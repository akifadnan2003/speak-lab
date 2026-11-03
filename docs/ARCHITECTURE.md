# SpeakLab — Architecture

Last updated for milestone M1 (2026-11-03).

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
| `src/main.tsx` | Mounts `<App>` with the global stylesheet. |
| `src/app/App.tsx` | Providers: error boundary, QueryClient, Theme, Auth, Tooltip, Router, SW update prompt. |
| `src/app/router.tsx` | Hash router. Public auth routes; `RequireAuth` → `AppShell` → role-scoped routes. Feature pages are lazy. |
| `src/app/RoleHome.tsx` | `/` sends tutors to `/tutor`, students to the dashboard. |
| `src/app/pwa.ts` | Install-prompt hook (Chromium/Android); iOS falls back to instructions. |
| `src/config/env.ts` | Zod-validated `import.meta.env`. Exposes `supabaseConfigured`, `uiPreview`, `basePath`. |
| `src/lib/supabase/client.ts` | Lazy `createClient` with anon key, PKCE, persisted session. Returns `null` when unconfigured. |
| `src/features/auth/` | `AuthProvider` (session state machine), `guards.tsx`, login / recovery / callback / disabled screens. |
| `src/features/*` | One folder per product area; pages import demo data today and queries tomorrow. |
| `src/features/curriculum/` | Zod `schema/` (chapter, lesson, blocks, exercises, answers), `content/` (A0–C1 map + authored chapters, validated at import), `ports.ts` (`ContentSource`, `ProgressRepository`), `persistence/` (memory, localStorage), `progression.ts` (pure unlock/completion rules), `CurriculumProvider.tsx` (DI + TanStack Query hooks), `az-help.tsx` (Azerbaijani layer). |
| `src/features/exercises/` | `engine/` (pure: `grade.ts`, `normalize.ts`, `session.ts` reducer, `shuffle.ts`), `components/` (one component per exercise type, `ExerciseRenderer`, `ExerciseRunner`, `ExerciseFeedback`). |
| `src/features/vocabulary/` | `schema.ts` (entries, bank validation, `termForms`), `content/` (A0–A2 bank), `srs/` (SM-2-style `scheduler.ts`, `time.ts`), `revision/queue.ts`, `stats.ts`, `modes/` (registry + exercise builders), `components/` (Flashcard, ActiveRecall, VocabularySession, TranslationReveal), `ports.ts`, `persistence/`, `migration.ts`, `VocabularyProvider.tsx`, dashboard and practice pages. |
| `src/features/learn/`, `src/features/lesson/` | Learn (levels + chapters), Chapter (lessons, objectives, completion rules), Lesson workspace (content blocks + runner, persistence wiring). |
| `src/components/ui/` | Accessible primitives (Radix + cva): button, card, badge, input, label, dialog, sheet, tabs, progress (+ ring), switch, avatar, skeleton, tooltip, dropdown-menu, select, separator, empty-state, page-header, stat. |
| `src/components/layout/` | `AppShell`, `DesktopSidebar` / `SidebarNav`, `BottomNav`, `TopBar`, `AuthLayout`, `Brand`, `nav.ts`. |
| `src/components/theme/` | Zustand theme store, provider, toggle. |
| `src/components/feedback/` | Loader, preview banner, demo notice, error boundary, SW update prompt. |
| `src/demo/` | M1 demonstration fixtures. Deleted as real data arrives. |

### Auth state machine

```
loading ──▶ unauthenticated { reason: 'unconfigured' | 'no-session' }
        └─▶ authenticated { user: { id, email, fullName, role, status }, preview }
```

