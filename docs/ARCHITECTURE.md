# SpeakLab — Architecture

Last updated for milestone M2 (2026-11-03).

## 1. Overview

```
┌──────────────────────────────┐        ┌──────────────────────────────────────┐
│  Browser (PWA, GitHub Pages) │        │  Supabase project (dedicated)        │
│  React 19 + Vite 8           │  HTTPS │  Auth (invite-only, PKCE)            │
│  Hash router, Tailwind 4     │ ─────▶ │  Postgres + Row Level Security       │
│  TanStack Query cache        │        │  Storage (private recordings)        │
│  supabase-js (anon key only) │        │  Edge Functions (service role, AI)   │
└──────────────────────────────┘        └──────────────┬───────────────────────┘
                                                       │ server-side only
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │ AI providers (replaceable)   │
                                        │ LLM · STT · TTS              │
                                        └──────────────────────────────┘
```

The frontend is fully static. Anything privileged (inviting users, changing roles or account
status, calling AI providers, enforcing quotas) runs in Supabase Edge Functions that verify the
caller's JWT and role before using the service-role key.

## 2. Frontend structure

| Path | Responsibility |
| --- | --- |
| `src/main.tsx` | Captures auth material from email links (`captureAuthRedirect`) **before** mounting `<App>`. |
| `src/app/App.tsx` | Providers: error boundary, QueryClient, Theme, Auth, Tooltip, Router, SW update prompt. |
| `src/app/router.tsx` | Hash router. Public auth routes; `RequireAuth` → `AppShell` → role-scoped routes. Feature pages are lazy. |
| `src/app/RoleHome.tsx` | `/` sends tutors to `/tutor`, students to the dashboard. |
| `src/app/pwa.ts` | Install-prompt hook (Chromium/Android); iOS falls back to instructions. |
| `src/config/env.ts` | Zod-validated `import.meta.env`. Exposes `supabaseConfigured`, `uiPreview` (refused when configured), `basePath`. |
| `src/lib/supabase/client.ts` | Lazy `createClient` with the publishable key, PKCE, persisted session, `detectSessionInUrl: false`. Returns `null` when unconfigured. `database.types.ts` holds the row shapes the client may see. |
| `src/features/auth/` | `auth-url.ts` (link capture/scrub), `AuthProvider` (session listener + profile query), `guards.tsx` (`RequireAuth`, `RequireOnboarded`, `RequireRole`, `RedirectIfAuthenticated`), `profile.ts`, `profile-mutations.ts`, `auth-errors.ts`, screens: login, forgot password, callback, welcome (onboarding), reset password, account disabled. |
| `src/lib/local-data.ts` | Registry and purge of student-local data (storage keys, IndexedDB, feature cleaners). Used by the auth provider on sign-out, SIGNED_OUT and account switch. |
| `src/features/tutor/api.ts` | Queries for students / invitations / events and the `student-admin` function call (`callStudentAdmin`). Demo fixtures only in preview mode. |
| `src/features/*` | One folder per product area; pages import demo data today and queries tomorrow. |
| `src/features/curriculum/` | Zod `schema/` (chapter, lesson, blocks, exercises, answers), `content/` (A0–C1 map + authored chapters, validated at import), `ports.ts` (`ContentSource`, `ProgressRepository`), `persistence/` (memory, localStorage), `progression.ts` (pure unlock/completion rules), `CurriculumProvider.tsx` (DI + TanStack Query hooks), `az-help.tsx` (Azerbaijani layer). |
| `src/features/exercises/` | `engine/` (pure: `grade.ts`, `normalize.ts`, `session.ts` reducer, `shuffle.ts`), `components/` (one component per exercise type, `ExerciseRenderer`, `ExerciseRunner`, `ExerciseFeedback`). |
| `src/features/vocabulary/` | `schema.ts` (entries, bank validation, `termForms`), `content/` (A0–A2 bank), `srs/` (SM-2-style `scheduler.ts`, `time.ts`), `revision/queue.ts`, `stats.ts`, `modes/` (registry + exercise builders), `components/` (Flashcard, ActiveRecall, VocabularySession, TranslationReveal), `ports.ts`, `persistence/` (device repository, `api.ts` + `outbox.ts` + `cloud.ts` cloud repository with offline queue, `cleanup.ts`), `cloud-import.ts` (consented device-to-account upload), `components/PendingSyncBadge`, `VocabularyProvider.tsx`, dashboard and practice pages. |
| `src/features/learn/`, `src/features/lesson/` | Learn (levels + chapters), Chapter (lessons, objectives, completion rules), Lesson workspace (content blocks + runner, persistence wiring). |
| `src/components/ui/` | Accessible primitives (Radix + cva): button, card, badge, input, label, dialog, sheet, tabs, progress (+ ring), switch, avatar, skeleton, tooltip, dropdown-menu, select, separator, empty-state, page-header, stat. |
| `src/components/layout/` | `AppShell`, `DesktopSidebar` / `SidebarNav`, `BottomNav`, `TopBar`, `AuthLayout`, `Brand`, `nav.ts`. |
| `src/components/theme/` | Zustand theme store, provider, toggle. |
| `src/components/feedback/` | Loader, preview banner, demo notice, error boundary, SW update prompt. |
| `src/demo/` | M1 demonstration fixtures. Deleted as real data arrives. |

