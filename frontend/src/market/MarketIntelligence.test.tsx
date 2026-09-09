import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthContext } from '../auth/AuthContext'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketIntelligenceWorkspace } from './MarketIntelligenceWorkspace'
import * as api from './marketIntelligenceApi'

vi.mock('./marketIntelligenceApi', () => ({ getStatus: vi.fn(), getNews: vi.fn(), getCalendar: vi.fn() }))
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic@example.test', displayName: 'Synthetic' }
const status: api.IntelligenceStatus = {
  news: { provider: 'MARKETAUX', configured: false, status: 'NOT_CONFIGURED', limitation: 'Requires server-side MARKET_NEWS_API_KEY' },
  calendar: { provider: 'TRADING_ECONOMICS', configured: false, status: 'NOT_CONFIGURED', limitation: 'Requires server-side MARKET_CALENDAR_API_KEY' },
}
const view = () => <AuthContext.Provider value={{ user, clear: vi.fn(), update: vi.fn() }}><MarketIntelligenceWorkspace /></AuthContext.Provider>

describe('Market Intelligence workspace', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.getStatus).mockResolvedValue(status); vi.mocked(api.getNews).mockRejectedValue(new Error('This provider is not configured. No market intelligence data is being invented.')); vi.mocked(api.getCalendar).mockRejectedValue(new Error('This provider is not configured. No market intelligence data is being invented.')) })

  it('shows provider status and does not invent news when unconfigured', async () => {
    render(view())
    await screen.findByText('Requires server-side MARKET_NEWS_API_KEY')
    expect(screen.getByText(/No placeholder events are shown/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load news' }))
    await screen.findByRole('alert')
    expect(screen.getByText(/provider is not configured/i)).toBeInTheDocument()
    expect(api.getNews).toHaveBeenCalledWith(user.id, 'EUR USD', 'UTC')
  })

  it('switches to calendar with bounded date and timezone controls', async () => {
    render(view())
    await waitFor(() => expect(api.getStatus).toHaveBeenCalledWith(user.id))
    fireEvent.click(screen.getByRole('tab', { name: 'Economic Calendar' }))
    expect(screen.getByRole('tabpanel', { name: 'Economic Calendar' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Display timezone'), { target: { value: 'Asia/Ho_Chi_Minh' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load calendar' }))
    await screen.findByRole('alert')
    expect(api.getCalendar).toHaveBeenCalledWith(user.id, expect.any(String), expect.any(String), 'Asia/Ho_Chi_Minh')
  })
})
