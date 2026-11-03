import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

function Example() {
  return (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="grammar">Grammar</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="grammar">Grammar panel</TabsContent>
      <TabsContent value="notes">Notes panel</TabsContent>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('switches panels on click', async () => {
    const user = userEvent.setup()
    render(<Example />)
    expect(screen.getByText('Overview panel')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Grammar' }))
    expect(screen.getByText('Grammar panel')).toBeVisible()
    expect(screen.queryByText('Overview panel')).not.toBeInTheDocument()
  })

  it('supports arrow-key navigation between tabs', async () => {
    const user = userEvent.setup()
    render(<Example />)
    const overview = screen.getByRole('tab', { name: 'Overview' })
    overview.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Grammar' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(overview).toHaveAttribute('aria-selected', 'true')
  })
})
