import type { LessonKind, Skill } from '@/features/curriculum/schema'
import { SKILLS } from '@/features/curriculum/schema'
import { isPracticeLesson, latestFirstTries, lessonIndex, lessonKey, percent } from './records'
import type { LearningRecords } from './types'

/**
 * English skill development. Definitions: docs/PROGRESS_METRICS.md §3.
 *
 * Every skill reports participation (lessons completed, exercises tried) separately from
 * accuracy/mastery, and shows a number only where graded evidence exists:
 * - grammar, reading, pronunciation-free skills: first-try accuracy over graded exercises in
 *   lessons of that kind (minimum `MIN_GRADED_EXERCISES` distinct exercises);
 * - vocabulary: server-owned review outcomes and the mastered share of learned words (minimum
 *   `MIN_VOCABULARY_REVIEWS` reviews);
 * - speaking and writing: only self-checked exercises exist, so no score is ever shown;
 * - listening: no listening content exists yet.
 */
export const MIN_GRADED_EXERCISES = 8
export const MIN_VOCABULARY_REVIEWS = 10

/** Exercise types graded by the engine (self-checked types never count towards accuracy). */
const GRADED_TYPES = new Set(['multiple_choice', 'fill_blank', 'sentence_ordering', 'error_correction', 'matching', 'question_formation', 'sentence_transformation'])

export type SkillEvidence =
  | { readonly kind: 'measured'; readonly accuracy: number; readonly mastered?: number; readonly sample: number }
  | { readonly kind: 'insufficient'; readonly sample: number; readonly needed: number }
  | { readonly kind: 'self_checked' }
  | { readonly kind: 'no_content' }

export interface SkillSummary {
  readonly skill: Skill
  readonly lessonsCompleted: number
  readonly exercisesTried: number
  readonly evidence: SkillEvidence
}

const SELF_CHECKED: ReadonlySet<Skill> = new Set<Skill>(['speaking', 'writing'])

/** The six skills the dashboard reports on (pronunciation lessons count towards speaking). */
export const REPORTED_SKILLS: readonly Skill[] = SKILLS.filter((s) => s !== 'pronunciation')

/** Which reported skill a lesson's work belongs to, or null for the chapter check. */
export function skillOfLesson(kind: LessonKind): Skill | null {
  if (kind === 'assessment') return null
  if (kind === 'pronunciation') return 'speaking'
  return kind
}

export function computeSkills(records: LearningRecords): readonly SkillSummary[] {
  const index = lessonIndex(records.chapters)
  const hasContent = new Set<Skill>()
  for (const chapter of records.chapters) {
    if (chapter.status !== 'authored') continue
    for (const lesson of chapter.lessons) {
      const skill = skillOfLesson(lesson.kind)
      if (skill) hasContent.add(skill)
    }
  }

  const lessonsCompleted = new Map<Skill, number>()
  for (const record of records.lessonProgress) {
    const ref = index.get(lessonKey(record.chapterId, record.lessonId))
    const skill = ref && isPracticeLesson(ref) ? skillOfLesson(ref.lesson.kind) : null
    if (!skill || record.status !== 'completed') continue
    lessonsCompleted.set(skill, (lessonsCompleted.get(skill) ?? 0) + 1)
  }

  const tried = new Map<Skill, Set<string>>()
  const firstTryScores = new Map<Skill, number[]>()
  for (const attempt of records.attempts) {
    const ref = index.get(lessonKey(attempt.chapterId, attempt.lessonId))
    const skill = ref && isPracticeLesson(ref) ? skillOfLesson(ref.lesson.kind) : null
    if (!skill) continue
    const set = tried.get(skill) ?? new Set<string>()
    set.add(`${attempt.chapterId}/${attempt.lessonId}/${attempt.exerciseId}`)
    tried.set(skill, set)
  }
  for (const attempt of latestFirstTries(records.attempts).values()) {
    const ref = index.get(lessonKey(attempt.chapterId, attempt.lessonId))
    const skill = ref && isPracticeLesson(ref) ? skillOfLesson(ref.lesson.kind) : null
    if (!skill || !GRADED_TYPES.has(attempt.exerciseType)) continue
    const list = firstTryScores.get(skill) ?? []
    list.push(attempt.score)
    firstTryScores.set(skill, list)
  }

  const applied = records.vocabularyReviews.filter((r) => r.skill !== 'spoken')
  const learned = records.vocabularyStates.filter((s) => s.stage !== 'new')
  const mastered = learned.filter((s) => s.stage === 'mastered').length

  return REPORTED_SKILLS.map<SkillSummary>((skill) => {
    const participation = { lessonsCompleted: lessonsCompleted.get(skill) ?? 0, exercisesTried: tried.get(skill)?.size ?? 0 }
    if (skill === 'vocabulary') {
      const sample = applied.length
      if (sample < MIN_VOCABULARY_REVIEWS) return { skill, ...participation, evidence: { kind: 'insufficient', sample, needed: MIN_VOCABULARY_REVIEWS } }
      const accuracy = Math.round((applied.filter((r) => r.correct).length / sample) * 100)
      return {
        skill,
        ...participation,
        evidence: { kind: 'measured', accuracy, mastered: learned.length === 0 ? 0 : Math.round((mastered / learned.length) * 100), sample },
      }
    }
    if (SELF_CHECKED.has(skill)) return { skill, ...participation, evidence: { kind: 'self_checked' } }
    if (!hasContent.has(skill)) return { skill, ...participation, evidence: { kind: 'no_content' } }
    const scores = firstTryScores.get(skill) ?? []
    if (scores.length < MIN_GRADED_EXERCISES) return { skill, ...participation, evidence: { kind: 'insufficient', sample: scores.length, needed: MIN_GRADED_EXERCISES } }
    return { skill, ...participation, evidence: { kind: 'measured', accuracy: percent(scores)!, sample: scores.length } }
  })
}
