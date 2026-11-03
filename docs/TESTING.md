# SpeakLab — Testing Strategy

Last updated for milestone M1 (2026-11-03).

## 1. Layers

| Layer | Tool | Where | Runs |
| --- | --- | --- | --- |
| Type safety | `tsc -b` (TypeScript 7, strict, `noUncheckedIndexedAccess`) | whole repo | local, CI |
| Lint | oxlint (correctness errors, suspicious warnings, React hooks rules) | `src`, `e2e` | local, CI |
| Unit / integration | Vitest 5 + Testing Library + jsdom | `src/**/*.test.ts(x)` | local, CI |
| End-to-end | Playwright 1.64, Chromium desktop + Pixel 7 emulation | `e2e/*.spec.ts` | local, CI |
| Authorization (M2) | Vitest against a Supabase test DB with per-role JWTs | `supabase/tests/` | CI |
| Manual device pass | Real iPhone Safari, Android Chrome, Windows Edge/Chrome | checklist below | each milestone |

## 2. Commands

```bash
npm run typecheck
npm run lint
npm run test            # vitest run
npm run test:coverage   # v8 coverage report
npm run test:e2e        # builds, serves dist under /speak-lab/, runs Playwright
npm run check           # typecheck + lint + test + build
```

Playwright needs a one-time `npm run test:e2e:install`. E2E runs with `VITE_UI_PREVIEW=true` so the
shells render (see `playwright.config.ts`); once M2 lands, e2e will seed test users instead.

## 3. What is covered today (M1)

Unit / integration (42 tests):

- `lib/utils`: class merging, initials, clamp, minute and relative-time formatting, greeting.
- `config/env`: unconfigured vs configured Supabase, empty strings, invalid URL fallback, preview flag.
- `theme-store`: resolution, persistence, document class, system sync.
- `layout/nav`: role navigation sets, five-item mobile limit, no tutor routes for students.
- `ui/button`: click, loading/busy, `asChild`, variants.
- `ui/dialog`: open, focus trap, Escape, close button.
- `ui/tabs`: click switching, arrow-key navigation.
- `app/router`: production fail-closed redirects for `/`, tutor and lesson routes; login form
  validation; preview mode dashboard + banner; student blocked from tutor routes; tutor blocked
  from student routes; login redirect when authenticated; student card → profile tabs; 404.

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

## 4. Conventions

- Tests sit next to the code they test. Name the behaviour, not the implementation.
- Mock `@/config/env` to drive auth states; mock `virtual:pwa-register/react` where `App` is rendered.
- Prefer role-based queries (`getByRole`) and user-event over fireEvent.
- Never skip or delete a failing test to get green; fix the code or the test with a reason in the
  commit message.
- Each milestone adds tests for its acceptance criteria before the milestone is reported complete.

## 5. Manual device checklist (per milestone)

- iPhone Safari: install to Home Screen, safe-area padding, no zoom on input focus, dialogs usable
  with the keyboard open, microphone permission flow (M7).
- Android Chrome: install prompt, bottom nav above the system bar, back button behaviour with hash
  routes.
- Windows laptop: keyboard-only navigation of the shell, focus rings visible, dark mode.
- All: 320px width without overflow; offline reload shows the app shell (not a browser error).

## 6. Not yet automated

- Visual regression screenshots (consider Playwright snapshots in M9).
- Accessibility audit (axe) in e2e (M9).
- Performance budget (Lighthouse CI) (M9).
