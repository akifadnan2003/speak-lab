/**
 * Shared helpers for integration tests against a *local* Supabase stack (`supabase start`).
 * Nothing here ever points at the hosted project: the service key is read from the local CLI.
 */
import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface LocalStack {
  url: string
  anonKey: string
  serviceKey: string
  mailpitUrl: string
}

let cached: LocalStack | null = null

function fromEnv(): LocalStack | null {
  const url = process.env.SUPABASE_URL ?? process.env.API_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? process.env.PUBLISHABLE_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? process.env.SECRET_KEY
  const mailpitUrl = process.env.MAILPIT_URL ?? process.env.INBUCKET_URL ?? 'http://127.0.0.1:54324'
  if (url && anonKey && serviceKey) return { url, anonKey, serviceKey, mailpitUrl }
  return null
}

function fromCli(): LocalStack {
  const raw = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const json = JSON.parse(raw) as Record<string, string>
  const url = json['API_URL'] ?? json['api_url']
  const anonKey = json['ANON_KEY'] ?? json['PUBLISHABLE_KEY'] ?? json['anon_key']
  const serviceKey = json['SERVICE_ROLE_KEY'] ?? json['SECRET_KEY'] ?? json['service_role_key']
  const mailpitUrl = json['MAILPIT_URL'] ?? json['INBUCKET_URL'] ?? 'http://127.0.0.1:54324'
  if (!url || !anonKey || !serviceKey) throw new Error('supabase status did not return API_URL/ANON_KEY/SERVICE_ROLE_KEY')
  return { url, anonKey, serviceKey, mailpitUrl }
}

export function localStack(): LocalStack {
  if (cached) return cached
  cached = fromEnv() ?? fromCli()
  if (!/127\.0\.0\.1|localhost/.test(cached.url)) {
    throw new Error(`Refusing to run integration tests against a non-local Supabase URL: ${cached.url}`)
  }
  return cached
}

