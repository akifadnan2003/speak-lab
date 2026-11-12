# Homework, feedback and teacher notes (M6)

How the tutor workspace stores and protects homework, submissions, feedback and private notes.
Schema: `supabase/migrations/20261112200000_tutor_workspace.sql`. Design:
`docs/superpowers/specs/2026-11-12-m6-tutor-workspace-design.md`. Decision: ADR-022.

## 1. Data model

| Table | Owner | Rows |
| --- | --- | --- |
| `assignments` | tutor | One per homework: `kind` (`lesson`, `vocabulary`, `written`), title, instructions, target (`chapter_id` + `lesson_id` + `requires_pass`, or `review_target`), optional `due_at`, `status` (`draft`, `published`, `cancelled`), server-set `published_at` / `cancelled_at`. |
| `assignment_recipients` | tutor (row), student (their text) | One per assignment × student: `status` (`assigned`, `in_progress`, `submitted`, `reviewed`), `draft_text`, frozen `submitted_text`, server-computed `evidence`, `started_at` / `submitted_at` / `reviewed_at` / `returned_at`, `late`, `feedback`, `feedback_updated_at`. |
| `teacher_notes` | tutor | Private notes: body (1–4000 chars), topic, priority. **No student-facing policy.** |

`account_events` records `assignment_published`, `assignment_cancelled`, `assignment_submitted`,
`assignment_returned`, `assignment_reviewed` (subject: the student; actor: whoever acted). Note
bodies are never logged.

## 2. Lifecycle (enforced by triggers, never by the client)

```
assignment   draft ──publish──▶ published ──cancel──▶ cancelled
                └───────────────cancel───────────────▶ cancelled
submission   assigned ──start──▶ in_progress ──submit──▶ submitted ──review──▶ reviewed
                                      ▲                      │                  │
                                      └────── return ────────┴──────────────────┘
```

- **Publish** sets `published_at` (server clock). **Cancel** sets `cancelled_at` and freezes the
  assignment; recipients keep whatever they submitted and any feedback.
- Tutor edits (title, instructions, due date) are allowed on drafts and on published homework
  **until any recipient has submitted**; after that the assignment must be cancelled and
  reassigned. Kind and target never change after publishing. Only drafts can be deleted.
- A student saving a draft moves `assigned → in_progress` and sets `started_at`.
- **Written** homework is submitted by the student with non-empty text: the trigger copies the
  draft into `submitted_text`, sets `submitted_at`, and flags `late` when past `due_at`. Late
  submissions are accepted.
- **Lesson** and **vocabulary** homework cannot be set to `submitted` by an update at all. The
  student calls `complete_assignment(assignment_id)`, which checks the learner's own records:
  - lesson without `requires_pass`: a `lesson_progress` row with `status = 'completed'`
    (practice completion, self-reported like all practice progress);
  - lesson with `requires_pass` (a chapter check): a **passed, submitted** `assessment_attempts`
    row, i.e. a server-graded result; forged lesson progress for the check's id is ignored;
  - vocabulary: at least `review_target` non-voided `vocabulary_reviews` recorded **after**
    `published_at`.
  The evidence is stored on the row (`evidence` jsonb) and shown to both sides. Without evidence
  the function returns `completed: false` with the current progress and changes nothing.
  Calling it again after completion is idempotent.
- **Review**: the tutor writes `feedback` (any time after publishing) and moves
  `submitted → reviewed` (`reviewed_at`). **Return for changes** moves `submitted|reviewed →
  in_progress` (`returned_at`), keeps the last `submitted_text` visible to both, and lets the
  student edit and resubmit. Students cannot edit a submitted answer otherwise.
- **Overdue** is derived in the UI: published, `due_at` in the past, not submitted or reviewed.
  Due dates are informative; nothing closes automatically.
- No numeric grades exist. Scores are shown only when they come from a chapter check.

## 3. Permissions

| Actor | `assignments` | `assignment_recipients` | `teacher_notes` |
| --- | --- | --- | --- |
| Student (active) | SELECT published or cancelled assignments addressed to them | SELECT own row; UPDATE own row limited by trigger to `draft_text` and the `status` moves above | nothing (no policy; `SELECT` returns no rows, writes are refused) |
| Tutor | SELECT/INSERT/UPDATE own; DELETE own drafts | SELECT/INSERT/UPDATE/DELETE for own assignments; trigger limits writes to `feedback` and review transitions; recipients must be linked students; delete only on drafts | SELECT/INSERT/UPDATE/DELETE own notes about linked students |
| Disabled account | nothing (every policy requires `is_active()`); `complete_assignment` refuses | | |
| Anonymous | nothing | nothing | nothing |

Policy cross-checks use `security definer` helpers (`assignment_owner`, `is_assignment_recipient`)
so the two tables' policies do not recurse. `is_service_role()` lets Edge Functions and tests act
with the service key; clients cannot forge it because PostgREST derives the claims from the JWT.

## 4. Client behaviour

- Tutor: `src/features/tutor/StudentAssignmentsSection.tsx` (create as draft or assign now, edit,
  publish, cancel with confirmation, review panel), `StudentNotesSection.tsx`,
  `StudentOverviewSection.tsx` (homework at a glance). Data access in `src/features/assignments/api.ts`.
- Student: home-page card, `/homework`, `/homework/:id` (server-saved drafts, submit with
  confirmation, "Mark as done" through the function, feedback).
- All student-scoped queries live under `['student', <id>, …]` and are cleared on sign-out and
  account switch; tutor queries live under `['tutor', …]` and are cleared with the rest of the
  query cache on sign-out. Drafts are saved to the server, not to the device, so nothing of a
  submission survives on a shared phone.
- Preview mode (no backend) shows honest empty states; nothing is simulated.

## 5. Tests

- `supabase/tests/pglite/tutor-workspace.test.ts` (22, runs without Docker): grants, policies,
  every transition, forged states, disabled accounts, evidence checks, idempotency, note privacy.
- `supabase/tests/assignments.test.ts` (full stack, CI): the same guarantees through GoTrue +
  PostgREST, including an unrelated student and a disabled student.
- `src/features/assignments/model.test.ts`: derived statuses, overdue, ordering, counts.
- Component tests for the review panel and the student detail page; browser scenario in
  `e2e/auth.spec.ts` (tutor assigns, student submits, tutor reviews, student reads feedback, note
  privacy through the API).

## 6. Known limitations

- Practice-lesson completion is self-reported (M3 design); the tutor sees it labelled as such.
- Vocabulary homework counts answers, not correctness (it is formative practice).
- One tutor only; assigning to another tutor's students is not modelled.
- No attachments, calendars, reminders or email notifications (SMTP is deferred).
