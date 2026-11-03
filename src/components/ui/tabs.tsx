import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

/**
 * Horizontally scrollable tab list so long tab sets (e.g. the student profile
 * sections) stay usable at 320px without wrapping or overflowing the page.
 */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-10 max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1 text-fg-muted scrollbar-thin',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap',
        'transition-[background-color,color,box-shadow] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-xs',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 outline-none focus-visible:outline-2 focus-visible:outline-ring', className)}
      {...props}
    />
  )
}
