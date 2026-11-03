import { useId, useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { optionBase, optionCorrect, optionIdle, optionMuted, optionSelected, optionWrong, type ExerciseComponentProps } from './types'

export function MultipleChoiceExercise({
  exercise,
  answer,
  onChange,
  disabled,
  result,
  revealed,
  hideCorrectness,
}: ExerciseComponentProps<'multiple_choice'>) {
  const labelId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const checked = !!result && !hideCorrectness

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled) return
    const last = exercise.options.length - 1
    let next: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    const option = exercise.options[next]
    if (option) {
      onChange({ type: 'multiple_choice', optionId: option.id })
      refs.current[next]?.focus()
    }
  }

  const selectedIndex = Math.max(
    0,
    exercise.options.findIndex((o) => o.id === answer.optionId),
  )

  return (
    <div className="flex flex-col gap-3">
      <p id={labelId} className="text-base font-medium">
        {exercise.prompt}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        {exercise.options.map((option, i) => {
          const active = answer.optionId === option.id
          const isCorrect = option.id === exercise.correctOptionId
          const showCorrect = (checked || revealed) && isCorrect
          const showWrong = checked && active && !isCorrect
          return (
            <button
              key={option.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={i === selectedIndex ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange({ type: 'multiple_choice', optionId: option.id })}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                optionBase,
                !active && !showCorrect && !showWrong && !(checked || revealed) && optionIdle,
                active && !showCorrect && !showWrong && optionSelected,
                showCorrect && optionCorrect,
                showWrong && optionWrong,
                (checked || revealed) && !showCorrect && !showWrong && optionMuted,
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                {option.id.toUpperCase()}
              </span>
              <span>{option.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
