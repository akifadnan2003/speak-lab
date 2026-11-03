import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import { LocalizedTextView } from '@/features/curriculum/az-help'
import type { LocalizedText } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import type { GradeResult } from '../engine/grade'
import type { Outcome } from '../engine/session'

interface ExerciseFeedbackProps {
  readonly outcome: Outcome
  readonly result?: GradeResult
  readonly explanation?: LocalizedText
  readonly attemptsLeft: number
}

/** Status panel shown under an exercise after it is checked. */
export function ExerciseFeedback({ outcome, result, explanation, attemptsLeft }: ExerciseFeedbackProps) {
  if (outcome === 'pending' || !result) return null
  const correct = outcome === 'correct'
  const revealed = outcome === 'revealed'
  const partial = !correct && result.score > 0 && result.score < 1

  let title: string
  if (correct) title = 'Correct!'
  else if (revealed) title = 'Here is the answer.'
  else if (partial) title = 'Almost. Part of it is right.'
  else title = attemptsLeft > 0 ? 'Not quite. Try again.' : 'Not quite.'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="exercise-feedback"
      data-outcome={outcome}
      className={cn(
        'flex gap-3 rounded-lg p-3 text-sm',
        correct && 'bg-success-soft text-success-soft-fg',
        !correct && !revealed && 'bg-warning-soft text-warning-soft-fg',
        revealed && 'bg-info-soft text-info-soft-fg',
      )}
    >
      {correct ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : revealed ? (
        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-semibold">{title}</p>
        {revealed && result.correctAnswer ? (
          <p>
            <span className="opacity-80">Correct answer: </span>
            <span className="font-medium">{result.correctAnswer}</span>
          </p>
        ) : null}
        {(correct || revealed) && explanation ? <LocalizedTextView text={explanation} azClassName="bg-surface/70" /> : null}
        {!correct && !revealed && attemptsLeft > 0 ? (
          <p className="text-xs opacity-80 tabular">
            {attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} left
          </p>
        ) : null}
      </div>
    </div>
  )
}
