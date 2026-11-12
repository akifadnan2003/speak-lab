import type { Answer, Exercise } from '@/features/curriculum/schema'
import { emptyAnswer, type GradeResult } from './grade'

/**
 * Exercise session state machine.
 *
 * A session is one run through a lesson's exercises. It is a pure reducer so
 * every transition is unit-testable; the React runner performs grading and
 * persistence around it.
 *
 * Practice mode: up to `maxAttempts` per exercise, feedback after each check,
 * answer revealed when attempts run out. Assessment mode: one attempt,
 * feedback withheld until the session is finished.
 */

export type SessionMode = 'practice' | 'assessment'

export type Outcome = 'pending' | 'correct' | 'incorrect' | 'revealed'

export interface ExerciseState {
  readonly answer: Answer
  readonly attempts: number
  readonly hintUsed: boolean
  readonly outcome: Outcome
  readonly result?: GradeResult
  /** Score that counts for the lesson (0 when revealed). */
  readonly finalScore: number
}

export interface SessionState {
  readonly mode: SessionMode
  readonly maxAttempts: number
  readonly exercises: readonly Exercise[]
  readonly index: number
  readonly states: Readonly<Record<string, ExerciseState>>
  readonly finished: boolean
}

export type SessionAction =
  | { type: 'answer'; exerciseId: string; answer: Answer }
  | { type: 'hint'; exerciseId: string }
  | { type: 'checked'; exerciseId: string; result: GradeResult }
  /** Assessment graded elsewhere: the answer is locked now, the result arrives with `results`. */
  | { type: 'lock'; exerciseId: string }
  /** Server-graded results for an assessment; finishes the session. */
  | { type: 'results'; results: Readonly<Record<string, GradeResult>> }
  | { type: 'retry'; exerciseId: string }
  | { type: 'reveal'; exerciseId: string }
  | { type: 'go'; index: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'finish' }
  | { type: 'restart' }

export const DEFAULT_MAX_ATTEMPTS: Record<SessionMode, number> = { practice: 3, assessment: 1 }

export function createSession(
  exercises: readonly Exercise[],
  options: { mode?: SessionMode; maxAttempts?: number } = {},
): SessionState {
  const mode = options.mode ?? 'practice'
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS[mode]
  const states: Record<string, ExerciseState> = {}
  for (const exercise of exercises) {
    states[exercise.id] = {
      answer: emptyAnswer(exercise),
      attempts: 0,
      hintUsed: false,
      outcome: 'pending',
      finalScore: 0,
    }
  }
  return { mode, maxAttempts, exercises, index: 0, states, finished: false }
}

