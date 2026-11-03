import type {
  ChapterAccessOverride,
  ExerciseAttemptRecord,
  LessonProgressRecord,
  ProgressRepository,
} from '../ports'

/**
 * In-memory ProgressRepository. Used by tests and as the base for the
 * localStorage implementation. Records are copied on the way out so callers
 * cannot mutate the store.
 */
export interface MemoryStore {
  lessonProgress: LessonProgressRecord[]
  attempts: ExerciseAttemptRecord[]
  overrides: ChapterAccessOverride[]
}

export function createMemoryStore(): MemoryStore {
  return { lessonProgress: [], attempts: [], overrides: [] }
}

export function createMemoryProgressRepository(
  store: MemoryStore = createMemoryStore(),
  onChange?: (store: MemoryStore) => void,
): ProgressRepository {
  return {
    async listLessonProgress(studentId) {
      return store.lessonProgress.filter((r) => r.studentId === studentId)
    },
    async upsertLessonProgress(record) {
      const i = store.lessonProgress.findIndex(
        (r) => r.studentId === record.studentId && r.chapterId === record.chapterId && r.lessonId === record.lessonId,
      )
      if (i >= 0) store.lessonProgress[i] = record
      else store.lessonProgress.push(record)
      onChange?.(store)
    },
    async recordAttempt(attempt) {
      if (store.attempts.some((a) => a.id === attempt.id)) return
      store.attempts.push(attempt)
      onChange?.(store)
    },
    async listAttempts(studentId, filter) {
      return store.attempts.filter(
        (a) => a.studentId === studentId && (filter?.lessonId === undefined || a.lessonId === filter.lessonId),
      )
    },
    async listChapterOverrides(studentId) {
      return store.overrides.filter((o) => o.studentId === studentId)
    },
  }
}
