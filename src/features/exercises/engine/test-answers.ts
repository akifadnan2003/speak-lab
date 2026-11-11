import type { Answer, Exercise } from '@/features/curriculum/schema'

/**
 * Test helper: the answer the author marked as correct, for every exercise type. Lets tests and
 * integration suites pass an assessment without hand-writing each answer.
 */
export function correctAnswerFor(exercise: Exercise): Answer {
  switch (exercise.type) {
    case 'multiple_choice':
      return { type: 'multiple_choice', optionId: exercise.correctOptionId }
    case 'fill_blank':
      return { type: 'fill_blank', values: exercise.blanks.map((b) => b.accepted[0] ?? '') }
    case 'sentence_ordering':
      return { type: 'sentence_ordering', order: exercise.tokens.map((_, i) => i) }
    case 'error_correction':
      return { type: 'error_correction', text: exercise.accepted[0] ?? '' }
    case 'matching':
      return { type: 'matching', matches: Object.fromEntries(exercise.pairs.map((p) => [p.id, p.id])) }
    case 'question_formation':
      return { type: 'question_formation', text: exercise.accepted[0] ?? '' }
    case 'sentence_transformation':
      return { type: 'sentence_transformation', text: exercise.accepted[0] ?? '' }
    case 'speaking_prompt':
      return { type: 'speaking_prompt', done: true, checklist: exercise.checklist.map(() => true) }
    case 'guided_writing': {
      const words = exercise.requirements.map((r) => r.anyOf[0] ?? '').join(' ')
      const filler = Array.from({ length: exercise.minWords }, (_, i) => `word${i}`).join(' ')
      return { type: 'guided_writing', text: `${words} ${filler}` }
    }
    default: {
      const never: never = exercise
      return never
    }
  }
}
