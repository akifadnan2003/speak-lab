import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthProvider'

/** Shown when a session exists but the profile cannot be loaded. Fails closed. */
export function AuthErrorScreen({ message }: { message: string }) {
  const { signOut, refreshProfile } = useAuth()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div role="alert" className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center shadow-md">
        <span className="flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger-soft-fg">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">We could not load your account</h1>
        <p className="text-sm text-fg-muted">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => void refreshProfile()}>
            Try again
          </Button>
          <Button onClick={() => void signOut()}>Sign out</Button>
        </div>
      </div>
    </div>
  )
}
