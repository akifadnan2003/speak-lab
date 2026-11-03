import { create } from 'zustand'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'speaklab.theme'

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference
}

export function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  syncWithSystem: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readStoredPreference()
  return {
    preference: initial,
    resolved: resolveTheme(initial),
    setPreference: (preference) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, preference)
      } catch {
        /* storage unavailable */
      }
      const resolved = resolveTheme(preference)
      applyThemeToDocument(resolved)
      set({ preference, resolved })
    },
    syncWithSystem: () => {
      if (get().preference !== 'system') return
      const resolved = resolveTheme('system')
      applyThemeToDocument(resolved)
      set({ resolved })
    },
  }
})