### Auth state machine

```
loading ──▶ unauthenticated { reason: 'unconfigured' | 'no-session' }
        ├─▶ error { message }                      (session exists, profile unreadable → fail closed)
        └─▶ authenticated { user: AuthUser, preview }
flow: null | processing | complete | error          (email link being turned into a session)
```

`SupabaseAuthProvider` subscribes to `onAuthStateChange`, processes a captured email link
(`verifyOtp` for `token_hash`, `exchangeCodeForSession` for PKCE codes, `setSession` for implicit
fragments), and reads the caller's `profiles` row with TanStack Query (refetched every 60 s and on
focus so a disabled account is noticed). `AuthUser` carries id, email, name, role, status,
support language, preferences and `onboardingCompletedAt`.

Guards: `RequireAuth` (→ `/login`; disabled → `/account-disabled`; error → error screen),
`RequireOnboarded` (student without completed onboarding → `/welcome`), `RequireRole` (→ own
home), `RedirectIfAuthenticated`.

Email-link routing: `/auth/callback?flow=…` reflects the flow state and then sends invitations to
`/welcome` (password + preferences → `complete_onboarding()` → `/`), recovery to
`/reset-password`, anything else home. See ADR-009.

### Preview mode

`VITE_UI_PREVIEW=true` with **no** Supabase configuration creates a fake local session
(`src/demo/preview-users.ts`) and shows a persistent banner with a Student/Tutor switch. It is used
by the shell e2e suite and local reviews only; `config/env.ts` and `vite.config.ts` refuse it when
Supabase is configured (ADR-012).

### Data fetching

TanStack Query with query keys namespaced by feature (`['auth','profile', id]`,
`['tutor','students', tutorId]`). Mutations go through `supabase-js` for RLS-protected tables
(own profile) or `supabase.functions.invoke('student-admin')` for privileged actions; mutations
invalidate the relevant keys. Offline exercise submissions (M8+) will queue in IndexedDB with client-generated
idempotency keys to prevent duplicates on sync.

## 3. Routing and GitHub Pages

- `base: '/speak-lab/'` in Vite; all assets, the manifest, `start_url`, `scope` and the service
  worker registration respect it. `VITE_BASE_PATH` overrides for local experiments.
- Hash routing (`createHashRouter`) so deep links and refreshes work on static hosting without
  relying on a 404 redirect hack. A `404.html` copy and `.nojekyll` are still emitted as a safety net.
- Auth email links target `https://akifadnan2003.github.io/speak-lab/?token_hash=…&type=…` (query
  before the hash). `captureAuthRedirect()` consumes and scrubs them before the router mounts and
  the in-app `/auth/callback` route shows the outcome. Details in `docs/SECURITY.md` and ADR-009.

## 4. Supabase integration strategy

**Project:** a dedicated Supabase project for SpeakLab. Public signups and anonymous sign-ins are
disabled in the Auth settings. Email provider on, with the GitHub Pages URL in *Site URL* and
*Redirect URLs*.

**Schema.** Core entities, all with `created_at`/`updated_at`, foreign keys and indexes:

