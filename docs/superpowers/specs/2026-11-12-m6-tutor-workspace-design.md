# M6 design — tutor dashboard and teaching workspace

Date: 2026-11-12. Branch `m6-tutor-workspace`. Status: design, then implemented on the branch.

## Audit findings (main 977c121, M0–M5 live)

- Tutor student profile (`StudentDetailPage`): real tabs Overview (account details + a "Learning
  summary" demo notice), Curriculum (M3 overrides, works), Progress (M5, works), History (account
  events). Placeholders: Vocabulary ("M4"), Speaking (M7), Listening (M8), Assignments, Teacher
  notes, Settings ("M6").
- Curriculum tab shows Unlock/Skip for planned (unwritten) chapters; unlocking one opens nothing.
- Student settings: `profiles.support_language`, `preferences` jsonb (`feedbackStyle`,
  `dailySpeakingMinutes`, `showSupportLanguage`) are student-owned (column grants on own row).
- Privileged account actions go through the `student-admin` Edge Function (`invite`, `resend`,
  `revoke`, `set_status`); it verifies the caller and logs `account_events`.
- Authorization helpers already in Postgres: `is_active()`, `is_tutor()`, `tutor_of(uuid)`;
  `account_events` has a closed `event_type` check that each milestone extends.
- Vocabulary rows are readable by the tutor for linked students (M4 RLS); M5 reads them through
  `VocabularyServices.records`. `computeVocabularyStats` (M4) gives learned/mastered/due/
  difficult/recent for any student's records.
- No assignment, submission, feedback or note storage exists.

## Goals

A tutor opens a linked student's profile and can: understand progress (M5 analytics reused),
inspect vocabulary, create and manage homework, review submissions and give feedback, keep
private notes, control curriculum access without being misled by unwritten content, and see
which settings are the student's and which are the tutor's. The student sees homework on the
home page and a Homework section, works on it, submits written answers, and reads feedback.

## Data model (one additive migration `20261112200000_tutor_workspace.sql`)

### `assignments` (tutor-owned)

| Column | Notes |
| --- | --- |
| `id uuid pk` | `gen_random_uuid()` |
| `tutor_id uuid` | FK profiles; must be the tutor (trigger) |
| `kind` | enum `assignment_kind`: `lesson`, `vocabulary`, `written` |
| `title text` | 1–120 chars |
| `instructions text` | ≤ 4000 chars, may be empty |
| `chapter_id`, `lesson_id text` | required for `lesson`, null otherwise; kebab-case ids; must be an authored lesson (checked by the client against the bundle, and by the completion RPC) |
| `review_target int` | required for `vocabulary` (1–500 reviews), null otherwise |
| `due_at timestamptz` | optional |
| `status` | enum `assignment_status`: `draft`, `published`, `cancelled` |
| `published_at`, `cancelled_at` | set by trigger, never by clients |
| `created_at`, `updated_at` | |

### `assignment_recipients` (one row per assignment × student; holds the submission and feedback)

| Column | Notes |
| --- | --- |
| `assignment_id uuid`, `student_id uuid` | composite PK; student must be linked to the assignment's tutor (trigger) |
| `status` | enum `submission_status`: `assigned`, `in_progress`, `submitted`, `reviewed` |
| `draft_text text` | student's saved written work, ≤ 8000 |
| `submitted_text text` | frozen copy at submission (written kind) |
| `evidence jsonb` | server-computed snapshot for lesson/vocabulary completion (`complete_assignment`) |
| `started_at`, `submitted_at`, `reviewed_at`, `returned_at` | set by trigger/RPC |
| `late boolean` | `submitted_at > due_at` at submission time |
| `feedback text` | tutor's feedback, ≤ 4000 |
| `feedback_updated_at` | |
| `created_at`, `updated_at` | |

### `teacher_notes` (private to the tutor)

| Column | Notes |
| --- | --- |
| `id uuid pk` | |
| `tutor_id uuid`, `student_id uuid` | FK profiles; linked (trigger) |
| `body text` | 1–4000 chars |
| `topic text` | `general`, `grammar`, `vocabulary`, `pronunciation`, `speaking`, `listening`, `reading`, `writing`, `behaviour`, `planning` |
| `priority text` | `normal`, `high` |
| `created_at`, `updated_at` | |

No policy for students at all; the table is also excluded from the `authenticated` grants a
student could use (grants exist but RLS has no student-facing policy; verified by tests through
PostgREST as a student: 0 rows, insert refused).

### Events

`account_events.event_type` gains `assignment_published`, `assignment_cancelled`,
`assignment_submitted`, `assignment_returned`, `assignment_reviewed`. Note bodies are never logged.

## Lifecycle (server-enforced by triggers and one RPC)

```
assignment:   draft ──publish──▶ published ──cancel──▶ cancelled
                 └────cancel────────────────────────▶ cancelled
recipient:    assigned ──start──▶ in_progress ──submit──▶ submitted ──review──▶ reviewed
                                        ▲                       │                 │
                                        └──────── return ───────┴─────────────────┘
overdue (derived): assignment published, due_at < now, recipient not submitted/reviewed
```

