import { ArrowLeft, ArrowRight, BookOpen, Languages, Lock, Smartphone } from 'lucide-react'
import { useCallback, useId } from 'react'
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
import { useCurriculumServices, useProgression, useProgressMutations } from '@/features/curriculum/CurriculumProvider'
import type { LessonProgressRecord } from '@/features/curriculum/ports'
import { isLessonDone, type ChapterState, type LessonState } from '@/features/curriculum/progression'
import { LESSON_KIND_LABEL, type Lesson } from '@/features/curriculum/schema'
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
      const isAssessment = lesson.kind === 'assessment'
      const passed = !isAssessment || summary.score >= chapter.completion.passMark
      const previousBest = lessonState.bestScore ?? 0
      const now = new Date().toISOString()
      const record: LessonProgressRecord = {
        studentId,
        chapterId: chapter.id,
        lessonId: lesson.id,
        status: passed ? 'completed' : 'in_progress',
        bestScore: Math.max(previousBest, summary.score),
        lastScore: summary.score,
        completedAt: passed ? now : undefined,
        updatedAt: now,
      }
      upsertLesson.mutate(record)
    },
    [studentId, chapter, lesson, lessonState.bestScore, upsertLesson],
  )

  const hasExplanation = lesson.blocks.length > 0

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
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <Smartphone className="size-3.5" aria-hidden />
              {storage === 'device' ? 'Progress saved on this device' : 'Progress synced'}
            </span>
          </CardHeader>
          <CardContent className="pt-3">
            <ExerciseRunner
              lesson={lesson}
              passMark={lesson.kind === 'assessment' ? chapter.completion.passMark : undefined}
              onStart={onStart}
              onAttempt={onAttempt}
              onComplete={onComplete}
              summaryActions={
                nextOpen ? (
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
              }
            />
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
