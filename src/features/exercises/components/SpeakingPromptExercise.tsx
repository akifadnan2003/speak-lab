import { useId, useState } from 'react'
import { Eye, EyeOff, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocalizedTextView } from '@/features/curriculum/az-help'
import { cn } from '@/lib/utils'
import type { ExerciseComponentProps } from './types'

/**
 * Self-checked speaking drill. The learner says the sentence aloud, reveals
 * the model, and ticks the checklist. There is no recording and no automatic
 * evaluation in this milestone; the copy says so explicitly.
 */
export function SpeakingPromptExercise({ exercise, answer, onChange, disabled }: ExerciseComponentProps<'speaking_prompt'>) {
  const id = useId()
  const [showModel, setShowModel] = useState(false)

  function toggle(index: number) {
    if (disabled) return
    const checklist = exercise.checklist.map((_, i) => (i === index ? !answer.checklist[i] : (answer.checklist[i] ?? false)))
    onChange({ ...answer, checklist })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-skill-speaking/15 text-skill-speaking">
          <Mic className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <LocalizedTextView text={exercise.prompt} className="text-base font-medium" />
          {exercise.cue ? <p className="text-sm text-fg-muted">Cue: {exercise.cue}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Model answer</p>
          <Button variant="ghost" size="sm" onClick={() => setShowModel((v) => !v)} aria-expanded={showModel} aria-controls={`${id}-model`}>
            {showModel ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {showModel ? 'Hide' : 'Show'}
          </Button>
        </div>
        <p id={`${id}-model`} className={cn('mt-1 text-base', !showModel && 'sr-only')}>
          {exercise.modelAnswer}
        </p>
        {!showModel ? <p className="mt-1 text-sm text-fg-subtle">Say it first, then compare.</p> : null}
      </div>

      {exercise.variations && exercise.variations.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-fg-muted">
          {exercise.variations.map((v) => (
            <li key={v} className="flex gap-2">
              <span aria-hidden>↻</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Check yourself</legend>
        {exercise.checklist.map((label, i) => {
          const checkedItem = answer.checklist[i] === true
          return (
            <label
              key={label}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm',
                checkedItem ? 'border-success bg-success-soft text-success-soft-fg' : 'border-line bg-surface hover:bg-surface-2',
                disabled && 'cursor-default',
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={checkedItem}
                onChange={() => toggle(i)}
              />
              <span>{label}</span>
            </label>
          )
        })}
      </fieldset>

      <p className="text-xs text-fg-subtle">Self-checked. Nothing is recorded or evaluated automatically in this lesson.</p>
    </div>
  )
}
