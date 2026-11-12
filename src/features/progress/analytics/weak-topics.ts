import { nextLesson, currentChapter } from '@/features/curriculum/progression'
import { isPracticeLesson, latestFirstTries, lessonIndex, lessonKey, percent, submittedAssessments } from './records'
import type { LearningRecords } from './types'

/**
 * Topics that need practice, and what to do next. Definitions: docs/PROGRESS_METRICS.md §4.
 *
 * Evidence thresholds (a topic is never called weak on a handful of answers):
 * - a practice lesson: at least `WEAK_MIN_EXERCISES` distinct exercises tried and first-try
 *   accuracy below `WEAK_ACCURACY` percent;
 * - a chapter check: best submitted score below the pass mark;
 * - vocabulary: at least `WEAK_MIN_LAPSED_WORDS` words with two or more lapses.
 * Recommendations link only to content the learner can open right now.
 */
export const WEAK_MIN_EXERCISES = 6
export const WEAK_ACCURACY = 70
export const WEAK_MIN_LAPSED_WORDS = 3

export interface WeakTopic {
  readonly id: string
  readonly kind: 'lesson' | 'chapter_check' | 'vocabulary'
  readonly title: string
  readonly detail: string
  /** First-try accuracy (lesson) or best score (chapter check), percent. */
  readonly accuracy: number | null
  readonly sample: number
  /** In-app path the learner can open now, if any. */
  readonly href: string | null
}

export interface NextStep {
  readonly id: string
  readonly kind: 'continue' | 'chapter_check' | 'vocabulary_due' | 'weak_topic' | 'start'
  readonly title: string
  readonly detail: string
  readonly href: string
}

export interface PracticeInsights {
  readonly weakTopics: readonly WeakTopic[]
  /** Lessons tried but without enough evidence yet (shown as "Not enough practice data"). */
  readonly insufficient: number
  readonly nextSteps: readonly NextStep[]
}

export function computePracticeInsights(records: LearningRecords, vocabularyDue: number): PracticeInsights {
  const index = lessonIndex(records.chapters)
  const weak: WeakTopic[] = []
  let insufficient = 0

  // Lessons: first-try accuracy over distinct graded exercises.
  const byLesson = new Map<string, number[]>()
  for (const attempt of latestFirstTries(records.attempts).values()) {
    const key = lessonKey(attempt.chapterId, attempt.lessonId)
    const ref = index.get(key)
    if (!isPracticeLesson(ref) || attempt.exerciseType === 'speaking_prompt' || attempt.exerciseType === 'guided_writing') continue
    const list = byLesson.get(key) ?? []
    list.push(attempt.score)
    byLesson.set(key, list)
  }
  for (const [key, scores] of byLesson) {
    const ref = index.get(key)!
    if (scores.length < WEAK_MIN_EXERCISES) {
      insufficient++
      continue
    }
    const accuracy = percent(scores)!
    if (accuracy >= WEAK_ACCURACY) continue
    const state = records.progression.get(ref.chapter.id)?.lessons.find((l) => l.lesson.id === ref.lesson.id)
    const openable = state !== undefined && state.status !== 'locked'
    weak.push({
      id: `lesson:${key}`,
      kind: 'lesson',
      title: ref.lesson.title,
      detail: `${ref.chapter.level} · Chapter ${ref.chapter.number} · ${accuracy}% right on the first try across ${scores.length} exercises`,
      accuracy,
      sample: scores.length,
      href: openable ? `/learn/${ref.chapter.id}/lessons/${ref.lesson.id}` : null,
    })
  }

  // Chapter checks: best submitted score below the pass mark.
  const best = new Map<string, { score: number; passMark: number; count: number; lessonId: string }>()
  for (const a of submittedAssessments(records.assessments)) {
    const current = best.get(a.chapterId)
    if (!current) best.set(a.chapterId, { score: a.score!, passMark: a.passMark, count: 1, lessonId: a.lessonId })
    else best.set(a.chapterId, { ...current, score: Math.max(current.score, a.score!), count: current.count + 1 })
  }
  for (const [chapterId, b] of best) {
    if (b.score >= b.passMark) continue
    const state = records.progression.get(chapterId)
    if (!state) continue
    const check = state.lessons.find((l) => l.lesson.id === b.lessonId)
    weak.push({
      id: `check:${chapterId}`,
      kind: 'chapter_check',
      title: `${state.chapter.title}: chapter check`,
      detail: `Best score ${b.score}% of the ${b.passMark}% needed, ${b.count} ${b.count === 1 ? 'attempt' : 'attempts'}`,
      accuracy: b.score,
      sample: b.count,
      href: check && check.status !== 'locked' ? `/learn/${chapterId}/lessons/${b.lessonId}` : `/learn/${chapterId}`,
    })
  }

  // Vocabulary: words that keep lapsing.
  const lapsed = records.vocabularyStates.filter((s) => s.lapses >= 2)
  if (lapsed.length >= WEAK_MIN_LAPSED_WORDS) {
    weak.push({
      id: 'vocabulary:lapses',
      kind: 'vocabulary',
      title: 'Words you keep forgetting',
      detail: `${lapsed.length} words were forgotten after being learned at least twice`,
      accuracy: null,
      sample: lapsed.length,
      href: '/vocabulary/practice/active_recall',
    })
  }

  weak.sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101) || a.id.localeCompare(b.id))

  // Next steps, most useful first.
  const steps: NextStep[] = []
  const chapter = currentChapter(records.progression)
  const lesson = chapter ? nextLesson(chapter) : undefined
  if (chapter && lesson) {
    const started = records.lessonProgress.length > 0 || records.attempts.length > 0
    steps.push({
      id: `continue:${chapter.chapter.id}/${lesson.lesson.id}`,
      kind: started ? 'continue' : 'start',
      title: started ? `Continue: ${lesson.lesson.title}` : `Start: ${lesson.lesson.title}`,
      detail: `${chapter.chapter.level} · Chapter ${chapter.chapter.number} · ${chapter.chapter.title} · ${lesson.lesson.estimatedMinutes} min`,
      href: `/learn/${chapter.chapter.id}/lessons/${lesson.lesson.id}`,
    })
  }
  if (chapter) {
    const check = chapter.lessons.find((l) => l.lesson.kind === 'assessment')
    if (check && check.status === 'available') {
      steps.push({
        id: `check:${chapter.chapter.id}`,
        kind: 'chapter_check',
        title: `Take the chapter check: ${chapter.chapter.title}`,
        detail: `Pass mark ${chapter.chapter.completion.passMark}%`,
        href: `/learn/${chapter.chapter.id}/lessons/${check.lesson.id}`,
      })
    }
  }
  if (vocabularyDue > 0) {
    steps.push({
      id: 'vocabulary:due',
      kind: 'vocabulary_due',
      title: `Review ${vocabularyDue} ${vocabularyDue === 1 ? 'word' : 'words'} due now`,
      detail: 'Spaced repetition works best when reviews happen on time',
      href: '/vocabulary',
    })
  }
  const firstWeak = weak.find((w) => w.href)
  if (firstWeak?.href) {
    steps.push({ id: `weak:${firstWeak.id}`, kind: 'weak_topic', title: `Practise again: ${firstWeak.title}`, detail: firstWeak.detail, href: firstWeak.href })
  }

  return { weakTopics: weak, insufficient, nextSteps: steps.slice(0, 4) }
}
