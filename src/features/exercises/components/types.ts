import type { AnswerOf, ExerciseOf, ExerciseType } from '@/features/curriculum/schema'
import type { GradeResult } from '../engine/grade'

/** Props shared by every exercise component. */
export interface ExerciseComponentProps<T extends ExerciseType> {
  readonly exercise: ExerciseOf<T>
  readonly answer: AnswerOf<T>
  readonly onChange: (answer: AnswerOf<T>) => void
  /** Input is frozen: answered correctly, revealed, or assessment attempt used. */
  readonly disabled: boolean
  /** Last grading result, used to highlight correct/incorrect parts. */
  readonly result?: GradeResult
  /** Show the correct answer (attempts exhausted or learner gave up). */
  readonly revealed: boolean
  /** Pressing Enter in a single-line input submits. */
  readonly onSubmit?: () => void
  /** Assessment mode hides per-part correctness until the end. */
  readonly hideCorrectness?: boolean
}

export const optionBase =
  'flex min-h-12 w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default'
export const optionIdle = 'border-line bg-surface hover:border-line-strong hover:bg-surface-2'
export const optionSelected = 'border-primary bg-primary-soft text-primary-soft-fg'
export const optionCorrect = 'border-success bg-success-soft text-success-soft-fg'
export const optionWrong = 'border-danger bg-danger-soft text-danger-soft-fg'
export const optionMuted = 'border-line opacity-60'
