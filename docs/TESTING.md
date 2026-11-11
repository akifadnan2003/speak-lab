# SpeakLab — Testing Strategy

Last updated for milestone M3 integration (2026-11-11).

## 1. Layers

| Layer | Tool | Where | Runs |
| --- | --- | --- | --- |
| Type safety | `tsc -b` (TypeScript 7, strict, `noUncheckedIndexedAccess`) | whole repo incl. `e2e/`, `supabase/tests/` | local, CI |
| Lint | oxlint (correctness errors, React compiler rules) | `src`, `e2e`, `supabase/tests` | local, CI |
| Unit / integration | Vitest 5 + Testing Library + jsdom | `src/**/*.test.ts(x)` | local, CI |
| End-to-end (shell) | Playwright 1.64, Chromium desktop + Pixel 7, **preview build** | `e2e/shell.spec.ts` | local, CI |
| Authorization, lifecycle & learning records | Vitest (node) against a **local Supabase stack** (Postgres + RLS, GoTrue, Edge Functions, Mailpit) | `supabase/tests/*.test.ts` | CI (`database` job); local with Docker |
| End-to-end (real auth) | Playwright against the production bundle built for the **local Supabase stack**; real emails from Mailpit | `e2e/auth.spec.ts` | CI (`database` job); local with Docker |
| Manual device pass | Real iPhone Safari, Android Chrome, Windows Edge/Chrome/Firefox | checklist below | each milestone |

## 2. Commands

```bash
npm run typecheck
npm run lint
npm run test              # vitest run (jsdom)
npm run test:e2e          # builds with VITE_UI_PREVIEW=true, serves /speak-lab/, Playwright shell suite
npm run check             # typecheck + lint + test + build

# Needs Docker:
npx supabase start        # local stack with migrations, Edge Function and Mailpit
npm run test:db           # supabase/tests (vitest.integration.config.ts)
npm run test:e2e:auth     # e2e/auth.spec.ts (playwright.auth.config.ts); reads keys from `supabase status`
```

`test:db` and `test:e2e:auth` refuse to run against a non-local Supabase URL.

The Supabase CLI is pinned to **3.0.0** in `package.json` and both workflows. Newer releases
change how the local stack serves the custom email templates (3.1.0 broke the invite email in
CI); bump it on purpose with a green `database` job, not through `latest`.

## 3. M2 requirement coverage

| # | Requirement | Where it is proven |
| --- | --- | --- |
| 1 | Unauthenticated users cannot access protected data | `auth-rls.test.ts` "1 · unauthenticated visitors"; `router.test.tsx` fail-closed routes; `auth.spec.ts` deep link → login |
| 2 | Students cannot read another student's data | `auth-rls.test.ts` "2 + 3 · student isolation" |
| 3 | Students cannot read tutor-only information | same (invitations, events, links); `auth.spec.ts` `/tutor` URLs bounce |
| 4 | Students cannot promote themselves | `auth-rls.test.ts` "4 · privilege escalation" (role/status/email updates rejected, bootstrap rejected, second tutor impossible) |
| 5 | Unauthorized users cannot issue invitations | `auth-rls.test.ts` "5" (401 anon, 403 student, 400 invalid, 409 duplicate) |
| 6 | Disabled students cannot access protected resources | `auth-rls.test.ts` "6" (live session denied, refresh refused, sign-in refused, reactivation); `auth.spec.ts` disable flow in the browser |
| 7 | The tutor can access authorized student data | `auth-rls.test.ts` "7"; `auth.spec.ts` real student card |
| 8 | Public registration is rejected | `auth-rls.test.ts` "8" (`signup_disabled`, anonymous refused); verified manually against the hosted project |
| 9 | Invite acceptance works | `auth-rls.test.ts` "9" (real email → `verifyOtp` → triggers); `auth.spec.ts` full browser flow incl. password + preferences |
| 10 | Password reset works | `auth-rls.test.ts` "10"; `auth.spec.ts` recovery flow incl. replay rejection |
| 11 | Session expiration is handled | `AuthProvider.test.tsx` SIGNED_OUT → unauthenticated; `auth-rls.test.ts` invalid refresh token rejected |
| 12 | Logout removes access | `auth-rls.test.ts` "12" (refresh token revoked); `auth.spec.ts` logout then protected route → login |
| 13 | Invalid/expired invitations handled safely | `auth-rls.test.ts` "13" (bad hash, duplicate, resend, revoke kills link); `AuthProvider.test.tsx` expired link → flow error; `auth.spec.ts` replayed link shows error |
| 14 | GitHub Pages redirects work | `auth-url.test.ts` (token_hash / code / implicit / error parsing and URL scrubbing); `auth.spec.ts` opens the emailed URL with query-before-hash exactly as delivered |
| 15 | Refreshing a protected route does not break the app | `shell.spec.ts` deep hash refresh; `auth.spec.ts` reload on `/settings` keeps the session |

## 3b. M3 integration coverage

