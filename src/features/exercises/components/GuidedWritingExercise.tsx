import { useId } from 'react'
import { Check, Circle, X } from 'lucide-react'
import { Textarea } from '@/components/ui/input'
import { LocalizedTextView } from '@/features/curriculum/az-help'
import { cn } from '@/lib/utils'
import { countWords } from '../engine/normalize'
import type { ExerciseComponentProps } from './types'

/**
 * Guided writing with a deterministic checklist. The requirements are
 * visible from the start so the learner knows what to include; after
 * checking, each one shows pass/fail. Nothing here is evaluated by AI.
 */
export function GuidedWritingExercise({ exercise, answer, onChange, disabled, result, revealed }: ExerciseComponentProps<'guided_writing'>) {
  const id = useId()
  const words = countWords(answer.text)
  const parts = result?.parts

  return (
    <div className="flex flex-col gap-4">
      <LocalizedTextView text={exercise.prompt} className="text-base font-medium" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-text`} className="text-sm font-medium">
          Your text
        </label>
        <Textarea
          id={`${id}-text`}
          value={answer.text}
          disabled={disabled}
          rows={6}
          autoCapitalize="sentences"
          spellCheck={false}
          onChange={(e) => onChange({ type: 'guided_writing', text: e.target.value })}
          aria-describedby={`${id}-count`}
        />
        <p id={`${id}-count`} className="text-xs text-fg-muted tabular" aria-live="polite">
          {words} / {exercise.minWords} words minimum
        </p>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm" aria-label="Checklist">
        {[`At least ${exercise.minWords} words`, ...exercise.requirements.map((r) => r.label)].map((label, i) => {
          const part = parts?.[i]
          const Icon = part ? (part.correct ? Check : X) : Circle
          return (
            <li
              key={label}
              className={cn(
                'flex items-start gap-2',
                part?.correct && 'text-success-soft-fg',
                part && !part.correct && 'text-danger-soft-fg',
                !part && 'text-fg-muted',
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-label={part ? (part.correct ? 'done' : 'missing') : 'to do'} />
              <span>{label}</span>
            </li>
          )
        })}
      </ul>

      {revealed && exercise.modelAnswer ? (
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Model</p>
          <p>{exercise.modelAnswer}</p>
        </div>
      ) : null}
      <p className="text-xs text-fg-subtle">The checklist is checked automatically. Your tutor reads the full text.</p>
    </div>
  )
}
