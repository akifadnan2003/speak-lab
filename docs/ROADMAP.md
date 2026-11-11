# SpeakLab — Roadmap and Milestones

Last updated 2026-11-11. Status legend: ✅ done · 🔄 in progress · ⏳ planned.

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Repository, architecture, documentation, commands, test strategy | ✅ |
| M1 | Application foundation and design system | ✅ |
| M2 | Authentication and roles | ⏳ next |
| M3 | Curriculum and exercise engine | 🔄 frontend slice done; backend persistence pending |
| M4 | Vocabulary and revision | 🔄 frontend slice done; backend persistence pending |

| M2 | Authentication, authorization and student invitations | ✅ (live in production 2026-11-11) |
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

## M3 — Curriculum and Exercise Engine 🔄

Design: `docs/superpowers/specs/2026-11-03-m3-curriculum-engine-design.md`.

**Integration notes for the standalone M3 work (branch `worktree-m3-curriculum`):**

- Register the localStorage repository's `clearStoredProgress()` with
  `registerLocalDataCleaner()` from `src/lib/local-data.ts` so sign-out and account switching
  wipe it (the auth provider already purges every `speaklab.*` key and IndexedDB database).
- Persist progress, attempts and assessment results to Supabase under the student's own rows
  (RLS: `student_id = auth.uid()`, tutor read via `tutor_students`); local storage becomes a cache
  or offline queue with client-generated idempotency keys, never the source of truth.
- Assessment integrity (retake limits, timing, answer validation) is enforced server-side in that
  integration; the current localStorage retake record cannot guarantee it.
- M3 is not merged until M2 is verified independently.

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

Done (frontend-independent slice, branch `worktree-m3-curriculum`):

- [x] Zod schemas for chapters, lessons, content blocks and nine exercise types; curriculum-level
      validation (unique ids, prerequisites exist, no cycles)
- [x] Full A0 → C1 map (70 chapters) with objectives, skills and prerequisites; planned chapters
      shown honestly as "not written yet"
- [x] Exercise engine: deterministic grading with partial credit, text normalisation, hints,
      explanations (EN + optional AZ), three-attempt practice / one-attempt assessment session
      reducer, seeded shuffling
- [x] Components: multiple choice, fill-in-the-blank (word bank), sentence ordering (tap + arrow
      keys), error correction, matching (tap-tap), question formation, sentence transformation,
      speaking prompt (self-checked, clearly labelled), guided writing (checklist), runner with
      summary; keyboard and touch accessible, 320px-safe
- [x] Chapter A0-01 fully authored: 11 lessons, 130+ exercises, 18+ speaking prompts, Azerbaijani
      mechanism explanations
- [x] Progression rules (unlock, assessment gating, chapter completion, tutor override model)
- [x] `ContentSource` / `ProgressRepository` ports with static content + localStorage progress
      (device-only, labelled in the UI); Learn, Chapter and Lesson screens and the Home "Continue"
      card run on the real engine
- [x] 71 new unit/component tests; e2e updated

Remaining for M3 (needs M2 and backend work):

- Supabase `ProgressRepository` and versioned `lesson_content` tables; tutor unlock/skip UI (M6)
- Listening/dictation exercise types (need audio) and placement assessment content
- Further chapters (A0-02 onward) authored with the same schemas

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

Remaining for M4: Supabase repository and tables, audio assets + listening mode, spoken-use mode
(M7), tutor assignment of word sets (M6), parameter tuning from real review data.

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
