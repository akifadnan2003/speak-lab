/**
 * SpeakLab · Edge Function `student-admin`
 *
 * Privileged student-account operations for the tutor. The browser never holds the secret key:
 * it calls this function with the caller's session JWT, the function verifies the caller with
 * the Auth server, checks in the database that the caller is the active tutor, and only then
 * uses the service-role client.
 *
 * Actions (JSON body `{ action, ... }`):
 *   invite      { email, fullName, redirectTo? }     → sends the Supabase invitation email
 *   resend      { invitationId, redirectTo? }        → re-sends a pending/expired invitation
 *   revoke      { invitationId }                     → deletes the unconfirmed auth user, marks revoked
 *   set_status  { studentId, status }                → disable/reactivate + ban/unban in Auth
 *
 * Every response is `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { z } from 'npm:zod@4.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SECRET_KEY = readSecretKey()
const INVITE_TTL_SECONDS = Number(Deno.env.get('SPEAKLAB_INVITE_TTL_SECONDS') ?? '3600')
const ALLOWED_APP_URLS = (
  Deno.env.get('SPEAKLAB_ALLOWED_APP_URLS') ??
  // Custom domain first; the old project-site URL stays during the migration (it redirects to the
  // custom domain) and is removed once no email link to it can still be valid.
  'https://speaklab.akiflabs.net/,https://akifadnan2003.github.io/speak-lab/,http://localhost:4173/,http://localhost:5173/,http://127.0.0.1:4173/'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function readSecretKey(): string {
  // New-style projects inject SUPABASE_SECRET_KEYS (JSON dictionary); legacy projects inject
  // SUPABASE_SERVICE_ROLE_KEY. Support both without ever exposing either.
  const json = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, string>
      const first = parsed['default'] ?? Object.values(parsed)[0]
      if (first) return first
    } catch {
      /* fall through */
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address'))

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('invite'),
    email: emailSchema,
    fullName: z.string().trim().min(2, 'Enter the student name').max(120),
    redirectTo: z.url().optional(),
  }),
  z.object({ action: z.literal('resend'), invitationId: z.uuid(), redirectTo: z.url().optional() }),
  z.object({ action: z.literal('revoke'), invitationId: z.uuid() }),
  z.object({
    action: z.literal('set_status'),
    studentId: z.uuid(),
    status: z.enum(['active', 'disabled']),
  }),
])
type Body = z.infer<typeof bodySchema>

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fail(status: number, code: string, message: string): Response {
  return json(status, { ok: false, error: { code, message } })
}

function resolveRedirect(requested: string | undefined): string {
  if (requested && ALLOWED_APP_URLS.includes(requested)) return requested
  return ALLOWED_APP_URLS[0]!
}

async function authenticateTutor(req: Request, admin: SupabaseClient) {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw new HttpError(401, 'unauthenticated', 'Sign in to continue.')
  }
  const asCaller = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await asCaller.auth.getUser()
  if (error || !data.user) {
    throw new HttpError(401, 'unauthenticated', 'Your session is not valid. Sign in again.')
  }
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, status')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profileError) throw new HttpError(500, 'profile_lookup_failed', profileError.message)
  if (!profile || profile.role !== 'tutor' || profile.status !== 'active') {
    throw new HttpError(403, 'forbidden', 'Only the tutor can manage student accounts.')
  }
  return { id: data.user.id as string }
}

async function logEvent(
  admin: SupabaseClient,
  event: { user_id: string | null; actor_id: string; event_type: string; metadata?: Record<string, unknown> },
) {
  const { error } = await admin.from('account_events').insert({ ...event, metadata: event.metadata ?? {} })
  if (error) console.error('account_events insert failed', error.message)
}

