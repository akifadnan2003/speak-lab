import { zodResolver } from '@hookform/resolvers/zod'
import { Ban, ClipboardList, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Textarea } from '@/components/ui/input'
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssignmentMutations, useStudentAssignments, WorkspaceError, type AssignmentDraft } from '@/features/assignments/api'
import { describeEvidence, describeTarget, displayStatus, DISPLAY_STATUS_LABEL, DISPLAY_STATUS_VARIANT, KIND_LABEL, sortHomework, type HomeworkItem } from '@/features/assignments/model'
import { useProgression } from '@/features/curriculum/CurriculumProvider'
import { LESSON_KIND_LABEL } from '@/features/curriculum/schema'
import type { AssignmentKind } from '@/lib/supabase/database.types'
import { formatRelative } from '@/lib/utils'
import { useStudents, type StudentAccount } from './api'

/**
 * Homework for one linked student: list, create/edit (draft or publish), cancel, and the review
 * panel with the submission (text or verified evidence), feedback, "Mark reviewed" and
 * "Return for changes". Every transition is validated again by the database triggers.
 */
const schema = z
  .object({
    kind: z.enum(['lesson', 'vocabulary', 'written']),
    title: z.string().trim().min(1, 'Give the homework a title').max(120, 'At most 120 characters'),
    instructions: z.string().max(4000, 'At most 4000 characters'),
    lesson: z.string(),
    reviewTarget: z.number({ error: 'Enter a number' }).int().min(1).max(500),
    dueAt: z.string(),
    studentIds: z.array(z.string()).min(1, 'Choose at least one student'),
  })
  .refine((v) => v.kind !== 'lesson' || v.lesson.length > 0, { message: 'Choose a lesson', path: ['lesson'] })
type Values = z.infer<typeof schema>

