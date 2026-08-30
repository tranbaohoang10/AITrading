import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { App } from './App'
import { CodeViewer } from './components/CodeViewer'
import { TradingProvider, useTrading } from './context/TradingContext'

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('PB-001 responsive navigation and keyboard', () => {
  it.each([[767, 'mobile'], [768, 'tablet'], [1199, 'tablet'], [1200, 'desktop']])('selects the correct layout at %i', (width, layout) => {
    window.innerWidth = Number(width)
    const { container } = render(<App />)
    expect(container.querySelector('[data-layout]')).toHaveAttribute('data-layout', layout)
  })

  it('all planned desktop navigation destinations show explicit empty states', () => {
    render(<App />)
    for (const name of ['Trading Journal', 'My Code', 'Strategies', 'Settings', 'Account']) {
      fireEvent.click(within(screen.getByTestId('global-sidebar')).getByRole('button', { name }))
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
      expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    expect(screen.getByTestId('chart-view')).toBeInTheDocument()
  })

  it('uses roving tab focus with arrows/Home/End and clamps keyboard resizing', () => {
    render(<App />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Chart' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Trades' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Trades' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Trades' }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'Chart' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Chart' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Trades' })).toHaveFocus()
    const divider = screen.getByRole('separator')
    for (let i = 0; i < 100; i++) fireEvent.keyDown(divider, { key: 'ArrowLeft' })
    expect(divider).toHaveAttribute('aria-valuenow', '320')
    for (let i = 0; i < 100; i++) fireEvent.keyDown(divider, { key: 'ArrowRight' })
    expect(divider).toHaveAttribute('aria-valuenow', '400')
  })

  it('closes mobile modal on cancel and restores trigger focus', () => {
    window.innerWidth = 390
    render(<App />)
    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes the tablet dialog with Escape even when native cancel is unavailable', () => {
    window.innerWidth = 1024
    render(<App />)
    const trigger = screen.getByRole('button', { name: 'Open AI Chat' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close AI Chat' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

describe('PB-001 input, duplicate events and lifetime safeguards', () => {
  it.each([['empty', ''], ['whitespace', '   '], ['oversized', 'x'.repeat(4001)]])('rejects %s input', (_name, input) => {
    const { result } = renderHook(useTrading, { wrapper: TradingProvider })
    act(() => result.current.setPrompt(input))
    act(() => result.current.generateStrategy())
    expect(result.current.generationStatus).toBe('error')
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.backtestStatus).toBe('idle')
  })

  it('accepts the maximum length once, suppresses duplicate calls, and prevents pending input loss', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(useTrading, { wrapper: TradingProvider })
    act(() => result.current.setPrompt('x'.repeat(4000)))
    act(() => { result.current.generateStrategy(); result.current.generateStrategy(); result.current.setPrompt('new input') })
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.prompt).toHaveLength(4000)
    await act(async () => { await vi.advanceTimersByTimeAsync(650) })
    expect(result.current.messages).toHaveLength(3)
    expect(result.current.backtestStatus).toBe('idle')
    act(() => { result.current.runBacktest(); result.current.runBacktest() })
    expect(vi.getTimerCount()).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    expect(result.current.backtestStatus).toBe('complete')
  })

  it('clears outstanding generation/backtest timers on unmount', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(useTrading, { wrapper: TradingProvider })
    act(() => result.current.setPrompt('Synthetic EMA strategy'))
    act(() => { result.current.generateStrategy(); result.current.runBacktest() })
    expect(vi.getTimerCount()).toBe(2)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('renders hostile prompt/code as plain text without creating HTML or network calls', async () => {
    vi.useFakeTimers()
    const network = vi.spyOn(window, 'fetch')
    const payload = '<img src="https://invalid.example/leak" onerror="alert(1)"><script>bad()</script>'
    const { container } = render(<App />)
    fireEvent.change(screen.getByLabelText('Strategy prompt'), { target: { value: payload } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate Strategy' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(650) })
    expect(screen.getByText(payload)).toBeInTheDocument()
    expect(container.querySelectorAll('img,script')).toHaveLength(0)
    expect(network).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Attach reference' })).toBeDisabled()
  })
})

describe('PB-001 clipboard trust', () => {
  it('reports success only after a successful write', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<CodeViewer title="Sample" language="text" code={'<script>plain text</script>'} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('<script>plain text</script>')
    vi.unstubAllGlobals()
  })

  it.each(['missing', 'denied'])('reports %s clipboard without fake success', async (condition) => {
    vi.stubGlobal('navigator', condition === 'missing' ? {} : { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    render(<CodeViewer title="Sample" language="text" code="sample" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Select the code')
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
