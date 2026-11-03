import { NavLink } from 'react-router'
import { bottomNavFor } from './nav'
import type { UserRole } from '@/features/auth/types'
import { cn } from '@/lib/utils'

/** Mobile bottom navigation with safe-area padding and 44px+ touch targets. */
export function BottomNav({ role }: { role: UserRole }) {
  const items = bottomNavFor(role)
  return (
    <nav
      aria-label="Primary"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="flex h-bottomnav items-stretch">
        {items.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                  isActive ? 'text-primary' : 'text-fg-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-primary-soft',
                    )}
                  >
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <span className="truncate">{item.shortLabel ?? item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
