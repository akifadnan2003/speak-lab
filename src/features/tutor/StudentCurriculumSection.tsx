import { ChevronDown, ChevronUp, Lock, LockOpen, RotateCcw, SkipForward, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { countUsedAttempts, MAX_ASSESSMENT_ATTEMPTS } from '@/features/curriculum/assessment-rules'
import { useQuery } from '@tanstack/react-query'
import {
  curriculumKeys,
  useAssessmentActions,
  useAssessmentAttempts,
  useChapterOverrideMutations,
  useCurriculumServices,
  useProgression,
} from '@/features/curriculum/CurriculumProvider'
import { currentChapter, type ChapterState } from '@/features/curriculum/progression'
import { CEFR_LEVELS, LESSON_KIND_LABEL, LEVEL_NAMES, type CefrLevel } from '@/features/curriculum/schema'
import { ChapterStatusBadge } from '@/features/learn/ChapterStatusBadge'
import { cn } from '@/lib/utils'

/**
 * Tutor view of one student's curriculum: real progression from the student's rows (read under
 * RLS through the tutor link), with the tutor's three levers:
 *   - unlock a chapter early (prerequisites waived),
 *   - skip a chapter (counts as done, e.g. placement),
 *   - allow an assessment retake (voids used attempts).
 * "Place at level" is the placement shortcut: it skips every chapter below the chosen level.
 */
export function StudentCurriculumSection({ studentId, tutorId }: { studentId: string; tutorId: string }) {
  const { states, isLoading, error } = useProgression(studentId)
  const { progress } = useCurriculumServices()
  const overrideRows = useQuery({
    queryKey: curriculumKeys.overrides(studentId),
    queryFn: () => progress.listChapterOverrides(studentId),
  })
  const overrideByChapter = new Map((overrideRows.data ?? []).map((o) => [o.chapterId, o.kind]))
  const overrides = useChapterOverrideMutations(studentId, tutorId)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!states && isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }
  if (!states) {
    return <EmptyState compact title="Could not load the curriculum" description={error instanceof Error ? error.message : 'Try again.'} />
  }

  const all = [...states.values()]
  const current = currentChapter(states)
  const completed = all.filter((s) => s.status === 'completed').length
  const skipped = all.filter((s) => s.status === 'skipped').length
  const busy = overrides.set.isPending || overrides.clear.isPending || overrides.placeAtLevel.isPending
  const mutationError = overrides.set.error ?? overrides.clear.error ?? overrides.placeAtLevel.error

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Placement</CardTitle>
            <p className="mt-1 text-sm text-fg-muted">
              Currently on{' '}
              <span className="font-medium text-fg" data-testid="current-chapter">
                {current ? `${current.chapter.level} · ${current.chapter.title}` : 'no written chapter is open (the next ones are planned or locked)'}
              </span>
              . {completed} completed, {skipped} skipped.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-fg-muted">Start at level</span>
            <select
              aria-label="Place the student at a level"
              data-testid="place-at-level"
              className="h-10 rounded-md border border-line bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              disabled={busy}
              value=""
              onChange={(event) => {
                const level = event.target.value as CefrLevel | ''
                if (!level) return
                overrides.placeAtLevel.mutate({
                  level,
                  levels: CEFR_LEVELS,
                  chapters: all.map((s) => ({ id: s.chapter.id, level: s.chapter.level })),
                })
              }}
            >
              <option value="">Choose…</option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level} · {LEVEL_NAMES[level]}
                </option>
              ))}
            </select>
          </label>
        </CardHeader>
        {mutationError ? (
          <CardContent className="pt-0">
            <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-fg" data-testid="override-error">
              {mutationError.message}
            </p>
          </CardContent>
        ) : null}
      </Card>

      <p className="text-xs text-fg-muted" data-testid="curriculum-legend">
        <span className="font-medium text-fg">Written</span> chapters can be opened once their prerequisites are done, or unlocked by you.{' '}
        <span className="font-medium text-fg">Planned</span> chapters have no lessons yet: unlocking them opens nothing, so only <em>skip</em> is offered (it satisfies the next chapter&apos;s prerequisite).{' '}
        <span className="font-medium text-fg">Skipped</span> chapters count as done for progression; completed progress is never overwritten.
      </p>
      <ol className="flex flex-col gap-2" aria-label="Chapters">
        {all.map((state) => {
          const { chapter } = state
          const override = overrideByChapter.get(chapter.id) ?? null
          const open = expanded === chapter.id
          return (
            <li key={chapter.id} data-testid="tutor-chapter-row" data-chapter={chapter.id} data-status={state.status}>
              <Card className={cn(chapter.status === 'planned' && 'opacity-80')}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-14 shrink-0 text-xs font-semibold text-fg-muted tabular">
                      {chapter.level}-{String(chapter.number).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{chapter.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ChapterStatusBadge state={state} />
                        {override ? (
                          <Badge variant="outline" data-testid="override-badge">
                            {override === 'skip' ? 'Skipped by tutor' : 'Unlocked by tutor'}
                          </Badge>
                        ) : null}
                        {chapter.status === 'authored' && state.status !== 'locked' ? (
                          <span className="text-xs text-fg-muted tabular">{state.progress}% of lessons</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {override ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => overrides.clear.mutate(chapter.id)} data-testid="clear-override">
                          <Undo2 aria-hidden /> Remove override
                        </Button>
                      ) : (
                        <>
                          {state.status === 'locked' && chapter.status === 'authored' ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => overrides.set.mutate({ chapterId: chapter.id, kind: 'unlock' })} data-testid="unlock-chapter">
                              <LockOpen aria-hidden /> Unlock
                            </Button>
                          ) : null}
                          {chapter.status === 'planned' ? (
                            <span className="self-center text-xs text-fg-muted" data-testid="planned-note">
                              Not written yet: nothing to unlock
                            </span>
                          ) : null}
                          {state.status !== 'completed' ? (
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => overrides.set.mutate({ chapterId: chapter.id, kind: 'skip' })} data-testid="skip-chapter">
                              <SkipForward aria-hidden /> Skip
                            </Button>
                          ) : null}
                        </>
                      )}
                      {chapter.status === 'authored' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-expanded={open}
                          aria-label={`${open ? 'Hide' : 'Show'} lessons of ${chapter.title}`}
                          onClick={() => setExpanded(open ? null : chapter.id)}
                        >
                          {open ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {open ? <LessonRows state={state} studentId={studentId} /> : null}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function LessonRows({ state, studentId }: { state: ChapterState; studentId: string }) {
  return (
    <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
      {state.lessons.map((lessonState, index) => {
        const { lesson, status, bestScore } = lessonState
        return (
          <li key={lesson.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm" data-testid="tutor-lesson-row" data-status={status}>
            {status === 'locked' ? <Lock className="size-4 text-fg-subtle" aria-label="Locked" /> : <span className="w-4 text-center text-xs text-fg-muted tabular">{index + 1}</span>}
            <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
            <span className="text-xs text-fg-muted">{LESSON_KIND_LABEL[lesson.kind]}</span>
            <Badge variant={status === 'completed' ? 'success' : status === 'in_progress' ? 'info' : 'neutral'}>{status.replace('_', ' ')}</Badge>
            {typeof bestScore === 'number' ? <span className="text-xs tabular">{bestScore}%</span> : null}
            {lesson.kind === 'assessment' ? <AssessmentControls studentId={studentId} chapterId={state.chapter.id} lessonId={lesson.id} chapterVersion={state.chapter.version} /> : null}
          </li>
        )
      })}
      {state.lessons.length > 0 ? (
        <li className="px-3 py-2">
          <Progress value={state.progress} size="sm" aria-label={`${state.progress}% of lessons done`} />
        </li>
      ) : null}
    </ol>
  )
}

function AssessmentControls({ studentId, chapterId, lessonId, chapterVersion }: { studentId: string; chapterId: string; lessonId: string; chapterVersion: number }) {
  const attempts = useAssessmentAttempts(studentId, chapterId, lessonId)
  const { reset } = useAssessmentActions(studentId)
  const used = attempts.data ? countUsedAttempts(attempts.data, chapterVersion) : 0
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-fg-muted tabular" data-testid="assessment-attempts-used">
        {used}/{MAX_ASSESSMENT_ATTEMPTS} attempts
      </span>
      {used > 0 ? (
        <Button size="sm" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate({ chapterId, lessonId })} data-testid="reset-assessment">
          <RotateCcw aria-hidden /> Allow retake
        </Button>
      ) : null}
      {reset.isError ? <span role="alert" className="text-xs text-danger">{reset.error.message}</span> : null}
    </span>
  )
}
