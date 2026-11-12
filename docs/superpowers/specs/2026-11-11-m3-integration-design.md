# M3 integration design — curriculum engine on the authenticated foundation

Date: 2026-11-11. Author: Agent 1 on branch `m3-integration`. Status: implemented, awaiting review.

## Intent

Bring Agent 2's standalone M3 work (`worktree-m3-curriculum`, 712feec: schemas, 70-chapter map,
exercise engine, components, A0-01) into the real app: authenticated learners, Supabase persistence
under RLS, and server-side assessment integrity. Integration, not a rewrite: the M3 screens,
schemas, grading engine and content are kept; only the persistence behind the existing ports and
the assessment flow change.

## Goals

- Learners use their real identity; progress, attempts and chapter completion live in Postgres
  rows the learner owns (RLS `student_id = auth.uid()`), readable by the linked tutor only.
- Progress follows the account across devices; nothing about a learner survives sign-out or an
  account switch on a shared device; preview progress is never imported into a real account.
- Chapter checks are graded on the server from raw answers. Students cannot submit scores,
  mastery or assessment rows. Attempt ids are idempotency keys; retake limits, expiry and
  correct-answer disclosure are server decisions.
- The journey starts at A0-01. The A2 Past Continuous showcase chapter exists as real content at
  its place in the map and is reached by completing A2-06 or by tutor placement.
- The tutor can unlock or skip chapters, place a learner at a level, and allow assessment
  retakes, from the student profile.

## Non-goals

- M4 (vocabulary) and M5 (progress analytics): untouched, branch `worktree-m4-vocabulary` stays.
- Content in the database (`lesson_content`): content stays bundled and versioned by
  `chapter.version`; the server grades from the same bundle.
- Audio, listening exercise types, AI evaluation.

## Decisions

1. **Server grading reuses the client engine through a generated copy.** The Edge Function
   `assessment` imports `supabase/functions/_shared/features/**`, generated from `src/features`
   by `scripts/sync-function-shared.mjs` (explicit `.ts` extensions, `npm:zod@<ver>`). The copy is
   committed and CI fails when it is stale (`npm run sync:functions:check`). One grading engine,
   one content set, no Deno in the browser build. (ADR-015)
2. **Three trust tiers in the database.** `lesson_progress` + `exercise_attempts`: the learner's
   own practice record, client-written. `chapter_access_overrides`: tutor-written for linked
   students. `assessment_attempts`: service role only; clients SELECT. Chapter completion requires
   a passed assessment attempt, so no client write can complete a chapter. Client rows that claim
   an assessment lesson are dropped by `mergeAssessmentResults` on both sides.
3. **Assessment rules are one shared module.** `assessment-rules.ts`: 3 submitted attempts per
   chapter version, 2 h attempt TTL, answers disclosed only after a pass or on the last attempt,
   `mergeAssessmentResults`, `countUsedAttempts`, `openAttempt`. The memory gateway (preview and
   unit tests) and the Edge Function implement the same rules; the integration suite proves the
   function against Postgres.
4. **Answer keys do not ship for assessment lessons.** `scripts/build-client-content.mjs` generates
   the curriculum real builds import, with assessment keys removed; the full content module is
   only reachable behind a build-time `VITE_UI_PREVIEW` constant. Ordering and matching keys are inherent to the exercise
   presentation and remain (documented in SECURITY.md).
5. **The runner has one extra mode, not a fork.** `ExerciseRunner` with the `assessment` prop
   locks answers (`lock` action), submits them together, and finishes from server results
   (`results` action). Practice lessons are unchanged.
6. **Placement = skip overrides.** "Place at level X" writes `skip` overrides for every chapter
   below X and clears overrides from X upward; progression rules already treat skipped chapters
   as satisfied prerequisites. No placement assessment content yet.
7. **Device hygiene.** `clearStoredProgress` is registered with `registerLocalDataCleaner`; real
   builds never read localStorage progress at all.

## Left to later milestones

Content tables and editor (M6), placement assessment content, listening/audio types, M4 merge,
progress analytics (M5).
