# M5 design — student progress and learning analytics

Date: 2026-11-12. Branch `m5-student-progress`. Status: implementation plan, then implemented.

## Audit findings

- Production (`main` 8f42e7a) serves M2–M4 at https://speaklab.akiflabs.net/; migrations
  `20261103120000`, `20261111150000`, `20261111160800`, `20261111160900` are applied. One real
  student exists. Nothing in M5 touches accounts or existing rows.
- Remaining demo data on the student side: `src/demo/student-home.ts` drives the whole of
  `StudentHomePage` (level badge, streak, course progress, speaking target, vocabulary due,
  weekly minutes, recent activity, assignments, weak topics, achievements) and the whole of
  `ProgressPage`. The tutor profile's `grammar` tab is an "arrives in M5" placeholder.
- Real records already available under RLS (student: own rows; tutor: linked students):
  `lesson_progress` (status, best/last score, `completed_at`), `exercise_attempts` (one row per
  answer, `attempt_number` within a run, `correct`, `score`, `created_at`), `assessment_attempts`
  (server-graded, `status`, `score`, `passed`, `submitted_at`), `student_vocabulary` (server SRS
  state incl. `lapses`, counters), `vocabulary_reviews` (every answer, `applied`, `reviewed_at`).
  Content: 70 chapters in the map, **2 authored** (A0-01, A2-07); lesson `kind` is one of the
  six skills, `pronunciation`, or `assessment`. There are no listening lessons.
- Reusable logic: `computeProgression` (chapter/lesson statuses), `mergeAssessmentResults`,
  `computeVocabularyStats` and `computeStreak`, `dateKey`/`daysBetweenKeys` (time-zone aware
  calendar days), `WeeklyActivityChart` (CSS bars + sr table), `ActivityList`, `Stat`,
  `Progress`, `ProgressRing`, `EmptyState`, skill colour tokens.
- Caveat found: `listAttempts` and `AssessmentGateway.listAttempts` fetch without paging, so a
  student with more than 1000 attempts would be silently truncated by PostgREST. Fixed in M5.

## Decisions

1. **No new tables, views or RPCs.** Analytics are pure TypeScript over the records the client
   can already read under RLS (`src/features/progress/analytics/*`). The tutor summary reuses the
   same functions with a linked student's id; RLS decides what comes back. Caches are TanStack
   queries keyed `['student', <id>, …]`, in memory only, cleared on sign-out and account switch by
   the existing `queryClient.clear()`.
2. **One metric vocabulary, documented in `docs/PROGRESS_METRICS.md`.** Participation (did it),
   completion (finished it), accuracy (how often right), mastery (sustained evidence) are kept
   apart in names and UI.
3. **Calendar days are the learner's device time zone** (`Intl`), the same rule the vocabulary
   streak already uses. A week is today and the six previous days. The streak counts consecutive
   active days ending today, or yesterday if today has nothing yet.
4. **Skills show evidence or `Not assessed yet`.** Grammar and reading: first-try accuracy over
   graded exercises in lessons of that kind (minimum 8 distinct exercises). Vocabulary:
   server-owned review outcomes and mastered share (minimum 10 applied reviews). Speaking and
   writing: self-checked only, labelled as such, never scored. Listening: no content yet.
5. **Weak topics need evidence.** A lesson is weak when at least 6 distinct exercises were tried
   and first-try accuracy is below 70%; a chapter check is weak when the best submitted score is
   below the pass mark; vocabulary is weak when at least 3 words have two or more lapses. Each
   item links only to content the learner can open now.
6. **Timeline and achievements are derived, deterministic and idempotent**: stable ids built
   from the record keys, so re-rendering or re-fetching never duplicates them. Achievements: first
   lesson, first chapter passed, first vocabulary review, 50 reviews, 25 words learned, 7-day
   streak, perfect chapter check.
7. **Chapters are counted as available only when authored**; planned chapters are shown as
   "coming", never as progress denominators.

## Out of scope (M6/M7)

Assignments, tutor notes, manual grading, feedback, AI settings and usage, speaking scores,
listening content, time-on-task.
