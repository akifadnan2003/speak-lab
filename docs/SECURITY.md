# SpeakLab — Security

Last updated for milestone M2 (2026-11-03). This document states the model and what is enforced
today. Operational steps live in `docs/SUPABASE_SETUP.md`.

## 1. Threat model summary

Assets: student personal data, learning history, private recordings (M7), tutor notes, AI
provider budget. Adversaries: an uninvited visitor, a student trying to see another student or
elevate privileges, a leaked publishable key, a compromised client bundle, bot abuse of AI
endpoints, a revoked student with a still-open session.

## 2. Principles and where they are enforced

| Principle | Enforcement |
| --- | --- |
| Invitation only | Supabase Auth: sign-ups and anonymous sign-ins disabled (verified against the hosted project). Accounts are created only by `auth.admin.inviteUserByEmail` inside the `student-admin` Edge Function after the caller is verified as the tutor. |
| Exactly one tutor | `profiles.role` is written only by `bootstrap_owner()` (service role / SQL editor) and never by clients. Partial unique index `profiles_single_tutor_idx` forbids a second tutor row for anyone. |
| No self-promotion | Column-level grants exclude `role`, `status`, `email`, `id` from client updates; a `BEFORE UPDATE` trigger rejects any such change arriving with a client JWT. `bootstrap_owner` is not executable by `anon`/`authenticated`. |
| Students see only their data | RLS on every table. `profiles`: own row, or tutor ↔ linked student. `tutor_students`: participants. `invitations`: tutor only. `account_events`: own rows or tutor for linked students. |
| Fail closed | No session → `/login`. Session without a readable profile → error screen with sign-out. Missing Supabase config → login only, sign-in disabled. Preview mode refused at build and runtime when Supabase is configured. |
| Least-privilege keys | Browser ships only the publishable key. The secret key exists only in Edge Function secrets injected by Supabase; the deploy workflow fails if a secret key is found in the bundle or in the public variable. |
| Validate everything | Zod on the client and in the Edge Function; database `CHECK` constraints; email normalised to lowercase. |
| Audit the lifecycle | `account_events`: account created, invitation sent/resent/revoked/accepted, disabled/reactivated, owner bootstrapped. No tokens or secrets are stored. |
| Revocation is server-side | Disable = `status = 'disabled'` + Auth ban. RLS denies immediately; refresh and sign-in are refused. Not merely a local sign-out. |
| Assessments are graded server-side | `assessment_attempts` is written only by the `assessment` Edge Function (service role); clients have SELECT. The function verifies the caller, recomputes the chapter gate from the database, grades raw answers with the shared engine copy, enforces 3 attempts per chapter version and a 2 h attempt expiry, and discloses correct answers only after a pass or on the last attempt. Chapter completion requires a passed attempt, so no client write completes a chapter. Real builds ship a generated curriculum with assessment answer keys removed (`npm run sync:content`); the full content exists only in preview builds and in the function's copy. |
| The vocabulary schedule is server-owned | Clients have SELECT only on the four vocabulary tables. Answers are submitted through `record_vocabulary_reviews` (`security definer`, student from `auth.uid()`, active students only), which derives quality and runs the SQL scheduler; `reset_vocabulary_progress` is the only other write. Client-sent schedule fields and student ids are ignored, and a queue written under another account is refused (`p_expected_student`). Vocabulary is formative practice and never feeds an assessment (`assessment-isolation.test.ts`). |
| Queued work is never lost silently | Answers recorded offline stay in a per-account outbox and are shown as "not reached your account yet". Sign-out warns about them and offers an explicit sync first; the flush only sends the signed-in account's queue and the device purge still runs afterwards (ADR-019). |
| Nothing of a student stays on a shared device | `src/lib/local-data.ts`: sign-out, the SIGNED_OUT event and a change of the active user id purge every `speaklab.*` storage key except the theme and the auth session, run registered feature cleaners (M3 registers `clearStoredProgress`), delete `speaklab*` IndexedDB databases and clear the TanStack Query cache. The profile query of a new user waits for this purge. |

## 3. Authorization rules (as implemented in `supabase/migrations/20261103120000_identity_and_access.sql`)

