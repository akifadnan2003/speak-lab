import { useId, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { LocalizedTextView } from '@/features/curriculum/az-help'
import type { AnswerOf, ExerciseOf } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import type { GradeResult } from '../engine/grade'

type TextType = 'error_correction' | 'question_formation' | 'sentence_transformation'

interface TextAnswerProps {
  readonly exercise: ExerciseOf<TextType>
  readonly answer: AnswerOf<TextType>
  readonly onChange: (answer: AnswerOf<TextType>) => void
  readonly disabled: boolean
  readonly result?: GradeResult
  readonly revealed: boolean
  readonly onSubmit?: () => void
  readonly hideCorrectness?: boolean
}

/**
 * Shared single-line typed answer used by error correction, question
 * formation and sentence transformation. The source sentence is shown as a
 * quote; Enter submits.
 */
export function TextAnswerExercise({
  exercise,
  answer,
  onChange,
  disabled,
  result,
  revealed,
  onSubmit,
  hideCorrectness,
}: TextAnswerProps) {
  const id = useId()
  const checked = !!result && !hideCorrectness

  const heading =
    exercise.type === 'error_correction'
      ? 'Find and correct the mistake.'
      : exercise.type === 'question_formation'
        ? 'Make a question.'
        : undefined

  const source =
    exercise.type === 'error_correction'
      ? exercise.incorrect
      : exercise.type === 'question_formation'
        ? exercise.prompt
        : exercise.source

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {exercise.instruction ? (
        <LocalizedTextView text={exercise.instruction} className="text-base font-medium" />
      ) : heading ? (
        <p className="text-base font-medium">{heading}</p>
      ) : null}
      {exercise.type === 'sentence_transformation' ? (
        <LocalizedTextView text={exercise.transformation} className="text-base font-medium" />
      ) : null}
      <blockquote
        className={cn(
          'rounded-lg border-l-4 bg-surface-2 px-4 py-3 text-base',
          exercise.type === 'error_correction' ? 'border-warning' : 'border-primary',
        )}
      >
        {source}
        {exercise.type === 'question_formation' && exercise.answerCue ? (
          <span className="mt-1 block text-sm text-fg-muted">Answer: {exercise.answerCue}</span>
        ) : null}
      </blockquote>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-input`} className="text-sm font-medium">
          Your answer
        </label>
        <Input
          id={`${id}-input`}
          value={answer.text}
          disabled={disabled}
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={checked && !result?.correct ? true : undefined}
          onChange={(e) => onChange({ type: answer.type, text: e.target.value })}
          onKeyDown={onKeyDown}
          className={cn(
            checked && result?.correct && 'border-success bg-success-soft text-success-soft-fg',
            checked && !result?.correct && 'border-danger',
          )}
        />
      </div>
      {revealed && result ? (
        <p className="text-sm">
          <span className="text-fg-muted">Correct answer: </span>
          <span className="font-medium text-success-soft-fg">{result.correctAnswer}</span>
        </p>
      ) : null}
    </div>
  )
}
