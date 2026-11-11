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
**Decision.** `createHashRouter`. URLs look like `/speak-lab/#/learn/a2-07`.
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
