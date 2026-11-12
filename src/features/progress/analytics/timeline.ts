import { completedPracticeLessons, submittedAssessments } from './records'
import type { LearningRecords } from './types'

/**
 * Chronological learning history. Definitions: docs/PROGRESS_METRICS.md §5.
 *
 * Every entry is backed by one stored record (or a deterministic count of them) and carries a
 * stable id, so re-fetching never produces duplicates. Newest first.
 */
export type TimelineKind = 'lesson_completed' | 'check_passed' | 'check_failed' | 'chapter_completed' | 'vocabulary_milestone' | 'vocabulary_first_review'

export interface TimelineEvent {
  readonly id: string
  readonly kind: TimelineKind
  readonly at: string
  readonly title: string
  readonly detail: string
  /** Where the event happened, when it can be opened. */
  readonly href?: string
}

/** Review counts that earn a timeline entry (the nth review, in `reviewedAt` order). */
export const VOCABULARY_MILESTONES = [10, 50, 100, 250, 500, 1000] as const

export function computeTimeline(records: LearningRecords): readonly TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const { record, ref } of completedPracticeLessons(records)) {
    const score = record.bestScore !== undefined ? ` · best score ${record.bestScore}%` : ''
    events.push({
      id: `lesson:${record.chapterId}/${record.lessonId}`,
      kind: 'lesson_completed',
      at: record.completedAt!,
      title: `Completed ${ref.lesson.title}`,
      detail: `${ref.chapter.level} · Chapter ${ref.chapter.number}${score}`,
      href: `/learn/${record.chapterId}/lessons/${record.lessonId}`,
    })
  }

  const passedChapters = new Set<string>()
  for (const a of submittedAssessments(records.assessments).sort((x, y) => x.submittedAt!.localeCompare(y.submittedAt!))) {
    const chapter = records.chapters.find((c) => c.id === a.chapterId)
    const title = chapter ? chapter.title : a.chapterId
    events.push({
      id: `check:${a.id}`,
      kind: a.passed ? 'check_passed' : 'check_failed',
      at: a.submittedAt!,
      title: a.passed ? `Passed the chapter check: ${title}` : `Chapter check not passed yet: ${title}`,
      detail: `Score ${a.score}% · pass mark ${a.passMark}% · attempt ${a.attemptNumber}`,
      href: `/learn/${a.chapterId}/lessons/${a.lessonId}`,
    })
    if (a.passed && !passedChapters.has(a.chapterId)) {
      passedChapters.add(a.chapterId)
      const state = records.progression.get(a.chapterId)
      if (state?.status === 'completed') {
        events.push({
          id: `chapter:${a.chapterId}`,
          kind: 'chapter_completed',
          at: a.submittedAt!,
          title: `Chapter complete: ${title}`,
          detail: chapter ? `${chapter.level} · Chapter ${chapter.number}` : '',
          href: `/learn/${a.chapterId}`,
        })
      }
    }
  }

  const reviews = [...new Map(records.vocabularyReviews.map((r) => [r.id, r])).values()].sort(
    (a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id),
  )
  const first = reviews[0]
  if (first) {
    events.push({ id: 'vocabulary:first', kind: 'vocabulary_first_review', at: first.reviewedAt, title: 'First vocabulary review', detail: 'Spaced repetition started', href: '/vocabulary' })
  }
  for (const n of VOCABULARY_MILESTONES) {
    const nth = reviews[n - 1]
    if (!nth) break
    events.push({ id: `vocabulary:${n}`, kind: 'vocabulary_milestone', at: nth.reviewedAt, title: `${n} vocabulary reviews`, detail: 'Every answer counted once', href: '/vocabulary' })
  }

  return events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
}
