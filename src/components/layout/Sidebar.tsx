import { NavLink } from 'react-router'
import { Brand } from './Brand'
import { navFor, SETTINGS_NAV, type NavItem } from './nav'
import type { UserRole } from '@/features/auth/types'
import { cn } from '@/lib/utils'

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
          isActive
            ? 'bg-primary-soft text-primary-soft-fg'
            : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn('size-[18px] shrink-0', isActive ? 'text-primary' : 'text-fg-subtle group-hover:text-fg-muted')}
            aria-hidden
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

interface SidebarNavProps {
  role: UserRole
  onNavigate?: () => void
}

/** Navigation list shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ role, onNavigate }: SidebarNavProps) {
  const items = navFor(role)
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase">
          {role === 'tutor' ? 'Teaching' : 'Learning'}
        </p>
        {items.map((item) => (
          <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <SidebarLink item={SETTINGS_NAV} onNavigate={onNavigate} />
      </div>
    </nav>
  )
}

export function DesktopSidebar({ role }: { role: UserRole }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-line bg-surface lg:flex"
      data-testid="desktop-sidebar"
    >
      <div className="flex h-topbar items-center px-5">
        <Brand />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-3 pt-2 pb-4 scrollbar-thin">
        <SidebarNav role={role} />
      </div>
    </aside>
  )
}
