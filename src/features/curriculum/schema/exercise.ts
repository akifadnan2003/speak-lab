import { z } from 'zod'
import { ContentIdSchema, DifficultySchema, LocalizedTextSchema, SkillSchema } from './common'

/**
 * Exercise content model.
 *
 * Each exercise type is a member of a discriminated union keyed by `type`.
 * The engine (`src/features/exercises/engine`) has one grader per type and the
 * renderer has one component per type; TypeScript's exhaustiveness checks keep
 * the three in sync. Adding a type means touching all three places.
 *
 * Answers are authored explicitly (`accepted` lists) so grading is fully
 * deterministic. There is no fuzzy matching and no AI in this layer.
 */

const ExerciseBase = z.object({
  id: ContentIdSchema,
  skill: SkillSchema,
  difficulty: DifficultySchema.default(2),
  /** Short task instruction shown above the prompt, e.g. "Choose the correct form." */
  instruction: LocalizedTextSchema.optional(),
  /** Revealed on request before answering; costs nothing but is recorded. */
  hint: LocalizedTextSchema.optional(),
  /** Shown after the answer is checked (or at the end of an assessment). */
  explanation: LocalizedTextSchema.optional(),
})

export const BLANK_MARKER = '___'

const AcceptedAnswers = z.array(z.string().min(1)).min(1)

export const MultipleChoiceSchema = ExerciseBase.extend({
  type: z.literal('multiple_choice'),
  prompt: z.string().min(1),
  options: z
    .array(z.object({ id: z.string().min(1), text: z.string().min(1) }))
    .min(2)
    .max(6),
  correctOptionId: z.string().min(1),
}).refine((e) => e.options.some((o) => o.id === e.correctOptionId), {
  message: 'correctOptionId must reference an option',
  path: ['correctOptionId'],
})

export const FillBlankSchema = ExerciseBase.extend({
  type: z.literal('fill_blank'),
  /** Sentence with one `___` per blank, in order. */
  text: z.string().min(1),
  blanks: z.array(z.object({ accepted: AcceptedAnswers })).min(1),
  /** Optional word bank shown as tappable chips (still typed answers underneath). */
  wordBank: z.array(z.string().min(1)).optional(),
}).refine((e) => e.text.split(BLANK_MARKER).length - 1 === e.blanks.length, {
  message: 'number of ___ markers must equal blanks.length',
  path: ['text'],
})

export const SentenceOrderingSchema = ExerciseBase.extend({
  type: z.literal('sentence_ordering'),
  /** Tokens in the correct order. Punctuation may be attached to a token ("student."). */
  tokens: z.array(z.string().min(1)).min(2).max(14),
  /** Other orders that are also correct, written as full sentences. */
  alternatives: z.array(z.string().min(1)).optional(),
  /** Shown as the task cue, e.g. "Put the words in order." */
  prompt: z.string().optional(),
})

export const ErrorCorrectionSchema = ExerciseBase.extend({
  type: z.literal('error_correction'),
  /** The sentence containing exactly one mistake. */
  incorrect: z.string().min(1),
  accepted: AcceptedAnswers,
})

export const MatchingSchema = ExerciseBase.extend({
  type: z.literal('matching'),
  prompt: z.string().optional(),
  pairs: z
    .array(z.object({ id: z.string().min(1), left: z.string().min(1), right: z.string().min(1) }))
    .min(2)
    .max(8),
}).refine((e) => new Set(e.pairs.map((p) => p.id)).size === e.pairs.length, {
  message: 'pair ids must be unique',
  path: ['pairs'],
})

export const QuestionFormationSchema = ExerciseBase.extend({
  type: z.literal('question_formation'),
  /** A statement to turn into a question, or a cue such as "you / from Baku ?". */
  prompt: z.string().min(1),
  /** Optional expected answer shown as a cue, e.g. "Yes, I am." */
  answerCue: z.string().optional(),
  accepted: AcceptedAnswers,
})

