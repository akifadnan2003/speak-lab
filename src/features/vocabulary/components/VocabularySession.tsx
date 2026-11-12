import { ArrowRight, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { Answer, Exercise } from '@/features/curriculum/schema'
import { ExerciseFeedback } from '@/features/exercises/components/ExerciseFeedback'
import { ExerciseRenderer } from '@/features/exercises/components/ExerciseRenderer'
import { emptyAnswer, grade, isAnswerComplete, type GradeResult } from '@/features/exercises/engine/grade'
import { cn } from '@/lib/utils'
import { buildMatching, buildMeaningChoice, buildMissingWord, buildSentenceCompletion, type VocabularyMode } from '../modes'
import type { VocabularyReviewRecord, VocabularyState } from '../ports'
import { QUEUE_REASON_LABEL, type QueueEntry } from '../revision/queue'
import type { VocabularyEntry } from '../schema'
import { schedule, type ReviewInput } from '../srs/scheduler'
import { stageLabel } from '../stage-label'
import { ActiveRecall } from './ActiveRecall'
import { Flashcard } from './Flashcard'
import { TranslationReveal } from './TranslationReveal'

export interface SessionOutcome {
  readonly entry: VocabularyEntry
  readonly correct: boolean
  readonly stateAfter: VocabularyState
}

export interface VocabularySessionProps {
  readonly mode: VocabularyMode
  readonly queue: readonly QueueEntry[]
  readonly bank: readonly VocabularyEntry[]
  readonly studentId: string
  readonly now?: () => Date
  readonly onReview: (state: VocabularyState, review: VocabularyReviewRecord) => void
  /** Start a fresh session with a newly built queue. */
  readonly onRestart?: () => void
  readonly summaryActions?: ReactNode
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Runs one practice session over a revision queue. Each item gets one
 * attempt (spaced repetition records the result and reschedules), then the
 * learner moves on. States are updated locally as the session goes so a word
 * that appears twice (e.g. in a matching group) uses its latest state.
 */
export function VocabularySession({ mode, queue: queueProp, bank, studentId, now = () => new Date(), onReview, onRestart, summaryActions }: VocabularySessionProps) {
  // Snapshot the queue at mount: saving a review mid-session must not reorder the remaining items.
  const [queue] = useState(queueProp)
  const steps = useMemo(() => chunk(queue, mode.groupSize), [queue, mode.groupSize])
  const [index, setIndex] = useState(0)
  const [states, setStates] = useState<Record<string, VocabularyState>>(() => Object.fromEntries(queue.map((q) => [q.entry.id, q.state])))
  const [outcomes, setOutcomes] = useState<SessionOutcome[]>([])
  const [stepDone, setStepDone] = useState(false)

  const record = useCallback(
    (entry: VocabularyEntry, input: Omit<ReviewInput, 'now' | 'skill'> & { skill?: ReviewInput['skill'] }, answer?: string) => {
      const at = now()
      const current = states[entry.id]
      if (!current) return
      const skill = input.skill ?? mode.skill
      const { state, quality } = schedule(current, { ...input, skill, now: at })
      const review: VocabularyReviewRecord = {
        id: newId(),
        studentId,
        entryId: entry.id,
        modeId: mode.id,
        skill,
        correct: quality >= 3,
        quality,
        hintUsed: input.hintUsed ?? false,
        ...(answer !== undefined ? { answer } : {}),
        reviewedAt: at.toISOString(),
        intervalDaysAfter: state.intervalDays,
        stageAfter: state.stage,
      }
      setStates((s) => ({ ...s, [entry.id]: state }))
      setOutcomes((o) => [...o, { entry, correct: quality >= 3, stateAfter: state }])
      onReview(state, review)
    },
    [mode.id, mode.skill, now, onReview, states, studentId],
  )

  const step = steps[index]
  const finished = index >= steps.length

  if (queue.length === 0) return null

  if (finished) {
    return <SessionSummary outcomes={outcomes} actions={summaryActions} onRestart={onRestart} />
  }
  if (!step) return null

  const total = steps.length
  const next = () => {
    setStepDone(false)
    setIndex((i) => i + 1)
  }
  const first = step[0]!

  return (
    <div className="flex flex-col gap-4" data-testid="vocab-session">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted tabular">
          {index + 1} of {total}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {step.length === 1 ? <Badge variant="neutral">{QUEUE_REASON_LABEL[first.reason]}</Badge> : null}
          <Badge variant="primary">{mode.label}</Badge>
        </div>
      </div>
      <Progress value={(index / total) * 100} size="sm" aria-label={`${index} of ${total} done`} />

      <div key={`${index}-${first.entry.id}`}>
        {mode.renderer === 'flashcard' ? (
          <Flashcard
            entry={first.entry}
            onGrade={(selfGrade) => {
              record(first.entry, { correct: selfGrade !== 'again', selfGrade })
              next()
            }}
          />
        ) : mode.renderer === 'recall' ? (
          <ActiveRecall
            entry={first.entry}
            onResult={(r) => {
              record(first.entry, { correct: r.correct, hintUsed: r.hintUsed }, r.answer)
              setStepDone(true)
            }}
          />
        ) : (
          <ExerciseStep
            mode={mode}
            entries={step.map((s) => s.entry)}
            bank={bank}
            onChecked={(results) => {
              for (const r of results) record(r.entry, { correct: r.correct, hintUsed: r.hintUsed }, r.answer)
              setStepDone(true)
            }}
          />
        )}
      </div>

      {stepDone ? (
        <div className="flex justify-end border-t border-line pt-4">
          <Button onClick={next} data-testid="next-item">
            {index + 1 === total ? 'Finish' : 'Next'} <ArrowRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

interface ExerciseStepResult {
  entry: VocabularyEntry
  correct: boolean
  hintUsed: boolean
  answer?: string
}

function ExerciseStep({
  mode,
  entries,
  bank,
  onChecked,
}: {
  mode: VocabularyMode
  entries: readonly VocabularyEntry[]
  bank: readonly VocabularyEntry[]
  onChecked: (results: ExerciseStepResult[]) => void
}) {
  const exercise = useMemo<Exercise | null>(() => {
    const first = entries[0]
    if (!first) return null
    switch (mode.id) {
      case 'meaning_choice':
        return buildMeaningChoice(first, bank)
      case 'sentence_completion':
        return buildSentenceCompletion(first, bank)
      case 'missing_word':
        return buildMissingWord(first)
      case 'matching':
        return buildMatching(entries)
      default:
        return null
    }
  }, [mode.id, entries, bank])
  const [answer, setAnswer] = useState<Answer | null>(() => (exercise ? emptyAnswer(exercise) : null))
  const [result, setResult] = useState<GradeResult | null>(null)
  const [hint, setHint] = useState(false)

  if (!exercise || !answer) {
    return <p className="text-sm text-fg-muted">This word cannot be practised in this mode yet.</p>
  }

  const check = () => {
    if (result || !isAnswerComplete(exercise, answer)) return
    const r = grade(exercise, answer)
    setResult(r)
    if (exercise.type === 'matching') {
      onChecked(
        entries.map((entry) => ({
          entry,
          correct: r.parts?.find((p) => p.key === entry.id)?.correct ?? false,
          hintUsed: false,
        })),
      )
    } else {
      const first = entries[0]!
      onChecked([{ entry: first, correct: r.correct, hintUsed: hint, answer: describeAnswer(answer, exercise) }])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ExerciseRenderer
        exercise={exercise}
        answer={answer}
        onChange={setAnswer}
        disabled={!!result}
        result={result ?? undefined}
        revealed={!!result && !result.correct}
        onSubmit={check}
      />
      {exercise.hint && !result ? (
        !hint ? (
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => setHint(true)}>
            Hint
          </Button>
        ) : (
          <p role="note" className="text-sm text-fg-muted">
            {exercise.hint.en}
          </p>
        )
      ) : null}
      {!result ? (
        <Button onClick={check} disabled={!isAnswerComplete(exercise, answer)} className="w-fit" data-testid="check-answer">
          Check
        </Button>
      ) : (
        <>
          <ExerciseFeedback outcome={result.correct ? 'correct' : 'revealed'} result={result} explanation={exercise.explanation} attemptsLeft={0} />
          {entries.length === 1 ? <TranslationReveal entry={entries[0]!} /> : null}
        </>
      )}
    </div>
  )
}

function describeAnswer(answer: Answer, exercise: Exercise): string | undefined {
  switch (answer.type) {
    case 'multiple_choice':
      return exercise.type === 'multiple_choice' ? exercise.options.find((o) => o.id === answer.optionId)?.text : undefined
    case 'fill_blank':
      return answer.values.join(' / ')
    default:
      return undefined
  }
}

function SessionSummary({ outcomes, actions, onRestart }: { outcomes: readonly SessionOutcome[]; actions?: ReactNode; onRestart?: () => void }) {
  const correct = outcomes.filter((o) => o.correct).length
  return (
    <div className="flex flex-col gap-5" data-testid="vocab-summary" aria-live="polite">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success-soft-fg">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold">Session complete</h2>
        <p className="text-sm text-fg-muted tabular">
          {correct} of {outcomes.length} correct · reviews saved
        </p>
      </div>
      <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {outcomes.map((o, i) => (
          <li key={`${o.entry.id}-${i}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            {o.correct ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="correct" />
            ) : (
              <XCircle className="size-4 shrink-0 text-danger" aria-label="incorrect" />
            )}
            <span className="min-w-0 flex-1 font-medium">{o.entry.term}</span>
            <span className={cn('text-xs text-fg-muted tabular')}>
              {stageLabel(o.stateAfter.stage)} · next in {o.stateAfter.intervalDays} {o.stateAfter.intervalDays === 1 ? 'day' : 'days'}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onRestart ? (
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw aria-hidden /> Practise again
          </Button>
        ) : null}
        {actions}
      </div>
    </div>
  )
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 1) return items.map((i) => [i])
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  // A trailing matching group of one cannot be matched; fold it into the previous group.
  const last = out[out.length - 1]
  if (out.length > 1 && last && last.length < 2) {
    out.pop()
    out[out.length - 1]!.push(...last)
  }
  return out
}