| Requirement | Where it is proven |
| --- | --- |
| Student-specific progress isolation | `progress.test.ts` "isolation" (RLS: read own only, forged rows refused); `supabase.test.ts` (every read scoped by student id) |
| Tutor visibility | `progress.test.ts` "tutor visibility" (linked students readable, unlinked not, no tutor writes to progress); `auth.spec.ts` Curriculum tab |
| Locked chapter access | `progress.test.ts` (function refuses `locked`); `LessonWorkspacePage.test.tsx` locked check; `auth.spec.ts` URL to the locked check |
| Unauthorized assessment updates | `progress.test.ts` (direct insert/update to `assessment_attempts` denied, forged `lesson_progress` for the assessment ignored, other student cannot submit) |
| Server-side grading and disclosure | `progress.test.ts` (score computed from raw answers, no `correctAnswer` after a fail, revealed after a pass); `persistence.test.ts` memory gateway as reference |
| Cross-device progress | `progress.test.ts` second signed-in client; `auth.spec.ts` device 2 sees device 1's progress |
| Sign-out cleanup | `local-cleanup.test.ts` (registered cleaner wipes progress); `AuthProvider.test.tsx` |
| Account switching | `local-cleanup.test.ts` (`activateLocalUser` purge; preview id never imported) |
| Assessment retakes | `progress.test.ts` (3 attempts, `retakes_exhausted`, tutor reset, stranger refused); `persistence.test.ts` |
| Idempotency | `progress.test.ts` (same attempt id twice, start twice, submit twice) |
| Mobile and desktop lesson navigation | `auth.spec.ts` runs on Desktop Chrome and Pixel 7 projects; `shell.spec.ts` preview build |
| Shared function code in sync | `npm run sync:functions:check` in CI |

## 4. What is covered today

Unit / integration (174 tests): utils, env (incl. preview refusal when configured), theme store,
nav, button/dialog/tabs, router (production fail-closed, preview mode, real-configured routes),
`auth-url` capture/scrub, `AuthProvider` state machine with a fake client (session, disabled,
missing profile, SIGNED_OUT, verifyOtp success, expired link, local-data purge on sign-out and
account switch), `lib/local-data` (prefix purge, keep-list, cleaners, shared-device switch).

Unit / integration added by M3 (71 tests, total 113):

- `curriculum/content`: 70-chapter map shape, level ordering, consecutive numbering, prerequisite
  order and cycle rejection, A0-01 lesson kinds and exercise-type coverage, id uniqueness.
- `exercises/engine/normalize`: case/space/punctuation forgiveness, curly quotes, question marks,
  no forgiveness for apostrophes or word order; word counting; phrase containment.
- `exercises/engine/grade`: every exercise type, partial credit per blank/pair, ordering
  alternatives, question-mark requirement, speaking self-check, writing checklist, empty answers.
- `exercises/engine/session`: practice attempts → reveal, retry keeps typed text, hint recorded,
  navigation bounds, finish/restart, assessment single attempt and frozen answers.
- `curriculum/progression`: new-student unlocking, assessment gating, pass-mark completion,
  speaking-skip rule, tutor unlock/skip overrides, lesson scoring.
- `curriculum/persistence`: memory and localStorage repositories, per-student namespacing,
  idempotent attempts, corrupted storage.
- `exercises/components/ExerciseRunner`: MCQ flow with explanation, three-attempt retry and reveal,
  hint + Azerbaijani layer, word bank + Enter, ordering by tap and arrow keys, matching partial
  credit, speaking Done + summary, finish gating, assessment mode with hidden feedback.
- `lesson/LessonWorkspacePage`: preview-session Learn list (only A0-01 openable), chapter lessons
  with locked assessment, locked lesson refusal, lesson run persisting attempts/progress to
  localStorage, Azerbaijani switch, completed lesson reflected in the chapter view.

End-to-end (34 tests across two projects):

- Base path, manifest (`start_url`, `scope`, `display`), service worker reachable.
- Deep hash route direct navigation and refresh (`/learn/a0-01`).
- Preview banner visible.
- Student navigation through bottom bar (mobile) / sidebar (desktop).
- Real lesson exercise operable by keyboard; progress survives navigation; sentence ordering by tap.
- Student cannot reach `/tutor`.
- Tutor cards open profile; tab routing; grammar table.
- Invite dialog validation and Escape.
- Theme switch persists across reload.
- No horizontal overflow at 320/375/390/430/768/1024/1440 on eight screens.

Shell e2e (32 tests, two projects): unchanged from M1 (manifest, deep links, navigation,
exercise keyboard use, role isolation, dialogs, theme, overflow at 7 widths).

Database + real-auth (CI `database` job): 21 + 10 integration tests (`auth-rls.test.ts`,
`progress.test.ts`) and 6 browser scenarios (12 test runs across the desktop and Pixel 7 projects).

## 5. Conventions

- Tests sit next to the code they test. Name the behaviour, not the implementation.
- Mock `@/config/env` to drive auth states; mock `@/lib/supabase/client` with an in-memory fake for
  provider tests (see `AuthProvider.test.tsx`); call `resetSupabaseClientForTests()` when the env
  changes within a file.
- Never mock RLS. Policy behaviour is proven only by `supabase/tests` against Postgres.
- Prefer role-based queries (`getByRole`) and user-event over fireEvent.
- Never skip or delete a failing test to get green; fix the code or the test with a reason in the
  commit message.
- Each milestone adds tests for its acceptance criteria before the milestone is reported complete.

## 6. Manual device checklist (per milestone)

- iPhone Safari: open an invitation link from Mail, complete onboarding, install to Home Screen,
  sign out and back in; safe-area padding; no zoom on input focus.
- Android Chrome: same invitation flow from Gmail; install prompt; back button with hash routes.
- Windows Chrome/Edge/Firefox: invitation and recovery links from webmail; keyboard-only navigation;
  dark mode.
- All: 320 px width without overflow; offline reload shows the app shell.

## 7. Not yet automated

- Visual regression screenshots (M9).
- Accessibility audit (axe) in e2e (M9).
- Performance budget (Lighthouse CI) (M9).
- Real device browsers (manual checklist above).
