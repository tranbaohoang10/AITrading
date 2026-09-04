import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { App } from './App'

function desktop() {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
}

describe('TASK-003 through TASK-007 workspace behavior', () => {
  beforeEach(() => desktop())
  afterEach(() => vi.useRealTimers())

  it('fully replaces workspace content when switching tabs', () => {
    render(<App />)
    expect(screen.getByTestId('chart-view')).toBeInTheDocument()
    expect(screen.getByTestId('chart-toolbar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Pine Script' }))
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chart-toolbar')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pine Script' })).toBeInTheDocument()
  })

  it('shows all local Chart toolbar controls', () => {
    render(<App />)
    const toolbar = screen.getByTestId('chart-toolbar')
    expect(within(toolbar).getByLabelText('Symbol')).toBeInTheDocument()
    expect(within(toolbar).getByLabelText('Timeframe')).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Add indicator' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Chart settings' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('group')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Chart tools' })).toBeInTheDocument()
    expect(screen.getByLabelText('Lines tools')).toHaveAttribute('title', 'Trend Line')
    fireEvent.click(screen.getByRole('button', { name: 'Show Lines menu' }))
    expect(screen.getByRole('button', { name: 'Trend Line' })).toHaveAttribute('title', 'Trend Line')
  })

  it('keeps drawing tools compact and exposes an honest chart export menu', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('Lines tools'))
    expect(screen.getByLabelText('Lines tools')).toHaveClass('text-slate-100')

    fireEvent.click(screen.getByLabelText('Chart capture and export'))
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Send to chat/ })).not.toBeInTheDocument()
  })

  it('keeps code views read-only, scrollable, and copyable', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Strategy DSL' }))
    const viewer = screen.getByTestId('code-viewer')
    expect(within(viewer).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(viewer).getByTestId('code-scroll-container')).toHaveClass('overflow-auto')
    expect(within(viewer).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('generates mock strategy views without automatically running backtest', async () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Backtest Results' }))
    expect(screen.getByText('Waiting for a separate Backtest action')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Strategy prompt'), { target: { value: 'Build a pullback strategy' } })
    fireEvent.click(screen.getByRole('button', { name: /Generate Strategy/ }))
    expect(screen.getByText('Generating mock Strategy DSL and platform views…')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(650) })

    expect(screen.getByText('Strategy views updated. Backtest has not run.')).toBeInTheDocument()
    expect(screen.getByText('Waiting for a separate Backtest action')).toBeInTheDocument()
    expect(within(screen.getByTestId('backtest-results')).getByText('0')).toBeInTheDocument()
  })

  it('updates metrics and trades only after a separate Backtest action', async () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Backtest Results' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Backtest' }))
    expect(screen.getByRole('button', { name: 'Running mock…' })).toBeDisabled()
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })

    expect(screen.getByTestId('backtest-results')).toHaveTextContent('+18.42%')
    fireEvent.click(screen.getByRole('tab', { name: 'Trades' }))
    expect(screen.getByTestId('trades-table')).toBeInTheDocument()
    expect(screen.getByText('T-1042')).toBeInTheDocument()
  })
})
