import { Loader2, Lock, MailX } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from './AuthProvider'
import { homePathFor } from './guards'

/**
 * Landing route for email links. The auth material was already captured at boot
 * (see auth-url.ts); this screen only reflects the outcome:
 *   - processing  → spinner
 *   - error       → explanation (expired, already used, invalid) with next steps
 *   - complete    → invitation: /welcome (set password + preferences)
 *                   recovery:   /reset-password
 *                   anything else: the user's home
 */
export function AuthCallbackPage() {
  const { state, flow, clearFlow } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const hint = params.get('flow') ?? 'signin'

  // Navigate as soon as the link produced a session. The flow is cleared only when this page
  // unmounts: clearing it first would re-render the "no flow + authenticated" branch below and
  // start a second, competing redirect to the user's home.
  useEffect(() => {
    if (flow?.status !== 'complete' || state.status !== 'authenticated') return
    const target = flow.type === 'invite' ? '/welcome' : flow.type === 'recovery' ? '/reset-password' : homePathFor(state.user.role)
    navigate(target, { replace: true })
  }, [flow, state, navigate])
  useEffect(() => () => clearFlow(), [clearFlow])

  if (flow?.status === 'error') {
    const invite = flow.type === 'invite' || hint === 'invite'
    return (
      <Card className="shadow-md">
        <CardHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger-soft-fg">
            <MailX className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-xl">{invite ? 'This invitation link cannot be used' : 'This link cannot be used'}</CardTitle>
          <CardDescription data-testid="auth-callback-error">{flow.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-fg-muted">
            {invite
              ? 'Links work once and expire after a short time. Ask your tutor to resend the invitation.'
              : 'Request a new link and open it on this device.'}
          </p>
          {invite ? null : (
            <Button asChild>
              <Link to="/forgot-password">Request a new reset link</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/login" onClick={clearFlow}>
              Go to sign in
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!flow && state.status === 'authenticated') {
    return <Navigate to={state.user.status === 'disabled' ? '/account-disabled' : homePathFor(state.user.role)} replace />
  }
  if (!flow && state.status === 'unauthenticated') {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Nothing to finish</CardTitle>
          <CardDescription>
            This page completes invitation and password-reset links. Open the link from your email to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">{hint === 'invite' ? 'Accepting your invitation' : 'Verifying your link'}</CardTitle>
        <CardDescription>One moment while we check the link with the server.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      </CardContent>
    </Card>
  )
}

export function AccountDisabledPage() {
  const { state, signOut } = useAuth()
  const navigate = useNavigate()
  if (state.status === 'authenticated' && state.user.status !== 'disabled') {
    return <Navigate to={homePathFor(state.user.role)} replace />
  }
  return (
    <Card className="shadow-md">
      <CardHeader>
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger-soft-fg">
          <Lock className="size-5" aria-hidden />
        </span>
        <CardTitle className="text-xl">Account disabled</CardTitle>
        <CardDescription>
          Your access has been paused by your tutor. Contact them to reactivate your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            void signOut().then(() => navigate('/login', { replace: true }))
          }}
        >
          Back to sign in
        </Button>
      </CardContent>
    </Card>
  )
}
