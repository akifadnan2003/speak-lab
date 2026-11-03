import {
  BarChart3,
  BookOpen,
  Home,
  Layers,
  Mic,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/features/auth/types'

export interface NavItem {
  to: string
  label: string
  /** Shorter label for the mobile bottom bar. */
  shortLabel?: string
  icon: LucideIcon
  /** Match nested routes (e.g. /learn/chapter) as active. */
  end?: boolean
}

export const STUDENT_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/speak', label: 'Speak', icon: Mic },
  { to: '/vocabulary', label: 'Vocabulary', shortLabel: 'Vocab', icon: Layers },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
]

export const TUTOR_NAV: NavItem[] = [
  { to: '/tutor', label: 'My Students', shortLabel: 'Students', icon: Users, end: true },
  { to: '/tutor/curriculum', label: 'Curriculum', icon: BookOpen },
]

export const SETTINGS_NAV: NavItem = { to: '/settings', label: 'Settings', icon: Settings }

export function navFor(role: UserRole): NavItem[] {
  return role === 'tutor' ? TUTOR_NAV : STUDENT_NAV
}

/** Items shown in the mobile bottom bar (max five for comfortable touch targets). */
export function bottomNavFor(role: UserRole): NavItem[] {
  const items = navFor(role)
  return role === 'tutor' ? [...items, SETTINGS_NAV] : items.slice(0, 5)
}
