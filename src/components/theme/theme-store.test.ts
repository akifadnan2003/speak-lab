import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY, applyThemeToDocument, resolveTheme, useThemeStore } from './theme-store'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    useThemeStore.setState({ preference: 'system', resolved: 'light' })
  })

  it('resolves explicit preferences directly', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('resolves system preference from matchMedia (light in jsdom mock)', () => {
    expect(resolveTheme('system')).toBe('light')
  })

  it('applies the dark class to the document', () => {
    applyThemeToDocument('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyThemeToDocument('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists the preference and updates the document', () => {
    useThemeStore.getState().setPreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(useThemeStore.getState().resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('syncWithSystem is a no-op for explicit preferences', () => {
    useThemeStore.getState().setPreference('dark')
    useThemeStore.getState().syncWithSystem()
    expect(useThemeStore.getState().resolved).toBe('dark')
  })
})
