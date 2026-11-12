/**
 * Authorization and lifecycle tests against a real local Supabase stack.
 *
 * These are not mocks: Postgres policies, triggers, GoTrue and the `student-admin` Edge Function
 * all run in Docker (`supabase start`). Run with `npm run test:db` after the stack is up.
 *
 * Scenario numbers refer to the M2 testing requirements in docs/TESTING.md.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  accessTokenOf,
  adminClient,
  anonClient,
  callFunction,
  ensureTutor,
  extractAuthLink,
  inviteAndAccept,
  STUDENT_PASSWORD,
  TUTOR_PASSWORD,
  uniqueEmail,
  userClient,
  waitForEmail,
} from './helpers.ts'

const admin = adminClient()
let tutor: { id: string; email: string }
let tutorClient: SupabaseClient
let tutorToken: string
let studentA: { client: SupabaseClient; userId: string; invitationId: string; email: string }
let studentB: { client: SupabaseClient; userId: string; email: string }
const createdUserIds: string[] = []

beforeAll(async () => {
  tutor = await ensureTutor(admin)
  tutorClient = await userClient(tutor.email, TUTOR_PASSWORD)
  tutorToken = await accessTokenOf(tutorClient)

  // Student A: the real invitation path (function → email → verifyOtp → password).
  const emailA = uniqueEmail('student-a')
  const accepted = await inviteAndAccept(tutorToken, emailA, 'Aysel Test')
  studentA = { ...accepted, email: emailA }
  createdUserIds.push(accepted.userId)

  // Student B: a second linked student, created directly so cross-student checks have a target.
  const emailB = uniqueEmail('student-b')
  const created = await admin.auth.admin.createUser({
    email: emailB,
    password: STUDENT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Rashad Test' },
  })
  if (created.error || !created.data.user) throw new Error(created.error?.message)
  createdUserIds.push(created.data.user.id)
  const link = await admin.from('tutor_students').insert({ tutor_id: tutor.id, student_id: created.data.user.id })
  if (link.error) throw new Error(link.error.message)
  studentB = { client: await userClient(emailB, STUDENT_PASSWORD), userId: created.data.user.id, email: emailB }
}, 120_000)

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id)
})

describe('9 · invitation acceptance (real email link)', () => {
  it('activates the profile, links the student to the tutor and records the lifecycle', async () => {
    const profile = await admin.from('profiles').select('*').eq('id', studentA.userId).single()
    expect(profile.data).toMatchObject({ role: 'student', status: 'active', email: studentA.email, full_name: 'Aysel Test', support_language: 'az', preferred_language: 'en' })

    const link = await admin.from('tutor_students').select('*').eq('student_id', studentA.userId).single()
    expect(link.data?.tutor_id).toBe(tutor.id)

    const invitation = await admin.from('invitations').select('*').eq('id', studentA.invitationId).single()
    expect(invitation.data?.status).toBe('accepted')
    expect(invitation.data?.accepted_at).toBeTruthy()

    const events = await admin.from('account_events').select('event_type').eq('user_id', studentA.userId)
    const types = (events.data ?? []).map((e: { event_type: string }) => e.event_type)
    expect(types).toEqual(expect.arrayContaining(['invitation_sent', 'account_created', 'invitation_accepted']))
  })
})

describe('1 · unauthenticated visitors', () => {
  it('cannot read any protected table', async () => {
    const anon = anonClient()
    for (const table of ['profiles', 'tutor_students', 'invitations', 'account_events']) {
      const res = await anon.from(table).select('*')
      expect(res.error !== null || (res.data ?? []).length === 0, `${table} leaked rows to anon`).toBe(true)
    }
  })

  it('cannot call the owner bootstrap', async () => {
    const res = await anonClient().rpc('bootstrap_owner', { p_user_id: studentA.userId })
    expect(res.error).not.toBeNull()
  })
})

describe('8 · public registration', () => {
  it('is rejected by the Auth server', async () => {
    const { data, error } = await anonClient().auth.signUp({ email: uniqueEmail('intruder'), password: 'Intruder-pass-123' })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('signup_disabled')
    expect(data.session).toBeNull()
  })

  it('does not allow anonymous sign-ins', async () => {
    const { error } = await anonClient().auth.signInAnonymously()
    expect(error).not.toBeNull()
  })
})

describe('2 + 3 · student isolation', () => {
  it('sees only their own profile', async () => {
    const all = await studentA.client.from('profiles').select('id')
    expect(all.error).toBeNull()
    expect((all.data ?? []).map((r) => r.id)).toEqual([studentA.userId])
    const other = await studentA.client.from('profiles').select('id').eq('id', studentB.userId)
    expect(other.data).toEqual([])
  })

  it('cannot read tutor-only invitations or other students’ events', async () => {
    const invitations = await studentA.client.from('invitations').select('*')
    expect(invitations.data ?? []).toEqual([])
    const events = await studentA.client.from('account_events').select('*').eq('user_id', studentB.userId)
    expect(events.data ?? []).toEqual([])
    const links = await studentA.client.from('tutor_students').select('student_id')
    expect((links.data ?? []).map((l) => l.student_id)).toEqual([studentA.userId])
  })
})

describe('4 · privilege escalation', () => {
  it('cannot change role, status or email on their own profile', async () => {
    for (const patch of [{ role: 'tutor' }, { status: 'disabled' }, { email: 'owner@example.test' }]) {
      const res = await studentA.client.from('profiles').update(patch).eq('id', studentA.userId)
      expect(res.error, `expected ${JSON.stringify(patch)} to be rejected`).not.toBeNull()
    }
    const after = await admin.from('profiles').select('role, status, email').eq('id', studentA.userId).single()
    expect(after.data).toMatchObject({ role: 'student', status: 'active', email: studentA.email })
  })

  it('cannot run the owner bootstrap for themselves', async () => {
    const res = await studentA.client.rpc('bootstrap_owner', { p_user_id: studentA.userId })
    expect(res.error).not.toBeNull()
  })

  it('a second tutor is impossible even for the service role', async () => {
    const res = await admin.rpc('bootstrap_owner', { p_user_id: studentA.userId })
    expect(res.error?.message).toMatch(/a tutor already exists/)
    const again = await admin.rpc('bootstrap_owner', { p_user_id: tutor.id })
    expect(again.error).toBeNull()
    expect(again.data).toBe('already-owner')
  })

  it('can update allowed preference columns', async () => {
    const res = await studentA.client
      .from('profiles')
      .update({ full_name: 'Aysel Updated', preferences: { feedbackStyle: 'detailed', dailySpeakingMinutes: 20 }, support_language: 'none' })
      .eq('id', studentA.userId)
    expect(res.error).toBeNull()
    const after = await admin.from('profiles').select('full_name, support_language').eq('id', studentA.userId).single()
    expect(after.data).toMatchObject({ full_name: 'Aysel Updated', support_language: 'none' })
  })
})

describe('5 · invitations are tutor-only', () => {
  it('rejects anonymous and student callers', async () => {
    const anon = await callFunction({ action: 'invite', email: uniqueEmail('x'), fullName: 'X Y' }, null)
    expect(anon.status).toBe(401)
    const student = await callFunction({ action: 'invite', email: uniqueEmail('x'), fullName: 'X Y' }, await accessTokenOf(studentA.client))
    expect(student.status).toBe(403)
    expect(student.json.error?.code).toBe('forbidden')
  })

  it('validates input and prevents duplicates', async () => {
    const bad = await callFunction({ action: 'invite', email: 'not-an-email', fullName: 'X Y' }, tutorToken)
    expect(bad.status).toBe(400)
    const dup = await callFunction({ action: 'invite', email: studentA.email, fullName: 'Aysel Again' }, tutorToken)
    expect(dup.status).toBe(409)
    expect(dup.json.error?.code).toBe('already_registered')
  })
})

describe('7 · the tutor', () => {
  it('reads linked students, invitations and events', async () => {
    const profiles = await tutorClient.from('profiles').select('id').in('id', [studentA.userId, studentB.userId])
    expect((profiles.data ?? []).map((p) => p.id).sort()).toEqual([studentA.userId, studentB.userId].sort())
    const invitations = await tutorClient.from('invitations').select('id').eq('id', studentA.invitationId)
    expect(invitations.data?.length).toBe(1)
    const events = await tutorClient.from('account_events').select('event_type').eq('user_id', studentA.userId)
    expect((events.data ?? []).length).toBeGreaterThan(0)
  })

  it('still cannot write privileged columns directly (must go through the function)', async () => {
    const res = await tutorClient.from('profiles').update({ status: 'disabled' }).eq('id', studentB.userId)
    expect(res.error).not.toBeNull()
  })
})

describe('13 · invalid, expired, resent and revoked invitations', () => {
  it('rejects an invalid token hash', async () => {
    const { error } = await anonClient().auth.verifyOtp({ token_hash: 'not-a-real-hash', type: 'invite' })
    expect(error).not.toBeNull()
  })

  it('resend sends a new email and revoke deletes the unconfirmed user', async () => {
    const email = uniqueEmail('pending')
    const invited = await callFunction({ action: 'invite', email, fullName: 'Pending Person' }, tutorToken)
    expect(invited.status).toBe(200)
    const id = (invited.json.data as { id: string }).id
    const first = await waitForEmail(email)
    const seen = new Set([first.id])

    const dup = await callFunction({ action: 'invite', email, fullName: 'Pending Person' }, tutorToken)
    expect(dup.json.error?.code).toBe('already_invited')

    const resent = await callFunction({ action: 'resend', invitationId: id }, tutorToken)
    expect(resent.status).toBe(200)
    expect((resent.json.data as { resend_count: number }).resend_count).toBe(1)
    const second = await waitForEmail(email, seen)
    const link = extractAuthLink(second.html, second.text)
    expect(link.searchParams.get('type')).toBe('invite')

    const revoked = await callFunction({ action: 'revoke', invitationId: id }, tutorToken)
    expect(revoked.status).toBe(200)
    const row = await admin.from('invitations').select('status, user_id').eq('id', id).single()
    expect(row.data?.status).toBe('revoked')
    // The link that was emailed no longer works because the unconfirmed user is gone.
    const verify = await anonClient().auth.verifyOtp({ token_hash: link.searchParams.get('token_hash')!, type: 'invite' })
    expect(verify.error).not.toBeNull()

    const resendRevoked = await callFunction({ action: 'resend', invitationId: id }, tutorToken)
    expect(resendRevoked.status).toBe(409)
  })
})

describe('10 · password reset (real email link)', () => {
  it('lets a student choose a new password via the recovery link', async () => {
    const seen = new Set<string>()
    const { error } = await anonClient().auth.resetPasswordForEmail(studentB.email, { redirectTo: 'http://localhost:4173/' })
    expect(error).toBeNull()
    const mail = await waitForEmail(studentB.email, seen)
    const link = extractAuthLink(mail.html, mail.text)
    expect(link.searchParams.get('type')).toBe('recovery')
    expect(link.href.startsWith('http://localhost:4173/?')).toBe(true)

    const client = anonClient()
    const verified = await client.auth.verifyOtp({ token_hash: link.searchParams.get('token_hash')!, type: 'recovery' })
    expect(verified.error).toBeNull()
    const newPassword = 'Brand-new-pass-2026'
    const updated = await client.auth.updateUser({ password: newPassword })
    expect(updated.error).toBeNull()

    const old = await anonClient().auth.signInWithPassword({ email: studentB.email, password: STUDENT_PASSWORD })
    expect(old.error?.code).toBe('invalid_credentials')
    const fresh = await anonClient().auth.signInWithPassword({ email: studentB.email, password: newPassword })
    expect(fresh.error).toBeNull()
    // restore for later tests
    await admin.auth.admin.updateUserById(studentB.userId, { password: STUDENT_PASSWORD })
  })
})

describe('11 + 12 · sessions, expiry and logout', () => {
  it('rejects an invalid refresh token', async () => {
    const { error } = await anonClient().auth.refreshSession({ refresh_token: 'definitely-not-valid' })
    expect(error).not.toBeNull()
  })

  it('logout revokes the refresh token and drops access', async () => {
    const client = await userClient(studentB.email, STUDENT_PASSWORD)
    const { data: before } = await client.auth.getSession()
    const refreshToken = before.session!.refresh_token
    expect((await client.from('profiles').select('id')).data?.length).toBe(1)

    const { error } = await client.auth.signOut()
    expect(error).toBeNull()
    const after = await client.from('profiles').select('id')
    expect(after.error !== null || (after.data ?? []).length === 0).toBe(true)

    const reuse = await anonClient().auth.refreshSession({ refresh_token: refreshToken })
    expect(reuse.error).not.toBeNull()
  })
})

describe('6 · disabled accounts', () => {
  it('lose access server-side even with a live session, and cannot sign in until reactivated', async () => {
    const live = await userClient(studentB.email, STUDENT_PASSWORD)
    expect((await live.from('tutor_students').select('student_id')).data?.length).toBe(1)

    const disabled = await callFunction({ action: 'set_status', studentId: studentB.userId, status: 'disabled' }, tutorToken)
    expect(disabled.status).toBe(200)

    // Existing session: policies now deny everything except the own profile row (so the UI can explain).
    expect((await live.from('tutor_students').select('student_id')).data ?? []).toEqual([])
    expect((await live.from('account_events').select('id')).data ?? []).toEqual([])
    const own = await live.from('profiles').select('status').eq('id', studentB.userId).single()
    expect(own.data?.status).toBe('disabled')

    // Refresh and sign-in are refused by the Auth server (user banned).
    const { data: current } = await live.auth.getSession()
    const refreshed = await anonClient().auth.refreshSession({ refresh_token: current.session!.refresh_token })
    expect(refreshed.error).not.toBeNull()
    const login = await anonClient().auth.signInWithPassword({ email: studentB.email, password: STUDENT_PASSWORD })
    expect(login.error).not.toBeNull()

    // A student cannot disable or reactivate anyone.
    const forbidden = await callFunction({ action: 'set_status', studentId: studentB.userId, status: 'active' }, await accessTokenOf(studentA.client))
    expect(forbidden.status).toBe(403)

    const reactivated = await callFunction({ action: 'set_status', studentId: studentB.userId, status: 'active' }, tutorToken)
    expect(reactivated.status).toBe(200)
    const back = await anonClient().auth.signInWithPassword({ email: studentB.email, password: STUDENT_PASSWORD })
    expect(back.error).toBeNull()

    const events = await admin.from('account_events').select('event_type').eq('user_id', studentB.userId)
    expect((events.data ?? []).map((e: { event_type: string }) => e.event_type)).toEqual(expect.arrayContaining(['account_disabled', 'account_reactivated']))
  })
})