function toIso(local: string): string | null {
  if (!local) return null
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function StudentAssignmentsSection({ account, tutorId }: { account: StudentAccount; tutorId: string }) {
  const homework = useStudentAssignments(account.id)
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<HomeworkItem | 'new' | null>(null)
  const [now] = useState(() => new Date())
  const items = homework.data ? sortHomework(homework.data, now) : []
  const openId = params.get('open')
  const open = items.find((i) => i.assignment.id === openId) ?? null

  if (homework.isError) return <EmptyState compact title="Homework could not be loaded" description={homework.error instanceof Error ? homework.error.message : 'Try again.'} />

  return (
    <div className="flex flex-col gap-4" data-testid="student-assignments">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Homework for {account.fullName || account.email}. Lesson and vocabulary homework completes itself from the student&apos;s records; written answers are reviewed by you.
        </p>
        <Button onClick={() => setEditing('new')} data-testid="new-assignment">
          <Plus aria-hidden /> New homework
        </Button>
      </div>

      {homework.isPending ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No homework yet" description="Assign a lesson, a vocabulary review target or a written task. The student sees it on their home page." compact />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Assignments">
          {items.map((item) => (
            <AssignmentRow key={item.assignment.id} item={item} now={now} selected={open?.assignment.id === item.assignment.id} onOpen={() => setParams({ open: item.assignment.id })} />
          ))}
        </ul>
      )}

      {open ? <ReviewPanel key={open.assignment.id} item={open} tutorId={tutorId} account={account} now={now} onEdit={() => setEditing(open)} onClose={() => setParams({})} /> : null}

      {editing ? (
        <AssignmentDialog
          tutorId={tutorId}
          defaultStudent={account}
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function AssignmentRow({ item, now, selected, onOpen }: { item: HomeworkItem; now: Date; selected: boolean; onOpen: () => void }) {
  const { assignment, submission } = item
  const status = displayStatus(assignment, submission, now)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-pressed={selected}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected ? 'border-primary bg-primary-soft/40' : 'border-line bg-surface'}`}
        data-testid="assignment-row"
        data-status={status}
        data-kind={assignment.kind}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{assignment.title}</span>
          <span className="block text-xs text-fg-muted">
            {KIND_LABEL[assignment.kind]}
            {assignment.dueAt ? ` · due ${new Date(assignment.dueAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ' · no due date'}
            {submission.submittedAt ? ` · submitted ${formatRelative(submission.submittedAt)}${submission.late ? ' (late)' : ''}` : ''}
          </span>
        </span>
        <Badge variant={DISPLAY_STATUS_VARIANT[status]}>{DISPLAY_STATUS_LABEL[status]}</Badge>
      </button>
    </li>
  )
}

function ReviewPanel({ item, tutorId, account, now, onEdit, onClose }: { item: HomeworkItem; tutorId: string; account: StudentAccount; now: Date; onEdit: () => void; onClose: () => void }) {
  const { assignment, submission } = item
  const { setStatus, remove, review } = useAssignmentMutations(tutorId)
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const status = displayStatus(assignment, submission, now)
  const busy = setStatus.isPending || remove.isPending || review.isPending
  const error = setStatus.error ?? remove.error ?? review.error
  const studentIds = [account.id]
  const canEdit = assignment.status === 'draft' || (assignment.status === 'published' && submission.status !== 'submitted' && submission.status !== 'reviewed')
  const { chapters } = useProgression(account.id)
  const lessonTitle = assignment.kind === 'lesson' ? chapters?.find((c) => c.id === assignment.chapterId)?.lessons.find((l) => l.id === assignment.lessonId)?.title : undefined

  return (
    <Card data-testid="review-panel" data-status={status}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{assignment.title}</h3>
            <p className="text-sm text-fg-muted">
              {describeTarget(assignment, lessonTitle)} · {assignment.dueAt ? `due ${new Date(assignment.dueAt).toLocaleString()}` : 'no due date'} ·{' '}
              {assignment.publishedAt ? `assigned ${formatRelative(assignment.publishedAt)}` : 'draft, not visible to the student'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {assignment.status === 'draft' ? (
              <Button size="sm" disabled={busy} onClick={() => setStatus.mutate({ id: assignment.id, status: 'published', studentIds })} data-testid="publish-assignment">
                <Send aria-hidden /> Publish
              </Button>
            ) : null}
            {canEdit ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={onEdit} data-testid="edit-assignment">
                <Pencil aria-hidden /> Edit
              </Button>
            ) : null}
            {assignment.status === 'draft' ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove.mutate({ id: assignment.id, studentIds })} data-testid="delete-assignment">
                <Trash2 aria-hidden /> Delete draft
              </Button>
            ) : assignment.status === 'published' ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmCancel(true)} data-testid="cancel-assignment">
                <Ban aria-hidden /> Cancel
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close review panel">
              Close
            </Button>
          </div>
        </div>

        {assignment.instructions ? <p className="rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-wrap">{assignment.instructions}</p> : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Submission</h4>
            {submission.status === 'assigned' ? (
              <p className="text-sm text-fg-muted">Not started.</p>
            ) : submission.status === 'in_progress' && !submission.submittedText ? (
              <p className="text-sm text-fg-muted">In progress{submission.startedAt ? ` since ${formatRelative(submission.startedAt)}` : ''}. Drafts stay private until submitted.</p>
            ) : null}
            {submission.evidence ? (
              <p className="rounded-lg border border-success/40 bg-success-soft p-3 text-sm text-success-soft-fg" data-testid="submission-evidence">
                {describeEvidence(submission.evidence)}
              </p>
            ) : null}
            {submission.submittedText ? (
              <blockquote className="rounded-lg border border-line p-3 text-sm whitespace-pre-wrap" data-testid="submission-text">
                {submission.submittedText}
              </blockquote>
            ) : null}
            {submission.submittedAt ? (
              <p className="text-xs text-fg-muted">
                Submitted {new Date(submission.submittedAt).toLocaleString()}
                {submission.late ? ' · after the due date' : ''}
                {submission.returnedAt ? ` · returned for changes ${formatRelative(submission.returnedAt)}` : ''}
                {submission.reviewedAt ? ` · reviewed ${formatRelative(submission.reviewedAt)}` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback">Your feedback</Label>
            <Textarea id="feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={4000} rows={5} disabled={assignment.status !== 'published' || busy} placeholder="What went well, what to work on next." data-testid="feedback-input" />
            <FieldHint>Visible to the student only. No numeric grade: scores come only from chapter checks.</FieldHint>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy || assignment.status !== 'published' || feedback === (submission.feedback ?? '')} onClick={() => review.mutate({ assignmentId: assignment.id, studentId: account.id, feedback })} data-testid="save-feedback">
                Save feedback
              </Button>
              {submission.status === 'submitted' ? (
                <Button size="sm" disabled={busy} onClick={() => review.mutate({ assignmentId: assignment.id, studentId: account.id, feedback, status: 'reviewed' })} data-testid="mark-reviewed">
                  Mark reviewed
                </Button>
              ) : null}
              {submission.status === 'submitted' || submission.status === 'reviewed' ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => review.mutate({ assignmentId: assignment.id, studentId: account.id, feedback, status: 'in_progress' })} data-testid="return-assignment">
                  <Undo2 aria-hidden /> Return for changes
                </Button>
              ) : null}
            </div>
            {review.isSuccess && !busy ? (
              <p role="status" className="text-xs text-success">
                Saved
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-fg" data-testid="assignment-error">
            {error instanceof WorkspaceError ? error.message : 'Something went wrong.'}
          </p>
        ) : null}
      </CardContent>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this homework?</DialogTitle>
            <DialogDescription>The student will see it as cancelled. Submitted work and feedback stay visible; nothing is deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep it</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmCancel(false)
                setStatus.mutate({ id: assignment.id, status: 'cancelled', studentIds })
              }}
              data-testid="confirm-cancel-assignment"
            >
              Cancel homework
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function AssignmentDialog({ tutorId, defaultStudent, existing, onClose }: { tutorId: string; defaultStudent: StudentAccount; existing: HomeworkItem | null; onClose: () => void }) {
  const students = useStudents(tutorId)
  const { chapters, states } = useProgression(defaultStudent.id)
  const { create, update } = useAssignmentMutations(tutorId)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          kind: existing.assignment.kind,
          title: existing.assignment.title,
          instructions: existing.assignment.instructions,
          lesson: existing.assignment.chapterId && existing.assignment.lessonId ? `${existing.assignment.chapterId}/${existing.assignment.lessonId}` : '',
          reviewTarget: existing.assignment.reviewTarget ?? 20,
          dueAt: toLocalInput(existing.assignment.dueAt),
          studentIds: [defaultStudent.id],
        }
      : { kind: 'written', title: '', instructions: '', lesson: '', reviewTarget: 20, dueAt: '', studentIds: [defaultStudent.id] },
  })
  const kind = useWatch({ control: form.control, name: 'kind' }) as AssignmentKind
  const busy = create.isPending || update.isPending

  // Only authored lessons; the chapter check is offered as "pass the check".
  const lessonOptions = useMemo(() => {
    if (!chapters) return []
    return chapters
      .filter((c) => c.status === 'authored')
      .flatMap((c) =>
        c.lessons.map((l) => {
          const state = states?.get(c.id)?.lessons.find((x) => x.lesson.id === l.id)
          return { value: `${c.id}/${l.id}`, label: `${c.level}-${String(c.number).padStart(2, '0')} · ${l.title} (${LESSON_KIND_LABEL[l.kind]})`, kind: l.kind, status: state?.status ?? 'locked' }
        }),
      )
  }, [chapters, states])

  const submit = (publish: boolean) =>
    form.handleSubmit(async (values) => {
      const [chapterId, lessonId] = values.lesson.split('/')
      const chosen = lessonOptions.find((o) => o.value === values.lesson)
      const draft: AssignmentDraft = {
        kind: values.kind,
        title: values.title,
        instructions: values.instructions,
        chapterId: chapterId ?? null,
        lessonId: lessonId ?? null,
        requiresPass: chosen?.kind === 'assessment',
        reviewTarget: values.reviewTarget,
        dueAt: toIso(values.dueAt),
      }
      try {
        if (existing) {
          await update.mutateAsync({ id: existing.assignment.id, patch: draft, studentIds: values.studentIds })
        } else {
          await create.mutateAsync({ draft, studentIds: values.studentIds, publish })
        }
        onClose()
      } catch (error) {
        form.setError('root', { message: error instanceof WorkspaceError ? error.message : 'Could not save the homework.' })
      }
    })()

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit homework' : 'New homework'}</DialogTitle>
          <DialogDescription>{existing ? 'Changes are visible to the student immediately.' : 'Save as a draft to finish later, or assign it now.'}</DialogDescription>
        </DialogHeader>
        <form id="assignment-form" className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
          <Field>
            <Label htmlFor="assignment-kind">Type</Label>
            <select id="assignment-kind" className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-base sm:h-10 sm:text-sm" disabled={!!existing && existing.assignment.status === 'published'} {...form.register('kind')} data-testid="assignment-kind">
              <option value="written">Written answer (you review it)</option>
              <option value="lesson">Complete a lesson or pass a chapter check</option>
              <option value="vocabulary">Vocabulary reviews (a number of answers)</option>
            </select>
          </Field>
          <Field>
            <Label htmlFor="assignment-title">Title</Label>
            <Input id="assignment-title" maxLength={120} aria-invalid={!!form.formState.errors.title} {...form.register('title')} data-testid="assignment-title" />
            <FieldError>{form.formState.errors.title?.message}</FieldError>
          </Field>
          {kind === 'lesson' ? (
            <Field>
              <Label htmlFor="assignment-lesson">Lesson</Label>
              <select id="assignment-lesson" className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-base sm:h-10 sm:text-sm" disabled={!!existing && existing.assignment.status === 'published'} aria-invalid={!!form.formState.errors.lesson} {...form.register('lesson')} data-testid="assignment-lesson">
                <option value="">Choose a written lesson…</option>
                {lessonOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                    {o.status === 'locked' ? ' · locked for this student' : o.status === 'completed' ? ' · already completed' : ''}
                  </option>
                ))}
              </select>
              <FieldHint>Only written chapters are listed. A chapter check counts when it is passed; other lessons when they are completed.</FieldHint>
              <FieldError>{form.formState.errors.lesson?.message}</FieldError>
            </Field>
          ) : null}
          {kind === 'vocabulary' ? (
            <Field>
              <Label htmlFor="assignment-target">Reviews to answer</Label>
              <Input id="assignment-target" type="number" inputMode="numeric" min={1} max={500} disabled={!!existing && existing.assignment.status === 'published'} aria-invalid={!!form.formState.errors.reviewTarget} {...form.register('reviewTarget', { valueAsNumber: true })} data-testid="assignment-target" />
              <FieldHint>Counted from the moment the homework is assigned.</FieldHint>
              <FieldError>{form.formState.errors.reviewTarget?.message}</FieldError>
            </Field>
          ) : null}
          <Field>
            <Label htmlFor="assignment-instructions">Instructions</Label>
            <Textarea id="assignment-instructions" rows={4} maxLength={4000} {...form.register('instructions')} data-testid="assignment-instructions" />
            <FieldError>{form.formState.errors.instructions?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="assignment-due">Due (optional)</Label>
            <Input id="assignment-due" type="datetime-local" {...form.register('dueAt')} data-testid="assignment-due" />
          </Field>
          {!existing && students.data && students.data.length > 1 ? (
            <Field>
              <Label>Students</Label>
              <div className="flex flex-col gap-1.5">
                {students.data
                  .filter((s) => s.status === 'active')
                  .map((s) => (
                    <label key={s.id} className="flex min-h-9 items-center gap-2 text-sm">
                      <input type="checkbox" value={s.id} {...form.register('studentIds')} className="size-4" />
                      {s.fullName || s.email}
                    </label>
                  ))}
              </div>
              <FieldError>{form.formState.errors.studentIds?.message}</FieldError>
            </Field>
          ) : null}
          {form.formState.errors.root ? (
            <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-fg" data-testid="assignment-form-error">
              {form.formState.errors.root.message}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {existing ? (
            <Button onClick={() => void submit(false)} loading={busy} data-testid="save-assignment">
              Save changes
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => void submit(false)} loading={busy} data-testid="save-draft">
                Save draft
              </Button>
              <Button onClick={() => void submit(true)} loading={busy} data-testid="assign-now">
                <Send aria-hidden /> Assign now
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
