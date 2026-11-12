import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AzHelpProvider } from '@/features/curriculum/az-help'
import { ec, fb, match, mc, ord, qf, sp, t } from '@/features/curriculum/content/authoring'
import { LessonSchema, type Lesson, type LessonInput } from '@/features/curriculum/schema'
import { ExerciseRunner } from './ExerciseRunner'

function lesson(exercises: LessonInput['exercises'], kind: Lesson['kind'] = 'grammar'): Lesson {
  return LessonSchema.parse({ id: 't-l1', title: 'Test', kind, estimatedMinutes: 5, exercises })
}

describe('ExerciseRunner — practice mode', () => {
  it('multiple choice: check, feedback with explanation, next', async () => {
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    const onStart = vi.fn()
    render(
      <ExerciseRunner
        lesson={lesson([
          mc('t-e1', 'I ___ a student.', ['is', 'am'], 1, { explanation: t('I takes am.', 'I ilə am.') }),
          mc('t-e2', 'She ___ a doctor.', ['is', 'am'], 0),
        ])}
        onAttempt={onAttempt}
        onStart={onStart}
      />,
    )
    expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument()
    const check = screen.getByTestId('check-answer')
    expect(check).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /am/ }))
    await user.click(check)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ attemptNumber: 1, result: expect.objectContaining({ correct: true }) }))
    const feedback = screen.getByTestId('exercise-feedback')
    expect(feedback).toHaveAttribute('data-outcome', 'correct')
    expect(within(feedback).getByText('I takes am.')).toBeInTheDocument()
    expect(screen.queryByTestId('az-text')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('next-exercise'))
    expect(screen.getByText('Exercise 2 of 2')).toBeInTheDocument()
  })

  it('retries a wrong answer, then reveals after three attempts', async () => {
    const user = userEvent.setup()
    render(<ExerciseRunner lesson={lesson([mc('t-e1', 'I ___ a student.', ['is', 'am'], 1)])} />)
    for (let attempt = 1; attempt <= 3; attempt++) {
      await user.click(screen.getByRole('radio', { name: /is/ }))
      await user.click(screen.getByTestId('check-answer'))
      const feedback = screen.getByTestId('exercise-feedback')
      if (attempt < 3) {
        expect(feedback).toHaveAttribute('data-outcome', 'incorrect')
        expect(feedback).toHaveTextContent(`${3 - attempt} attempt`)
        await user.click(screen.getByRole('button', { name: 'Try again' }))
      } else {
        expect(feedback).toHaveAttribute('data-outcome', 'revealed')
        expect(feedback).toHaveTextContent('Correct answer: am')
      }
    }
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /am/ })).toBeDisabled()
  })

  it('shows the hint on request and lets the learner give up with Show answer', async () => {
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    render(
      <AzHelpProvider initial>
        <ExerciseRunner lesson={lesson([ec('t-e1', 'He are a teacher.', ['He is a teacher.'], { hint: t('he takes is', 'he ilə is') })])} onAttempt={onAttempt} />
      </AzHelpProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('note')).toHaveTextContent('he takes is')
    expect(screen.getByTestId('az-text')).toHaveTextContent('he ilə is')
    await user.type(screen.getByLabelText('Your answer'), 'He are a teacher{Enter}')
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ hintUsed: true, result: expect.objectContaining({ correct: false }) }))
    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(screen.getByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'revealed')
  })

  it('fill in the blanks: word bank fills the blank and Enter submits', async () => {
    const user = userEvent.setup()
    render(<ExerciseRunner lesson={lesson([fb('t-e1', 'She ___ a doctor.', ['is'], { wordBank: ['am', 'is', 'are'] })])} />)
    await user.click(screen.getByRole('button', { name: 'is' }))
    const blank = screen.getByLabelText('Blank 1 of 1')
    expect(blank).toHaveValue('is')
    await user.type(blank, '{Enter}')
    expect(screen.getByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'correct')
  })

  it('sentence ordering: tap words to build, remove and reorder with the keyboard', async () => {
    const user = userEvent.setup()
    render(<ExerciseRunner lesson={lesson([ord('t-e1', 'I am a student.')])} />)
    const pool = screen.getByTestId('ordering-pool')
    const sentence = screen.getByTestId('ordering-sentence')
    await user.click(within(pool).getByRole('button', { name: 'am' }))
    await user.click(within(pool).getByRole('button', { name: 'I' }))
    await user.click(within(pool).getByRole('button', { name: 'a' }))
    await user.click(within(pool).getByRole('button', { name: 'student.' }))
    expect(within(pool).getByRole('button', { name: 'am' })).toBeDisabled()
    // "am I a student." → move "I" left with the keyboard
    const chipI = within(sentence).getByRole('button', { name: /^I, position 2/ })
    chipI.focus()
    await user.keyboard('{ArrowLeft}')
    expect(within(sentence).getAllByRole('button').map((b) => b.textContent)).toEqual(['I', 'am', 'a', 'student.'])
    await user.click(screen.getByTestId('check-answer'))
    expect(screen.getByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'correct')
  })

  it('matching: tap left then right, partial credit on check', async () => {
    const user = userEvent.setup()
    render(
      <ExerciseRunner
        lesson={lesson([
          match('t-e1', [
            ['my father', 'he'],
            ['the car', 'it'],
          ]),
        ])}
      />,
    )
    const left = screen.getByRole('group', { name: 'Left items' })
    const right = screen.getByRole('group', { name: 'Right items' })
    expect(within(right).getByRole('button', { name: 'he' })).toBeDisabled()
    await user.click(within(left).getByRole('button', { name: 'my father' }))
    await user.click(within(right).getByRole('button', { name: 'it' }))
    await user.click(within(left).getByRole('button', { name: 'the car' }))
    await user.click(within(right).getByRole('button', { name: 'he' }))
    await user.click(screen.getByTestId('check-answer'))
    expect(screen.getByTestId('exercise-feedback')).toHaveTextContent('Try again')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await user.click(within(left).getByRole('button', { name: 'my father' }))
    await user.click(within(right).getByRole('button', { name: 'he' }))
    await user.click(within(left).getByRole('button', { name: 'the car' }))
    await user.click(within(right).getByRole('button', { name: 'it' }))
    await user.click(screen.getByTestId('check-answer'))
    expect(screen.getByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'correct')
  })

  it('speaking prompt: Done requires the checklist and the summary counts prompts', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(
      <ExerciseRunner
        lesson={lesson([sp('t-e1', t('Say your name.'), "Hi, I'm Leyla.", ['Used I\'m', 'Said my name'])], 'speaking')}
        onComplete={onComplete}
      />,
    )
    expect(screen.getByText(/Nothing is recorded/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByText("Hi, I'm Leyla.")).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: "Used I'm" }))
    await user.click(screen.getByRole('checkbox', { name: 'Said my name' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByTestId('finish-lesson'))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ score: 100, correct: 1, total: 1 }))
    expect(screen.getByTestId('exercise-summary')).toHaveTextContent('1 of 1 prompts completed')
  })

  it('finish is disabled until every exercise is answered and the summary can restart', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(
      <ExerciseRunner
        lesson={lesson([mc('t-e1', 'I ___', ['is', 'am'], 1), qf('t-e2', 'You are tired.', ['Are you tired?'])])}
        onComplete={onComplete}
      />,
    )
    await user.click(screen.getByTestId('next-exercise'))
    expect(screen.getByTestId('finish-lesson')).toBeDisabled()
    await user.type(screen.getByLabelText('Your answer'), 'Are you tired?{Enter}')
    // Enter submits the typed question (step-level assertions locate CI-only failures).
    expect(await screen.findByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'correct')
    expect(screen.getByTestId('finish-lesson')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous exercise' }))
    expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /am/ }))
    expect(screen.getByRole('radio', { name: /am/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByTestId('check-answer'))
    expect(await screen.findByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'correct')
    await user.click(screen.getByTestId('next-exercise'))
    expect(screen.getByText('Exercise 2 of 2')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('finish-lesson')).toBeEnabled())
    await user.click(screen.getByTestId('finish-lesson'))
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ score: 100, correct: 2, total: 2 })))
    expect(screen.getByText('Lesson complete')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Practise again' }))
    expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument()
  })
})

