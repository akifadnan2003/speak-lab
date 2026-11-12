import { describe, expect, it } from 'vitest'
import { ExerciseSchema, type Exercise } from '@/features/curriculum/schema'
import { mc, qf } from '@/features/curriculum/content/authoring'
import { grade } from './grade'
import {
  allAnswered,
  answeredCount,
  attemptsLeft,
  canRetry,
  collectAnswers,
  createSession,
  finalScores,
  sessionReducer,
  type SessionState,
} from './session'

const exercises: Exercise[] = [
  ExerciseSchema.parse(mc('s-e1', 'I ___', ['am', 'is'], 0)),
  ExerciseSchema.parse(qf('s-e2', 'You are tired.', ['Are you tired?'])),
]

function check(state: SessionState, exerciseId: string): SessionState {
  const exercise = state.exercises.find((e) => e.id === exerciseId)!
  const current = state.states[exerciseId]!
  return sessionReducer(state, { type: 'checked', exerciseId, result: grade(exercise, current.answer) })
}

describe('practice session', () => {
  it('starts pending with empty answers and three attempts', () => {
    const s = createSession(exercises)
    expect(s.maxAttempts).toBe(3)
    expect(s.states['s-e1']?.outcome).toBe('pending')
    expect(answeredCount(s)).toBe(0)
    expect(allAnswered(s)).toBe(false)
  })

  it('marks a correct answer and locks further edits', () => {
    let s = createSession(exercises)
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'a' } })
    s = check(s, 's-e1')
    expect(s.states['s-e1']).toMatchObject({ outcome: 'correct', attempts: 1, finalScore: 1 })
    const after = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } })
    expect(after.states['s-e1']?.answer).toEqual({ type: 'multiple_choice', optionId: 'a' })
  })

  it('allows retries until attempts run out, then reveals with zero score', () => {
    let s = createSession(exercises)
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } })
    s = check(s, 's-e1')
    expect(s.states['s-e1']?.outcome).toBe('incorrect')
    expect(canRetry(s, 's-e1')).toBe(true)
    expect(attemptsLeft(s, 's-e1')).toBe(2)

    s = sessionReducer(s, { type: 'retry', exerciseId: 's-e1' })
    expect(s.states['s-e1']?.outcome).toBe('pending')
    expect(s.states['s-e1']?.answer).toEqual({ type: 'multiple_choice', optionId: '' })

    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } })
    s = check(s, 's-e1')
    s = sessionReducer(s, { type: 'retry', exerciseId: 's-e1' })
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } })
    s = check(s, 's-e1')
    expect(s.states['s-e1']).toMatchObject({ outcome: 'revealed', attempts: 3, finalScore: 0 })
    expect(canRetry(s, 's-e1')).toBe(false)
  })

  it('keeps typed text on retry and records hint use', () => {
    let s = createSession(exercises)
    s = sessionReducer(s, { type: 'hint', exerciseId: 's-e2' })
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e2', answer: { type: 'question_formation', text: 'Are you tired' } })
    s = check(s, 's-e2')
    s = sessionReducer(s, { type: 'retry', exerciseId: 's-e2' })
    expect(s.states['s-e2']).toMatchObject({ hintUsed: true, answer: { text: 'Are you tired' }, outcome: 'pending' })
  })

  it('reveal gives up on the exercise with zero score', () => {
    let s = createSession(exercises)
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } })
    s = check(s, 's-e1')
    s = sessionReducer(s, { type: 'reveal', exerciseId: 's-e1' })
    expect(s.states['s-e1']).toMatchObject({ outcome: 'revealed', finalScore: 0 })
  })

  it('navigates within bounds and finishes once all are answered', () => {
    let s = createSession(exercises)
    s = sessionReducer(s, { type: 'prev' })
    expect(s.index).toBe(0)
    s = sessionReducer(s, { type: 'next' })
    expect(s.index).toBe(1)
    s = sessionReducer(s, { type: 'next' })
    expect(s.index).toBe(1)
    s = sessionReducer(s, { type: 'go', index: 5 })
    expect(s.index).toBe(1)

    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'a' } })
    s = check(s, 's-e1')
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e2', answer: { type: 'question_formation', text: 'Are you tired?' } })
    s = check(s, 's-e2')
    expect(allAnswered(s)).toBe(true)
    expect(finalScores(s)).toEqual([1, 1])
    s = sessionReducer(s, { type: 'finish' })
    expect(s.finished).toBe(true)
    const restarted = sessionReducer(s, { type: 'restart' })
    expect(restarted.finished).toBe(false)
    expect(answeredCount(restarted)).toBe(0)
  })
})

