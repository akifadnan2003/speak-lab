import { beforeEach, describe, expect, it } from 'vitest'
import {
  appRedirectUrl,
  callbackUrlFor,
  captureAuthRedirect,
  consumeAuthRedirect,
  extractAuthRedirect,
  setPendingAuthRedirectForTests,
} from './auth-url'

describe('extractAuthRedirect', () => {
  it('reads token_hash links produced by the SpeakLab email templates', () => {
    const r = extractAuthRedirect({ search: '?token_hash=abc123&type=invite', hash: '' })
    expect(r).toEqual({ kind: 'token_hash', tokenHash: 'abc123', type: 'invite' })
    expect(extractAuthRedirect({ search: '?token_hash=x&type=recovery', hash: '#/auth/callback' })).toMatchObject({
      type: 'recovery',
    })
  })

  it('reads PKCE codes from the query string', () => {
    expect(extractAuthRedirect({ search: '?code=the-code', hash: '#/' })).toEqual({ kind: 'code', code: 'the-code', type: null })
  })

  it('rejects raw implicit-grant tokens in the fragment (login CSRF guard)', () => {
    const r = extractAuthRedirect({
      search: '',
      hash: '#access_token=at&expires_in=3600&refresh_token=rt&token_type=bearer&type=invite',
    })
    expect(r).toMatchObject({ kind: 'error', code: 'unsupported_link' })
  })

  it('reports provider errors from either location', () => {
    expect(
      extractAuthRedirect({ search: '', hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired' }),
    ).toEqual({ kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' })
    expect(extractAuthRedirect({ search: '?error=access_denied&error_description=nope', hash: '' })).toMatchObject({ kind: 'error' })
  })

  it('ignores ordinary router hashes and unrelated query strings', () => {
    expect(extractAuthRedirect({ search: '', hash: '#/learn/a2-07' })).toBeNull()
    expect(extractAuthRedirect({ search: '?utm=1', hash: '#/tutor' })).toBeNull()
    expect(extractAuthRedirect({ search: '', hash: '' })).toBeNull()
    // token_hash without a known type is not usable
    expect(extractAuthRedirect({ search: '?token_hash=x&type=weird', hash: '' })).toBeNull()
  })
})

describe('captureAuthRedirect', () => {
  beforeEach(() => setPendingAuthRedirectForTests(null))

  it('stores the redirect once and scrubs the address bar', () => {
    const calls: string[] = []
    const win = {
      location: { search: '?token_hash=secret&type=invite', hash: '' },
      history: { replaceState: (_s: unknown, _t: string, url: string) => calls.push(url) },
    } as unknown as Window
    const captured = captureAuthRedirect(win, '/speak-lab/')
    expect(captured).toMatchObject({ kind: 'token_hash' })
    expect(calls).toEqual(['/speak-lab/#/auth/callback?flow=invite'])
    expect(consumeAuthRedirect()).toEqual(captured)
    expect(consumeAuthRedirect()).toBeNull()
  })

  it('does nothing for a normal navigation', () => {
    const win = {
      location: { search: '', hash: '#/settings' },
      history: { replaceState: () => { throw new Error('should not be called') } },
    } as unknown as Window
    expect(captureAuthRedirect(win, '/speak-lab/')).toBeNull()
    expect(consumeAuthRedirect()).toBeNull()
  })
})

describe('url helpers', () => {
  it('builds callback and redirect urls under the base path', () => {
    expect(callbackUrlFor('/speak-lab/', 'recovery')).toBe('/speak-lab/#/auth/callback?flow=recovery')
    expect(callbackUrlFor('/speak-lab', 'invite')).toBe('/speak-lab/#/auth/callback?flow=invite')
    expect(appRedirectUrl('/speak-lab/', 'https://akifadnan2003.github.io')).toBe('https://akifadnan2003.github.io/speak-lab/')
  })
})
