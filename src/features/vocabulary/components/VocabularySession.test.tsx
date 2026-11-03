import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VOCABULARY_BANK } from '../content'
import { findMode } from '../modes'
import type { VocabularyReviewRecord, VocabularyState } from '../ports'
import type { QueueEntry } from '../revision/queue'
import { createInitialState } from '../srs/scheduler'
import { ActiveRecall } from './ActiveRecall'
import { Flashcard } from './Flashcard'
import { VocabularySession } from './VocabularySession'

const NOW = new Date('2026-11-10T09:00:00.000Z')
const hello = VOCABULARY_BANK.find((e) => e.id === 'v-hello')!
const name = VOCABULARY_BANK.find((e) => e.id === 'v-name')!
const student = VOCABULARY_BANK.find((e) => e.id === 'v-student')!
const teacher = VOCABULARY_BANK.find((e) => e.id === 'v-teacher')!

function entry(e: (typeof VOCABULARY_BANK)[number]): QueueEntry {
  return { entry: e, state: createInitialState('s1', e.id, NOW), reason: 'new' }
}

describe('Flashcard', () => {
  it('flips with the keyboard and grades with number keys; translation hidden until asked', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()
    render(<Flashcard entry={hello} onGrade={onGrade} />)
    expect(screen.queryByTestId('flashcard-back')).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Flip' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('flashcard-back')).toHaveTextContent(hello.definition)
    expect(screen.queryByTestId('translation')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('reveal-translation'))
    expect(screen.getByTestId('translation')).toHaveTextContent('salam')
    screen.getByRole('button', { name: /Good/ }).focus()
    await user.keyboard('3')
    expect(onGrade).toHaveBeenCalledWith('good')
  })
})

describe('ActiveRecall', () => {
  it('checks typed English, records hint use, and only then offers the translation', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<ActiveRecall entry={student} onResult={onResult} />)
    expect(screen.getByText(student.definition)).toBeInTheDocument()
    expect(screen.queryByTestId('reveal-translation')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('note')).toHaveTextContent('Starts with S')
    await user.type(screen.getByLabelText('The word in English'), 'Student{Enter}')
    expect(onResult).toHaveBeenCalledWith({ correct: true, hintUsed: true, answer: 'Student' })
    expect(screen.getByTestId('recall-feedback')).toHaveAttribute('data-outcome', 'correct')
    expect(screen.getByTestId('reveal-translation')).toBeInTheDocument()
  })

  it('reveals the word after a wrong answer', async () => {
    const user = userEvent.setup()
    render(<ActiveRecall entry={student} onResult={vi.fn()} />)
    await user.type(screen.getByLabelText('The word in English'), 'pupil{Enter}')
    expect(screen.getByTestId('recall-feedback')).toHaveTextContent('The word is "student"')
  })
})

describe('VocabularySession', () => {
  it('flashcards: grades schedule each word and the summary shows the next interval', async () => {
    const user = userEvent.setup()
    const reviews: VocabularyReviewRecord[] = []
    const states: VocabularyState[] = []
    render(
      <VocabularySession
        mode={findMode('flashcards')!}
        queue={[entry(hello), entry(name)]}
        bank={VOCABULARY_BANK}
        studentId="s1"
        now={() => NOW}
        onReview={(s, r) => {
          states.push(s)
          reviews.push(r)
        }}
      />,
    )
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Flip' }))
    await user.click(screen.getByRole('button', { name: /Good/ }))
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Flip' }))
    await user.click(screen.getByRole('button', { name: /Again/ }))
    expect(reviews.map((r) => [r.entryId, r.correct, r.quality, r.modeId, r.skill])).toEqual([
      ['v-hello', true, 4, 'flashcards', 'recognition'],
      ['v-name', false, 1, 'flashcards', 'recognition'],
    ])
    expect(states[0]).toMatchObject({ stage: 'learning', intervalDays: 1 })
    const summary = screen.getByTestId('vocab-summary')
    expect(summary).toHaveTextContent('1 of 2 correct')
    expect(summary).toHaveTextContent('next in 1 day')
  })

  it('meaning choice: one attempt, feedback, Next; mid-session the queue stays fixed', async () => {
    const user = userEvent.setup()
    const onReview = vi.fn()
    const queue = [entry(hello), entry(teacher)]
    const { rerender } = render(
      <VocabularySession mode={findMode('meaning_choice')!} queue={queue} bank={VOCABULARY_BANK} studentId="s1" now={() => NOW} onReview={onReview} />,
    )
    expect(screen.getByText(`${hello.term} (${hello.partOfSpeech})`)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: new RegExp(hello.definition.slice(0, 20)) }))
    await user.click(screen.getByTestId('check-answer'))
    expect(onReview).toHaveBeenCalledTimes(1)
    expect(onReview.mock.calls[0]?.[1]).toMatchObject({ correct: true, skill: 'recognition', answer: hello.definition })
    expect(screen.getByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'correct')
    // A parent re-render with a reordered queue must not change the running session.
    rerender(
      <VocabularySession mode={findMode('meaning_choice')!} queue={[entry(teacher), entry(hello)]} bank={VOCABULARY_BANK} studentId="s1" now={() => NOW} onReview={onReview} />,
    )
    await user.click(screen.getByTestId('next-item'))
    expect(screen.getByText(`${teacher.term} (${teacher.partOfSpeech})`)).toBeInTheDocument()
  })

  it('matching: four words per step, each pair graded separately', async () => {
    const user = userEvent.setup()
    const onReview = vi.fn()
    render(
      <VocabularySession
        mode={findMode('matching')!}
        queue={[entry(hello), entry(name), entry(student), entry(teacher)]}
        bank={VOCABULARY_BANK}
        studentId="s1"
        now={() => NOW}
        onReview={onReview}
      />,
    )
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
    const left = screen.getByRole('group', { name: 'Left items' })
    const right = screen.getByRole('group', { name: 'Right items' })
    for (const e of [hello, name, student, teacher]) {
      await user.click(within(left).getByRole('button', { name: e.term }))
      await user.click(within(right).getByRole('button', { name: e.definition }))
    }
    await user.click(screen.getByTestId('check-answer'))
    expect(onReview).toHaveBeenCalledTimes(4)
    expect(onReview.mock.calls.every((c) => c[1].correct === true)).toBe(true)
  })

  it('missing word: typed answer graded against the example form', async () => {
    const user = userEvent.setup()
    const onReview = vi.fn()
    render(<VocabularySession mode={findMode('missing_word')!} queue={[entry(student)]} bank={VOCABULARY_BANK} studentId="s1" now={() => NOW} onReview={onReview} />)
    await user.type(screen.getByLabelText('Blank 1 of 1'), 'student{Enter}')
    expect(onReview.mock.calls[0]?.[1]).toMatchObject({ correct: true, skill: 'recall', answer: 'student' })
    await user.click(screen.getByTestId('next-item'))
    expect(screen.getByTestId('vocab-summary')).toBeInTheDocument()
  })
})