Guards: `RequireAuth` (→ `/login`), `RequireRole` (→ the user's own home), `RedirectIfAuthenticated`.
A `disabled` account status redirects to `/account-disabled`. In M2 the provider subscribes to
`supabase.auth.onAuthStateChange`, loads the caller's `profiles` row (role, status, name) and keeps
this exact context shape, so no screen changes.

### Preview mode (M1 only)

`VITE_UI_PREVIEW=true` at build time creates a fake local session (`src/demo/preview-users.ts`),
shows a persistent banner with a Student/Tutor switch, and never contacts a network. It exists so
the shells can be reviewed before auth. The deploy workflow sets it today and must drop it in M2.

### Data fetching (M2+)

TanStack Query with query keys namespaced by feature (`['student', id, 'progress']`). Mutations go
through `supabase-js` for RLS-protected tables or `supabase.functions.invoke` for privileged
actions. Offline exercise submissions (M8+) will queue in IndexedDB with client-generated
idempotency keys to prevent duplicates on sync.

## 3. Routing and GitHub Pages

- `base: '/speak-lab/'` in Vite; all assets, the manifest, `start_url`, `scope` and the service
  worker registration respect it. `VITE_BASE_PATH` overrides for local experiments.
- Hash routing (`createHashRouter`) so deep links and refreshes work on static hosting without
  relying on a 404 redirect hack. A `404.html` copy and `.nojekyll` are still emitted as a safety net.
- Auth email links target `https://akifadnan2003.github.io/speak-lab/` (query parameters land before
  the hash and are read by supabase-js). The in-app `/auth/callback` route handles the post-exchange
  step. Details in `docs/SECURITY.md`.

## 4. Supabase integration strategy

**Project:** a dedicated Supabase project for SpeakLab. Public signups and anonymous sign-ins are
disabled in the Auth settings. Email provider on, with the GitHub Pages URL in *Site URL* and
*Redirect URLs*.

**Schema (M2 → M6).** Core entities, all with `created_at`/`updated_at`, foreign keys and indexes:

| Area | Tables (planned) |
| --- | --- |
| Identity | `profiles` (id = auth.users.id, full_name, role, status, support_language, preferences), `tutor_students` (tutor_id, student_id), `invitations` (email, invited_by, status, sent_at, accepted_at), `account_events` (audit) |
| Curriculum | `courses`, `curriculum_units` (level, chapter_number, version), `lessons`, `lesson_content` (versioned JSON), `exercise_definitions`, `assessments` |
| Learning | `exercise_attempts`, `lesson_progress`, `chapter_access` (unlock/skip overrides), `skill_mastery`, `mistake_records`, `learning_activity` (timeline) |
| Vocabulary | `vocabulary_items`, `vocabulary_sets`, `student_vocabulary` (stage, ease, due_at, recognition/recall stats), `vocabulary_reviews` |
| Teaching | `assignments`, `assignment_submissions`, `teacher_notes`, `teacher_feedback` |
| Speaking | `speaking_sessions`, `conversation_messages`, `recordings` (storage path, retention, consent) |
| AI ops | `ai_usage` (tokens, seconds, cost estimate per call), `ai_quotas` (per student limits) |

**Authorization boundaries.**

- `profiles.role` is set only by migration (owner bootstrap) or by Edge Functions running as service
  role after verifying the caller is the tutor. RLS denies clients from updating `role`, `status`
  and tutor assignments (column-level via trigger or `WITH CHECK` comparing old/new values).
- Student-scoped tables: `USING (student_id = auth.uid())` for students, plus
  `EXISTS (SELECT 1 FROM tutor_students ts WHERE ts.student_id = row.student_id AND ts.tutor_id = auth.uid())`
  for the tutor, both guarded by `profiles.status = 'active'`.
- Teacher-only tables (`teacher_notes`, `invitations`, `ai_usage` aggregates): tutor role only.
- A helper `is_tutor()` SQL function (security definer, stable) centralises the role check.
- Disabled accounts: `status = 'disabled'` blocks every policy; the `disable-student` Edge Function
  also revokes refresh tokens via the Admin API.

**Edge Functions (planned).** `invite-student`, `resend-invitation`, `revoke-invitation`,
`set-account-status`, `bootstrap-owner` (one-time, protected by a deploy-time secret and deleted
afterwards or guarded by `profiles` emptiness), `ai-chat`, `ai-transcribe`, `ai-speak` (TTS),
`ai-evaluate`. Each validates input with Zod, checks role, enforces quota, writes `ai_usage`.

**Migrations.** `supabase/migrations/*.sql`, applied through the Supabase CLI and CI. No manual
dashboard changes to schema or policies.

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
- `.github/workflows/ci.yml`: typecheck, lint, unit tests, build, Playwright (on PRs and `main`).
- `.github/workflows/deploy.yml`: same checks, then `actions/deploy-pages` on push to `main`.
  Public env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) comes from repository *variables*.
