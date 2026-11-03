import { z } from 'zod'

/**
 * Shared vocabulary for the curriculum content model.
 *
 * Everything that is stored as content (chapters, lessons, exercises) is
 * described by a Zod schema here so that the same validation runs for
 * TypeScript content modules today and for versioned JSON rows later.
 */

export const CEFR_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1'] as const
export const CefrLevelSchema = z.enum(CEFR_LEVELS)
export type CefrLevel = z.infer<typeof CefrLevelSchema>

export const SKILLS = [
  'grammar',
  'vocabulary',
  'pronunciation',
  'speaking',
  'listening',
  'reading',
  'writing',
] as const
export const SkillSchema = z.enum(SKILLS)
export type Skill = z.infer<typeof SkillSchema>

export const LESSON_KINDS = [...SKILLS, 'assessment'] as const
export const LessonKindSchema = z.enum(LESSON_KINDS)
export type LessonKind = z.infer<typeof LessonKindSchema>

/** 1 = introductory, 2 = core, 3 = stretch. */
export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
export type Difficulty = z.infer<typeof DifficultySchema>

/**
 * English is always present and is the teaching language. Azerbaijani is an
 * optional explanation layer that the UI reveals only on request and only
 * when authored.
 */
export const LocalizedTextSchema = z.object({
  en: z.string().min(1),
  az: z.string().min(1).optional(),
})
export type LocalizedText = z.infer<typeof LocalizedTextSchema>

/** Identifiers are lower-case, dash separated, e.g. `a0-01`, `a0-01-l03`, `a0-01-l03-e04`. */
export const ContentIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids are lower-case kebab-case')
export type ContentId = z.infer<typeof ContentIdSchema>

export const LEVEL_NAMES: Record<CefrLevel, string> = {
  A0: 'Foundations',
  A1: 'Elementary',
  A2: 'Pre-intermediate',
  B1: 'Intermediate',
  B2: 'Upper-intermediate',
  C1: 'Advanced',
}

export const LESSON_KIND_LABEL: Record<LessonKind, string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  pronunciation: 'Pronunciation',
  speaking: 'Speaking',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  assessment: 'Assessment',
}
