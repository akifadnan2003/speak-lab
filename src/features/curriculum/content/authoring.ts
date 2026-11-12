import type { ExerciseInput, LocalizedText, Skill } from '../schema'

/**
 * Small authoring helpers so chapter files read like a lesson plan rather
 * than JSON. They only produce schema input; validation happens in
 * `parseChapter`.
 */

type Common = {
  skill?: Skill
  difficulty?: 1 | 2 | 3
  instruction?: LocalizedText
  hint?: LocalizedText
  explanation?: LocalizedText
}

export const t = (en: string, az?: string): LocalizedText => (az ? { en, az } : { en })

export function mc(
  id: string,
  prompt: string,
  options: readonly string[],
  correctIndex: number,
  common: Common = {},
): ExerciseInput {
  return {
    id,
    type: 'multiple_choice',
    skill: common.skill ?? 'grammar',
    prompt,
    options: options.map((text, i) => ({ id: String.fromCharCode(97 + i), text })),
    correctOptionId: String.fromCharCode(97 + correctIndex),
    ...common,
  }
}

export function fb(
  id: string,
  text: string,
  accepted: readonly (string | readonly string[])[],
  common: Common & { wordBank?: string[] } = {},
): ExerciseInput {
  const { wordBank, ...rest } = common
  return {
    id,
    type: 'fill_blank',
    skill: rest.skill ?? 'grammar',
    text,
    blanks: accepted.map((a) => ({ accepted: typeof a === 'string' ? [a] : [...a] })),
    ...(wordBank ? { wordBank } : {}),
    ...rest,
  }
}

export function ord(id: string, sentence: string, common: Common & { alternatives?: string[] } = {}): ExerciseInput {
  const { alternatives, ...rest } = common
  return {
    id,
    type: 'sentence_ordering',
    skill: rest.skill ?? 'grammar',
    tokens: sentence.split(' '),
    ...(alternatives ? { alternatives } : {}),
    ...rest,
  }
}

export function ec(id: string, incorrect: string, accepted: readonly string[], common: Common = {}): ExerciseInput {
  return { id, type: 'error_correction', skill: common.skill ?? 'grammar', incorrect, accepted: [...accepted], ...common }
}

export function match(
  id: string,
  pairs: readonly (readonly [string, string])[],
  common: Common & { prompt?: string } = {},
): ExerciseInput {
  return {
    id,
    type: 'matching',
    skill: common.skill ?? 'vocabulary',
    pairs: pairs.map(([left, right], i) => ({ id: `p${i + 1}`, left, right })),
    ...common,
  }
}

export function qf(
  id: string,
  prompt: string,
  accepted: readonly string[],
  common: Common & { answerCue?: string } = {},
): ExerciseInput {
  return { id, type: 'question_formation', skill: common.skill ?? 'grammar', prompt, accepted: [...accepted], ...common }
}

export function st(
  id: string,
  source: string,
  transformation: LocalizedText,
  accepted: readonly string[],
  common: Common = {},
): ExerciseInput {
  return {
    id,
    type: 'sentence_transformation',
    skill: common.skill ?? 'grammar',
    source,
    transformation,
    accepted: [...accepted],
    ...common,
  }
}

export function sp(
  id: string,
  prompt: LocalizedText,
  modelAnswer: string,
  checklist: readonly string[],
  common: Common & { cue?: string; variations?: string[] } = {},
): ExerciseInput {
  return {
    id,
    type: 'speaking_prompt',
    skill: common.skill ?? 'speaking',
    prompt,
    modelAnswer,
    checklist: [...checklist],
    ...common,
  }
}

export function gw(
  id: string,
  prompt: LocalizedText,
  minWords: number,
  requirements: readonly { label: string; anyOf: readonly string[] }[],
  common: Common & { modelAnswer?: string } = {},
): ExerciseInput {
  return {
    id,
    type: 'guided_writing',
    skill: common.skill ?? 'writing',
    prompt,
    minWords,
    requirements: requirements.map((r) => ({ label: r.label, anyOf: [...r.anyOf] })),
    ...common,
  }
}
