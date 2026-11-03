import { describe, expect, it, vi } from 'vitest'
import { parseEnv } from './env'

describe('parseEnv', () => {
  it('reports supabase as unconfigured when values are missing', () => {
    const env = parseEnv({}, false)
    expect(env.supabaseConfigured).toBe(false)
    expect(env.supabaseUrl).toBeNull()
    expect(env.uiPreview).toBe(false)
    expect(env.basePath).toBe('/speak-lab/')
  })

  it('treats empty strings as unset', () => {
    const env = parseEnv({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }, false)
    expect(env.supabaseConfigured).toBe(false)
  })

  it('reports configured when both url and key are present', () => {
    const env = parseEnv(
      { VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' },
      false,
    )
    expect(env.supabaseConfigured).toBe(true)
    expect(env.supabaseUrl).toBe('https://abc.supabase.co')
  })

  it('falls back to defaults and warns on an invalid url', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = parseEnv({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'anon' }, false)
    expect(env.supabaseConfigured).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('parses preview flag from "true" or "1" only', () => {
    expect(parseEnv({ VITE_UI_PREVIEW: 'true' }, false).uiPreview).toBe(true)
    expect(parseEnv({ VITE_UI_PREVIEW: '1' }, false).uiPreview).toBe(true)
    expect(parseEnv({ VITE_UI_PREVIEW: 'yes' }, false).uiPreview).toBe(false)
  })
})
