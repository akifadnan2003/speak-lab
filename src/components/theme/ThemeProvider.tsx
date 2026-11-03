import { useEffect, type ReactNode } from 'react'
import { applyThemeToDocument, useThemeStore } from './theme-store'

/** Keeps the document theme class in sync with the store and OS preference. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const resolved = useThemeStore((s) => s.resolved)
  const syncWithSystem = useThemeStore((s) => s.syncWithSystem)

  useEffect(() => {
    applyThemeToDocument(resolved)
  }, [resolved])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => syncWithSystem()
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [syncWithSystem])

  return children
}
