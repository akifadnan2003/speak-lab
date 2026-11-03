import { useCallback, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Lightbulb, RotateCcw, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LocalizedTextView } from '@/features/curriculum/az-help'
import { scoreLesson } from '@/features/curriculum/progression'
import { EXERCISE_TYPE_LABEL, type Answer, type Exercise, type Lesson } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import { grade, isAnswerComplete, type GradeResult } from '../engine/grade'
import {
  allAnswered,
  answeredCount,
  attemptsLeft,
  canRetry,
  createSession,
  finalScores,
  sessionReducer,
  type SessionAction,
  type SessionMode,
  type SessionState,
} from '../engine/session'
import { ExerciseFeedback } from './ExerciseFeedback'
import { ExerciseRenderer } from './ExerciseRenderer'

export interface AttemptEvent {
  readonly exercise: Exercise
  readonly answer: Answer
  readonly result: GradeResult
  readonly attemptNumber: number
  readonly hintUsed: boolean
}

export interface RunSummary {
  /** Percent 0–100. */
  readonly score: number
  readonly correct: number
  readonly total: number
  readonly scores: readonly number[]
}

export interface ExerciseRunnerProps {
  readonly lesson: Lesson
  readonly mode?: SessionMode
  /** Pass mark shown on the assessment summary. */
  readonly passMark?: number
  readonly onAttempt?: (event: AttemptEvent) => void
  readonly onStart?: () => void
  readonly onComplete?: (summary: RunSummary) => void
  /** Rendered on the summary screen (e.g. "Next lesson"). */
  readonly summaryActions?: React.ReactNode
}

/**
 * Runs a lesson's exercises one at a time. Grading and the state machine are
 * pure (`../engine`); this component only wires them to the UI and emits
 * attempt/complete events for persistence.
 */
