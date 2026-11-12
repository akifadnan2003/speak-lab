import { ArrowLeft, CheckCircle2, ExternalLink, MessageSquare, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/input'
import { FieldHint, Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { useHomeworkMutations, useStudentHomework, WorkspaceError, type CompletionResult } from '@/features/assignments/api'
import { describeEvidence, describeTarget, displayStatus, DISPLAY_STATUS_LABEL, DISPLAY_STATUS_VARIANT, type HomeworkItem } from '@/features/assignments/model'
import { useChapters } from '@/features/curriculum/CurriculumProvider'
import { formatRelative } from '@/lib/utils'

/**
 * One homework item for the signed-in student: instructions, due date, status, the linked lesson
 * or vocabulary target with "Mark as done" (verified by the server), or the written editor with a
 * saved draft and Submit, plus the tutor's feedback.
 */
export function HomeworkDetailPage() {
  const { assignmentId = '' } = useParams()
  const user = useCurrentUser()
  const homework = useStudentHomework(user?.id ?? null)
  const [now] = useState(() => new Date())
  const item = homework.data?.find((i) => i.assignment.id === assignmentId)

  if (homework.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48" />
      </div>
    )
  }
  if (!item || !user) {
    return (
      <EmptyState
        title="Homework not found"
        description="It may have been removed, or it is not yours."
        action={
          <Button asChild variant="outline">
            <Link to="/homework">Back to homework</Link>
          </Button>
        }
      />
    )
  }
  return <HomeworkDetail key={item.assignment.id} item={item} studentId={user.id} now={now} />
}

function HomeworkDetail({ item, studentId, now }: { item: HomeworkItem; studentId: string; now: Date }) {
  const { assignment, submission } = item
  const status = displayStatus(assignment, submission, now)
  const chapters = useChapters()
  const lesson = assignment.kind === 'lesson' ? chapters.data?.find((c) => c.id === assignment.chapterId)?.lessons.find((l) => l.id === assignment.lessonId) : undefined
  const open = assignment.status === 'published' && (submission.status === 'assigned' || submission.status === 'in_progress')

  return (
    <div className="flex flex-col gap-5" data-testid="homework-detail" data-status={status}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/homework">
          <ArrowLeft aria-hidden /> Homework
        </Link>
      </Button>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={DISPLAY_STATUS_VARIANT[status]} data-testid="homework-status">
            {DISPLAY_STATUS_LABEL[status]}
          </Badge>
          {submission.late ? <Badge variant="outline">Submitted after the due date</Badge> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{assignment.title}</h1>
        <p className="text-sm text-fg-muted">
          {describeTarget(assignment, lesson?.title)}
          {assignment.dueAt ? ` · due ${new Date(assignment.dueAt).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ' · no due date'}
          {assignment.publishedAt ? ` · assigned ${formatRelative(assignment.publishedAt)}` : ''}
        </p>
      </div>

      {assignment.instructions ? (
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm whitespace-pre-wrap">{assignment.instructions}</CardContent>
        </Card>
      ) : null}

      {assignment.status === 'cancelled' ? (
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-fg-muted" data-testid="homework-cancelled">
          Your tutor cancelled this homework{assignment.cancelledAt ? ` ${formatRelative(assignment.cancelledAt)}` : ''}. Nothing more to do.
        </p>
      ) : assignment.kind === 'written' ? (
        <WrittenWork item={item} studentId={studentId} open={open} />
      ) : (
        <LinkedWork item={item} studentId={studentId} open={open} lessonTitle={lesson?.title} />
      )}

      {submission.feedback ? (
        <Card className="border-primary/30" data-testid="homework-feedback">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" aria-hidden /> Feedback from your tutor
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            <p className="text-sm whitespace-pre-wrap">{submission.feedback}</p>
            <p className="text-xs text-fg-muted">
              {submission.feedbackUpdatedAt ? `Written ${formatRelative(submission.feedbackUpdatedAt)}` : ''}
              {submission.status === 'reviewed' && submission.reviewedAt ? ` · reviewed ${formatRelative(submission.reviewedAt)}` : ''}
              {submission.status === 'in_progress' && submission.returnedAt ? ` · returned for changes ${formatRelative(submission.returnedAt)}: edit and submit again` : ''}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function LinkedWork({ item, studentId, open, lessonTitle }: { item: HomeworkItem; studentId: string; open: boolean; lessonTitle: string | undefined }) {
  const { assignment, submission } = item
  const { complete } = useHomeworkMutations(studentId)
  const [result, setResult] = useState<CompletionResult | null>(null)
  const href = assignment.kind === 'lesson' ? `/learn/${assignment.chapterId}/lessons/${assignment.lessonId}` : '/vocabulary'
  const progress = result?.progress

  return (
    <Card>
      <CardHeader>
        <CardTitle>{assignment.kind === 'lesson' ? (lessonTitle ?? 'The lesson') : 'Vocabulary reviews'}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {submission.evidence ? (
          <p className="inline-flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft p-3 text-sm text-success-soft-fg" data-testid="homework-evidence">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {describeEvidence(submission.evidence)}
          </p>
        ) : (
          <p className="text-sm text-fg-muted">
            {assignment.kind === 'lesson'
              ? assignment.requiresPass
                ? 'Open the chapter check and pass it. The result comes from the graded check, not from this page.'
                : 'Open the lesson and finish it. Completion is read from your learning record.'
              : `Answer ${assignment.reviewTarget} vocabulary reviews after ${assignment.publishedAt ? formatRelative(assignment.publishedAt) : 'the assignment'}. Every answer counts once.`}
          </p>
        )}
        {progress ? (
          <p className="text-sm" data-testid="homework-progress">
            {assignment.kind === 'vocabulary' && typeof progress.count === 'number'
              ? `${progress.count} of ${String(progress.target)} reviews so far.`
              : assignment.requiresPass
                ? progress.attempted
                  ? `Best score so far ${String(progress.best_score)}%, not yet a pass.`
                  : 'The chapter check has not been submitted yet.'
                : `The lesson is ${String(progress.lesson_status).replace('_', ' ')}.`}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={open ? 'primary' : 'outline'}>
            <Link to={href}>
              <ExternalLink aria-hidden /> {assignment.kind === 'lesson' ? 'Open the lesson' : 'Open vocabulary'}
            </Link>
          </Button>
          {open ? (
            <Button
              variant="outline"
              loading={complete.isPending}
              onClick={async () => {
                try {
                  setResult(await complete.mutateAsync({ assignmentId: assignment.id }))
                } catch {
                  /* shown below */
                }
              }}
              data-testid="mark-done"
            >
              <CheckCircle2 aria-hidden /> Mark as done
            </Button>
          ) : null}
        </div>
        {result && !result.completed ? (
          <p role="status" className="text-sm text-fg-muted" data-testid="homework-not-yet">
            Not finished yet according to your records. Keep going and try again.
          </p>
        ) : null}
        {complete.isError ? (
          <p role="alert" className="text-sm text-danger">
            {complete.error instanceof WorkspaceError ? complete.error.message : 'Could not check your progress.'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function WrittenWork({ item, studentId, open }: { item: HomeworkItem; studentId: string; open: boolean }) {
  const { assignment, submission } = item
  const { saveDraft, submit } = useHomeworkMutations(studentId)
  const [text, setText] = useState(submission.draftText)
  const [confirm, setConfirm] = useState(false)
  const dirty = text !== submission.draftText
  const busy = saveDraft.isPending || submit.isPending
  const error = saveDraft.error ?? submit.error

  if (!open) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your answer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          {submission.submittedText ? (
            <blockquote className="rounded-lg border border-line p-3 text-sm whitespace-pre-wrap" data-testid="homework-submitted-text">
              {submission.submittedText}
            </blockquote>
          ) : (
            <p className="text-sm text-fg-muted">Nothing was submitted.</p>
          )}
          {submission.submittedAt ? <p className="text-xs text-fg-muted">Submitted {new Date(submission.submittedAt).toLocaleString()}</p> : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your answer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {submission.submittedText && submission.returnedAt ? (
          <details className="rounded-lg border border-line p-3 text-sm">
            <summary className="cursor-pointer text-fg-muted">What you submitted before</summary>
            <p className="mt-2 whitespace-pre-wrap">{submission.submittedText}</p>
          </details>
        ) : null}
        <Label htmlFor="answer">Write in English</Label>
        <Textarea id="answer" value={text} onChange={(e) => setText(e.target.value)} rows={10} maxLength={8000} placeholder="Type your answer here. Save as you go; submit when you are done." data-testid="homework-answer" />
        <FieldHint>
          {8000 - text.length} characters left · {dirty ? 'unsaved changes' : submission.startedAt ? 'saved to your account' : 'not started'}
        </FieldHint>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!dirty || busy} loading={saveDraft.isPending} onClick={() => saveDraft.mutate({ assignmentId: assignment.id, text })} data-testid="save-draft-answer">
            Save draft
          </Button>
          <Button disabled={text.trim().length === 0 || busy} onClick={() => setConfirm(true)} data-testid="submit-answer">
            <Send aria-hidden /> Submit
          </Button>
        </div>
        {saveDraft.isSuccess && !dirty ? (
          <p role="status" className="text-xs text-success">
            Draft saved
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger" data-testid="homework-error">
            {error instanceof WorkspaceError ? error.message : 'Could not save your answer.'}
          </p>
        ) : null}
      </CardContent>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your answer?</DialogTitle>
            <DialogDescription>Your tutor will read it and reply with feedback. You cannot edit it afterwards unless your tutor returns it to you.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep editing</Button>
            </DialogClose>
            <Button
              loading={submit.isPending}
              onClick={async () => {
                try {
                  await submit.mutateAsync({ assignmentId: assignment.id, text })
                } finally {
                  setConfirm(false)
                }
              }}
              data-testid="confirm-submit-answer"
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
