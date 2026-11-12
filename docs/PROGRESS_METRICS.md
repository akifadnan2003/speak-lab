# Progress metrics: definitions and sources (M5)

Every number on the student home page, the Progress page and the tutor's Progress tab is
computed by the pure functions in `src/features/progress/analytics/` from records the signed-in
account can read under Row Level Security. Nothing is estimated, sampled or stored separately;
the same records always give the same numbers. The tutor sees exactly what the student sees,
for linked students only.

Conventions used throughout:

- **Calendar day**: the day in the device's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`),
  derived from each record's UTC instant. A review at 00:30 Baku time belongs to that Baku day,
  not to the previous UTC day. The tutor's screen uses the tutor's device zone.
- **Participation**, **completion**, **accuracy** and **mastery** are different things and are
  never mixed: tried ≠ finished ≠ right ≠ retained.
- **Practice lesson**: any lesson of an authored chapter except the chapter check. Planned
  chapters have no lessons and never count.
- **Submitted chapter check**: an `assessment_attempts` row with `status = 'submitted'`. Open,
  expired or voided attempts are not outcomes.
- **Not possible yet** (and therefore not shown): time on task (timestamps are not durations),
  speaking or writing scores (self-checked until the AI coach, M7), listening (no content).

## 1. Learning overview (`computeOverview`)

| Metric | Definition | Source |
| --- | --- | --- |
| Level | Level of the first chapter that is in progress or available in curriculum order; if the learner has completed a higher level than that, the highest completed level. Labelled *placed by your tutor* when earlier chapters were skipped by a tutor placement and no completed chapter is at that level. | `computeProgression` over `lesson_progress` + `chapter_access_overrides` |
| Lessons completed | Practice lessons with `status = 'completed'`. The chapter check is not a lesson here. | `lesson_progress` |
| Lessons in progress | Practice lessons with `status = 'in_progress'`. | `lesson_progress` |
| Chapters completed | Authored chapters whose progression status is `completed` (every lesson done, speaking done, chapter check at or above the pass mark). | progression |
| Chapters available | Authored chapters that are open or finished (`available`, `in_progress`, `completed`). Skipped and locked chapters and all planned chapters are excluded. The UI also says how many chapters are still "coming". | progression |
| Chapter checks | Submitted attempts, and the number of distinct chapters with at least one passed attempt. | `assessment_attempts` |
| Latest activity | Newest instant among lesson progress updates, exercise attempts, submitted checks and vocabulary reviews. | all four tables |
| Learning streak | Consecutive active days ending today, or ending yesterday when today has no activity yet (so a streak is not "lost" at 00:01). An **active day** has at least one practice lesson completed, exercise answered, chapter check submitted or vocabulary answer recorded. Opening a page is not activity. | derived (`computeStreak`) |
| Active days | Number of distinct active days ever. | derived |
| Words learned / due / mastered | `student_vocabulary` rows with `stage ≠ 'new'`; of those, rows whose `due_at` is at or before now; rows with `stage = 'mastered'`. The server owns these stages. | `student_vocabulary` |

The overview is **empty** when there are no active days and no lesson in progress; the UI then
shows an invitation, never zeros dressed up as progress.

## 2. Weekly activity (`computeWeeklyActivity`)

Seven calendar days ending today, oldest first. Per day:

| Signal | Counted as | Double-counting rule |
| --- | --- | --- |
| Lessons completed | Practice lessons whose `completed_at` falls on the day | One per lesson (a lesson has one completion instant) |
| Exercises practised | Distinct exercises with at least one attempt on the day | Retries of the same exercise that day count once; attempt rows are de-duplicated by id |
| Vocabulary reviews | Vocabulary answers whose `reviewed_at` falls on the day | Each review id once |
| Chapter checks | Submitted attempts whose `submitted_at` falls on the day | Each attempt once |

The bar height is the sum of the four signals (counts, not minutes). A `sr-only` table carries
the same numbers.

## 3. English skills (`computeSkills`)

Six skills are reported: grammar, vocabulary, reading, listening, writing, speaking. Pronunciation
lessons count towards speaking participation. For each skill:

