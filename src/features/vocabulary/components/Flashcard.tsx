import { RotateCw, Volume2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VocabularyEntry } from '../schema'
import type { SelfGrade } from '../srs/scheduler'
import { TranslationReveal } from './TranslationReveal'

const GRADES: { grade: SelfGrade; label: string; hint: string; className: string }[] = [
  { grade: 'again', label: 'Again', hint: 'I did not know it', className: 'border-danger text-danger-soft-fg hover:bg-danger-soft' },
  { grade: 'hard', label: 'Hard', hint: 'I remembered with effort', className: 'border-warning text-warning-soft-fg hover:bg-warning-soft' },
  { grade: 'good', label: 'Good', hint: 'I knew it', className: 'border-primary text-primary-soft-fg hover:bg-primary-soft' },
  { grade: 'easy', label: 'Easy', hint: 'Instant', className: 'border-success text-success-soft-fg hover:bg-success-soft' },
]

/**
 * Flashcard: front shows the word, back shows the meaning. The learner says
 * the meaning before flipping and then grades themselves; the grade feeds the
 * scheduler. Keyboard: Space/Enter flips, 1–4 grade.
 */
export function Flashcard({ entry, onGrade }: { entry: VocabularyEntry; onGrade: (grade: SelfGrade) => void }) {
  const [flipped, setFlipped] = useState(false)
  const id = useId()

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!flipped && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault()
      setFlipped(true)
      return
    }
    if (flipped) {
      const index = Number.parseInt(event.key, 10) - 1
      const grade = GRADES[index]
      if (grade) {
        event.preventDefault()
        onGrade(grade.grade)
      }
    }
  }

  return (
    <div className="flex flex-col gap-4" onKeyDown={onKeyDown} data-testid="flashcard">
      <div
        role="group"
        aria-labelledby={`${id}-term`}
        className={cn(
          'flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border bg-surface p-6 text-center shadow-sm transition-colors',
          flipped ? 'border-primary/40' : 'border-line',
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{flipped ? 'Meaning' : 'Word'}</p>
        <p id={`${id}-term`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {entry.term}
        </p>
        <p className="text-sm text-fg-muted">
          {entry.partOfSpeech}
          {entry.pronunciation?.respelling ? ` · ${entry.pronunciation.respelling}` : ''}
        </p>
        {entry.pronunciation?.audioUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={entry.pronunciation.audioUrl} target="_blank" rel="noreferrer">
              <Volume2 aria-hidden /> Play audio
            </a>
          </Button>
        ) : null}
        {flipped ? (
          <div className="mt-2 flex flex-col gap-2 text-left sm:text-center" data-testid="flashcard-back">
            <p className="text-base">{entry.definition}</p>
            <p className="text-sm italic text-fg-muted">{entry.examples[0]}</p>
            {entry.synonyms.length > 0 ? <p className="text-xs text-fg-muted">Also: {entry.synonyms.join(', ')}</p> : null}
            {entry.collocations.length > 0 ? <p className="text-xs text-fg-muted">Goes with: {entry.collocations.join(', ')}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">Say the meaning in English, then flip.</p>
        )}
      </div>

      {!flipped ? (
        <Button size="lg" onClick={() => setFlipped(true)} className="w-full sm:w-auto sm:self-center">
          <RotateCw aria-hidden /> Flip
        </Button>
      ) : (
        <>
          <TranslationReveal entry={entry} />
          <div role="group" aria-label="How well did you know it?" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((g, i) => (
              <button
                key={g.grade}
                type="button"
                onClick={() => onGrade(g.grade)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-lg border bg-surface px-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  g.className,
                )}
              >
                <span>
                  {g.label} <kbd className="ml-1 hidden rounded bg-surface-2 px-1 text-[10px] font-normal text-fg-muted sm:inline">{i + 1}</kbd>
                </span>
                <span className="text-xs font-normal text-fg-muted">{g.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
