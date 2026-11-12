import { LogOut, Menu, Settings, User } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useGuardedSignOut } from '@/features/auth/SignOutGuard'
import type { AuthUser } from '@/features/auth/types'
import { Brand } from './Brand'
import { SidebarNav } from './Sidebar'

function UserMenu({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const afterSignOut = useCallback(() => navigate('/login', { replace: true }), [navigate])
  // Warns first when answers recorded on this device have not reached the account yet.
  const { requestSignOut, dialog } = useGuardedSignOut(afterSignOut)
  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Account menu"
          data-testid="user-menu"
        >
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={user.fullName} src={user.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <User aria-hidden /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings aria-hidden /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={requestSignOut}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
      {dialog}
    </>
  )
}

export function TopBar({ user }: { user: AuthUser }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header
      className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="flex h-topbar items-center gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" data-testid="open-menu">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Main sections of SpeakLab</SheetDescription>
              <div className="flex h-topbar items-center px-5">
                <Brand />
              </div>
              <div className="flex flex-1 flex-col px-3 pb-4">
                <SidebarNav role={user.role} onNavigate={() => setMenuOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <Brand className="sm:hidden" />
        </div>
        <div className="hidden sm:block lg:hidden">
          <Brand />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {user.role === 'tutor' ? (
            <Badge variant="primary" className="hidden sm:inline-flex">
              Tutor
            </Badge>
          ) : null}
          <Link
            to="/speak"
            className="hidden h-9 items-center gap-2 rounded-lg bg-primary-soft px-3 text-sm font-medium text-primary-soft-fg transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline-flex dark:hover:bg-brand-800/60"
            hidden={user.role === 'tutor'}
          >
            Quick practice
          </Link>
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
