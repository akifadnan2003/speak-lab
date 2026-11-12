import { z } from 'zod'
import { CefrLevelSchema, ContentIdSchema, SkillSchema } from './common'
import { LessonSchema } from './lesson'

/**
 * A chapter is the curriculum unit. The full A0–C1 map is a list of chapters;
 * `status: 'planned'` chapters carry objectives and prerequisites but no
 * lessons yet, so the Learn screen can show the real path honestly.
 */
export const ChapterCompletionSchema = z.object({
  /** Minimum assessment score (0–100) to pass the chapter. */
  passMark: z.number().int().min(0).max(100).default(80),
  /** Chapter completion requires the assessment lesson to be passed. */
  requireAssessment: z.boolean().default(true),
  /** Chapter completion requires every speaking lesson to be completed. */
  requireSpeaking: z.boolean().default(true),
})
export type ChapterCompletion = z.infer<typeof ChapterCompletionSchema>

export const ChapterSchema = z
  .object({
    id: ContentIdSchema,
    level: CefrLevelSchema,
    number: z.number().int().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    objectives: z.array(z.string().min(1)).min(1),
    /** Chapter ids that should be completed first. Tutors can override. */
    prerequisites: z.array(ContentIdSchema).default([]),
    skills: z.array(SkillSchema).min(1),
    /** Bump when content changes in a way that invalidates old attempts. */
    version: z.number().int().min(1).default(1),
    status: z.enum(['authored', 'planned']).default('planned'),
    completion: ChapterCompletionSchema.default({ passMark: 80, requireAssessment: true, requireSpeaking: true }),
    lessons: z.array(LessonSchema).default([]),
  })
  .refine((c) => c.status === 'planned' || c.lessons.length > 0, {
    message: 'authored chapters need at least one lesson',
    path: ['lessons'],
  })
  .refine((c) => !c.prerequisites.includes(c.id), { message: 'a chapter cannot require itself', path: ['prerequisites'] })
  .refine(
    (c) => {
      const ids = new Set<string>()
      for (const lesson of c.lessons) {
        if (ids.has(lesson.id)) return false
        ids.add(lesson.id)
        for (const ex of lesson.exercises) {
          if (ids.has(ex.id)) return false
          ids.add(ex.id)
        }
      }
      return true
    },
    { message: 'lesson and exercise ids must be unique within a chapter', path: ['lessons'] },
  )

export type Chapter = z.infer<typeof ChapterSchema>
export type ChapterInput = z.input<typeof ChapterSchema>

/** Validate authored content at module load so mistakes fail fast in tests and dev. */
export function parseChapter(input: ChapterInput): Chapter {
  return ChapterSchema.parse(input)
}

/**
 * Validate a whole curriculum: unique ids, prerequisites that exist, and no
 * prerequisite cycles (a topological order must exist).
 */
export const CurriculumSchema = z
  .array(ChapterSchema)
  .min(1)
  .superRefine((chapters, ctx) => {
    const ids = new Map<string, number>()
    chapters.forEach((c, i) => {
      if (ids.has(c.id)) ctx.addIssue({ code: 'custom', message: `duplicate chapter id ${c.id}`, path: [i, 'id'] })
      ids.set(c.id, i)
    })
    chapters.forEach((c, i) => {
      for (const p of c.prerequisites) {
        if (!ids.has(p)) ctx.addIssue({ code: 'custom', message: `unknown prerequisite ${p}`, path: [i, 'prerequisites'] })
      }
    })
    if (ctx.issues.length === 0 && topologicalOrder(chapters) === null) {
      ctx.addIssue({ code: 'custom', message: 'prerequisite cycle detected', path: [] })
    }
  })

/** Kahn's algorithm; returns null on a cycle. Stable: ties keep curriculum order. */
export function topologicalOrder(chapters: readonly Chapter[]): Chapter[] | null {
  const byId = new Map(chapters.map((c) => [c.id, c]))
  const position = new Map(chapters.map((c, i) => [c.id, i]))
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  for (const c of chapters) {
    indegree.set(c.id, c.prerequisites.filter((p) => byId.has(p)).length)
    for (const p of c.prerequisites) {
      dependents.set(p, [...(dependents.get(p) ?? []), c.id])
    }
  }
  const result: Chapter[] = []
  const ready = chapters.filter((c) => indegree.get(c.id) === 0).map((c) => c.id)
  while (ready.length > 0) {
    const id = ready.shift()!
    const chapter = byId.get(id)
    if (chapter) result.push(chapter)
    for (const d of dependents.get(id) ?? []) {
      const next = (indegree.get(d) ?? 0) - 1
      indegree.set(d, next)
      if (next === 0) ready.push(d)
    }
    // keep curriculum order among ready nodes
    ready.sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0))
  }
  return result.length === chapters.length ? result : null
}
