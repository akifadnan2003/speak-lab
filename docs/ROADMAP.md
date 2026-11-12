# SpeakLab — Roadmap and Milestones

Last updated 2026-11-12. Status legend: ✅ done · 🔄 in progress · ⏳ planned.

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Repository, architecture, documentation, commands, test strategy | ✅ |
| M1 | Application foundation and design system | ✅ |
| M2 | Authentication, authorization and student invitations | ✅ (live in production 2026-11-11) |
| M3 | Curriculum and exercise engine | 🔄 integration built on `m3-integration`, PR open |
| M4 | Vocabulary and revision | 🔄 integration built on `m4-integration`, PR open |
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

Production state (2026-11-11): migration applied and `student-admin` deployed through the manual
workflow (Session pooler, CLI 3.0.0), real-auth frontend live, owner bootstrapped, one test
student created from the dashboard and linked with `tutor_students`. Verified on the hosted
project: signup rejected, anonymous REST denied, function rejects unauthenticated calls, exactly
one tutor, student session reads only its own rows.

Owner actions still open (see `docs/SUPABASE_SETUP.md`):

1. Configure custom SMTP (§1.3) and replace the *Invite user* and *Reset password* templates
   (§1.4). Until then invitations from the app and "Forgot password" cannot send email; create
   students from the dashboard and link them with the `tutor_students` insert (§3).
2. Complete the manual device checklist in `docs/TESTING.md` §6.

## M3 — Curriculum and Exercise Engine 🔄 (integration in review)

Designs: `docs/superpowers/specs/2026-11-03-m3-curriculum-engine-design.md` (standalone engine,
Agent 2) and `docs/superpowers/specs/2026-11-11-m3-integration-design.md` (integration into the
authenticated app, Agent 1, branch `m3-integration`).

Delivered by the standalone slice (merged from `worktree-m3-curriculum`, 712feec):

- [x] Zod schemas for chapters, lessons, content blocks and nine exercise types; curriculum-level
      validation (unique ids, prerequisites exist, no cycles)
- [x] Full A0 → C1 map (70 chapters) with objectives, skills and prerequisites; planned chapters
      shown honestly as "not written yet"
- [x] Exercise engine: deterministic grading with partial credit, text normalisation, hints,
      explanations (EN + optional AZ), three-attempt practice session reducer, seeded shuffling
- [x] Components for every exercise type; runner with summary; keyboard and touch accessible
- [x] Chapter A0-01 fully authored: 11 lessons, 130+ exercises, 20 speaking prompts, Azerbaijani
      mechanism explanations
- [x] Progression rules (unlock, assessment gating, chapter completion, tutor override model)

Delivered by the integration:

- [x] Migration `20261111150000_curriculum_progress.sql`: `lesson_progress`, `exercise_attempts`
      (client id = idempotency key), `chapter_access_overrides`, `assessment_attempts`; RLS per
      student with tutor read through `tutor_students`; audit events for overrides and assessments
- [x] Supabase `ProgressRepository` and `AssessmentGateway` behind the M3 ports; preview builds keep
      the localStorage pair; `storage` label tells the learner where progress lives
- [x] Edge Function `assessment`: server-side grading from the shared engine/content copy, chapter
      gate computed from the database, 3 attempts per chapter version, 2 h attempt expiry,
      idempotent start/submit, answer disclosure only after a pass or on the last attempt, tutor
      reset; assessment answer keys redacted from the bundle
- [x] Lesson workspace: chapter checks start an attempt, save answers without feedback, submit for
      server grading and show the server's verdict; practice lessons unchanged
- [x] Tutor: Curriculum tab on the student profile with real progression, unlock / skip / clear
      overrides, "Place at level", per-assessment attempts and "Allow retake"
- [x] `clearStoredProgress` registered with the M2 local-data cleanup (sign-out, SIGNED_OUT,
      account switch); preview progress never reaches a real account
- [x] A2-07 "Past Continuous; when / while; interrupted actions" authored (the M1 showcase
      content) at its real place in the map, reachable by completing A2-06 or by placement