Rules (all in `assignments_guard` / `recipients_guard` triggers):

- Only `is_tutor()` inserts assignments; `tutor_id` must be `auth.uid()`; status on insert is
  `draft` or `published`.
- Tutor edits (`title`, `instructions`, `due_at`, targets) are allowed while `draft`, and while
  `published` as long as no recipient has submitted; `kind` and targets never change after publish.
  `status` may only move draft→published, draft→cancelled, published→cancelled. Timestamps are
  overwritten by the trigger. A cancelled assignment is frozen.
- Recipients are inserted only by the tutor who owns the assignment, only for linked students,
  while the assignment is not cancelled. Deleting a recipient is allowed only while the
  assignment is `draft` (otherwise cancel the assignment).
- Students may update only their own row and only `draft_text` and `status`:
  `assigned→in_progress` (saving a draft does this automatically), `in_progress|assigned→submitted`
  for `written` assignments with non-empty text. The trigger freezes `submitted_text`, sets
  `submitted_at`, computes `late`, refuses when the assignment is not `published` or is
  cancelled, and refuses any other column change (feedback, evidence, timestamps).
- `lesson` and `vocabulary` recipients cannot be set to `submitted` by an update at all. The
  student calls `complete_assignment(p_assignment_id)` (security definer): it re-checks the
  session, loads the assignment, verifies the evidence from the learner's own records
  (`lesson`: `lesson_progress` completed for a practice lesson, or a passed submitted
  `assessment_attempts` row for a chapter check; `vocabulary`: applied `vocabulary_reviews`
  since `published_at` ≥ `review_target`), stores a snapshot in `evidence`, and marks the row
  `submitted`. No evidence, no completion. Idempotent: a second call returns the same state.
- Tutor updates on recipients: `feedback` (any time after assignment publish), `status`
  `submitted→reviewed` (sets `reviewed_at`), `submitted|reviewed→in_progress` ("return for
  changes", sets `returned_at`, keeps the submission text visible to both, clears `late` until
  resubmitted). Tutors never write `draft_text`/`submitted_text`.
- Disabled accounts: every policy includes `is_active()`, so a disabled student cannot read or
  write assignments, and `complete_assignment` refuses.
- Due dates: informative. Late submissions are accepted and flagged `late`; the UI shows
  "overdue" for unsubmitted work past the due date.
- Resubmission: only after the tutor returns the work. Students cannot edit a submitted answer.

## Permissions summary

| Table | Student | Tutor |
| --- | --- | --- |
| `assignments` | SELECT where a recipient row for `auth.uid()` exists and status ≠ draft | SELECT/INSERT/UPDATE/DELETE own (`tutor_id = auth.uid()`), delete only drafts |
| `assignment_recipients` | SELECT/UPDATE own row (trigger limits columns and transitions) | SELECT/INSERT/UPDATE/DELETE for own assignments and linked students (trigger limits columns) |
| `teacher_notes` | nothing | SELECT/INSERT/UPDATE/DELETE own notes about linked students |
| `complete_assignment` | EXECUTE (acts as the session user) | not needed |

## UI

- **Tutor profile tabs**: Overview (M5 summary + assignment counts + quick links; account card
  kept), Vocabulary (M4 stats + searchable word list + word detail), Progress (M5), Assignments
  (list, create/edit dialog, publish/cancel, review panel with evidence or text, feedback,
  reviewed/return), Teacher notes (list, filter by topic/priority/search, create/edit/delete with
  confirmation), Curriculum (planned chapters: controls disabled with an explanation; legend),
  History, Settings (student-owned preferences read-only with explanation; tutor controls:
  access status via the existing function, placement via the existing overrides; AI settings
  explicitly deferred to M7). Speaking and Listening stay placeholders (M7/M8).
- **Student**: Home gets a "Homework" card (due soon, overdue, awaiting feedback); `/homework`
  lists all; `/homework/:id` shows instructions, due date, status, the linked lesson or
  vocabulary progress with a "Mark as done" that calls the RPC, or the written editor with
  server-saved drafts and Submit; tutor feedback when present. Status chips: pending, in
  progress, submitted, reviewed, overdue, cancelled.
- Preview mode (no backend) shows honest empty states for assignments and notes.

## Tests

PGlite suite (`supabase/tests/pglite/tutor-workspace.test.ts`, runs locally): grants, RLS,
triggers, RPC evidence checks, privacy of notes, forged status, disabled accounts, duplicate
calls. Full-stack suite in CI (`supabase/tests/assignments.test.ts`): GoTrue sessions through
PostgREST for the same guarantees plus an unrelated student. Unit tests for the status/overdue
helpers and the UI (tutor create/review, student submit). Browser: tutor assigns, student
submits, tutor reviews, student reads feedback.

## Deferred

File uploads, AI grading, calendar sync, AI feedback styles/quotas (M7), listening (M8),
assigning to students of other tutors (there is one tutor).
