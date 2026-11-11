import { ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, Cloud, Languages, Loader2, Lock, Smartphone } from 'lucide-react'
import { useCallback, useId, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { AzHelpProvider, useAzHelp } from '@/features/curriculum/az-help'
import { attemptsRemaining, countUsedAttempts, MAX_ASSESSMENT_ATTEMPTS, openAttempt } from '@/features/curriculum/assessment-rules'
import {
  useAssessmentActions,
  useAssessmentAttempts,
  useCurriculumServices,
  useProgression,
  useProgressMutations,
} from '@/features/curriculum/CurriculumProvider'
import type { AssessmentAttemptSummary, LessonProgressRecord } from '@/features/curriculum/ports'
import { isLessonDone, type ChapterState, type LessonState } from '@/features/curriculum/progression'
import { LESSON_KIND_LABEL, type Chapter, type Lesson } from '@/features/curriculum/schema'
import { ExerciseRunner, type AttemptEvent, type RunSummary } from '@/features/exercises/components/ExerciseRunner'
import { LessonContent } from './LessonContent'

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function LessonWorkspacePage() {
  const { chapterId = '', lessonId = '' } = useParams()
  const user = useCurrentUser()
  const { states, isLoading } = useProgression(user?.id ?? null)
  const chapterState = states?.get(chapterId)
  const lessonState = chapterState?.lessons.find((l) => l.lesson.id === lessonId)

  if (!states && isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!user || !chapterState || !lessonState) {
    return (
      <EmptyState
        title="Lesson not found"
        description="This lesson does not exist or is not available to you."
        action={
          <Button asChild variant="outline">
            <Link to="/learn">Back to curriculum</Link>
          </Button>
        }
      />
    )
  }

  if (lessonState.status === 'locked') {
    return (
      <EmptyState
        icon={Lock}
        title="This lesson is locked"
        description={
          lessonState.lesson.kind === 'assessment'
            ? 'Finish every other lesson in the chapter to unlock the chapter check.'
            : 'Complete the previous chapters first, or ask your tutor to unlock this one.'
        }
        action={
          <Button asChild variant="outline">
            <Link to={`/learn/${chapterId}`}>Back to chapter</Link>
          </Button>
        }
      />
    )
  }

  return (
    <AzHelpProvider>
      <LessonWorkspace key={lessonId} studentId={user.id} chapterState={chapterState} lessonState={lessonState} />
    </AzHelpProvider>
  )
}

function LessonWorkspace({
  studentId,
  chapterState,
  lessonState,
}: {
  studentId: string
  chapterState: ChapterState
  lessonState: LessonState
}) {
  const { chapter, lessons } = chapterState
  const { lesson } = lessonState
  const index = lessons.findIndex((l) => l.lesson.id === lesson.id)
  const prev = index > 0 ? lessons[index - 1] : undefined
  const next = lessons[index + 1]
  const nextOpen = next && next.status !== 'locked'
  const { upsertLesson, recordAttempt } = useProgressMutations(studentId)
  const { storage } = useCurriculumServices()
  const az = useAzHelp()
  const azId = useId()
  const hasAz = lessonHasAz(lesson)

  const onStart = useCallback(() => {
    if (isLessonDone(lessonState.status) || lessonState.status === 'in_progress') return
    const record: LessonProgressRecord = {
      studentId,
      chapterId: chapter.id,
      lessonId: lesson.id,
      status: 'in_progress',
      updatedAt: new Date().toISOString(),
    }
    upsertLesson.mutate(record)
  }, [studentId, chapter.id, lesson.id, lessonState.status, upsertLesson])

  const onAttempt = useCallback(
    (event: AttemptEvent) => {
      recordAttempt.mutate({
        id: newId(),
        studentId,
        chapterId: chapter.id,
        chapterVersion: chapter.version,
        lessonId: lesson.id,
        exerciseId: event.exercise.id,
        exerciseType: event.exercise.type,
        attemptNumber: event.attemptNumber,
        answer: event.answer,
        correct: event.result.correct,
        score: event.result.score,
        hintUsed: event.hintUsed,
        createdAt: new Date().toISOString(),
      })
    },
    [studentId, chapter, lesson.id, recordAttempt],
  )

  const onComplete = useCallback(
    (summary: RunSummary) => {
      // Practice lessons only: chapter checks are graded and recorded by the assessment gateway.
      if (lesson.kind === 'assessment') return
      const previousBest = lessonState.bestScore ?? 0
      const now = new Date().toISOString()
      const record: LessonProgressRecord = {
        studentId,
        chapterId: chapter.id,
        lessonId: lesson.id,
        status: 'completed',
        bestScore: Math.max(previousBest, summary.score),
        lastScore: summary.score,
        completedAt: now,
        updatedAt: now,
      }
      upsertLesson.mutate(record)
    },
    [studentId, chapter, lesson, lessonState.bestScore, upsertLesson],
  )

  const hasExplanation = lesson.blocks.length > 0
  const summaryActions = nextOpen ? (
    <Button asChild>
      <Link to={`/learn/${chapter.id}/lessons/${next.lesson.id}`}>
        Next lesson <ArrowRight aria-hidden />
      </Link>
    </Button>
  ) : (
    <Button asChild>
      <Link to={`/learn/${chapter.id}`}>Back to chapter</Link>
    </Button>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/learn/${chapter.id}`}>
            <ArrowLeft aria-hidden /> Chapter {chapter.number}
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="tabular">
            Lesson {index + 1} of {lessons.length}
          </span>
          <Progress value={((index + 1) / lessons.length) * 100} size="sm" className="w-24" aria-label="Position in chapter" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{LESSON_KIND_LABEL[lesson.kind]}</Badge>
            <Badge variant="neutral">{lesson.estimatedMinutes} min</Badge>
            {lessonState.status === 'completed' ? <Badge variant="success">Completed</Badge> : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>
        </div>
        {hasAz ? (
          <div className="flex items-center gap-2">
            <Switch id={azId} checked={az.enabled} onCheckedChange={az.setEnabled} aria-describedby={`${azId}-hint`} />
            <Label htmlFor={azId} className="flex items-center gap-1.5">
              <Languages className="size-4 text-primary" aria-hidden /> Azerbaijani help
            </Label>
            <span id={`${azId}-hint`} className="sr-only">
              Shows Azerbaijani explanations under the English text.
            </span>
          </div>
        ) : null}
      </div>

      {lesson.objectives.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-xs text-fg-muted">
          {lesson.objectives.map((o) => (
            <li key={o} className="rounded-full bg-surface-2 px-2.5 py-1">
              {o}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {hasExplanation ? (
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center gap-2">
              <BookOpen className="size-4 text-primary" aria-hidden />
              <CardTitle>{lesson.kind === 'reading' ? 'Text' : lesson.kind === 'vocabulary' ? 'Words' : 'Explanation'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <LessonContent blocks={lesson.blocks} />
            </CardContent>
          </Card>
        ) : null}

        <Card className={hasExplanation ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{lesson.kind === 'assessment' ? 'Chapter check' : 'Practice'}</CardTitle>
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted" data-testid="storage-label">
              {storage === 'device' ? <Smartphone className="size-3.5" aria-hidden /> : <Cloud className="size-3.5" aria-hidden />}
              {storage === 'device' ? 'Progress saved on this device' : 'Progress saved to your account'}
            </span>
          </CardHeader>
          <CardContent className="pt-3">
            {lesson.kind === 'assessment' ? (
              <AssessmentWorkspace studentId={studentId} chapter={chapter} lesson={lesson} summaryActions={summaryActions} />
            ) : (
              <ExerciseRunner lesson={lesson} onStart={onStart} onAttempt={onAttempt} onComplete={onComplete} summaryActions={summaryActions} />
            )}
          </CardContent>
        </Card>
      </div>

      <nav aria-label="Lesson navigation" className="flex items-center justify-between gap-3 border-t border-line pt-4">
        {prev ? (
          <Button asChild variant="ghost">
            <Link to={`/learn/${chapter.id}/lessons/${prev.lesson.id}`}>
              <ArrowLeft aria-hidden /> Previous
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {nextOpen ? (
          <Button asChild variant="outline">
            <Link to={`/learn/${chapter.id}/lessons/${next.lesson.id}`}>
              Next lesson <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to={`/learn/${chapter.id}`}>Back to chapter</Link>
          </Button>
        )}
      </nav>
    </div>
  )
}

/**
 * Chapter check: the server opens the attempt, grades the raw answers and decides what may be
 * disclosed. The runner only collects answers. Attempts, retakes and expiry follow
 * `assessment-rules.ts` on both sides.
 */
function AssessmentWorkspace({
  studentId,
  chapter,
  lesson,
  summaryActions,
}: {
  studentId: string
  chapter: Chapter
  lesson: Lesson
  summaryActions: React.ReactNode
}) {
  const attempts = useAssessmentAttempts(studentId, chapter.id, lesson.id)
  const { start, submit } = useAssessmentActions(studentId)
  // The attempt the learner is working on right now. `null` shows the intro / result card.
  const [active, setActive] = useState<AssessmentAttemptSummary | null>(null)

  if (attempts.isPending) {
    return <Skeleton className="h-40 w-full" aria-busy />
  }
  if (attempts.isError) {
    return <EmptyState compact title="Could not load your attempts" description={attempts.error.message} />
  }

  const all = attempts.data
  const used = countUsedAttempts(all, chapter.version)
  const remaining = attemptsRemaining(used)
  const submitted = all.filter((a) => a.status === 'submitted' && a.chapterVersion === chapter.version)
  const best = submitted.length ? Math.max(...submitted.map((a) => a.score ?? 0)) : undefined
  const passed = submitted.some((a) => a.passed)
  const open = openAttempt(all)
  const current = active ?? open ?? null

  const begin = () => {
    start.mutate({ chapterId: chapter.id, lessonId: lesson.id }, { onSuccess: (result) => setActive(result.attempt) })
  }

  if (current) {
    return (
      <ExerciseRunner
        key={current.id}
        lesson={lesson}
        mode="assessment"
        passMark={chapter.completion.passMark}
        summaryActions={summaryActions}
        assessment={{
          attemptsUsed: used,
          attemptsAllowed: MAX_ASSESSMENT_ATTEMPTS,
          submit: (answers) => submit.mutateAsync({ attemptId: current.id, answers }),
          onRetake: () => {
            setActive(null)
            begin()
          },
        }}
      />
    )
  }

  const questions = lesson.exercises.length
  return (
    <div className="flex flex-col gap-4" data-testid="assessment-intro">
      <div className="flex gap-3 rounded-lg bg-surface-2 p-4 text-sm">
        <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1.5">
          <p className="font-medium">
            {questions} questions, one answer each. Pass mark {chapter.completion.passMark}%.
          </p>
          <p className="text-fg-muted">
            Your answers are graded by the server when you submit. You have {MAX_ASSESSMENT_ATTEMPTS} attempts. Correct answers are
            shown after you pass or use your last attempt.
          </p>
          <p className="text-fg-muted tabular" data-testid="assessment-status">
            {used === 0 ? 'No attempts yet.' : `${used} of ${MAX_ASSESSMENT_ATTEMPTS} attempts used.`}
            {typeof best === 'number' ? ` Best score ${best}%.` : ''}
            {passed ? ' Passed.' : ''}
          </p>
        </div>
      </div>
      {start.isError ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-fg" data-testid="assessment-error">
          {start.error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {remaining > 0 ? (
          <Button onClick={begin} disabled={start.isPending} data-testid="start-assessment">
            {start.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardCheck aria-hidden />}
            {used === 0 ? 'Start chapter check' : passed ? 'Retake to improve' : 'Try again'}
          </Button>
        ) : (
          <p className="text-sm text-fg-muted" data-testid="assessment-exhausted">
            No attempts left. Ask your tutor to allow another attempt.
          </p>
        )}
        {passed ? summaryActions : null}
      </div>
    </div>
  )
}

function lessonHasAz(lesson: Lesson): boolean {
  const blockHasAz = lesson.blocks.some((b) => {
    switch (b.type) {
      case 'paragraph':
      case 'tip':
        return !!b.text.az
      case 'examples':
        return b.items.some((i) => !!i.az)
      case 'vocabulary':
        return b.items.some((i) => !!i.translation)
      case 'dialogue':
        return b.lines.some((l) => !!l.az)
      default:
        return false
    }
  })
  if (blockHasAz) return true
  return lesson.exercises.some(
    (e) =>
      !!e.hint?.az ||
      !!e.explanation?.az ||
      !!e.instruction?.az ||
      (e.type === 'speaking_prompt' && !!e.prompt.az) ||
      (e.type === 'guided_writing' && !!e.prompt.az) ||
      (e.type === 'sentence_transformation' && !!e.transformation.az),
  )
}