async function sendInvite(
  admin: SupabaseClient,
  email: string,
  fullName: string,
  redirectTo: string,
): Promise<{ userId: string }> {
  const metadata = { full_name: fullName, support_language: 'az', preferred_language: 'en' }
  const first = await admin.auth.admin.inviteUserByEmail(email, { data: metadata, redirectTo })
  if (!first.error && first.data.user) return { userId: first.data.user.id }

  const code = (first.error as { code?: string } | null)?.code
  if (code === 'email_exists' || /already been registered/i.test(first.error?.message ?? '')) {
    // An unconfirmed user from an earlier invitation. Replace it with a fresh invite.
    const existing = await findAuthUserByEmail(admin, email)
    if (existing && !existing.email_confirmed_at) {
      const del = await admin.auth.admin.deleteUser(existing.id)
      if (del.error) throw new HttpError(500, 'invite_failed', del.error.message)
      const second = await admin.auth.admin.inviteUserByEmail(email, { data: metadata, redirectTo })
      if (second.error || !second.data.user) {
        throw new HttpError(502, 'invite_failed', second.error?.message ?? 'Invitation could not be sent.')
      }
      return { userId: second.data.user.id }
    }
    throw new HttpError(409, 'already_registered', 'This email already has an active SpeakLab account.')
  }
  if (first.error?.status === 429) {
    throw new HttpError(429, 'rate_limited', 'Too many emails were sent recently. Try again in a few minutes.')
  }
  throw new HttpError(502, 'invite_failed', first.error?.message ?? 'Invitation could not be sent.')
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  // The admin API has no direct lookup by email; the profile row carries the id when it exists.
  const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (profile?.id) {
    const { data } = await admin.auth.admin.getUserById(profile.id as string)
    if (data.user) return data.user
  }
  const { data: invitation } = await admin
    .from('invitations')
    .select('user_id')
    .eq('email', email)
    .not('user_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (invitation?.user_id) {
    const { data } = await admin.auth.admin.getUserById(invitation.user_id as string)
    if (data.user) return data.user
  }
  const { data: page } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return page?.users.find((u) => (u.email ?? '').toLowerCase() === email) ?? null
}

function expiresAt(): string {
  return new Date(Date.now() + INVITE_TTL_SECONDS * 1000).toISOString()
}

