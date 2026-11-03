import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useThemeStore, type ThemePreference } from './theme-store'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference)
  const resolved = useThemeStore((s) => s.resolved)
  const setPreference = useThemeStore((s) => s.setPreference)
  const Icon = resolved === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme" data-testid="theme-toggle">
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon className="size-4 text-fg-muted" aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Inline segmented control used on the Settings screen. */
export function ThemeSegmentedControl() {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg bg-surface-2 p-1">
      {OPTIONS.map((option) => {
        const active = preference === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(option.value)}
            className={
              'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ' +
              (active ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg')
            }
          >
            <option.icon className="size-4" aria-hidden />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