describe('assessment session', () => {
  it('allows a single attempt, keeps partial credit and never reveals', () => {
    let s = createSession(exercises, { mode: 'assessment' })
    expect(s.maxAttempts).toBe(1)
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } })
    s = check(s, 's-e1')
    expect(s.states['s-e1']).toMatchObject({ outcome: 'incorrect', attempts: 1, finalScore: 0 })
    expect(canRetry(s, 's-e1')).toBe(false)
    expect(sessionReducer(s, { type: 'retry', exerciseId: 's-e1' })).toBe(s)
    expect(sessionReducer(s, { type: 'reveal', exerciseId: 's-e1' })).toBe(s)
    // Answer is frozen after the single attempt.
    const after = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'a' } })
    expect(after.states['s-e1']?.answer).toEqual({ type: 'multiple_choice', optionId: 'b' })
    expect(allAnswered(s)).toBe(false)
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e2', answer: { type: 'question_formation', text: 'Are you tired?' } })
    s = check(s, 's-e2')
    expect(allAnswered(s)).toBe(true)
  })
})

describe('server-graded assessment session', () => {
  it('locks answers without grading, counts them as answered, and finishes from server results', () => {
    let s = createSession(exercises, { mode: 'assessment' })
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } })
    s = sessionReducer(s, { type: 'lock', exerciseId: 's-e1' })
    expect(s.states['s-e1']).toMatchObject({ attempts: 1, outcome: 'pending' })
    expect(s.states['s-e1']?.result).toBeUndefined()
    expect(answeredCount(s)).toBe(1)
    // Locked answers are frozen and cannot be locked twice.
    expect(sessionReducer(s, { type: 'lock', exerciseId: 's-e1' })).toBe(s)
    expect(sessionReducer(s, { type: 'answer', exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'a' } }).states['s-e1']?.answer).toEqual({
      type: 'multiple_choice',
      optionId: 'b',
    })
    expect(allAnswered(s)).toBe(false)
    s = sessionReducer(s, { type: 'answer', exerciseId: 's-e2', answer: { type: 'question_formation', text: 'Are you tired?' } })
    s = sessionReducer(s, { type: 'lock', exerciseId: 's-e2' })
    expect(allAnswered(s)).toBe(true)
    expect(collectAnswers(s)).toEqual([
      { exerciseId: 's-e1', answer: { type: 'multiple_choice', optionId: 'b' } },
      { exerciseId: 's-e2', answer: { type: 'question_formation', text: 'Are you tired?' } },
    ])

    s = sessionReducer(s, {
      type: 'results',
      results: {
        's-e1': { correct: false, score: 0, correctAnswer: '' },
        's-e2': { correct: true, score: 1, correctAnswer: 'Are you tired?' },
      },
    })
    expect(s.finished).toBe(true)
    expect(s.states['s-e1']?.outcome).toBe('incorrect')
    expect(s.states['s-e2']?.outcome).toBe('correct')
    expect(finalScores(s)).toEqual([0, 1])
  })

  it('ignores lock and results in practice mode', () => {
    const s = createSession(exercises)
    expect(sessionReducer(s, { type: 'lock', exerciseId: 's-e1' })).toBe(s)
    expect(sessionReducer(s, { type: 'results', results: {} })).toBe(s)
  })
})
