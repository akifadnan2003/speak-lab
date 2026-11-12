import type { Chapter, Exercise } from '../schema'

/**
 * Strips answer keys from assessment lessons before content reaches the browser in a real
 * (Supabase-backed) build. Assessments are graded by the `assessment` Edge Function from the
 * full content, so the client never needs these fields; keeping them out of the bundle means a
 * learner cannot read the chapter check's answers from the page source.
 *
 * What cannot be hidden without changing the exercise itself (and is therefore documented in
 * docs/SECURITY.md rather than pretended away):
 *   - sentence ordering: the tokens are the answer, presented shuffled;
 *   - matching: the pairs are the answer, presented shuffled;
 *   - speaking prompts: self-checked, the model answer is the teaching content.
 * Practice lessons are left intact: their immediate feedback is the point.
 */
export const REDACTED = '•••'

export function redactExercise(exercise: Exercise): Exercise {
  switch (exercise.type) {
    case 'multiple_choice':
      return { ...exercise, correctOptionId: '' }
    case 'fill_blank':
      return { ...exercise, blanks: exercise.blanks.map(() => ({ accepted: [REDACTED] })) }
    case 'error_correction':
    case 'question_formation':
    case 'sentence_transformation':
      return { ...exercise, accepted: [REDACTED] }
    case 'guided_writing':
      return { ...exercise, requirements: exercise.requirements.map((r) => ({ label: r.label, anyOf: [REDACTED] })), modelAnswer: undefined }
    case 'sentence_ordering':
    case 'matching':
    case 'speaking_prompt':
      return exercise
    default: {
      const never: never = exercise
      return never
    }
  }
}

export function redactAssessmentKeys(chapters: readonly Chapter[]): Chapter[] {
  return chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) =>
      lesson.kind === 'assessment' ? { ...lesson, exercises: lesson.exercises.map(redactExercise) } : lesson,
    ),
  }))
}

/** True when an exercise has had its key removed (used to refuse local grading). */
export function isRedacted(exercise: Exercise): boolean {
  switch (exercise.type) {
    case 'multiple_choice':
      return exercise.correctOptionId === ''
    case 'fill_blank':
      return exercise.blanks.some((b) => b.accepted[0] === REDACTED)
    case 'error_correction':
    case 'question_formation':
    case 'sentence_transformation':
      return exercise.accepted[0] === REDACTED
    case 'guided_writing':
      return exercise.requirements.some((r) => r.anyOf[0] === REDACTED)
    default:
      return false
  }
}