async function handle(body: Body, tutorId: string, admin: SupabaseClient) {
  switch (body.action) {
    case 'invite': {
      const email = body.email
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id, status, role')
        .eq('email', email)
        .maybeSingle()
      if (existingProfile && existingProfile.status !== 'invited') {
        throw new HttpError(409, 'already_registered', 'This email already has a SpeakLab account.')
      }
      const { data: pending } = await admin
        .from('invitations')
        .select('id')
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle()
      if (pending) {
        throw new HttpError(409, 'already_invited', 'This email already has a pending invitation. Use Resend instead.')
      }
      const redirectTo = resolveRedirect(body.redirectTo)
      const { userId } = await sendInvite(admin, email, body.fullName, redirectTo)
      const { data: invitation, error } = await admin
        .from('invitations')
        .insert({
          email,
          full_name: body.fullName,
          user_id: userId,
          invited_by: tutorId,
          status: 'pending',
          sent_at: new Date().toISOString(),
          expires_at: expiresAt(),
        })
        .select('id, email, full_name, status, sent_at, expires_at, resend_count')
        .single()
      if (error) throw new HttpError(500, 'invitation_record_failed', error.message)
      await logEvent(admin, {
        user_id: userId,
        actor_id: tutorId,
        event_type: 'invitation_sent',
        metadata: { invitation_id: invitation.id, email },
      })
      return invitation
    }

    case 'resend': {
      const { data: invitation } = await admin
        .from('invitations')
        .select('id, email, full_name, status, user_id, resend_count')
        .eq('id', body.invitationId)
        .eq('invited_by', tutorId)
        .maybeSingle()
      if (!invitation) throw new HttpError(404, 'not_found', 'Invitation not found.')
      if (invitation.status === 'accepted') {
        throw new HttpError(409, 'already_accepted', 'This invitation was already accepted.')
      }
      if (invitation.status === 'revoked') {
        throw new HttpError(409, 'revoked', 'This invitation was revoked. Send a new invitation instead.')
      }
      const redirectTo = resolveRedirect(body.redirectTo)
      const { userId } = await sendInvite(admin, invitation.email as string, invitation.full_name as string, redirectTo)
      const { data: updated, error } = await admin
        .from('invitations')
        .update({
          user_id: userId,
          status: 'pending',
          sent_at: new Date().toISOString(),
          expires_at: expiresAt(),
          resend_count: ((invitation.resend_count as number) ?? 0) + 1,
          last_error: null,
        })
        .eq('id', invitation.id)
        .select('id, email, full_name, status, sent_at, expires_at, resend_count')
        .single()
      if (error) throw new HttpError(500, 'invitation_record_failed', error.message)
      await logEvent(admin, {
        user_id: userId,
        actor_id: tutorId,
        event_type: 'invitation_resent',
        metadata: { invitation_id: invitation.id },
      })
      return updated
    }

    case 'revoke': {
      const { data: invitation } = await admin
        .from('invitations')
        .select('id, email, status, user_id')
        .eq('id', body.invitationId)
        .eq('invited_by', tutorId)
        .maybeSingle()
      if (!invitation) throw new HttpError(404, 'not_found', 'Invitation not found.')
      if (invitation.status === 'accepted') {
        throw new HttpError(409, 'already_accepted', 'Accepted invitations cannot be revoked. Disable the student instead.')
      }
      if (invitation.user_id) {
        const { data } = await admin.auth.admin.getUserById(invitation.user_id as string)
        if (data.user && !data.user.email_confirmed_at) {
          const del = await admin.auth.admin.deleteUser(data.user.id)
          if (del.error) throw new HttpError(500, 'revoke_failed', del.error.message)
        }
      }
      const { data: updated, error } = await admin
        .from('invitations')
        .update({ status: 'revoked', revoked_at: new Date().toISOString(), user_id: null })
        .eq('id', invitation.id)
        .select('id, email, status, revoked_at')
        .single()
      if (error) throw new HttpError(500, 'invitation_record_failed', error.message)
      await logEvent(admin, {
        user_id: null,
        actor_id: tutorId,
        event_type: 'invitation_revoked',
        metadata: { invitation_id: invitation.id, email: invitation.email },
      })
      return updated
    }

    case 'set_status': {
      const { data: link } = await admin
        .from('tutor_students')
        .select('student_id')
        .eq('tutor_id', tutorId)
        .eq('student_id', body.studentId)
        .maybeSingle()
      if (!link) throw new HttpError(404, 'not_found', 'This student is not linked to you.')
      const { data: profile } = await admin
        .from('profiles')
        .select('id, role, status')
        .eq('id', body.studentId)
        .maybeSingle()
      if (!profile || profile.role !== 'student') {
        throw new HttpError(404, 'not_found', 'Student profile not found.')
      }
      const disable = body.status === 'disabled'
      // Ban first so a failure here never leaves an active profile with a banned auth user.
      const ban = await admin.auth.admin.updateUserById(body.studentId, {
        ban_duration: disable ? '876600h' : 'none',
      })
      if (ban.error) throw new HttpError(502, 'status_change_failed', ban.error.message)
      const { data: updated, error } = await admin
        .from('profiles')
        .update({ status: body.status })
        .eq('id', body.studentId)
        .select('id, status')
        .single()
      if (error) throw new HttpError(500, 'status_change_failed', error.message)
      await logEvent(admin, {
        user_id: body.studentId,
        actor_id: tutorId,
        event_type: disable ? 'account_disabled' : 'account_reactivated',
      })
      return updated
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')
  if (!SUPABASE_URL || !PUBLIC_KEY || !SECRET_KEY) {
    return fail(500, 'misconfigured', 'Function secrets are not configured.')
  }

  const admin = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  try {
    const tutor = await authenticateTutor(req, admin)
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      throw new HttpError(400, 'invalid_json', 'Request body must be JSON.')
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new HttpError(400, 'invalid_input', issue?.message ?? 'Invalid request.')
    }
    const data = await handle(parsed.data, tutor.id, admin)
    return json(200, { ok: true, data })
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.code, error.message)
    console.error('student-admin unexpected error', error)
    return fail(500, 'internal', 'Something went wrong. Try again.')
  }
})
