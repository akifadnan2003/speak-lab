# SpeakLab — Testing Strategy

Last updated for milestone M2 (2026-11-03).

## 1. Layers

| Layer | Tool | Where | Runs |
| --- | --- | --- | --- |
| Type safety | `tsc -b` (TypeScript 7, strict, `noUncheckedIndexedAccess`) | whole repo incl. `e2e/`, `supabase/tests/` | local, CI |
| Lint | oxlint (correctness errors, React compiler rules) | `src`, `e2e`, `supabase/tests` | local, CI |
| Unit / integration | Vitest 5 + Testing Library + jsdom | `src/**/*.test.ts(x)` | local, CI |
| End-to-end (shell) | Playwright 1.64, Chromium desktop + Pixel 7, **preview build** | `e2e/shell.spec.ts` | local, CI |
| Authorization & lifecycle | Vitest (node) against a **local Supabase stack** (Postgres + RLS, GoTrue, Edge Function, Mailpit) | `supabase/tests/*.test.ts` | CI (`database` job); local with Docker |
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

## 4. What is covered today

Unit / integration (62 tests): utils, env (incl. preview refusal when configured), theme store,
nav, button/dialog/tabs, router (production fail-closed, preview mode, real-configured routes),
`auth-url` capture/scrub, `AuthProvider` state machine with a fake client (session, disabled,
missing profile, SIGNED_OUT, verifyOtp success, expired link).

Shell e2e (32 tests, two projects): unchanged from M1 (manifest, deep links, navigation,
exercise keyboard use, role isolation, dialogs, theme, overflow at 7 widths).

Database + real-auth (CI `database` job): 16 integration tests and 5 browser scenarios listed above.

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