export function ExerciseRunner({ lesson, mode, passMark, onAttempt, onStart, onComplete, summaryActions }: ExerciseRunnerProps) {
  const sessionMode: SessionMode = mode ?? (lesson.kind === 'assessment' ? 'assessment' : 'practice')
  const [session, dispatch] = useReducer(
    sessionReducer,
    { exercises: lesson.exercises, mode: sessionMode, maxAttempts: lesson.maxAttempts },
    (init) => createSession(init.exercises, { mode: init.mode, maxAttempts: init.maxAttempts }),
  )
  // Hint visibility is keyed by exercise id so moving on resets it without an effect.
  const [hintFor, setHintFor] = useState<string | null>(null)
  const started = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const exercise = session.exercises[session.index]
  const state = exercise ? session.states[exercise.id] : undefined
  const total = session.exercises.length
  const isAssessment = session.mode === 'assessment'
  const hintOpen = !!exercise && hintFor === exercise.id

  /** Navigate and move focus to the exercise heading so screen readers announce the change. */
  const go = useCallback((action: Extract<SessionAction, { type: 'next' | 'prev' }>) => {
    dispatch(action)
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  }, [])

  const finish = useCallback(() => {
    if (!allAnswered(session)) return
    const scores = finalScores(session)
    const correct = session.exercises.filter((e) => session.states[e.id]?.outcome === 'correct').length
    dispatch({ type: 'finish' })
    onComplete?.({ score: scoreLesson(scores), correct, total, scores })
  }, [session, onComplete, total])

  const check = useCallback(() => {
    if (!exercise || !state) return
    if (!isAnswerComplete(exercise, state.answer)) return
    if (!started.current) {
      started.current = true
      onStart?.()
    }
    // Pressing Done on a speaking prompt is the learner's confirmation that they said it.
    const answer: Answer = state.answer.type === 'speaking_prompt' ? { ...state.answer, done: true } : state.answer
    if (answer !== state.answer) dispatch({ type: 'answer', exerciseId: exercise.id, answer })
    const result = grade(exercise, answer)
    dispatch({ type: 'checked', exerciseId: exercise.id, result })
    onAttempt?.({ exercise, answer, result, attemptNumber: state.attempts + 1, hintUsed: state.hintUsed })
  }, [exercise, state, onAttempt, onStart])

  const summary = useMemo(() => {
    if (!session.finished) return null
    const scores = finalScores(session)
    return {
      score: scoreLesson(scores),
      correct: session.exercises.filter((e) => session.states[e.id]?.outcome === 'correct').length,
    }
  }, [session])

  if (total === 0) {
    return <p className="text-sm text-fg-muted">This lesson has no exercises.</p>
  }

  if (session.finished && summary) {
    return (
      <SummaryView
        session={session}
        score={summary.score}
        correct={summary.correct}
        passMark={passMark}
        onRestart={() => dispatch({ type: 'restart' })}
        actions={summaryActions}
      />
    )
  }

  if (!exercise || !state) return null

  const terminal = state.outcome === 'correct' || state.outcome === 'revealed'
  const frozen = terminal || (isAssessment && state.attempts > 0)
  const complete = isAnswerComplete(exercise, state.answer)
  const done = answeredCount(session)
  const everythingAnswered = allAnswered(session)
  const isLast = session.index === total - 1
  const isSpeaking = exercise.type === 'speaking_prompt'

  return (
    <div className="flex flex-col gap-4" data-testid="exercise-runner">
      <div className="flex items-center justify-between gap-3">
        <h3 ref={headingRef} tabIndex={-1} className="text-sm font-medium text-fg-muted tabular outline-none">
          Exercise {session.index + 1} of {total}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{EXERCISE_TYPE_LABEL[exercise.type]}</Badge>
          {isAssessment ? <Badge variant="warning">1 attempt</Badge> : null}
        </div>
      </div>
      <Progress value={(done / total) * 100} size="sm" aria-label={`${done} of ${total} exercises answered`} />

      <div className="flex flex-col gap-4" key={exercise.id}>
        {exercise.instruction && exercise.type !== 'error_correction' && exercise.type !== 'question_formation' && exercise.type !== 'sentence_transformation' ? (
          <LocalizedTextView text={exercise.instruction} className="text-sm text-fg-muted" />
        ) : null}

        <ExerciseRenderer
          exercise={exercise}
          answer={state.answer}
          onChange={(answer) => dispatch({ type: 'answer', exerciseId: exercise.id, answer })}
          disabled={frozen}
          result={state.result}
          revealed={state.outcome === 'revealed'}
          hideCorrectness={isAssessment}
          onSubmit={!frozen ? check : undefined}
        />

        {exercise.hint && !isAssessment && !terminal ? (
          <div className="flex flex-col gap-2">
            {!hintOpen ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setHintFor(exercise.id)
                  dispatch({ type: 'hint', exerciseId: exercise.id })
                }}
              >
                <Lightbulb aria-hidden /> Hint
              </Button>
            ) : (
              <div className="flex gap-2 rounded-lg bg-surface-2 p-3 text-sm" role="note">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <LocalizedTextView text={exercise.hint} />
              </div>
            )}
          </div>
        ) : null}

        {!isAssessment ? (
          <ExerciseFeedback
            outcome={state.outcome}
            result={state.result}
            explanation={exercise.explanation}
            attemptsLeft={attemptsLeft(session, exercise.id)}
          />
        ) : state.attempts > 0 ? (
          <p role="status" className="rounded-lg bg-surface-2 p-3 text-sm text-fg-muted">
            Answer saved. Results and explanations appear at the end.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {!frozen && state.outcome !== 'incorrect' ? (
          <Button onClick={check} disabled={!complete} data-testid="check-answer">
            {isSpeaking ? 'Done' : 'Check'}
          </Button>
        ) : null}
        {state.outcome === 'incorrect' && !isAssessment ? (
          <>
            {canRetry(session, exercise.id) ? (
              <Button onClick={() => dispatch({ type: 'retry', exerciseId: exercise.id })}>
                <RotateCcw aria-hidden /> Try again
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => dispatch({ type: 'reveal', exerciseId: exercise.id })}>
              <Eye aria-hidden /> Show answer
            </Button>
          </>
        ) : null}

        <span className="flex-1" />

        {session.index > 0 ? (
          <Button variant="ghost" onClick={() => go({ type: 'prev' })} aria-label="Previous exercise">
            <ArrowLeft aria-hidden /> <span className="hidden sm:inline">Previous</span>
          </Button>
        ) : null}
        {!isLast ? (
          <Button variant={frozen ? 'primary' : 'outline'} onClick={() => go({ type: 'next' })} data-testid="next-exercise">
            Next <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button onClick={finish} disabled={!everythingAnswered} data-testid="finish-lesson">
            Finish <CheckCircle2 aria-hidden />
          </Button>
        )}
      </div>
      {isLast && !everythingAnswered ? (
        <p className="text-xs text-fg-muted">Answer every exercise to finish. Use Previous to go back to unanswered ones.</p>
      ) : null}
    </div>
  )
}

function SummaryView({
  session,
  score,
  correct,
  passMark,
  onRestart,
  actions,
}: {
  session: SessionState
  score: number
  correct: number
  passMark?: number
  onRestart: () => void
  actions?: React.ReactNode
}) {
  const total = session.exercises.length
  const isAssessment = session.mode === 'assessment'
  const passed = passMark === undefined || score >= passMark
  const scored = session.exercises.some((e) => e.type !== 'speaking_prompt')

  return (
    <div className="flex flex-col gap-5" data-testid="exercise-summary" aria-live="polite">
      <div className="flex flex-col items-center gap-2 text-center">
        <span
          className={cn(
            'flex size-16 items-center justify-center rounded-full',
            passed ? 'bg-success-soft text-success-soft-fg' : 'bg-warning-soft text-warning-soft-fg',
          )}
        >
          {passed ? <CheckCircle2 className="size-8" aria-hidden /> : <XCircle className="size-8" aria-hidden />}
        </span>
        <h3 className="text-xl font-semibold">
          {isAssessment ? (passed ? 'Passed' : 'Not passed yet') : 'Lesson complete'}
        </h3>
        {scored ? (
          <p className="text-sm text-fg-muted tabular">
            Score {score}% · {correct} of {total} correct
            {passMark !== undefined ? ` · pass mark ${passMark}%` : ''}
          </p>
        ) : (
          <p className="text-sm text-fg-muted tabular">
            {correct} of {total} prompts completed
          </p>
        )}
      </div>

      <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {session.exercises.map((exercise, i) => {
          const s = session.states[exercise.id]
          const ok = s?.outcome === 'correct'
          const label = describe(exercise)
          return (
            <li key={exercise.id} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
              <div className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="correct" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="incorrect" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-fg-muted tabular">{i + 1}. </span>
                  {label}
                </span>
              </div>
              {!ok && s?.result ? (
                <div className="ml-6 flex flex-col gap-1 text-xs text-fg-muted">
                  <span>
                    Correct: <span className="font-medium text-fg">{s.result.correctAnswer}</span>
                  </span>
                  {exercise.explanation ? <LocalizedTextView text={exercise.explanation} /> : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw aria-hidden /> {isAssessment ? 'Retake' : 'Practise again'}
        </Button>
        {actions}
      </div>
    </div>
  )
}

function describe(exercise: Exercise): string {
  switch (exercise.type) {
    case 'multiple_choice':
      return exercise.prompt
    case 'fill_blank':
      return exercise.text
    case 'sentence_ordering':
      return exercise.prompt ?? 'Put the words in order'
    case 'error_correction':
      return exercise.incorrect
    case 'matching':
      return exercise.prompt ?? 'Match the pairs'
    case 'question_formation':
      return exercise.prompt
    case 'sentence_transformation':
      return `${exercise.transformation.en} ${exercise.source}`
    case 'speaking_prompt':
      return exercise.prompt.en
    case 'guided_writing':
      return exercise.prompt.en
    default: {
      const never: never = exercise
      return never
    }
  }
}
