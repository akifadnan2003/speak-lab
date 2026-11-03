import type { ChapterAccessOverride, ChapterStatus, LessonProgressRecord, LessonStatus } from './ports'
import type { Chapter, Lesson } from './schema'

/**
 * Pure progression rules: which chapters and lessons a student can open, how
 * far they are, and when a chapter counts as complete. No I/O here so the
 * rules are trivially testable and identical on every surface.
 *
 * Rules (see docs/superpowers/specs/2026-11-03-m3-curriculum-engine-design.md):
 * - A chapter is unlocked when all prerequisites are completed or skipped, or
 *   it has no prerequisites, or the tutor unlocked it.
 * - Inside an unlocked chapter every non-assessment lesson is available; the
 *   assessment unlocks when every other lesson is completed or skipped.
 * - A chapter is complete when every lesson is completed or skipped, speaking
 *   lessons are actually completed (if required), and the assessment best
 *   score reaches the pass mark (if required).
 */

export interface LessonState {
  readonly lesson: Lesson
  readonly status: LessonStatus
  readonly bestScore?: number
}

export interface ChapterState {
  readonly chapter: Chapter
  readonly status: ChapterStatus
  /** 0–100, share of lessons completed or skipped. */
  readonly progress: number
  readonly lessons: readonly LessonState[]
  readonly assessmentBestScore?: number
  /** Prerequisite chapter ids still outstanding (empty when unlocked). */
  readonly missingPrerequisites: readonly string[]
}

export interface ProgressionInput {
  readonly chapters: readonly Chapter[]
  readonly lessonProgress: readonly LessonProgressRecord[]
  readonly overrides?: readonly ChapterAccessOverride[]
}

function progressKey(chapterId: string, lessonId: string) {
  return `${chapterId}/${lessonId}`
}

export function isLessonDone(status: LessonStatus): boolean {
  return status === 'completed' || status === 'skipped'
}

/** Chapter completion given the per-lesson statuses and scores. */
export function evaluateChapterCompletion(chapter: Chapter, lessons: readonly LessonState[]): boolean {
  if (chapter.status !== 'authored' || lessons.length === 0) return false
  const { completion } = chapter
  for (const state of lessons) {
    if (!isLessonDone(state.status)) return false
    if (completion.requireSpeaking && state.lesson.kind === 'speaking' && state.status !== 'completed') return false
    if (completion.requireAssessment && state.lesson.kind === 'assessment') {
      if (state.status !== 'completed') return false
      if ((state.bestScore ?? 0) < completion.passMark) return false
    }
  }
  return true
}

export function computeProgression(input: ProgressionInput): ReadonlyMap<string, ChapterState> {
  const records = new Map(input.lessonProgress.map((r) => [progressKey(r.chapterId, r.lessonId), r]))
  const overrides = new Map<string, ChapterAccessOverride['kind']>()
  for (const o of input.overrides ?? []) overrides.set(o.chapterId, o.kind)

  const result = new Map<string, ChapterState>()

  // Chapters are listed in curriculum order and prerequisites always point
  // backwards (validated by CurriculumSchema), so one pass suffices.
  for (const chapter of input.chapters) {
    const override = overrides.get(chapter.id)
    const missing = chapter.prerequisites.filter((id) => {
      const s = result.get(id)?.status
      return s !== 'completed' && s !== 'skipped'
    })
    const unlocked = override === 'unlock' || override === 'skip' || missing.length === 0

    const lessonStates = resolveLessons(chapter, unlocked, records)
    const done = lessonStates.filter((l) => isLessonDone(l.status)).length
    const progress = lessonStates.length === 0 ? 0 : Math.round((done / lessonStates.length) * 100)
    const assessment = lessonStates.find((l) => l.lesson.kind === 'assessment')

    let status: ChapterStatus
    if (evaluateChapterCompletion(chapter, lessonStates)) status = 'completed'
    else if (override === 'skip') status = 'skipped'
    else if (!unlocked) status = 'locked'
    else if (lessonStates.some((l) => l.status !== 'available' && l.status !== 'locked')) status = 'in_progress'
    else status = 'available'

    result.set(chapter.id, {
      chapter,
      status,
      progress,
      lessons: lessonStates,
      assessmentBestScore: assessment?.bestScore,
      missingPrerequisites: unlocked ? [] : missing,
    })
  }
  return result
}

function resolveLessons(
  chapter: Chapter,
  unlocked: boolean,
  records: ReadonlyMap<string, LessonProgressRecord>,
): LessonState[] {
  const base = chapter.lessons.map<LessonState>((lesson) => {
    const record = records.get(progressKey(chapter.id, lesson.id))
    // The chapter gate wins over stored records: a lesson inside a locked
    // chapter is never openable, even if a record exists (e.g. after a tutor
    // removed an unlock override). Scores are kept for display.
    if (!unlocked) return { lesson, status: 'locked', bestScore: record?.bestScore }
    if (record) return { lesson, status: record.status, bestScore: record.bestScore }
    return { lesson, status: 'available' }
  })
  const othersDone = base.filter((l) => l.lesson.kind !== 'assessment').every((l) => isLessonDone(l.status))
  return base.map((state) => {
    if (state.lesson.kind !== 'assessment') return state
    if (state.status === 'available' && !othersDone) return { ...state, status: 'locked' }
    return state
  })
}

/** Percent score for a lesson run from per-exercise scores (0..1). */
export function scoreLesson(scores: readonly number[]): number {
  if (scores.length === 0) return 0
  const total = scores.reduce((sum, s) => sum + Math.min(1, Math.max(0, s)), 0)
  return Math.round((total / scores.length) * 100)
}

/** The lesson a student should open next in a chapter, if any. */
export function nextLesson(state: ChapterState): LessonState | undefined {
  return (
    state.lessons.find((l) => l.status === 'in_progress') ??
    state.lessons.find((l) => l.status === 'available') ??
    undefined
  )
}

/** First chapter that is in progress or available, in curriculum order. */
export function currentChapter(states: ReadonlyMap<string, ChapterState>): ChapterState | undefined {
  let firstAvailable: ChapterState | undefined
  for (const state of states.values()) {
    if (state.status === 'in_progress') return state
    if (!firstAvailable && state.status === 'available' && state.chapter.status === 'authored') firstAvailable = state
  }
  return firstAvailable
}
