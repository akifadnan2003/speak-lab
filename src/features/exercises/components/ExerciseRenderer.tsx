import type { Answer, Exercise } from '@/features/curriculum/schema'
import type { GradeResult } from '../engine/grade'
import { FillBlankExercise } from './FillBlankExercise'
import { GuidedWritingExercise } from './GuidedWritingExercise'
import { MatchingExercise } from './MatchingExercise'
import { MultipleChoiceExercise } from './MultipleChoiceExercise'
import { SentenceOrderingExercise } from './SentenceOrderingExercise'
import { SpeakingPromptExercise } from './SpeakingPromptExercise'
import { TextAnswerExercise } from './TextAnswerExercise'
import type { AnswerOf } from '@/features/curriculum/schema'

export interface ExerciseRendererProps {
  readonly exercise: Exercise
  readonly answer: Answer
  readonly onChange: (answer: Answer) => void
  readonly disabled: boolean
  readonly result?: GradeResult
  readonly revealed: boolean
  readonly onSubmit?: () => void
  readonly hideCorrectness?: boolean
}

/**
 * Dispatches to the component for the exercise type. The `switch` is
 * exhaustive: adding a type to the schema without a component fails
 * typecheck here.
 */
export function ExerciseRenderer(props: ExerciseRendererProps) {
  const { exercise, answer, onChange, ...rest } = props
  if (exercise.type !== answer.type) return null

  switch (exercise.type) {
    case 'multiple_choice':
      return <MultipleChoiceExercise exercise={exercise} answer={answer as AnswerOf<'multiple_choice'>} onChange={onChange} {...rest} />
    case 'fill_blank':
      return <FillBlankExercise exercise={exercise} answer={answer as AnswerOf<'fill_blank'>} onChange={onChange} {...rest} />
    case 'sentence_ordering':
      return <SentenceOrderingExercise exercise={exercise} answer={answer as AnswerOf<'sentence_ordering'>} onChange={onChange} {...rest} />
    case 'error_correction':
      return <TextAnswerExercise exercise={exercise} answer={answer as AnswerOf<'error_correction'>} onChange={onChange} {...rest} />
    case 'matching':
      return <MatchingExercise exercise={exercise} answer={answer as AnswerOf<'matching'>} onChange={onChange} {...rest} />
    case 'question_formation':
      return <TextAnswerExercise exercise={exercise} answer={answer as AnswerOf<'question_formation'>} onChange={onChange} {...rest} />
    case 'sentence_transformation':
      return <TextAnswerExercise exercise={exercise} answer={answer as AnswerOf<'sentence_transformation'>} onChange={onChange} {...rest} />
    case 'speaking_prompt':
      return <SpeakingPromptExercise exercise={exercise} answer={answer as AnswerOf<'speaking_prompt'>} onChange={onChange} {...rest} />
    case 'guided_writing':
      return <GuidedWritingExercise exercise={exercise} answer={answer as AnswerOf<'guided_writing'>} onChange={onChange} {...rest} />
    default: {
      const never: never = exercise
      return never
    }
  }
}
