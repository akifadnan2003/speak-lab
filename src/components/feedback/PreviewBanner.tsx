import { FlaskConical } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import type { UserRole } from '@/features/auth/types'
import { cn } from '@/lib/utils'

/**
 * Always-visible notice shown while the app runs in M1 preview mode. It makes
 * clear that no real authentication, analytics or AI is connected and lets the
 * reviewer switch between the student and tutor shells.
 */
export function PreviewBanner({ className }: { className?: string }) {
  const { state, previewSwitchRole } = useAuth()
  if (state.status !== 'authenticated' || !state.preview || !previewSwitchRole) return null

  const role = state.user.role
  const options: { value: UserRole; label: string }[] = [
    { value: 'student', label: 'Student view' },
    { value: 'tutor', label: 'Tutor view' },
  ]

  return (
    <div
      role="status"
      data-testid="preview-banner"
      className={cn(
        'flex items-center justify-between gap-3 border-b border-warning/40 bg-warning-soft px-4 py-2 text-xs text-warning-soft-fg',
        className,
      )}
    >
      <p className="flex min-w-0 items-center gap-2">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          <strong className="font-semibold">Preview mode.</strong> Demo data only. Authentication,
          analytics and AI are not connected yet.
        </span>
      </p>
      <div
        role="radiogroup"
        aria-label="Preview role"
        className="flex shrink-0 overflow-hidden rounded-md border border-warning/50"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={role === option.value}
            onClick={() => previewSwitchRole(option.value)}
            className={cn(
              'px-2.5 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
              role === option.value ? 'bg-warning/30' : 'hover:bg-warning/15',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
