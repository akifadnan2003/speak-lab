/**
 * Auth-link handling for a hash-routed app on static hosting.
 *
 * Supabase can deliver authentication material to the app in three shapes:
 *
 * 1. `?token_hash=…&type=invite|recovery|…`  (our email templates; verified with `verifyOtp`)
 * 2. `?code=…`                               (PKCE flows started in this browser; exchanged)
 * plus `?error=…&error_code=…&error_description=…` (or the same in the fragment) on failure.
 *
 * Raw implicit-grant tokens (`#access_token=…&refresh_token=…`, produced by the default
 * `/auth/v1/verify` redirect when the hosted templates are NOT customised) are deliberately
 * rejected: anyone could craft such a link with their own tokens and sign a victim into a foreign
 * session (login CSRF). The app reports them as an unsupported link instead of calling
 * `setSession`. See docs/SUPABASE_SETUP.md §1.3 for the required template change.
 *
 * The fragment form collides with `HashRouter`, which would treat `#access_token=…` as a route
 * and immediately replace it with `#/login`, losing the tokens. `captureAuthRedirect()` therefore
 * runs synchronously before React mounts: it parses the URL, keeps the material in memory and
 * rewrites the address bar to `#/auth/callback` (with only a non-secret `flow` hint) so that
 * nothing sensitive stays in history, the tab title or a copied link.
 */
export type AuthFlowType = 'invite' | 'recovery' | 'magiclink' | 'signup' | 'email_change' | 'email'

export type AuthRedirect =
  | { kind: 'token_hash'; tokenHash: string; type: AuthFlowType }
  | { kind: 'code'; code: string; type: AuthFlowType | null }
  | { kind: 'error'; code: string; description: string }

const FLOW_TYPES: readonly string[] = ['invite', 'recovery', 'magiclink', 'signup', 'email_change', 'email']

function asFlowType(value: string | null): AuthFlowType | null {
  return value && FLOW_TYPES.includes(value) ? (value as AuthFlowType) : null
}

function fragmentParams(hash: string): URLSearchParams | null {
  // A router hash starts with "#/" (or is empty). Anything else may carry auth parameters.
  if (!hash || hash.startsWith('#/')) return null
  return new URLSearchParams(hash.replace(/^#/, ''))
}

/** Pure parser. Returns the auth material carried by the URL, or null when there is none. */
export function extractAuthRedirect(location: { search: string; hash: string }): AuthRedirect | null {
  const search = new URLSearchParams(location.search)
  const fragment = fragmentParams(location.hash)

  const errorCode = search.get('error_code') ?? fragment?.get('error_code') ?? search.get('error') ?? fragment?.get('error')
  if (errorCode) {
    const description =
      search.get('error_description') ?? fragment?.get('error_description') ?? 'The link could not be verified.'
    return { kind: 'error', code: errorCode, description: description.replace(/\+/g, ' ') }
  }

  const tokenHash = search.get('token_hash') ?? fragment?.get('token_hash')
  const type = asFlowType(search.get('type') ?? fragment?.get('type') ?? null)
  if (tokenHash && type) return { kind: 'token_hash', tokenHash, type }

  const code = search.get('code')
  if (code) return { kind: 'code', code, type }

  if (fragment?.get('access_token') || fragment?.get('refresh_token')) {
    return {
      kind: 'error',
      code: 'unsupported_link',
      description:
        'This link format is not accepted. The SpeakLab email templates must use token_hash links (see the setup guide).',
    }
  }

  return null
}

/** True when the URL carries any Supabase auth parameter (used to decide whether to rewrite). */
export function hasAuthParams(location: { search: string; hash: string }): boolean {
  return extractAuthRedirect(location) !== null
}

/** Public, non-secret hint kept in the rewritten URL so the callback screen knows the flow. */
export function flowHintFor(redirect: AuthRedirect): string {
  if (redirect.kind === 'error') return 'error'
  return redirect.type ?? 'signin'
}

/** Builds the clean in-app URL the address bar is rewritten to. */
export function callbackUrlFor(basePath: string, hint: string): string {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${base}#/auth/callback?flow=${encodeURIComponent(hint)}`
}

/** Absolute app URL used as the email `redirectTo`. Must be allow-listed in Supabase. */
export function appRedirectUrl(basePath: string, origin = window.location.origin): string {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${origin}${base}`
}

let pending: AuthRedirect | null = null

/**
 * Call once at boot, before the router mounts. Removes auth material from the address bar and
 * keeps it in memory for `consumeAuthRedirect()`.
 */
export function captureAuthRedirect(
  win: Pick<Window, 'location' | 'history'> = window,
  basePath = '/',
): AuthRedirect | null {
  const redirect = extractAuthRedirect(win.location)
  if (!redirect) return null
  pending = redirect
  try {
    win.history.replaceState(null, '', callbackUrlFor(basePath, flowHintFor(redirect)))
  } catch {
    /* history unavailable (very old browsers): the router will still show the callback page */
  }
  return redirect
}

/** Returns the captured redirect exactly once. */
export function consumeAuthRedirect(): AuthRedirect | null {
  const value = pending
  pending = null
  return value
}

/** Test seam. */
export function setPendingAuthRedirectForTests(value: AuthRedirect | null): void {
  pending = value
}