export const SentenceTransformationSchema = ExerciseBase.extend({
  type: z.literal('sentence_transformation'),
  source: z.string().min(1),
  /** What to do with the sentence: "Make it negative.", "Use a contraction." */
  transformation: LocalizedTextSchema,
  accepted: AcceptedAnswers,
})

/**
 * Speaking is self-checked in this milestone: the learner says the sentence
 * aloud, compares it to the model, and ticks the checklist. Nothing is
 * recorded or evaluated automatically and the UI says so.
 */
export const SpeakingPromptSchema = ExerciseBase.extend({
  type: z.literal('speaking_prompt'),
  prompt: LocalizedTextSchema,
  /** Cue words the learner should use, e.g. "I / student". */
  cue: z.string().optional(),
  modelAnswer: z.string().min(1),
  /** Variants to repeat with ("Now say it about your friend"). */
  variations: z.array(z.string().min(1)).optional(),
  checklist: z.array(z.string().min(1)).min(1).max(5),
})

/**
 * Guided writing is graded deterministically against a checklist of required
 * elements (each group accepts any listed phrase) and a minimum word count.
 */
export const GuidedWritingSchema = ExerciseBase.extend({
  type: z.literal('guided_writing'),
  prompt: LocalizedTextSchema,
  minWords: z.number().int().min(1),
  requirements: z
    .array(
      z.object({
        label: z.string().min(1),
        /** Satisfied when the text contains any of these (case-insensitive). */
        anyOf: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  modelAnswer: z.string().min(1).optional(),
})

export const ExerciseSchema = z.discriminatedUnion('type', [
  MultipleChoiceSchema,
  FillBlankSchema,
  SentenceOrderingSchema,
  ErrorCorrectionSchema,
  MatchingSchema,
  QuestionFormationSchema,
  SentenceTransformationSchema,
  SpeakingPromptSchema,
  GuidedWritingSchema,
])

export type Exercise = z.infer<typeof ExerciseSchema>
export type ExerciseType = Exercise['type']
export type ExerciseOf<T extends ExerciseType> = Extract<Exercise, { type: T }>
/** Author-side input (before defaults are applied). */
export type ExerciseInput = z.input<typeof ExerciseSchema>

export const EXERCISE_TYPES = [
  'multiple_choice',
  'fill_blank',
  'sentence_ordering',
  'error_correction',
  'matching',
  'question_formation',
  'sentence_transformation',
  'speaking_prompt',
  'guided_writing',
] as const satisfies readonly ExerciseType[]

export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  multiple_choice: 'Multiple choice',
  fill_blank: 'Fill in the blanks',
  sentence_ordering: 'Put the words in order',
  error_correction: 'Correct the mistake',
  matching: 'Match the pairs',
  question_formation: 'Make a question',
  sentence_transformation: 'Change the sentence',
  speaking_prompt: 'Say it aloud',
  guided_writing: 'Write',
}

/* ---------------------------------------------------------------------------
 * Answers. These are what the learner submits; they are stored verbatim in
 * attempt records so a tutor can later review exactly what was written.
 * ------------------------------------------------------------------------- */

export const AnswerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('multiple_choice'), optionId: z.string() }),
  z.object({ type: z.literal('fill_blank'), values: z.array(z.string()) }),
  /** Indices into `tokens`, in the order the learner arranged them. */
  z.object({ type: z.literal('sentence_ordering'), order: z.array(z.number().int().min(0)) }),
  z.object({ type: z.literal('error_correction'), text: z.string() }),
  /** pair id (left) → pair id whose right side was chosen. */
  z.object({ type: z.literal('matching'), matches: z.record(z.string(), z.string()) }),
  z.object({ type: z.literal('question_formation'), text: z.string() }),
  z.object({ type: z.literal('sentence_transformation'), text: z.string() }),
  z.object({ type: z.literal('speaking_prompt'), done: z.boolean(), checklist: z.array(z.boolean()) }),
  z.object({ type: z.literal('guided_writing'), text: z.string() }),
])

export type Answer = z.infer<typeof AnswerSchema>
export type AnswerOf<T extends ExerciseType> = Extract<Answer, { type: T }>
