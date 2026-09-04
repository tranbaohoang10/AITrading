import { fireEvent, render, screen, within } from '@testing-library/react'
import { App } from './App'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  fireEvent(window, new Event('resize'))
}

describe('TASK-002 responsive application shell', () => {
  it('renders the three independent desktop regions and resizable divider', () => {
    setViewport(1440)
    render(<App />)

    expect(screen.queryByTestId('global-sidebar')).not.toBeInTheDocument()
    expect(screen.getByTestId('ai-chat')).toBeInTheDocument()
    expect(screen.getByTestId('trading-workspace')).toBeInTheDocument()
    expect(screen.getByRole('separator', { name: 'Resize AI Chat' })).toHaveAttribute('aria-valuenow', '360')
    expect(screen.queryByRole('button', { name: 'Backtest' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open account' })).toBeInTheDocument()
  })

  it('opens a compact feature-backed Quant navigation panel and closes after navigation', async () => {
    setViewport(1440); render(<App />)
    expect(screen.queryByTestId('global-sidebar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Quant navigation' }))
    const expanded = screen.getByRole('complementary', { name: 'Quant navigation' })
    expect(within(expanded).getByRole('button', { name: /Library/ })).toBeInTheDocument()
    expect(within(expanded).getByRole('button', { name: /Image Analysis/ })).toBeInTheDocument()
    expect(within(expanded).queryByText(/credits|pricing|subscription/i)).not.toBeInTheDocument()
    fireEvent.click(within(expanded).getByRole('button', { name: /Library/ }))
    expect(screen.queryByRole('complementary', { name: 'Quant navigation' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument()
  })

  it('uses compact sidebar and an overlay AI Chat at tablet width', () => {
    setViewport(1024)
    render(<App />)

    expect(screen.getByTestId('compact-sidebar')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-chat')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open AI Chat' }))
    expect(screen.getByTestId('tablet-chat-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('ai-chat')).toBeInTheDocument()
  })

  it('closes the mobile drawer and presents exactly one selected primary view', () => {
    setViewport(390)
    render(<App />)

    expect(screen.getByTestId('mobile-active-view')).toHaveAttribute('data-view', 'chart')
    expect(screen.queryByTestId('ai-chat')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const drawer = screen.getByTestId('navigation-drawer')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Assistant' }))

    expect(screen.queryByTestId('navigation-drawer')).not.toBeInTheDocument()
    expect(screen.getByTestId('mobile-active-view')).toHaveAttribute('data-view', 'ai-chat')
    expect(screen.getByTestId('ai-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument()
  })
})
