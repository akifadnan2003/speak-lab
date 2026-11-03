import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { DialogOverlay } from './dialog'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description

interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: 'left' | 'right'
}

/** Side drawer used for the mobile navigation menu and secondary panels. */
export function SheetContent({ className, children, side = 'left', ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-overlay shadow-lg outline-none',
          'pt-[var(--safe-top)] pb-[var(--safe-bottom)]',
          side === 'left'
            ? 'left-0 border-r border-line data-[state=open]:animate-slide-in-left'
            : 'right-0 border-l border-line data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Close menu"
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