- **Participation**: practice lessons of that kind completed; distinct exercises of that kind tried.
- **Evidence** (one of):
  - `measured` with **first-try accuracy**: for every exercise, the most recent attempt with
    `attempt_number = 1` (the first answer of the latest run) is taken, and its 0–1 score is
    averaged. Retries inside a run and earlier runs are ignored, so repeating a lesson neither
    inflates nor double-counts. Only engine-graded exercise types count; self-checked types
    (speaking prompt, guided writing) never do. Shown once at least **8** graded exercises exist.
  - `measured` for **vocabulary**: share of correct answers over all recognition and recall
    reviews, plus the share of learned words that are `mastered` (server stage). Shown once at
    least **10** reviews exist.
  - `insufficient`: fewer graded exercises or reviews than the minimum. Displayed as
    **Not assessed yet** with the count still needed. Never 0%.
  - `self_checked`: speaking and writing. Displayed as **Self-checked only**; no score.
  - `no_content`: listening, until listening lessons exist.

Chapter-check results are not folded into skill accuracy: a chapter check mixes skills and is
reported on its own (overview, timeline, weak topics).

## 4. Needs more practice and next steps (`computePracticeInsights`)

A topic is listed only with enough evidence:

| Kind | Rule | Link |
| --- | --- | --- |
| Lesson | At least **6** distinct graded exercises tried and first-try accuracy below **70%** | The lesson, when it is open to the learner; otherwise no link |
| Chapter check | Best submitted score below the pass mark | The chapter check if it is open, else the chapter page |
| Vocabulary | At least **3** words with two or more lapses (`student_vocabulary.lapses`) | Active-recall practice |

Lessons that were tried but have fewer than 6 graded exercises are counted and shown as
**Not enough practice data**. Items are sorted by accuracy, lowest first.

**Next steps** (at most four, in this order): continue or start the next lesson of the current
chapter; take the chapter check when it is available; review words that are due; practise the
weakest topic that has a link. Every link points at content that exists and is open.

## 5. Learning history (`computeTimeline`)

Newest first. Each entry has a stable id built from the record key, so re-fetching never
duplicates it:

| Entry | Record | Id |
| --- | --- | --- |
| Completed *lesson* | `lesson_progress` completed practice lesson, at `completed_at` | `lesson:<chapter>/<lesson>` |
| Chapter check passed / not passed yet | Each submitted `assessment_attempts` row, at `submitted_at`, with score, pass mark and attempt number | `check:<attempt id>` |
| Chapter complete | Once per chapter, at the first passing attempt, only when progression says the chapter is completed | `chapter:<chapter>` |
| First vocabulary review | Earliest review by `reviewed_at` | `vocabulary:first` |
| N vocabulary reviews | The 10th, 50th, 100th, 250th, 500th, 1000th review (ids de-duplicated, ordered by `reviewed_at`) | `vocabulary:<n>` |

## 6. Achievements (`computeAchievements`)

Deterministic and tied to records; signing in or opening a page earns nothing.

| Achievement | Earned when | `earnedAt` |
| --- | --- | --- |
| First lesson completed | Any practice lesson completed | Its `completed_at` |
| First chapter check passed | First submitted attempt with `passed = true` | Its `submitted_at` |
| Perfect chapter check | First submitted attempt with score 100 | Its `submitted_at` |
| First vocabulary review | Any review | Its `reviewed_at` |
| 50 vocabulary reviews | 50 distinct reviews | The 50th review's `reviewed_at` |
| 25 words learned | 25 words with `stage ≠ 'new'` and a `first_learned_at` | The 25th `first_learned_at` |
| 7 days in a row | Seven consecutive active days (same definition as the streak) | End of the seventh day |

Countable achievements show progress (e.g. 12/50) until earned.

## 7. Scope, caching and privacy

- All reads go through the existing repositories (`ProgressRepository`, `AssessmentGateway`,
  `VocabularyRepository`) under TanStack keys `['student', <id>, …]`. The cache is in memory
  only and is cleared on sign-out and account switch by the auth provider.
- No new table, view, RPC or migration. RLS is unchanged: a student receives only their own rows;
  the tutor receives rows of students linked in `tutor_students`.
- Reads of `exercise_attempts` and `assessment_attempts` are paged (1000 rows per request), so
  long histories are complete rather than silently truncated.
- Cost grows with the number of records of one student; nothing scans other students.
