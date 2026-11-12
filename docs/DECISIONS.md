# SpeakLab — Architecture Decision Records

Format: context → decision → consequences. Newest at the bottom. Supersede rather than edit.

## ADR-001 · Static React SPA on GitHub Pages with a Supabase backend (2026-11-03)

**Context.** The frontend must be independently deployable to GitHub Pages without a Node server;
sensitive operations need a trusted backend.
**Decision.** Vite + React 19 + TypeScript static bundle; Supabase for Auth, Postgres with RLS,
Storage and Edge Functions. All privileged logic lives in Edge Functions.
**Consequences.** No SSR; auth and data are client-driven and policy-protected. AI providers are
only ever called server-side.

## ADR-002 · Tailwind CSS 4 with semantic tokens and Radix primitives (2026-11-03)

**Context.** Premium, consistent, themeable UI across phones and desktops with small bundle cost.
**Decision.** Tailwind 4 (`@theme inline`) over OKLCH CSS variables; Radix UI primitives wrapped
in shadcn-style components with `cva`; Lucide icons; Inter Variable self-hosted.
**Consequences.** Components never hardcode colours; dark mode is a class toggle; no runtime CSS-in-JS.

## ADR-003 · Hash routing for GitHub Pages (2026-11-03)

**Context.** GitHub Pages serves `index.html` only at the project root. Options: hash routing, or
browser routing with a `404.html` redirect trick that rewrites the path into a query string.
**Decision.** `createHashRouter`. URLs look like `/#/learn/a2-07` (originally `/speak-lab/#/…` on the project site; ADR-020).
**Consequences.** Direct navigation, refresh and PWA `start_url` work without redirects or flashes.
Supabase auth redirects target the root URL; `?code=` arrives before the hash and is consumed by
supabase-js. Trade-off: hash URLs are slightly less elegant; a `404.html` copy is still emitted as a
safety net. Revisit only if moving to a host with rewrite rules.

## ADR-004 · Fail-closed guards plus an explicit M1 preview mode (2026-11-03)

**Context.** M1 must deliver reviewable UI shells before authentication exists, without implying
auth works and without ever rendering protected screens in production by accident.
**Decision.** `AuthProvider` returns `unauthenticated` unless `VITE_UI_PREVIEW=true` was set at
build time, in which case a fake local session is created, a persistent banner is shown and every
screen carries demo notices. The deploy workflow enables it for M1 only.
**Consequences.** Guards are exercised from day one. M2 must remove the flag from the workflow and
replace the preview branch with the Supabase session listener.

## ADR-005 · Demo data isolated in `src/demo/` (2026-11-03)

**Context.** Screens need realistic content to validate layout and hierarchy.
**Decision.** All fixtures live in `src/demo/*`, typed with the shapes the real data layer will
use, and are labelled in the UI by `DemoNotice`. Product configuration that is genuinely static
(speaking mode catalogue, feedback styles) is also kept there for now but is not demo data.
**Consequences.** Screens migrate to queries by swapping imports; no fixture ever reaches the DB.

## ADR-006 · PWA with prompt-based updates and no runtime caching (2026-11-03)

**Context.** Installability on iOS and Android; privacy of learner data.
**Decision.** `vite-plugin-pwa` generateSW, `registerType: 'prompt'`, precache the app shell only,
`runtimeCaching: []`.
**Consequences.** Updates never interrupt an exercise; private data is never cached by the SW.
Offline activities (M8) will use IndexedDB explicitly, not the SW cache.

## ADR-007 · Route-level code splitting (2026-11-03)

**Context.** A single bundle exceeded 750 kB on first build.
**Decision.** Every feature page is `lazy()`-loaded; `AppShell` and `AuthLayout` wrap outlets in
`Suspense`. Vite 8 (rolldown) default splitting is used; `manualChunks` is not available in the
rolldown API and `codeSplitting` groups were deferred.
**Consequences.** Initial chunk ≈ 455 kB raw (React, router, query, shell primitives); each screen
loads 1–15 kB more. Revisit with `build.rolldownOptions.output.codeSplitting` in M9.

## ADR-008 · Tooling versions (2026-11-03)

**Context.** `npm create vite` produced Vite 8, TypeScript 7 (native), oxlint, React 19.3.
**Decision.** Keep the scaffold's current stable toolchain: Vite 8 + rolldown, TypeScript 7
(`tsc -b`, `baseUrl` removed in favour of `paths`), oxlint instead of ESLint, Vitest 5, Playwright
1.64, Tailwind 4.3, React Router 8.
**Consequences.** Faster builds and checks. Some ecosystem docs still describe Vite 5/6 options
(e.g. `manualChunks`); check the installed types before adopting snippets.