export function anonClient(): SupabaseClient {
  const s = localStack()
  return createClient(s.url, s.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export function adminClient(): SupabaseClient {
  const s = localStack()
  return createClient(s.url, s.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

/** A fresh client signed in as the given user (each client keeps its own session). */
export async function userClient(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return client
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@example.test`
}

/* ------------------------------------------------------------------------------------------ */
/* Mailpit (local email capture)                                                              */
/* ------------------------------------------------------------------------------------------ */

interface MailpitMessageSummary {
  ID: string
  To: { Address: string }[]
  Subject: string
}

async function mailpitSearch(to: string): Promise<MailpitMessageSummary[]> {
  const { mailpitUrl } = localStack()
  const res = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`)
  const json = (await res.json()) as { messages: MailpitMessageSummary[] }
  return json.messages ?? []
}

export async function mailpitMessageBody(id: string): Promise<{ html: string; text: string }> {
  const { mailpitUrl } = localStack()
  const res = await fetch(`${mailpitUrl}/api/v1/message/${id}`)
  if (!res.ok) throw new Error(`Mailpit message failed: ${res.status}`)
  const json = (await res.json()) as { HTML?: string; Text?: string }
  return { html: json.HTML ?? '', text: json.Text ?? '' }
}

export async function mailpitDelete(ids: string[]): Promise<void> {
  const { mailpitUrl } = localStack()
  await fetch(`${mailpitUrl}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  })
}

/** Waits for the newest email to `to` that is not in `seen`, returns its id and body. */
export async function waitForEmail(to: string, seen = new Set<string>(), timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const messages = await mailpitSearch(to)
    const fresh = messages.find((m) => !seen.has(m.ID))
    if (fresh) {
      const body = await mailpitMessageBody(fresh.ID)
      return { id: fresh.ID, subject: fresh.Subject, ...body }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No email arrived for ${to} within ${timeoutMs}ms`)
}

/** Extracts the SpeakLab link (`...?token_hash=...&type=...`) from an email body. */
export function extractAuthLink(html: string, text: string): URL {
  const unescaped = html.replace(/&amp;/g, '&')
  const match = unescaped.match(/https?:\/\/[^\s"'<>]+token_hash=[^\s"'<>]+/) ?? text.match(/https?:\/\/[^\s"'<>]+token_hash=[^\s"'<>]+/)
  if (!match) {
    // Local Mailpit only: these links carry throwaway tokens for the disposable test stack.
    const links = Array.from(unescaped.matchAll(/https?:\/\/[^\s"'<>]+/g), (m) => m[0])
    throw new Error(
      `No token_hash link found in email. The auth service probably used its built-in template ` +
        `instead of supabase/templates (check the Supabase CLI version). Links found: ${links.join(' | ') || 'none'}`,
    )
  }
  return new URL(match[0])
}

/* ------------------------------------------------------------------------------------------ */
/* Edge Function                                                                              */
/* ------------------------------------------------------------------------------------------ */

export async function callFunction(
  body: unknown,
  accessToken: string | null,
): Promise<{ status: number; json: { ok: boolean; data?: unknown; error?: { code: string; message: string } } }> {
  const { url, anonKey } = localStack()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: anonKey }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  const res = await fetch(`${url}/functions/v1/student-admin`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { status: res.status, json: (await res.json()) as never }
}

export async function accessTokenOf(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession()
  if (!data.session) throw new Error('client has no session')
  return data.session.access_token
}

/* ------------------------------------------------------------------------------------------ */
/* Scenario builders                                                                          */
/* ------------------------------------------------------------------------------------------ */

export const TUTOR_PASSWORD = 'Tutor-password-2026'
export const STUDENT_PASSWORD = 'Student-password-2026'

/** Creates (or reuses) the single tutor through the documented bootstrap path. */
export async function ensureTutor(admin: SupabaseClient): Promise<{ id: string; email: string }> {
  const existing = await admin.from('profiles').select('id, email').eq('role', 'tutor').maybeSingle()
  if (existing.data) {
    // Make sure the password is the one tests expect.
    await admin.auth.admin.updateUserById(existing.data.id as string, { password: TUTOR_PASSWORD, ban_duration: 'none' })
    return { id: existing.data.id as string, email: existing.data.email as string }
  }
  const email = uniqueEmail('tutor')
  const created = await admin.auth.admin.createUser({
    email,
    password: TUTOR_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Test Tutor' },
  })
  if (created.error || !created.data.user) throw new Error(`createUser failed: ${created.error?.message}`)
  const boot = await admin.rpc('bootstrap_owner', { p_user_id: created.data.user.id })
  if (boot.error) throw new Error(`bootstrap_owner failed: ${boot.error.message}`)
  return { id: created.data.user.id, email }
}

/** Full invitation flow: Edge Function → Mailpit email → verifyOtp → password. Returns a signed-in client. */
export async function inviteAndAccept(
  tutorToken: string,
  email: string,
  fullName: string,
  redirectTo = 'http://localhost:4173/speak-lab/',
): Promise<{ client: SupabaseClient; userId: string; invitationId: string }> {
  const invited = await callFunction({ action: 'invite', email, fullName, redirectTo }, tutorToken)
  if (!invited.json.ok) throw new Error(`invite failed: ${JSON.stringify(invited.json)}`)
  const invitationId = (invited.json.data as { id: string }).id

  const mail = await waitForEmail(email)
  const link = extractAuthLink(mail.html, mail.text)
  const tokenHash = link.searchParams.get('token_hash')
  const type = link.searchParams.get('type')
  if (!tokenHash || type !== 'invite') throw new Error(`unexpected invite link: ${link.href}`)
  if (!link.href.startsWith(redirectTo)) throw new Error(`invite link does not target the app URL: ${link.href}`)

  const client = anonClient()
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
  if (verified.error || !verified.data.session) throw new Error(`verifyOtp failed: ${verified.error?.message}`)
  const updated = await client.auth.updateUser({ password: STUDENT_PASSWORD })
  if (updated.error) throw new Error(`updateUser failed: ${updated.error.message}`)
  await mailpitDelete([mail.id])
  return { client, userId: verified.data.session.user.id, invitationId }
}
