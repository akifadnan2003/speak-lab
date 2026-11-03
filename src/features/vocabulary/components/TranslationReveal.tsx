import { Languages } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LocalizedTextView } from '@/features/curriculum/az-help'
import { SUPPORT_LANGUAGE_LABEL, SUPPORT_LANGUAGES, type VocabularyEntry } from '../schema'

/**
 * Support-language material (translations, grammar note) stays hidden until
 * the learner asks, so English recall comes first. Works for any language in
 * SUPPORT_LANGUAGES that the entry actually has.
 */
export function TranslationReveal({ entry, open: openProp, compact }: { entry: VocabularyEntry; open?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const languages = SUPPORT_LANGUAGES.filter((lang) => entry.translations[lang])
  const hasNote = !!entry.grammarNote
  if (languages.length === 0 && !hasNote) return null
  const shown = openProp ?? open

  return (
    <div className="flex flex-col gap-2">
      {!shown ? (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setOpen(true)} data-testid="reveal-translation">
          <Languages aria-hidden /> {compact ? 'Translate' : 'Show translation and note'}
        </Button>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3 text-sm" data-testid="translation">
          {languages.map((lang) => (
            <p key={lang} className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{SUPPORT_LANGUAGE_LABEL[lang]}</span>
              <span lang={lang} className="font-medium">
                {entry.translations[lang]}
              </span>
            </p>
          ))}
          {entry.grammarNote ? <LocalizedTextView text={entry.grammarNote} className="text-fg-muted" /> : null}
        </div>
      )}
    </div>
  )
}
