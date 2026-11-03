import { Loader2, Lock } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Landing route for Supabase email links (invitation, recovery, magic link).
 * M2 will exchange the code / token here and route to password setup. For now
 * it only explains the state so the route exists and is deployable.
 */
export function AuthCallbackPage() {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Finishing sign-in</CardTitle>
        <CardDescription>
          This page completes invitation and password-reset links. It becomes active in milestone
          M2.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <Button asChild variant="outline">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function AccountDisabledPage() {
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
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
