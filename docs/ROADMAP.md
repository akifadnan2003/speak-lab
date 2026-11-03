# SpeakLab — Roadmap and Milestones

Last updated 2026-11-03. Status legend: ✅ done · 🔄 in progress · ⏳ planned.

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Repository, architecture, documentation, commands, test strategy | ✅ |
| M1 | Application foundation and design system | ✅ |
| M2 | Authentication and roles | ⏳ next |
| M3 | Curriculum and exercise engine | ⏳ |
| M4 | Vocabulary and revision | ⏳ |
| M5 | Student progress | ⏳ |
| M6 | Tutor dashboard | ⏳ |
| M7 | AI speaking | ⏳ |
| M8 | Advanced learning and localisation | ⏳ |
| M9 | Production hardening | ⏳ |

## M0 — Repository and Architecture ✅

Acceptance: repo inspected and initialised; stack chosen; docs written; commands defined; test
strategy documented. Outcome: this `docs/` folder, `CLAUDE.md`, `README.md`.

## M1 — Application Foundation and Design System ✅

Acceptance criteria and outcome:

- [x] Vite + React 19 + TypeScript strict project under `/speak-lab/`
- [x] Design tokens (light/dark), Inter typography, spacing, radius, shadows, motion
- [x] Accessible primitives (Radix + cva), layout shell (sidebar, top bar, bottom nav, drawer)
- [x] Hash routing with lazy routes; fail-closed guards; role-scoped routes
- [x] Screens: login, recovery, callback, disabled; student home; learn, chapter, lesson workspace;
      speak and session; vocabulary; progress; settings; tutor My Students, student profile with ten
      sections, curriculum
- [x] Preview mode with explicit banner and demo-data notices
- [x] PWA: manifest, icons, service worker (prompt updates), install hook, mobile meta tags
- [x] CI (typecheck, lint, unit, build, Playwright) and GitHub Pages deploy workflow
- [x] Tests: 42 unit/integration, 32 e2e (desktop + mobile), overflow checks at 7 widths

Known gaps carried forward: no backend; forms validate only; speaking/vocabulary practice buttons
disabled; demo data everywhere (labelled).

## M2 — Authentication and Roles ⏳

Dependencies: Supabase project created by the owner (see "Owner actions" below).

Acceptance criteria:

- Dedicated Supabase project; public signup and anonymous sign-in disabled
- Migrations: `profiles`, `tutor_students`, `invitations`, `account_events`, `is_tutor()`, RLS
- Owner bootstrap procedure executed and documented
- Edge Functions: `invite-student`, `resend-invitation`, `revoke-invitation`, `set-account-status`
- Frontend: real `AuthProvider` with session listener and profile load; login, password recovery,
  invitation acceptance (set password), sign-out; `/auth/callback` working on GitHub Pages
- Tutor: invite dialog, invitation list, disable/reactivate wired to functions
- Preview mode removed from the deploy workflow; guards verified against real sessions
- Authorization tests (seven scenarios in `docs/SECURITY.md`) passing in CI
- Settings: profile name and preferences persisted

## M3 — Curriculum and Exercise Engine ⏳

Versioned content tables and Zod schemas; chapter/lesson/exercise renderer for the 20 exercise
types with deterministic grading; attempts and progress persistence; unlock/skip overrides; one
fully functional A2 chapter (Past Continuous) plus placement assessment skeleton.

## M4 — Vocabulary and Revision ⏳

Vocabulary bank import, student vocabulary states, SM-2 style scheduler, review queue, six
practice modes, mistake history, recognition vs recall vs spoken-use tracking.

## M5 — Student Progress ⏳

Learning activity timeline, skill mastery computation, weekly activity, weak-topic detection,
achievements, metric definitions in UI.

## M6 — Tutor Dashboard ⏳

Real student cards and profile sections, assignments and submissions, feedback, teacher notes,
lesson access management, level overrides, AI settings, usage and cost view.

## M7 — AI Speaking ⏳

Edge Functions for chat/transcribe/speak with provider abstraction; recording pipeline with iOS
and Android handling; 12 modes with objectives; feedback styles; session summaries; quotas and
usage accounting; recording consent and retention.

## M8 — Advanced Learning and Localisation ⏳

Listening, reading, writing and pronunciation activities; Azerbaijani explanation layer across
lessons, corrections and conversations; adaptive revision; selected offline activities with
idempotent sync.

## M9 — Production Hardening ⏳

Full e2e coverage, security review, device testing matrix, accessibility audit, error monitoring,
performance budget, production verification checklist.

## Owner actions required before M2

1. Create a dedicated Supabase project for SpeakLab.
2. Auth settings: disable "Allow new users to sign up" and anonymous sign-ins; enable email; set
   Site URL and Redirect URLs to `https://akifadnan2003.github.io/speak-lab/` (and
   `http://localhost:5173/speak-lab/` for development).
3. Add repository **variables** (not secrets) `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Add repository **secrets** for CI database tests and function deployment:
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`. Never paste these
   into tracked files.
5. Provide the owner's email so the first invitation can be sent; the bootstrap uses the resulting
   Auth user id.
