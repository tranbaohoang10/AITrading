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

    expect(screen.getByTestId('global-sidebar')).toHaveClass('w-[68px]')
    expect(screen.getByTestId('ai-chat')).toBeInTheDocument()
    expect(screen.getByTestId('trading-workspace')).toBeInTheDocument()
    expect(screen.getByRole('separator', { name: 'Resize AI Chat' })).toHaveAttribute('aria-valuenow', '360')
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
    fireEvent.click(within(drawer).getByRole('button', { name: 'AI Chat' }))

    expect(screen.queryByTestId('navigation-drawer')).not.toBeInTheDocument()
    expect(screen.getByTestId('mobile-active-view')).toHaveAttribute('data-view', 'ai-chat')
    expect(screen.getByTestId('ai-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument()
  })
})
