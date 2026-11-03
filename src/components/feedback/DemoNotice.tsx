import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Inline label placed on any panel that is rendering demonstration data or a
 * feature that is not yet connected. Keeps placeholder content honest.
 */
export function DemoNotice({
  children = 'Demo data. Real records arrive in a later milestone.',
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-info-soft px-2 py-1 text-xs text-info-soft-fg',
        className,
      )}
    >
      <Info className="size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