Helper functions (`SECURITY DEFINER`, `STABLE`, `search_path = ''`, executable by
`authenticated`/`service_role` only): `is_tutor()`, `is_active()`, `current_account_status()`,
`request_is_client()`.

| Table | SELECT | UPDATE | INSERT / DELETE |
| --- | --- | --- | --- |
| `profiles` | own row (any status); tutor → students linked in `tutor_students` | own row when active; only `full_name`, `preferred_language`, `support_language`, `preferences`, `onboarding_completed_at` | never from clients |
| `tutor_students` | active participants (tutor or the student) | never | never (trigger on invitation acceptance) |
| `invitations` | active tutor, own invitations | never | never (Edge Function with service role) |
| `account_events` | active user: own rows; tutor: linked students and invitees | never | never (triggers / function) |
| `lesson_progress` (M3) | own rows; tutor → linked students | own rows when active | INSERT own rows when active; never DELETE |
| `exercise_attempts` (M3) | own rows; tutor → linked students | never | INSERT own rows when active (client id = idempotency key) |
| `chapter_access_overrides` (M3) | own rows; tutor → linked students | never | tutor INSERT/DELETE for linked students only (audited) |
| `assessment_attempts` (M3) | own rows; tutor → linked students | never | never from clients (Edge Function `assessment` with service role) |
| `vocabulary_items` (M4) | active users | never | never from clients (generated seed migration) |
| `student_vocabulary` (M4) | own rows; tutor → linked students | never | never from clients (`record_vocabulary_reviews` / `reset_vocabulary_progress`, `security definer`) |
| `vocabulary_reviews` (M4) | own rows; tutor → linked students | never | never from clients (same functions; reviews are voided, never deleted) |
| `vocabulary_student_meta` (M4) | own rows; tutor → linked students | never | never from clients |

`bootstrap_owner(uuid)`: refuses client callers, requires an existing **confirmed** Auth user,
returns `already-owner` for the existing tutor, raises for any other id when a tutor exists.
`complete_onboarding()`: `SECURITY INVOKER`, sets the timestamp once for `auth.uid()`.

Triggers on `auth.users` (owned by `postgres`, `SECURITY DEFINER`, locked `search_path`): create
the profile on insert (status `invited`, or `active` if created pre-confirmed); on first email
confirmation set `active`, mark the invitation accepted, create the `tutor_students` link, log the
event; keep `profiles.email` in sync.

## 4. Edge Function `student-admin`

- `verify_jwt = false` at the gateway; the function authenticates the caller itself with
  `auth.getUser()` (validated by the Auth server) and then checks the tutor role **in the
  database** with the service client. Client-supplied role claims, metadata or emails are never
  used for authorization.
- Actions: `invite`, `resend`, `revoke`, `set_status`. Input validated with Zod; errors are
  returned as `{ ok: false, error: { code, message } }` with meaningful messages and no stack
  traces.
- `redirectTo` is accepted only from an allow-list (`SPEAKLAB_ALLOWED_APP_URLS`); Supabase applies
  its own redirect allow-list on top.
- Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` /
  `SUPABASE_SECRET_KEYS` are injected by the platform. Nothing is read from the request.

## 4b. Edge Function `assessment` (M3)

Same verification as `student-admin` (bearer JWT → `auth.getUser()` → active profile in the
database). `start` and `submit` require the student role; `reset` requires the tutor and a
`tutor_students` link. The chapter gate is recomputed from `lesson_progress`,
`chapter_access_overrides` and submitted `assessment_attempts` with the same `computeProgression`
the app uses, so a locked check cannot be started by URL. Answers are validated with the shared
Zod `AnswerSchema`; unknown or mistyped answers grade as empty. Stored `results` never contain the
answer key. Every submission and reset is logged in `account_events`.

## 5. Authentication flow on GitHub Pages (custom domain `speaklab.akiflabs.net`)

- Email templates link straight to the app with `token_hash` (ADR-009). `captureAuthRedirect()`
  runs before React mounts, keeps the material in memory, and rewrites the address bar to
  `#/auth/callback?flow=invite|recovery`, so tokens never stay in history, bookmarks or logs.
