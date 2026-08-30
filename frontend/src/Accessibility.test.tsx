import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from './App'

describe('TASK-008 and TASK-009 mobile/accessibility integration', () => {
  it('renders responsive trade cards rather than a table on mobile', async () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(within(screen.getByTestId('navigation-drawer')).getByRole('button', { name: 'Backtest Results' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Backtest' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(within(screen.getByTestId('navigation-drawer')).getByRole('button', { name: 'Trades' }))

    expect(screen.getByTestId('trades-cards')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('gives every icon-only button an accessible name and visible focus styles', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
    const { container } = render(<App />)
    const iconOnlyButtons = [...container.querySelectorAll('button')].filter((button) => button.querySelector('svg') && !button.textContent?.trim())

    expect(iconOnlyButtons.length).toBeGreaterThan(0)
    for (const button of iconOnlyButtons) {
      expect(button).toHaveAttribute('aria-label')
      expect(button).toHaveAttribute('title')
      expect(button.className).toContain('focus-visible:ring-2')
    }
  })
})
