import { AuthError } from '@supabase/supabase-js'

/**
 * Human messages for Supabase Auth error codes. Everything else falls back to a neutral
 * message so provider internals are not surfaced to learners.
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Your email is not confirmed yet. Open the invitation link your tutor sent you.',
  user_banned: 'Your account has been disabled by your tutor.',
  user_not_found: 'No account exists for this email. SpeakLab is invitation-only.',
  signup_disabled: 'SpeakLab is invitation-only. Ask your tutor for an invitation.',
  otp_expired: 'This link has expired or was already used. Ask your tutor to resend the invitation, or request a new reset link.',
  otp_disabled: 'This type of link is not enabled.',
  over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
  over_email_send_rate_limit: 'Too many emails were sent recently. Wait a few minutes and try again.',
  weak_password: 'Choose a stronger password: at least 10 characters with letters and numbers.',
  same_password: 'Choose a password that is different from your current one.',
  session_expired: 'Your session has expired. Sign in again.',
  refresh_token_not_found: 'Your session has expired. Sign in again.',
  validation_failed: 'Some of the information is not valid. Check the form and try again.',
  bad_json: 'The request could not be read. Try again.',
  reauthentication_needed: 'For security, sign in again before changing your password.',
  access_denied: 'This link could not be verified.',
}

export function describeAuthError(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof AuthError) {
    const code = error.code ?? ''
    if (code && MESSAGES[code]) return MESSAGES[code]!
    if (/expired|invalid/i.test(error.message) && /token|otp|link/i.test(error.message)) return MESSAGES['otp_expired']!
    if (/banned/i.test(error.message)) return MESSAGES['user_banned']!
    if (/invalid login credentials/i.test(error.message)) return MESSAGES['invalid_credentials']!
    if (error.status === 429) return MESSAGES['over_request_rate_limit']!
    return error.message || fallback
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message || fallback
  }
  return fallback
}

export function authErrorCode(error: unknown): string {
  if (error instanceof AuthError) return error.code ?? (error.status ? `http_${error.status}` : 'unknown')
  return 'unknown'
}
