# SpeakLab — Security

Last updated for milestone M1 (2026-11-03). Enforcement arrives in M2; this document states the
model the code must satisfy and what exists today.

## 1. Threat model summary

Assets: student personal data, learning history, private recordings, tutor notes, AI provider
budget. Adversaries: an uninvited visitor, a student trying to see another student or elevate
privileges, a leaked anon key, a compromised client bundle, bot abuse of AI endpoints.

## 2. Principles

1. **Invitation only.** Public signups and anonymous sign-ins are disabled in the Supabase Auth
   settings (configuration, not UI). Accounts are created only by the `invite-student` Edge Function
   using `auth.admin.inviteUserByEmail` after verifying the caller is the tutor.
2. **One tutor.** `profiles.role = 'tutor'` is assigned by the owner bootstrap only. No endpoint can
   grant it. RLS and a trigger reject client-side changes to `role`, `status` and tutor links.
3. **Fail closed.** Unknown or missing session → login. Missing config → login with explanation.
   Disabled account → blocked at policy level and signed out.
4. **Least privilege keys.** Browser ships only the anon key; its power is bounded by RLS. Service
   role and AI keys live in Edge Function secrets.
5. **Validate everything.** Zod on the client and in every Edge Function.
6. **Audit the lifecycle.** Invitations, status changes and role bootstrap are recorded in
   `account_events` without storing secrets or tokens.

## 3. Owner bootstrap (M2)

Documented, repeatable, no hardcoded email as the sole check:

1. The owner signs in once with a Supabase-created user (dashboard invite or magic link).
2. A migration creates `profiles` and the `is_tutor()` helper, with no tutor rows.
3. A one-time `bootstrap-owner` Edge Function, protected by a deploy-time secret
   (`BOOTSTRAP_SECRET`) **and** the invariant "no tutor exists yet", promotes the caller's verified
   `auth.uid()` to `tutor`. The function is removed (or the secret rotated out) after use.
4. Alternative: a migration that inserts the tutor row for a specific, verified Auth user id
   supplied as a migration variable. Either way the authorization check is the Auth user id, not an
   email string.

## 4. Row Level Security (M2)

- Every student-scoped table: `ENABLE ROW LEVEL SECURITY`, no default grants.
- Student policies: `student_id = auth.uid() AND is_active(auth.uid())`.
- Tutor policies: `is_tutor() AND EXISTS (tutor_students link)`.
- Teacher-only tables: tutor policies only.
- `profiles`: users read their own row; tutor reads assigned students; updates limited to
  non-sensitive columns through a `BEFORE UPDATE` trigger that rejects changes to `role`, `status`,
  `tutor_id` unless the session is service role.
- Storage: recordings bucket is private; object paths are prefixed with the student id and
  policies mirror the table rules. Retention and deletion are student-initiated or tutor-initiated
  and logged.

## 5. Required authorization tests (M2)

Executed against a test database in CI with per-role JWTs:

- A student cannot read another student's progress.
- A student cannot access tutor-only data (notes, invitations, usage).
- A student cannot grant themselves tutor privileges (role update rejected).
- Unauthenticated visitors cannot read private information.
- Unauthorized users cannot create invitations.
- A disabled student cannot continue accessing protected resources.
- The authorized tutor can access their students' progress.

## 6. Authentication flow on GitHub Pages (M2)

- `flowType: 'pkce'`, `detectSessionInUrl: true`, storage key `speaklab.auth`.
- Site URL and Redirect URL: `https://akifadnan2003.github.io/speak-lab/`. Query parameters from
  Supabase (`?code=`) arrive before the hash and are consumed by supabase-js; the app then routes
  to `#/auth/callback` to finish (set password for invites, new password for recovery).
- Email templates use the provider defaults. Expiration is whatever Supabase enforces (configurable
  in the dashboard); the UI reports what the provider reports and does not invent policies.
- Sessions persist in `localStorage`; refresh tokens rotate; sign-out revokes.

## 7. AI endpoints (M7)

- Browser never calls providers directly. Edge Functions authenticate the caller, check role and
  `ai_quotas`, call the provider, store usage and cost in `ai_usage`.
- Rate limiting per user and per IP at the function level; daily minute/token caps configurable by
  the tutor.
- Prompts never include other students' data.

## 8. Client hardening

- No secrets in the bundle (`.env.example` lists public names only; `.env*` ignored).
- Service worker precaches only the app shell; `runtimeCaching` is empty so private data,
  recordings and API responses are never stored by the SW.
- Content is rendered through React (escaped); no `dangerouslySetInnerHTML`.
- Error boundary avoids leaking stack traces to the UI.
- Dependencies: `npm audit` is reviewed each milestone. Current advisories are confined to
  build-time transitive dependencies of `vite-plugin-pwa`/`workbox-build` (deepmerge, glob,
  minimatch) and do not ship to the browser.

## 9. Preview mode caveat (M1)

`VITE_UI_PREVIEW=true` creates a fake local session over demo data. It exposes no real data and
no backend, and it is removed from the deployment workflow in M2. It must never be enabled in a
build that has Supabase credentials.
