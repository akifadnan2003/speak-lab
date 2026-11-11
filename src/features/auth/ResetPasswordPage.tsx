import { Navigate, useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from './AuthProvider'
import { homePathFor } from './guards'
import { NewPasswordForm } from './NewPasswordForm'

/** Reached from a verified recovery link (session already established). */
export function ResetPasswordPage() {
  const { state } = useAuth()
  const navigate = useNavigate()
  if (state.status !== 'authenticated') return <Navigate to="/login" replace />
  const { user } = state

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          Signed in as <strong>{user.email}</strong>. Your new password applies to every device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm
          autoFocus
          onSaved={() => navigate(user.role === 'student' && !user.onboardingCompletedAt ? '/welcome' : homePathFor(user.role), { replace: true })}
        />
      </CardContent>
    </Card>
  )
}
