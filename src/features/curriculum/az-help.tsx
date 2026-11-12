/* oxlint-disable react/only-export-components -- context module exporting its hook */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Languages } from 'lucide-react'
import type { LocalizedText } from './schema'
import { cn } from '@/lib/utils'

/**
 * Azerbaijani help layer.
 *
 * English is always rendered. When the learner switches Azerbaijani help on,
 * every `LocalizedText` that has an `az` field shows it underneath, visually
 * secondary. The preference is remembered on the device; the M2 settings
 * screen will persist it to the profile later.
 */
interface AzHelpValue {
  readonly enabled: boolean
  readonly setEnabled: (value: boolean) => void
}

const AzHelpContext = createContext<AzHelpValue | null>(null)
const STORAGE_KEY = 'speaklab.azHelp'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AzHelpProvider({ children, initial }: { children: ReactNode; initial?: boolean }) {
  const [enabled, setEnabledState] = useState<boolean>(() => initial ?? readStored())
  const value = useMemo<AzHelpValue>(
    () => ({
      enabled,
      setEnabled: (next) => {
        setEnabledState(next)
        try {
          localStorage.setItem(STORAGE_KEY, String(next))
        } catch {
          /* storage unavailable */
        }
      },
    }),
    [enabled],
  )
  return <AzHelpContext.Provider value={value}>{children}</AzHelpContext.Provider>
}

export function useAzHelp(): AzHelpValue {
  const ctx = useContext(AzHelpContext)
  return ctx ?? { enabled: false, setEnabled: () => {} }
}

/** Renders English, plus Azerbaijani when enabled and available. */
export function LocalizedTextView({
  text,
  className,
  azClassName,
  as: Tag = 'p',
}: {
  text: LocalizedText
  className?: string
  azClassName?: string
  as?: 'p' | 'span' | 'div'
}) {
  const { enabled } = useAzHelp()
  const showAz = enabled && !!text.az
  return (
    <Tag className={cn('flex flex-col gap-1.5', className)}>
      <span lang="en">{text.en}</span>
      {showAz ? (
        <span
          lang="az"
          data-testid="az-text"
          className={cn('flex items-start gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm text-fg-muted', azClassName)}
        >
          <Languages className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span>{text.az}</span>
        </span>
      ) : null}
    </Tag>
  )
}