function withState(state: SessionState, exerciseId: string, patch: Partial<ExerciseState>): SessionState {
  const current = state.states[exerciseId]
  if (!current) return state
  return { ...state, states: { ...state.states, [exerciseId]: { ...current, ...patch } } }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answer': {
      const current = state.states[action.exerciseId]
      if (!current || current.outcome === 'correct' || current.outcome === 'revealed') return state
      if (state.mode === 'assessment' && current.attempts > 0) return state
      return withState(state, action.exerciseId, { answer: action.answer })
    }
    case 'hint':
      return withState(state, action.exerciseId, { hintUsed: true })
    case 'checked': {
      const current = state.states[action.exerciseId]
      if (!current || current.outcome === 'correct' || current.outcome === 'revealed') return state
      const attempts = current.attempts + 1
      const { result } = action
      if (result.correct) {
        return withState(state, action.exerciseId, { attempts, result, outcome: 'correct', finalScore: result.score })
      }
      const exhausted = attempts >= state.maxAttempts
      if (exhausted) {
        // In an assessment the single attempt stands as given (partial credit kept).
        const outcome: Outcome = state.mode === 'assessment' ? 'incorrect' : 'revealed'
        const finalScore = state.mode === 'assessment' ? result.score : 0
        return withState(state, action.exerciseId, { attempts, result, outcome, finalScore })
      }
      return withState(state, action.exerciseId, { attempts, result, outcome: 'incorrect', finalScore: result.score })
    }
    case 'lock': {
      const current = state.states[action.exerciseId]
      if (!current || state.mode !== 'assessment' || current.attempts > 0) return state
      return withState(state, action.exerciseId, { attempts: 1 })
    }
    case 'results': {
      if (state.mode !== 'assessment') return state
      const states: Record<string, ExerciseState> = { ...state.states }
      for (const exercise of state.exercises) {
        const current = states[exercise.id]
        const result = action.results[exercise.id]
        if (!current || !result) continue
        states[exercise.id] = {
          ...current,
          attempts: Math.max(1, current.attempts),
          result,
          outcome: result.correct ? 'correct' : 'incorrect',
          finalScore: result.score,
        }
      }
      return { ...state, states, finished: true }
    }
    case 'retry': {
      const current = state.states[action.exerciseId]
      if (!current || current.outcome !== 'incorrect' || state.mode === 'assessment') return state
      const exercise = state.exercises.find((e) => e.id === action.exerciseId)
      if (!exercise) return state
      // Keep typed text so the learner can edit it; reset choices.
      const keepsText =
        current.answer.type === 'error_correction' ||
        current.answer.type === 'question_formation' ||
        current.answer.type === 'sentence_transformation' ||
        current.answer.type === 'guided_writing' ||
        current.answer.type === 'fill_blank'
      return withState(state, action.exerciseId, {
        outcome: 'pending',
        result: undefined,
        answer: keepsText ? current.answer : emptyAnswer(exercise),
      })
    }
    case 'reveal': {
      const current = state.states[action.exerciseId]
      if (!current || current.outcome === 'correct' || state.mode === 'assessment') return state
      return withState(state, action.exerciseId, { outcome: 'revealed', finalScore: 0 })
    }
    case 'go':
      if (action.index < 0 || action.index >= state.exercises.length) return state
      return { ...state, index: action.index }
    case 'next':
      return state.index < state.exercises.length - 1 ? { ...state, index: state.index + 1 } : state
    case 'prev':
      return state.index > 0 ? { ...state, index: state.index - 1 } : state
    case 'finish':
      return { ...state, finished: true }
    case 'restart':
      return createSession(state.exercises, { mode: state.mode, maxAttempts: state.maxAttempts })
    default: {
      const never: never = action
      return never
    }
  }
}

/* ---------------------------------------------------------------- selectors */

export function currentExercise(state: SessionState): Exercise | undefined {
  return state.exercises[state.index]
}

export function exerciseState(state: SessionState, exerciseId: string): ExerciseState | undefined {
  return state.states[exerciseId]
}

/** Every exercise has reached a terminal outcome (assessment: every one answered). */
export function allAnswered(state: SessionState): boolean {
  return state.exercises.every((e) => {
    const s = state.states[e.id]
    if (!s) return false
    if (state.mode === 'assessment') return s.attempts > 0
    return s.outcome === 'correct' || s.outcome === 'revealed'
  })
}

export function answeredCount(state: SessionState): number {
  return state.exercises.filter((e) => {
    const s = state.states[e.id]
    return !!s && (s.outcome !== 'pending' || s.attempts > 0)
  }).length
}

/** Every exercise's current answer, for a server-graded submission. */
export function collectAnswers(state: SessionState): { exerciseId: string; answer: Answer }[] {
  return state.exercises.map((e) => ({ exerciseId: e.id, answer: state.states[e.id]?.answer ?? emptyAnswer(e) }))
}

export function finalScores(state: SessionState): number[] {
  return state.exercises.map((e) => state.states[e.id]?.finalScore ?? 0)
}

export function canRetry(state: SessionState, exerciseId: string): boolean {
  const s = state.states[exerciseId]
  return !!s && state.mode === 'practice' && s.outcome === 'incorrect' && s.attempts < state.maxAttempts
}

export function attemptsLeft(state: SessionState, exerciseId: string): number {
  const s = state.states[exerciseId]
  return s ? Math.max(0, state.maxAttempts - s.attempts) : 0
}
