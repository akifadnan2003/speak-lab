import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders children and handles clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled and busy while loading', () => {
    render(<Button loading>Saving</Button>)
    const button = screen.getByRole('button', { name: /saving/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('renders as the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="#/learn">Learn</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Learn' })
    expect(link).toHaveAttribute('href', '#/learn')
    expect(link).toHaveAttribute('data-slot', 'button')
  })

  it('applies variant classes', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-danger')
  })
})
