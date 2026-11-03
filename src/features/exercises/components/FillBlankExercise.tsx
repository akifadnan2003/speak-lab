import { Fragment, useId, useRef, type KeyboardEvent } from 'react'
import { BLANK_MARKER } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import type { ExerciseComponentProps } from './types'

/**
 * Inline blanks inside the sentence. A word bank, when authored, offers
 * tappable chips that fill the focused (or next empty) blank — convenient on
 * phones, but typing always works too.
 */
export function FillBlankExercise({
  exercise,
  answer,
  onChange,
  disabled,
  result,
  revealed,
  onSubmit,
  hideCorrectness,
}: ExerciseComponentProps<'fill_blank'>) {
  const id = useId()
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const focused = useRef<number>(0)
  const segments = exercise.text.split(BLANK_MARKER)
  const checked = !!result && !hideCorrectness

  function setValue(index: number, value: string) {
    const values = [...answer.values]
    values[index] = value
    onChange({ type: 'fill_blank', values })
  }

  function fillFromBank(word: string) {
    if (disabled) return
    let target = focused.current
    const current = answer.values[target] ?? ''
    if (current.trim().length > 0) {
      const nextEmpty = answer.values.findIndex((v) => v.trim().length === 0)
      target = nextEmpty >= 0 ? nextEmpty : target
    }
    setValue(target, word)
    inputs.current[target]?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base leading-9" id={`${id}-prompt`}>
        {segments.map((segment, i) => {
          const blankIndex = i
          const part = result?.parts?.[blankIndex]
          const showCorrect = checked && part?.correct
          const showWrong = checked && part && !part.correct
          const width = Math.max(5, (exercise.blanks[blankIndex]?.accepted[0]?.length ?? 4) + 2)
          return (
            <Fragment key={i}>
              <span>{segment}</span>
              {blankIndex < exercise.blanks.length ? (
                <span className="inline-flex flex-col align-baseline">
                  <input
                    ref={(el) => {
                      inputs.current[blankIndex] = el
                    }}
                    type="text"
                    inputMode="text"
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={`Blank ${blankIndex + 1} of ${exercise.blanks.length}`}
                    aria-invalid={showWrong || undefined}
                    value={answer.values[blankIndex] ?? ''}
                    disabled={disabled}
                    onFocus={() => {
                      focused.current = blankIndex
                    }}
                    onChange={(e) => setValue(blankIndex, e.target.value)}
                    onKeyDown={onKeyDown}
                    style={{ width: `${width}ch` }}
                    className={cn(
                      'mx-1 inline-block h-9 min-w-16 rounded-md border bg-surface px-2 text-center text-base font-medium text-fg shadow-xs',
                      'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                      'disabled:opacity-80',
                      !showCorrect && !showWrong && 'border-line-strong',
                      showCorrect && 'border-success bg-success-soft text-success-soft-fg',
                      showWrong && 'border-danger bg-danger-soft text-danger-soft-fg',
                    )}
                  />
                  {revealed && part && !part.correct ? (
                    <span className="text-center text-xs text-success-soft-fg">{part.expected}</span>
                  ) : null}
                </span>
              ) : null}
            </Fragment>
          )
        })}
      </p>

      {exercise.wordBank && !disabled ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Word bank">
          {exercise.wordBank.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => fillFromBank(word)}
              className="min-h-10 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {word}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
