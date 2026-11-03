# SpeakLab — Roadmap and Milestones

Last updated 2026-11-03. Status legend: ✅ done · 🔄 in progress · ⏳ planned.

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Repository, architecture, documentation, commands, test strategy | ✅ |
| M1 | Application foundation and design system | ✅ |
| M2 | Authentication and roles | ⏳ next |
| M3 | Curriculum and exercise engine | 🔄 frontend slice done; backend persistence pending |
| M4 | Vocabulary and revision | 🔄 frontend slice done; backend persistence pending |
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

## M3 — Curriculum and Exercise Engine 🔄

Design: `docs/superpowers/specs/2026-11-03-m3-curriculum-engine-design.md`.

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
