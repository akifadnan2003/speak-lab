import { useId, useMemo, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shuffledIndices } from '../engine/shuffle'
import type { ExerciseComponentProps } from './types'

/**
 * Tap-to-build sentence ordering. No drag and drop: tapping a word moves it
 * into the sentence, tapping it there removes it, and arrow keys reorder
 * from the keyboard. This works identically with touch, mouse and keyboard.
 */
export function SentenceOrderingExercise({
  exercise,
  answer,
  onChange,
  disabled,
  result,
  revealed,
  hideCorrectness,
}: ExerciseComponentProps<'sentence_ordering'>) {
  const id = useId()
  const pool = useMemo(() => shuffledIndices(exercise.tokens.length, exercise.id), [exercise.id, exercise.tokens.length])
  const used = new Set(answer.order)
  const checked = !!result && !hideCorrectness

  function add(index: number) {
    if (disabled || used.has(index)) return
    onChange({ type: 'sentence_ordering', order: [...answer.order, index] })
  }

  function remove(position: number) {
    if (disabled) return
    onChange({ type: 'sentence_ordering', order: answer.order.filter((_, i) => i !== position) })
  }

  function move(position: number, delta: -1 | 1) {
    const target = position + delta
    if (disabled || target < 0 || target >= answer.order.length) return
    const next = [...answer.order]
    const a = next[position]!
    next[position] = next[target]!
    next[target] = a
    onChange({ type: 'sentence_ordering', order: next })
  }

  function onSentenceKey(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(position, -1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(position, 1)
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      remove(position)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-medium" id={`${id}-prompt`}>
        {exercise.prompt ?? 'Put the words in the correct order.'}
      </p>

      <div
        role="group"
        aria-labelledby={`${id}-prompt`}
        aria-describedby={`${id}-help`}
        className={cn(
          'flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-dashed p-2',
          checked && result?.correct ? 'border-success bg-success-soft/40' : 'border-line-strong bg-surface-2/60',
        )}
        data-testid="ordering-sentence"
      >
        {answer.order.length === 0 ? (
          <span className="px-2 text-sm text-fg-subtle">Tap the words below to build the sentence.</span>
        ) : null}
        {answer.order.map((tokenIndex, position) => {
          const part = result?.parts?.[position]
          const wrong = checked && !result?.correct && part && !part.correct
          return (
            <button
              key={`${tokenIndex}-${position}`}
              type="button"
              disabled={disabled}
              onClick={() => remove(position)}
              onKeyDown={(e) => onSentenceKey(e, position)}
              aria-label={`${exercise.tokens[tokenIndex]}, position ${position + 1}. Remove or use arrow keys to move.`}
              className={cn(
                'inline-flex min-h-10 items-center gap-1 rounded-md border px-3 text-sm font-medium shadow-xs',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default',
                wrong ? 'border-danger bg-danger-soft text-danger-soft-fg' : 'border-primary/40 bg-surface text-fg',
              )}
            >
              {exercise.tokens[tokenIndex]}
              {!disabled ? <X className="size-3.5 text-fg-subtle" aria-hidden /> : null}
            </button>
          )
        })}
      </div>
      <p id={`${id}-help`} className="sr-only">
        Words in the sentence can be removed with Backspace and moved with the left and right arrow keys.
      </p>

      <div role="group" aria-label="Available words" className="flex flex-wrap gap-2" data-testid="ordering-pool">
        {pool.map((tokenIndex) => {
          const isUsed = used.has(tokenIndex)
          return (
            <button
              key={tokenIndex}
              type="button"
              disabled={disabled || isUsed}
              onClick={() => add(tokenIndex)}
              aria-pressed={isUsed}
              className={cn(
                'min-h-10 rounded-md border px-3 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isUsed ? 'border-line bg-surface-2 text-fg-subtle line-through' : 'border-line-strong bg-surface hover:bg-surface-2',
              )}
            >
              {exercise.tokens[tokenIndex]}
            </button>
          )
        })}
      </div>

      {revealed ? (
        <p className="text-sm">
          <span className="text-fg-muted">Correct order: </span>
          <span className="font-medium text-success-soft-fg">{result?.correctAnswer ?? exercise.tokens.join(' ')}</span>
        </p>
      ) : null}
    </div>
  )
}