| Area | Tables |
| --- | --- |
| Identity (M2, shipped) | `profiles` (id = auth.users.id, email, full_name, role, status, preferred_language, support_language, preferences jsonb, onboarding_completed_at), `tutor_students` (tutor_id, student_id; one tutor per student), `invitations` (email, full_name, user_id, invited_by, status, sent_at, expires_at, resend_count, accepted_at, revoked_at), `account_events` (user_id, actor_id, event_type, metadata) |
| Curriculum | `courses`, `curriculum_units` (level, chapter_number, version), `lessons`, `lesson_content` (versioned JSON), `exercise_definitions`, `assessments` |
| Learning (M3, shipped) | `lesson_progress` (student, chapter, lesson, status, best/last score), `exercise_attempts` (client uuid id = idempotency key, answer jsonb, score), `chapter_access_overrides` (unlock/skip by tutor), `assessment_attempts` (server-graded chapter checks: answers, results, score, passed, expiry). Planned: `skill_mastery`, `mistake_records`, `learning_activity` |
| Vocabulary (M4, shipped) | `vocabulary_items` (generated bank mirror, versioned, retire-only), `student_vocabulary` (server-computed stage, ease, interval, due, recognition/recall/spoken counters, lapses), `vocabulary_reviews` (every answer, client id = idempotency key, server receive time, applied/voided), `vocabulary_student_meta` (reset watermark). Writes only through `record_vocabulary_reviews` / `reset_vocabulary_progress`. Planned: `vocabulary_sets` (tutor assignment, M6) |
| Teaching | `assignments`, `assignment_submissions`, `teacher_notes`, `teacher_feedback` |
| Speaking | `speaking_sessions`, `conversation_messages`, `recordings` (storage path, retention, consent) |
| AI ops | `ai_usage` (tokens, seconds, cost estimate per call), `ai_quotas` (per student limits) |

**Authorization boundaries.**

- `profiles.role` is set only by `bootstrap_owner()` (service role / SQL editor). `status` is set
  only by the `student-admin` Edge Function. Column-level grants exclude `role`, `status`, `email`,
  `id` from client updates and the `profiles_protect_columns` trigger rejects such changes from
  client JWTs. A partial unique index allows exactly one tutor row.
- Student-scoped tables: `USING (student_id = auth.uid())` for students, plus
  `EXISTS (SELECT 1 FROM tutor_students ts WHERE ts.student_id = row.student_id AND ts.tutor_id = auth.uid())`
  for the tutor, both guarded by `profiles.status = 'active'`.
- Teacher-only tables (`teacher_notes`, `invitations`, `ai_usage` aggregates): tutor role only.
- Helpers `is_tutor()`, `is_active()` (security definer, stable, locked search_path) centralise
  the checks.
- Disabled accounts: `status = 'disabled'` blocks every policy except reading the own profile row;
  the `student-admin` function also bans the Auth user so refresh and sign-in are refused.

**Edge Functions.** Shipped: `student-admin` (`invite`, `resend`, `revoke`, `set_status`;
ADR-010) and `assessment` (`start`, `submit`, `reset`; ADR-015, grades with the generated copy of
the client engine under `supabase/functions/_shared`). Planned for M7: `ai-chat`, `ai-transcribe`, `ai-speak` (TTS), `ai-evaluate`. Each
validates input with Zod, verifies the caller with the Auth server, checks the role in the
database, and (M7) enforces quota and writes `ai_usage`. There is no bootstrap endpoint (ADR-011).

**Migrations and deployment.** `supabase/migrations/*.sql` are applied by the manual
`supabase-deploy.yml` workflow (`supabase db push`, additive) together with
`supabase functions deploy`. CI applies the same migrations to a throwaway local stack for the
authorization tests. No manual dashboard changes to schema or policies.

## 5. AI provider abstraction (M7)

```ts
interface ConversationProvider { chat(input: ChatInput): AsyncIterable<ChatChunk> }
interface TranscriptionProvider { transcribe(audio: Blob, opts): Promise<Transcript> }
interface SpeechProvider { synthesize(text: string, voice): Promise<ArrayBuffer> }
```

Implemented inside Edge Functions; the frontend only calls SpeakLab's own endpoints. Provider
choice is configuration, and usage limits are enforced server-side per student per day.

## 6. PWA

`vite-plugin-pwa` in `generateSW` mode with `registerType: 'prompt'`: the app shell (JS, CSS, HTML,
fonts, icons) is precached; API responses, recordings and user data are never cached by the
service worker (`runtimeCaching: []`). `UpdatePrompt` lets the student choose when to reload.

## 7. Build and deployment

- `npm run build` → `tsc -b && vite build` → `dist/` with manifest, icons, `sw.js`.
- `.github/workflows/ci.yml`: `verify` (typecheck, lint, unit, build), `e2e` (shell suite on the
  preview build), `database` (local Supabase: migration, Edge Function, RLS tests, real-auth e2e).
- `.github/workflows/deploy.yml`: checks, requires the public Supabase variables, builds without
  preview mode, greps the bundle for secret keys, then `actions/deploy-pages` on push to `main`.
- `.github/workflows/supabase-deploy.yml`: manual, additive backend deployment with the
  least-privilege secrets. Never triggered by a frontend push.
