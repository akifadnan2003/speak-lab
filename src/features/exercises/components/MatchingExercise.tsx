import { useId, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { seededShuffle } from '../engine/shuffle'
import type { ExerciseComponentProps } from './types'

/**
 * Tap-tap matching: select an item on the left, then its partner on the
 * right. Matched pairs show a connector label; tapping a matched item
 * unmatches it. Works with touch and keyboard without drag and drop.
 */
export function MatchingExercise({
  exercise,
  answer,
  onChange,
  disabled,
  result,
  revealed,
  hideCorrectness,
}: ExerciseComponentProps<'matching'>) {
  const id = useId()
  const [pendingLeft, setPendingLeft] = useState<string | null>(null)
  const rights = useMemo(() => seededShuffle(exercise.pairs, `${exercise.id}:right`), [exercise.id, exercise.pairs])
  const checked = !!result && !hideCorrectness

  // right pair id → left pair id that chose it
  const takenBy = new Map<string, string>()
  for (const [left, right] of Object.entries(answer.matches)) takenBy.set(right, left)

  const labelFor = new Map(exercise.pairs.map((p, i) => [p.id, i + 1]))

  function pickLeft(leftId: string) {
    if (disabled) return
    if (answer.matches[leftId]) {
      const next = { ...answer.matches }
      delete next[leftId]
      onChange({ type: 'matching', matches: next })
      setPendingLeft(null)
      return
    }
    setPendingLeft((current) => (current === leftId ? null : leftId))
  }

  function pickRight(rightId: string) {
    if (disabled) return
    const owner = takenBy.get(rightId)
    if (owner) {
      const next = { ...answer.matches }
      delete next[owner]
      onChange({ type: 'matching', matches: next })
      return
    }
    if (!pendingLeft) return
    onChange({ type: 'matching', matches: { ...answer.matches, [pendingLeft]: rightId } })
    setPendingLeft(null)
  }

  function partFor(leftId: string) {
    return result?.parts?.find((p) => p.key === leftId)
  }

  return (
    <div className="flex flex-col gap-3">
      <p id={`${id}-prompt`} className="text-base font-medium">
        {exercise.prompt ?? 'Match the pairs.'}
      </p>
      <p className="text-xs text-fg-muted">Tap an item on the left, then its match on the right.</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2" role="group" aria-labelledby={`${id}-prompt`}>
        <div className="flex flex-col gap-2" role="group" aria-label="Left items">
          {exercise.pairs.map((pair) => {
            const matched = answer.matches[pair.id]
            const part = partFor(pair.id)
            const showCorrect = (checked || revealed) && part?.correct
            const showWrong = checked && part && !part.correct
            const selected = pendingLeft === pair.id
            return (
              <button
                key={pair.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected || !!matched}
                onClick={() => pickLeft(pair.id)}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default',
                  !selected && !matched && 'border-line-strong bg-surface hover:bg-surface-2',
                  selected && 'border-primary bg-primary-soft text-primary-soft-fg ring-1 ring-primary/40',
                  matched && !showCorrect && !showWrong && 'border-primary/50 bg-primary-soft/60',
                  showCorrect && 'border-success bg-success-soft text-success-soft-fg',
                  showWrong && 'border-danger bg-danger-soft text-danger-soft-fg',
                )}
              >
                <span>{pair.left}</span>
                {matched ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold tabular">
                    {labelFor.get(pair.id)}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2" role="group" aria-label="Right items">
          {rights.map((pair) => {
            const owner = takenBy.get(pair.id)
            const part = owner ? partFor(owner) : undefined
            const showCorrect = checked && part?.correct
            const showWrong = checked && part && !part.correct
            return (
              <button
                key={pair.id}
                type="button"
                disabled={disabled || (!pendingLeft && !owner)}
                aria-pressed={!!owner}
                onClick={() => pickRight(pair.id)}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default',
                  !owner && 'border-line-strong bg-surface',
                  !owner && pendingLeft && !disabled && 'hover:bg-surface-2',
                  !owner && !pendingLeft && !disabled && 'opacity-70',
                  owner && !showCorrect && !showWrong && 'border-primary/50 bg-primary-soft/60',
                  showCorrect && 'border-success bg-success-soft text-success-soft-fg',
                  showWrong && 'border-danger bg-danger-soft text-danger-soft-fg',
                )}
              >
                <span>{pair.right}</span>
                {owner ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold tabular">
                    {showCorrect ? <Check className="size-3" aria-label="correct" /> : showWrong ? <X className="size-3" aria-label="wrong" /> : labelFor.get(owner)}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      {revealed ? (
        <ul className="flex flex-col gap-1 text-sm">
          {exercise.pairs.map((pair) => (
            <li key={pair.id} className="text-success-soft-fg">
              {pair.left} → {pair.right}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