## ADR-009 · Email links carry `token_hash` straight to the app; auth material is captured before the router mounts (2026-11-03)

**Context.** Supabase admin invitations are not PKCE flows (no code verifier exists in the
student's browser), so the default `{{ .ConfirmationURL }}` ends in a `/auth/v1/verify` redirect
that returns tokens in the URL **fragment**. On GitHub Pages with `HashRouter`, the fragment is
the route: the router would rewrite `#access_token=…` to `#/login` and lose the tokens. Recovery
links have the same shape. Links must also work on iPhone Safari, Android Chrome and desktop
browsers without relying on redirect behaviour.
**Decision.** Custom *Invite* and *Reset password* templates link to
`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite|recovery` (query string before the
hash). `captureAuthRedirect()` runs in `main.tsx` before React mounts: it parses token_hash,
PKCE `code`, implicit fragments and provider errors, keeps them in memory, and rewrites the URL to
`#/auth/callback?flow=…`. `AuthProvider` then calls `verifyOtp` / `exchangeCodeForSession`.
Raw implicit-grant tokens in the fragment are rejected rather than passed to `setSession`, because
a crafted link could sign a victim into an attacker's session (login CSRF). `detectSessionInUrl`
is off. The hosted templates must be updated by hand (`docs/SUPABASE_SETUP.md` §1.3).
**Consequences.** No dependency on the redirect allow-list for the invite link itself (the app URL
is passed as `redirectTo` and still validated by Supabase and by the function allow-list). Tokens
never persist in history. Default (non-customised) templates do not work, by design. Tested with
real GoTrue emails in CI.

## ADR-010 · One Edge Function for student administration; revocation = status + Auth ban (2026-11-03)

**Context.** Invite, resend, revoke and disable/reactivate all need the same verification (caller
JWT → Auth server → tutor role in the database) and the same service-role client. Separate
functions would quadruple the boilerplate and the attack surface review. Revoking access must
hold for sessions that already exist.
**Decision.** A single `student-admin` function with an `action` discriminator and Zod schemas,
deployed with `--no-verify-jwt` because it authenticates callers itself (this also works with the
new publishable/secret API keys). Disable sets `profiles.status = 'disabled'` **and**
`ban_duration` on the Auth user; every RLS policy requires `is_active()` except reading one's own
profile row. Revoking a pending invitation deletes the unconfirmed Auth user so the emailed link
dies. Resend re-invites (replacing a stale unconfirmed user when GoTrue refuses to re-send).
**Consequences.** One deploy unit, one audit point. Immediate server-side denial for disabled
students; refresh and sign-in refused; a short access-token window remains (documented in
`docs/SECURITY.md` §6). Supersedes the four-function list in ADR-001's planning notes.

## ADR-011 · Owner bootstrap is an administrative SQL function, never an endpoint (2026-11-03)

**Context.** The previous plan allowed a one-time `bootstrap-owner` Edge Function guarded by a
secret. Any reachable endpoint that can grant the tutor role is a liability, and email strings are
not identities.
**Decision.** `public.bootstrap_owner(uuid)` — `SECURITY DEFINER`, locked `search_path`, execute
revoked from `anon`/`authenticated`, refuses client JWTs, requires a confirmed Auth user, idempotent
for the existing owner, raises for anyone else once a tutor exists. A partial unique index enforces
the single-tutor invariant at the storage level. Run once from the SQL editor with the verified
User UID.
**Consequences.** No bootstrap code ships to the browser or the function runtime. The procedure is
documented and auditable (`account_events.owner_bootstrapped`). Tests prove a second tutor is
impossible even for the service role.

## ADR-012 · Preview mode is mutually exclusive with a configured backend (2026-11-03)

**Context.** M1 deployed `VITE_UI_PREVIEW=true`. In M2 a real build must never show simulated
tutor access, while the shell e2e suite still benefits from the demo session.
**Decision.** `parseEnv` forces `uiPreview = false` when Supabase is configured; `vite.config.ts`
throws if both are set; the deploy workflow no longer sets the flag and requires the public
Supabase variables. Preview remains available for builds with no backend (shell e2e, local review).
**Consequences.** Demo fixtures stay isolated and labelled; real builds fail closed by construction.

## ADR-013 · Curriculum engine behind content and progress ports (2026-11-03)

**Context.** M3 (curriculum + exercise engine) was built in parallel with M2 (Supabase auth) and
must not depend on tables or Edge Functions that do not exist yet, while still being genuinely
usable and later pluggable into Postgres without rewriting screens.
**Decision.** Content and progress are accessed only through two interfaces in
`src/features/curriculum/ports.ts`: `ContentSource` (chapters) and `ProgressRepository` (lesson
progress, attempts, tutor overrides). M3 ships a static content source (TypeScript modules
validated by Zod at import) and a `localStorage` progress repository, injected via
`CurriculumProvider`. Grading (`src/features/exercises/engine/grade.ts`) and progression rules
(`src/features/curriculum/progression.ts`) are pure functions. Exercise types are a Zod
discriminated union; graders and components switch exhaustively on it.
**Consequences.** Learn / Chapter / Lesson screens work today without a backend and the UI states
that progress is device-only. The Supabase implementation only has to satisfy the ports; the
`exercise_attempts` record shape (client id as idempotency key) is already final. Speaking and
writing are self-checked or checklist-graded; no AI is simulated. Adding an exercise type means a
schema, a grader and a component, enforced by TypeScript.

## ADR-014 · A0 chapter 1 teaches sentence structure and *to be* (2026-11-03)

**Context.** The original map opened with an alphabet/greetings chapter; the M3 brief asked for a
first chapter that starts with sentence structure, subject pronouns and *am / is / are*.
**Decision.** A0-01 is "Sentence structure, subject pronouns and am / is / are". The alphabet
becomes its pronunciation lesson (spelling your name) and greetings/jobs its vocabulary lesson; a
new A0-04 (adjectives) keeps A0 at eight chapters. `pronunciation` was added as a lesson kind.
**Consequences.** Learners produce full sentences from the first lesson. `docs/CURRICULUM.md`
and the map are kept in sync by `curriculum.test.ts`.

## ADR-015 · Assessments are graded by an Edge Function that reuses the client engine through a generated copy (2026-11-11)

**Context.** M3's grading engine, schemas and content are TypeScript modules in `src/`. Chapter
completion must not be forgeable from the browser, yet the grading logic and the answer keys must
be identical on both sides, and the Vite build must not depend on Deno.
**Decision.** A new `assessment` Edge Function (`start`, `submit`, `reset`) is the only writer of
`assessment_attempts`. It imports `supabase/functions/_shared/features/**`, a copy of the pure
modules generated by `scripts/sync-function-shared.mjs` (imports rewritten to explicit `.ts` and
`npm:zod@<version>`), committed and verified in CI with `npm run sync:functions:check`. Shared
rules (`assessment-rules.ts`: 3 attempts per chapter version, 2 h attempt TTL, disclosure after a
pass or on the last attempt, merging of attempts into progress) run in the browser for display and
on the server for enforcement. `lesson_progress` rows that claim an assessment lesson are ignored
by both. Real builds import only `content/generated/client-curriculum.ts`, produced by
`scripts/build-client-content.mjs` with assessment keys removed; the full content module is loaded
behind a build-time `VITE_UI_PREVIEW` constant and eliminated from real bundles.
**Consequences.** One engine, one content set. Changing a source module requires re-running the
sync (CI fails otherwise). Ordering and matching exercises still expose their key by construction
(SECURITY.md §6). Practice lessons remain client-graded and self-reported, which is acceptable
because they gate nothing except the chapter check itself.

## ADR-016 · Placement is expressed as tutor skip/unlock overrides (2026-11-11)

**Context.** Every learner starts at A0-01, but stronger learners (and the A2 Past Continuous
showcase chapter) must be reachable without inventing a placement test the content does not have.
**Decision.** `chapter_access_overrides` (`unlock` | `skip`) are written by the tutor for linked
students (RLS, audited in `account_events`). "Place at level" on the student profile writes `skip`
for every chapter below the chosen level and clears overrides above it. `computeProgression`
already treats skipped chapters as satisfied prerequisites. A2-07 is authored content at its real
position in the map (requires A2-06 or an override).
**Consequences.** No public placement endpoint, no self-service acceleration. A future placement
assessment can produce the same overrides. Tutor decisions are visible to the learner (badge) and
in the account history.

## ADR-017 · Vocabulary: SM-2-style scheduler, language-keyed support material, explicit migration (2026-11-03)

**Context.** M4 needs spaced repetition that is explainable and testable, Azerbaijani support that
does not become mandatory for future languages, and a safe path from device-local progress to
authenticated server records.
**Decision.** (1) Scheduling is SM-2 with three documented adaptations (learning steps 1/3/6 days;
mastery requires three consecutive correct *active recall* answers at a ≥ 21-day interval; lapses
are counted and demote to learning). Quality 0–5 is derived deterministically from the answer type.
No optimality is claimed. (2) `VocabularyEntry.translations` is a partial record keyed by
`SUPPORT_LANGUAGES`; practice shows English first and reveals support material on request.
(3) Persistence goes through `VocabularyRepository`/`VocabularyBankSource` ports; the localStorage
implementation is namespaced by student id, `clearStoredVocabulary()` exists for sign-out, and
`exportVocabularySnapshot()` is the only path to the server: explicit, per-id, idempotent (client
review ids), and refusing `preview-*` ids. Local records are never re-keyed to another account.
(4) Four practice modes build M3 `Exercise` objects instead of new components.
**Consequences.** Review schedules are reproducible in tests, including time-zone cases. The
Supabase repository is a drop-in. Listening/speaking modes are listed as unavailable until audio
and the speech pipeline exist.

## ADR-018 · The server owns the vocabulary schedule; clients only submit answers (2026-11-11, integrated 2026-11-12)

**Context.** M4's spaced-repetition state (stage, ease, interval, due date, mastery) lived on the
device. Moving it into the account must not let a browser upload whatever schedule it likes, must
survive offline practice and a second device, and must respect the M2 rule that nothing of a
student stays on a shared device.
**Decision.** Clients have SELECT only on `vocabulary_items`, `student_vocabulary`,
`vocabulary_reviews` and `vocabulary_student_meta`. The only write paths are two `security definer`
functions that take the student from `auth.uid()` and refuse anyone who is not an active student:
`record_vocabulary_reviews(p_expected_student, p_reviews, p_source)` validates each answer, derives
the quality from the mode and answer flags, runs `public.vocabulary_schedule()` (a line-for-line
port of the TypeScript scheduler, proven equal by `scheduler.sql-parity.test.ts`) and returns the
server's states; `reset_vocabulary_progress(p_expected_student)` deletes the schedule, voids but
keeps the history for the tutor and moves a reset watermark. Client-sent quality, interval, stage,
ease and student id are ignored. `p_expected_student` is the account a queue was written under: it
can only make a call fail, never grant anything. Ordering rules: review id is the primary key
(idempotent replay); batches apply in `reviewed_at` order; an answer at or before the word's last
review is stored as history without rewinding; an answer at or before the last reset is voided;
`reviewed_at` is clamped to the server clock (+5 min) and must postdate the account.
The browser keeps a durable per-account outbox (`speaklab.vocab.outbox.v1:<uid>`), overlays queued
answers on the server copy, retries with backoff and on `online`, and refuses to flush a queue
under a different session. The bank itself is mirrored by a generated migration
(`*_vocabulary_bank_v<n>.sql`) that `bank-seed.test.ts` keeps equal to `bank.ts`; retired words
are never deleted because reviews reference them.
**Consequences.** Mastery and the schedule cannot be forged from the browser; the tutor sees every
answer with server receive times. `correct` is still decided in the browser, so vocabulary remains
formative self-practice and never feeds an official assessment (`assessment-isolation.test.ts`
pins that the `assessment` function and the curriculum tables know nothing about vocabulary).
Changing the scheduler means changing both implementations and the parity test.

## ADR-019 · Queued offline answers are visible and are flushed explicitly before sign-out (2026-11-12)

**Context.** With an offline queue, "Saved to your account" can be untrue for minutes or days, and
the M2 purge on sign-out would silently delete answers that never reached the server. Flushing
automatically inside `signOut()` would hide a network failure and, on a shared device, could run
under a session that is no longer the queue's owner.
**Decision.** `src/lib/local-data.ts` gains a *pending local work* registry next to the cleaners:
a feature registers a reporter `(studentId) => { label, count, flush }`. The cloud vocabulary
repository registers one and also notifies subscribers on every queue change, which drives a
visible `PendingSyncBadge` ("N answers have not reached your account yet", with *Try now*) on the
vocabulary dashboard and practice screens and a "waiting to sync" suffix on the storage label.
Sign-out from the top bar goes through `useGuardedSignOut`: with nothing queued it signs out at
once; otherwise a dialog names what is pending and offers *Sync and sign out* (flush, then sign
out only if nothing remains, else report the remainder and let the learner retry), *Sign out and
discard*, or *Stay signed in*. The flush is the feature's own code and only ever sends the
signed-in account's queue; the purge still runs on every sign-out, so account isolation is
unchanged.
**Consequences.** The UI never claims more than the server holds. Losing queued answers is an
explicit choice, never a side effect. Other features that queue work (drafts, offline attempts)
plug into the same registry without touching auth code.

## ADR-020 · Custom domain at the site root, hash routing kept (2026-11-12)

**Context.** SpeakLab moved from the GitHub Pages project site `akifadnan2003.github.io/speak-lab/`
to the custom domain `speaklab.akiflabs.net` (GoDaddy CNAME to `akifadnan2003.github.io`, HTTPS
enforced, certificate issued). A project site lives under `/speak-lab/`; a custom domain serves
the repository at `/`. Sessions, caches and offline queues are origin-scoped, so the move changes
the application's origin.
**Decision.** The production base path becomes `/` (`VITE_BASE_PATH` still allows a sub-path
build). `public/CNAME` ships with every artifact so the domain stays attached to the Pages site
whatever deployment method is used; the deploy workflow fails if the build still references
`/speak-lab/` or lacks the CNAME. Hash routing is kept: it needs no server rewrite, and the
`404.html` + `.nojekyll` safety net stays. Auth redirects are derived from `window.location.origin`
plus the base path (`appRedirectUrl`), so the app needs no hostname constant; the Supabase *Site
URL* and *Redirect URLs* and the `student-admin` allow-list (`SPEAKLAB_ALLOWED_APP_URLS`) list the
custom domain first and keep the old URL during the migration because emailed links may still
carry it (GitHub redirects it to the custom domain, path and query preserved). The old URL is
removed from both lists once no invitation or recovery link older than the OTP expiry can exist.
**Consequences.** Every user signs in again once on the new origin (sessions do not transfer).
Anything queued offline on the old origin cannot be flushed any more, because the old origin is
no longer served; the migration runbook (`docs/CUSTOM_DOMAIN.md`) says how to check. No data in
Supabase changes. Local development and the Playwright suites now run at `/` as well.

## ADR-021 · Progress analytics are pure client functions over RLS-protected records (2026-11-12)

**Context.** M5 replaces the last student-facing demo data with real progress: overview, weekly
activity, skills, weak topics, timeline and achievements, for the student and read-only for the
tutor. The architecture draft foresaw `skill_mastery`, `mistake_records` and `learning_activity`
tables. Every input already exists in `lesson_progress`, `exercise_attempts`,
`assessment_attempts`, `student_vocabulary` and `vocabulary_reviews`, all under RLS.
**Decision.** No new schema. `src/features/progress/analytics/` holds pure, deterministic
functions from `LearningRecords` to display models; `useLearningAnalytics` loads the records with
the existing repositories (paged) and computes once per data change. Metric definitions live in
`docs/PROGRESS_METRICS.md`: calendar days in the device time zone, first-try accuracy for graded
exercises, server stages for vocabulary, explicit evidence thresholds, "Not assessed yet" instead
of invented scores, stable ids for timeline entries and achievements. The tutor's Progress tab
calls the same hook with a linked student's id; RLS decides what comes back.
**Consequences.** Nothing to migrate or deploy on the backend; numbers can never disagree with
the records; the tutor and the student see the same figures. Cost grows with one student's
history (fine for a one-tutor academy); server-side aggregation can be added later behind the
same `LearningRecords` shape if histories grow. Time on task, speaking and writing scores and
listening remain unmeasured until the data to measure them exists.

## ADR-022 · Homework lifecycle lives in the database; completion needs evidence (2026-11-12)

**Context.** M6 adds homework, submissions, feedback and private notes to a product with one tutor
and real students. A modified client must not be able to mark work complete, write its own
feedback, read another learner's work or read the tutor's notes; and the tutor must not be able
to alter what a student wrote.
**Decision.** Three tables (`assignments`, `assignment_recipients`, `teacher_notes`), RLS for
who may see which rows, and `BEFORE` triggers that decide which columns each actor may change and
which status transitions are legal, setting every timestamp from the server clock. Lesson and
vocabulary homework is completed only by `complete_assignment`, a `security definer` function
that checks the learner's own records (`lesson_progress`, a passed server-graded chapter check,
or `vocabulary_reviews` after publication) and stores the evidence; written homework is
submitted by the student and reviewed by the tutor, with optional "return for changes" and
resubmission. Teacher notes have no student-facing policy at all. No Edge Function was needed:
PostgREST plus triggers and one RPC cover every operation, and the service role is recognised
only through verified JWT claims. Numeric grades exist only for chapter checks.
**Consequences.** The client contains no authorization logic; the same rules hold for the app,
curl and the dashboard. Tutor edits stop once anything is submitted (cancel and reassign
instead). Practice-lesson evidence is self-reported, as all practice progress is. Adding a second
tutor later needs only the existing link table. Notifications and attachments are out of scope.