- [x] Tests: unit (rules, redaction, reducer, repositories, runner, lesson page, cleanup),
      database integration (`supabase/tests/progress.test.ts`), real-auth browser flow
      (lesson navigation on desktop and mobile, cross-device progress, locked chapter check, tutor
      placement)

Remaining for M3 after this integration:

- Deploy: run the manual backend workflow (migration + both functions) after the PR merges.
- Listening/dictation exercise types (need audio) and placement assessment content.
- Further chapters (A0-02 onward) authored with the same schemas.
- Versioned `lesson_content` tables and the tutor content editor (M6).

## M4 — Vocabulary and Intelligent Revision 🔄

Design: `docs/superpowers/specs/2026-11-03-m4-vocabulary-design.md`. Branch `worktree-m4-vocabulary`.

Done (frontend-independent slice):

- [x] `VocabularyEntrySchema` (word/expression, part of speech, definition, examples, support-language
      translations keyed by language, pronunciation incl. optional audio URL, synonyms, antonyms,
      collocations, word family, grammar note, level, topics, tags, chapter links) and bank-level
      validation (unique ids, unique term+POS, first example contains the term)
- [x] A0–A2 bank: 180 validated entries across 13 topics, all with Azerbaijani translations
- [x] SM-2-style scheduler (documented adaptations: 1/3/6-day learning steps, mastery through
      active recall, lapse tracking), recognition / recall / spoken counters, time-zone-aware days
- [x] Deterministic revision queue: overdue → recently incorrect → weak recall → current chapter →
      mastered reinforcement → due → capped new words
- [x] Six working modes (flashcards, choose the meaning, matching, missing word, sentence
      completion, active recall) reusing the M3 exercise renderer; listening and speaking registered
      as unavailable with reasons
- [x] Dashboard computed from stored records only (learned, new, due/overdue, mastered, streak,
      by level, difficult, recently learned, recommended session), word browser with filters and a
      translation switch, device reset with confirmation
- [x] Ports + memory/localStorage repositories namespaced per student, `clearStoredVocabulary()`
      for sign-out, explicit snapshot export that refuses preview ids
- [x] 56 new tests (171 total); e2e flashcard flow

Integration onto the authenticated foundation (branch `m4-integration`, 2026-11-12; design and
evidence in `docs/VOCABULARY_PERSISTENCE.md`, ADR-018, ADR-019):

- [x] `worktree-m4-vocabulary` merged unchanged onto the M3 integration (router, roadmap and ADR
      numbering resolved; M4's vocabulary ADR is ADR-017), then the preparation commits
      `9bf65d7..m4-integration-prep` replayed without the scaffolding merge
- [x] Migrations `20261111160800_vocabulary_persistence.sql` (tables, RLS, `record_vocabulary_reviews`,
      `reset_vocabulary_progress`, SQL scheduler) and `20261111160900_vocabulary_bank_v1.sql`
      (generated bank mirror, 180 entries); both newer than every applied migration
- [x] Server-owned schedule: clients SELECT only, answers submitted through the RPC, quality and
      schedule derived on the server, per-student RLS, tutor read of linked students
- [x] Cloud repository with durable per-account outbox, retry/backoff, optimistic overlay, offline
      fallback to the last server copy, cross-device restore, consented local-to-cloud import
- [x] Visible pending-sync indicator on the dashboard and practice screens; sign-out guard that
      warns about queued answers and offers an explicit sync before the device purge
- [x] Cleanup wired to M2: `speaklab.vocab.*` keys purged, repository caches and timers disposed on
      sign-out and account switch
- [x] Vocabulary results never reach assessments (`assessment-isolation.test.ts`)
- [x] Tests: 305 unit (PGlite scheduler parity, outbox, cloud repository, import, cleanup, badge,
      sign-out guard), 22 PGlite RLS tests, 7 full-stack RLS tests, real-auth browser scenario
      (online answer, offline queue + warning, guarded sign-out, device 2 restore)

Remaining for M4: audio assets + listening mode, spoken-use mode (M7), tutor assignment of word sets
and a tutor view of `student_vocabulary` (M6), parameter tuning from real review data.

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
