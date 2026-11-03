# SpeakLab — Roadmap and Milestones

Last updated 2026-11-03. Status legend: ✅ done · 🔄 in progress · ⏳ planned.

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Repository, architecture, documentation, commands, test strategy | ✅ |
| M1 | Application foundation and design system | ✅ |
| M2 | Authentication, authorization and student invitations | ✅ (owner bootstrap pending) |
| M3 | Curriculum and exercise engine | ⏳ next |
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

- [x] Vite + React 19 + TypeScript strict project under `/speak-lab/`
- [x] Design tokens (light/dark), Inter typography, spacing, radius, shadows, motion
- [x] Accessible primitives (Radix + cva), layout shell (sidebar, top bar, bottom nav, drawer)
- [x] Hash routing with lazy routes; fail-closed guards; role-scoped routes
- [x] Screens for every product area with labelled demo data
- [x] PWA: manifest, icons, service worker (prompt updates), install hook, mobile meta tags
- [x] CI and GitHub Pages deploy workflow
- [x] Tests: 42 unit/integration, 32 e2e (desktop + mobile)

## M2 — Authentication, Authorization and Invitations ✅

Delivered:

- [x] Dedicated Supabase project; public sign-up and anonymous sign-in disabled (verified)
- [x] Migration `20261103120000_identity_and_access.sql`: `profiles`, `tutor_students`,
      `invitations`, `account_events`; enums; helper functions; triggers on `auth.users`; column
      grants; RLS on every table; single-tutor index; `bootstrap_owner()`; `complete_onboarding()`
- [x] Edge Function `student-admin` (invite, resend, revoke, set_status) with server-side
      authorization and audit events
- [x] Frontend: real `AuthProvider` (session listener, profile query, disabled detection), login,
      password recovery, password change, logout, invitation acceptance (`/welcome` onboarding:
      password + preferences), `/reset-password`, account-disabled handling, auth error mapping
- [x] GitHub Pages email-link handling (`token_hash`, PKCE code, implicit fragment, errors) with
      URL scrubbing before the router mounts; custom email templates in `supabase/templates/`
- [x] Tutor: My Students with real accounts, invitations list (pending/expired/accepted/revoked),
      resend/revoke, invite dialog with server errors; student profile with real account data,
      disable/reactivate, account history; analytics tabs are honest placeholders
- [x] Settings: profile name, learning preferences and password persisted per account
- [x] Preview mode removed from deployment and refused whenever Supabase is configured
- [x] CI: `database` job runs the migration, Edge Function and real-auth e2e against a local
      Supabase stack; manual `supabase-deploy.yml` for additive backend deployment
- [x] Docs: `SUPABASE_SETUP.md`, security, architecture, testing, ADR-009…012

Owner actions still required (see `docs/SUPABASE_SETUP.md`):

1. Replace the *Invite user* and *Reset password* email templates (§1.3).
2. Run the **Supabase backend (manual)** workflow once (migrations + function) if it has not run.
3. Create the owner Auth user and run `select public.bootstrap_owner('<uuid>')` (§3).
4. Sign in on the live site, invite the two students, and complete the device checklist.

## M3 — Curriculum and Exercise Engine ⏳

**Correction carried into M3:** the learning journey must start from zero. M3 begins with a
proper **A0/A1 foundation chapter** (alphabet and sounds, greetings, *to be*, *have got*,
numbers, present simple basics) before any A2 content. The A2 Past Continuous chapter remains
the showcase of the exercise engine but is reached through placement: the placement assessment
and tutor overrides accelerate advanced students past the foundation chapters rather than
starting everyone at A2.

Scope: versioned content tables and Zod schemas; chapter/lesson/exercise renderer for the 20
exercise types with deterministic grading; attempts and progress persistence (RLS per student);
unlock/skip overrides; one fully functional A0/A1 foundation chapter and the A2 Past Continuous
chapter; placement assessment skeleton; tutor curriculum view driven by real data.

## M4 — Vocabulary and Revision ⏳

Vocabulary bank import, student vocabulary states, SM-2 style scheduler, review queue, six
practice modes, mistake history, recognition vs recall vs spoken-use tracking.

## M5 — Student Progress ⏳

Learning activity timeline, skill mastery computation, weekly activity, weak-topic detection,
achievements, metric definitions in UI. Replaces the remaining student-side demo fixtures.

## M6 — Tutor Dashboard ⏳

Assignments and submissions, feedback, teacher notes, lesson access management, level overrides,
AI settings, usage and cost view. Fills the placeholder tabs on the student profile.

## M7 — AI Speaking ⏳

Edge Functions for chat/transcribe/speak with provider abstraction; recording pipeline with iOS
and Android handling; 12 modes with objectives; feedback styles; session summaries; quotas and
usage accounting; recording consent and retention.

## M8 — Advanced Learning and Localisation ⏳

Listening, reading, writing and pronunciation activities; Azerbaijani explanation layer across
lessons, corrections and conversations (profiles already carry `support_language`); adaptive
revision; selected offline activities with idempotent sync.

## M9 — Production Hardening ⏳

Full e2e coverage, security review (MFA for the tutor, shorter JWT expiry, custom SMTP),
device testing matrix, accessibility audit, error monitoring, performance budget, production
verification checklist.
