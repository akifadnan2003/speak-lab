import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { matchesAccepted } from '@/features/exercises/engine/normalize'
import { cn } from '@/lib/utils'
import { blankOut } from '../modes'
import type { VocabularyEntry } from '../schema'
import { TranslationReveal } from './TranslationReveal'

export interface RecallResult {
  readonly correct: boolean
  readonly hintUsed: boolean
  readonly answer: string
}

/**
 * Active recall: definition (and the example with the word removed) → type
 * the English word. The translation is only offered after checking, so the
 * learner tries English first. Enter checks; the hint reveals the first letter.
 */
export function ActiveRecall({ entry, onResult }: { entry: VocabularyEntry; onResult: (result: RecallResult) => void }) {
  const id = useId()
  const [text, setText] = useState('')
  const [hint, setHint] = useState(false)
  const [result, setResult] = useState<RecallResult | null>(null)
  const blanked = blankOut(entry.examples[0] ?? '', entry.term)
  const accepted = [entry.term, ...(blanked ? [blanked.answer] : [])]

  function check() {
    if (result || text.trim().length === 0) return
    const correct = matchesAccepted(text, accepted)
    const r = { correct, hintUsed: hint, answer: text }
    setResult(r)
    onResult(r)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      check()
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="active-recall">
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Meaning · {entry.partOfSpeech}
        </p>
        <p className="text-base font-medium">{entry.definition}</p>
        {blanked ? <p className="text-sm italic text-fg-muted">{blanked.text}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-input`} className="text-sm font-medium">
          The word in English
        </label>
        <Input
          id={`${id}-input`}
          value={text}
          disabled={!!result}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-invalid={result && !result.correct ? true : undefined}
          className={cn(result?.correct && 'border-success bg-success-soft text-success-soft-fg', result && !result.correct && 'border-danger')}
        />
      </div>

      {!result ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={check} disabled={text.trim().length === 0} data-testid="check-answer">
            Check
          </Button>
          {!hint ? (
            <Button variant="ghost" size="sm" onClick={() => setHint(true)}>
              <Lightbulb aria-hidden /> Hint
            </Button>
          ) : (
            <span role="note" className="text-sm text-fg-muted">
              Starts with <strong>{entry.term.slice(0, 1).toUpperCase()}</strong>, {entry.term.length} letters.
            </span>
          )}
        </div>
      ) : (
        <div
          role="status"
          data-testid="recall-feedback"
          data-outcome={result.correct ? 'correct' : 'incorrect'}
          className={cn(
            'flex gap-3 rounded-lg p-3 text-sm',
            result.correct ? 'bg-success-soft text-success-soft-fg' : 'bg-warning-soft text-warning-soft-fg',
          )}
        >
          {result.correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{result.correct ? 'Correct!' : `The word is "${entry.term}".`}</p>
            <p>{entry.examples[0]}</p>
          </div>
        </div>
      )}

      {result ? <TranslationReveal entry={entry} /> : null}
    </div>
  )
}
