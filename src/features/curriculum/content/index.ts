import type { ContentSource } from '../ports'
import type { Chapter } from '../schema'
import { CURRICULUM } from './curriculum-map'

/**
 * Static content source: the curriculum bundled with the app. A database
 * backed source (M3 backend / M6 editor) implements the same interface and is
 * swapped in through `CurriculumProvider`.
 */
export function createStaticContentSource(chapters: readonly Chapter[] = CURRICULUM): ContentSource {
  const byId = new Map(chapters.map((c) => [c.id, c]))
  return {
    async listChapters() {
      return chapters
    },
    async getChapter(chapterId) {
      return byId.get(chapterId)
    },
  }
}

export { CURRICULUM, CHAPTERS_PER_LEVEL, chapterIdFor } from './curriculum-map'

/** Synchronous lookup for tests and static screens. */
export function findChapterSync(chapterId: string): Chapter | undefined {
  return CURRICULUM.find((c) => c.id === chapterId)
}

export function findLessonSync(chapterId: string, lessonId: string) {
  const chapter = findChapterSync(chapterId)
  const lesson = chapter?.lessons.find((l) => l.id === lessonId)
  return chapter && lesson ? { chapter, lesson } : undefined
}