- Supported inputs: `?token_hash&type` (templates), `?code` (PKCE) and provider errors. Raw
  implicit-grant tokens in the fragment are **rejected** (a crafted link could otherwise sign a
  victim into an attacker's session). Processing happens in `AuthProvider` with `verifyOtp` or
  `exchangeCodeForSession`; `detectSessionInUrl` is off so supabase-js never consumes fragments
  either.
- Sessions persist in `localStorage` (`speaklab.auth`), refresh tokens rotate; `signOut()` uses the
  global scope (server-side revocation) and falls back to local sign-out when offline.
- The own profile is re-read every 60 s and on focus so a disabled account is surfaced quickly;
  RLS already blocks data access regardless.

## 6. Known limitations (M2)

1. **Access-token window.** A JWT already issued before a disable or sign-out stays
   cryptographically valid until it expires (default 1 h). It cannot read data (RLS checks
   `profiles.status`) and cannot be refreshed, but it still authenticates to the Auth server for
   that window. Mitigation: shorter JWT expiry in the dashboard (recommended 600 s).
2. **Email deliverability** uses Supabase's built-in sender with its rate limits. Custom SMTP is
   recommended before inviting more than a handful of students.
3. **No MFA** for the tutor account yet. Recommended for M9 (TOTP via Supabase MFA).
4. **CORS** on the Edge Function is `*`; authentication is bearer-token based, not cookie based, so
   this does not enable cross-site request forgery.
5. **Recovery before onboarding.** A student who abandons onboarding after verifying the invitation
   has a session but no password; they can still use *Forgot password*. Onboarding resumes on the
   next visit.
6. **Practice progress is self-reported.** `lesson_progress` and `exercise_attempts` for practice
   lessons are written by the learner's own client. They unlock the chapter check, nothing more:
   chapter completion and everything downstream depend on the server-graded attempt.
7. **Some answer keys are inherent to the exercise.** Sentence-ordering tokens and matching pairs
   are the answer, presented shuffled; speaking prompts are self-checked. Multiple choice, blanks,
   corrections, transformations and writing checklists have their keys removed from the generated
   client curriculum (real builds never import the full content module; the preview build does).
   A determined learner could still read the two inherent kinds from the page.
8. **Attempt expiry is wall-clock based** (2 h). The function voids an expired open attempt on the
   next start; it does not count against the three attempts.
9. **Vocabulary `correct` is decided in the browser.** The server derives quality and the schedule
   from the submitted flags, so a modified client could submit unearned "correct" answers for its
   own account. Acceptable for formative self-practice: the tutor sees every answer with server
   receive times, and vocabulary progress never counts towards an assessment (ADR-018).
10. **Discarding queued answers is possible.** A learner who chooses *Sign out and discard* (or
    whose device is purged by a different account signing in) loses answers that never reached the
    server. The pending-sync badge and the sign-out dialog make this explicit (ADR-019).

## 7. AI endpoints (M7)

- Browser never calls providers directly. Edge Functions authenticate the caller, check role and
  `ai_quotas`, call the provider, store usage and cost in `ai_usage`.
- Rate limiting per user and per IP at the function level; daily caps configurable by the tutor.
- Prompts never include other students' data.

## 8. Client hardening

- No secrets in the bundle (`.env.example` lists public names only; `.env*` ignored; deploy
  workflow greps the bundle for `sb_secret_`).
- Service worker precaches only the app shell; `runtimeCaching` is empty so private data is never
  stored by the SW. Auth tokens live in `localStorage`, not in the SW cache.
- Content is rendered through React (escaped); no `dangerouslySetInnerHTML`.
- Error boundary avoids leaking stack traces; auth errors are mapped to neutral messages.
- Dependencies: `npm audit` reviewed each milestone. Remaining advisories are confined to
  build-time transitive dependencies of `vite-plugin-pwa`/`workbox-build` and do not ship.

## 9. Preview mode

`VITE_UI_PREVIEW=true` creates a fake local session over labelled demo data. It is refused by
`config/env.ts` whenever Supabase is configured and the build throws if both are set. It is used
only by the shell e2e suite and local reviews, never by the deploy workflow.
