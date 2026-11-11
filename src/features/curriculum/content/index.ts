import type { ContentSource } from '../ports'
import type { Chapter } from '../schema'
import { CLIENT_CURRICULUM_JSON } from './generated/client-curriculum'

/**
 * The curriculum the running app uses.
 *
 * Real builds ship only `generated/client-curriculum.ts`: the full content with every assessment
 * lesson's answer keys removed (scripts/build-client-content.mjs). It was validated with the Zod
 * schema before redaction and CI checks it against the source, so it is not re-parsed here (the
 * redacted keys would not pass the schema). Chapter checks are graded by the `assessment` Edge
 * Function from its own full copy.
 *
 * Preview builds (`VITE_UI_PREVIEW=true`, no backend) load the full content instead, because the
 * client-side gateway has to grade locally. The condition is a build-time constant, so the full
 * content module is dead-code-eliminated from real builds rather than merely unused.
 */
export const CURRICULUM: readonly Chapter[] =
  import.meta.env.VITE_UI_PREVIEW === 'true'
    ? (await import('./curriculum-map')).CURRICULUM
    : (JSON.parse(CLIENT_CURRICULUM_JSON) as Chapter[])

/**
 * Static content source: the curriculum bundled with the app. A database
 * backed source (M6 editor) implements the same interface and is swapped in
 * through `CurriculumProvider`.
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

/** Synchronous lookup for tests and static screens. */
export function findChapterSync(chapterId: string): Chapter | undefined {
  return CURRICULUM.find((c) => c.id === chapterId)
}

export function findLessonSync(chapterId: string, lessonId: string) {
  const chapter = findChapterSync(chapterId)
  const lesson = chapter?.lessons.find((l) => l.id === lessonId)
  return chapter && lesson ? { chapter, lesson } : undefined
}
