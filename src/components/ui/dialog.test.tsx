import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog'

function Example() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a student</DialogTitle>
          <DialogDescription>Send a link.</DialogDescription>
        </DialogHeader>
        <input aria-label="Email" />
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('opens from the trigger, traps focus and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<Example />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = await screen.findByRole('dialog', { name: 'Invite a student' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes with the close button', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