describe('ExerciseRunner — assessment mode', () => {
  it('allows one attempt, hides feedback until the end and reports pass/fail against the pass mark', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(
      <ExerciseRunner
        lesson={lesson(
          [mc('t-e1', 'I ___', ['is', 'am'], 1, { explanation: t('I takes am.') }), mc('t-e2', 'She ___', ['is', 'am'], 0)],
          'assessment',
        )}
        passMark={80}
        onComplete={onComplete}
      />,
    )
    expect(screen.getByText('1 attempt')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /is/ }))
    await user.click(screen.getByTestId('check-answer'))
    expect(screen.queryByTestId('exercise-feedback')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Answer saved')
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /is/ })).toBeDisabled()
    await user.click(screen.getByTestId('next-exercise'))
    await user.click(screen.getByRole('radio', { name: /is/ }))
    await user.click(screen.getByTestId('check-answer'))
    await user.click(screen.getByTestId('finish-lesson'))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ score: 50, correct: 1, total: 2 }))
    const summary = screen.getByTestId('exercise-summary')
    expect(summary).toHaveTextContent('Not passed yet')
    expect(summary).toHaveTextContent('pass mark 80%')
    expect(summary).toHaveTextContent('I takes am.')
    expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument()
  })
})

describe('ExerciseRunner - server-graded assessment', () => {
  const twoQuestions = () =>
    lesson([mc('t-e1', 'I ___', ['is', 'am'], 1, { explanation: t('I takes am.') }), mc('t-e2', 'She ___', ['is', 'am'], 0)], 'assessment')

  it('locks answers without grading, submits them together and hides answers after a fail', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue({
      attempt: { id: 'att', status: 'submitted', score: 50, passed: false },
      results: [
        { exerciseId: 't-e1', correct: false, score: 0 },
        { exerciseId: 't-e2', correct: true, score: 1 },
      ],
      revealAnswers: false,
      attemptsUsed: 1,
      attemptsAllowed: 3,
    })
    const onRetake = vi.fn()
    render(<ExerciseRunner lesson={twoQuestions()} passMark={80} assessment={{ attemptsUsed: 0, attemptsAllowed: 3, submit, onRetake }} />)
    expect(screen.getByTestId('assessment-attempt')).toHaveTextContent('Attempt 1 of 3')

    await user.click(screen.getByRole('radio', { name: /is/ }))
    await user.click(screen.getByRole('button', { name: 'Save answer' }))
    expect(screen.getByRole('status')).toHaveTextContent('Answer saved')
    expect(screen.getByRole('radio', { name: /is/ })).toBeDisabled()
    await user.click(screen.getByTestId('next-exercise'))
    await user.click(screen.getByRole('radio', { name: /is/ }))
    await user.click(screen.getByRole('button', { name: 'Save answer' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(submit).toHaveBeenCalledWith([
      { exerciseId: 't-e1', answer: { type: 'multiple_choice', optionId: 'a' } },
      { exerciseId: 't-e2', answer: { type: 'multiple_choice', optionId: 'a' } },
    ])
    const summary = await screen.findByTestId('exercise-summary')
    expect(screen.getByTestId('summary-outcome')).toHaveTextContent('Not passed yet')
    expect(screen.getByTestId('summary-score')).toHaveTextContent('Score 50%')
    expect(screen.getByTestId('summary-attempts')).toHaveTextContent('2 attempts left')
    expect(screen.getByTestId('answers-hidden')).toBeInTheDocument()
    expect(summary).not.toHaveTextContent('I takes am.')
    expect(summary).not.toHaveTextContent('Correct:')
    await user.click(screen.getByTestId('retake'))
    expect(onRetake).toHaveBeenCalledTimes(1)
  })

  it('shows the correct answers and explanations when the server reveals them, and no retake when attempts are gone', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue({
      attempt: { id: 'att', status: 'submitted', score: 50, passed: false },
      results: [
        { exerciseId: 't-e1', correct: false, score: 0, correctAnswer: 'am' },
        { exerciseId: 't-e2', correct: true, score: 1, correctAnswer: 'is' },
      ],
      revealAnswers: true,
      attemptsUsed: 3,
      attemptsAllowed: 3,
    })
    render(<ExerciseRunner lesson={twoQuestions()} passMark={80} assessment={{ attemptsUsed: 2, attemptsAllowed: 3, submit }} />)
    await user.click(screen.getByRole('radio', { name: /is/ }))
    await user.click(screen.getByRole('button', { name: 'Save answer' }))
    await user.click(screen.getByTestId('next-exercise'))
    await user.click(screen.getByRole('radio', { name: /is/ }))
    await user.click(screen.getByRole('button', { name: 'Save answer' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const summary = await screen.findByTestId('exercise-summary')
    expect(summary).toHaveTextContent('Correct: am')
    expect(summary).toHaveTextContent('I takes am.')
    expect(screen.getByTestId('summary-attempts')).toHaveTextContent('No attempts left')
    expect(screen.queryByTestId('retake')).not.toBeInTheDocument()
  })

  it('keeps the answers and lets the learner retry when the submission fails', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockRejectedValueOnce(new Error('Could not reach the server.')).mockResolvedValue({
      attempt: { id: 'att', status: 'submitted', score: 100, passed: true },
      results: [
        { exerciseId: 't-e1', correct: true, score: 1, correctAnswer: 'am' },
        { exerciseId: 't-e2', correct: true, score: 1, correctAnswer: 'is' },
      ],
      revealAnswers: true,
      attemptsUsed: 1,
      attemptsAllowed: 3,
    })
    render(<ExerciseRunner lesson={twoQuestions()} passMark={80} assessment={{ attemptsUsed: 0, attemptsAllowed: 3, submit }} />)
    await user.click(screen.getByRole('radio', { name: /am/ }))
    await user.click(screen.getByRole('button', { name: 'Save answer' }))
    await user.click(screen.getByTestId('next-exercise'))
    await user.click(screen.getByRole('radio', { name: /is/ }))
    await user.click(screen.getByRole('button', { name: 'Save answer' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByTestId('assessment-error')).toHaveTextContent('Could not reach the server.')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByTestId('summary-outcome')).toHaveTextContent('Passed')
    expect(submit).toHaveBeenCalledTimes(2)
  })
})
