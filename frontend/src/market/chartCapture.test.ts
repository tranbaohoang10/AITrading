import { beforeEach, expect, it, vi } from 'vitest'
import { onChartCapture, sendChartCaptureToAssistant, type ChartCaptureRequest } from './chartCapture'

const request: ChartCaptureRequest = {
  blob: new Blob(['synthetic-png'], { type: 'image/png' }), prompt: 'Explain this area.', region: { x: 10, y: 20, width: 80, height: 60 },
  context: { symbol: 'BTC-USD', provider: 'COINBASE', timeframe: '1m', visibleTimeRange: { from: '2026-09-04T00:00:00Z', to: '2026-09-04T01:00:00Z' }, capturedTimeRange: { from: '2026-09-04T00:20:00Z', to: '2026-09-04T00:40:00Z' }, approximateCapturedPriceRange: { lower: 80000, upper: 81000 }, currentPrice: 80500, selectedDrawingIds: ['drawing-1'] },
}

beforeEach(() => { window.dispatchEvent(new Event('quant-test-cleanup')) })

it('routes one transient capture to the current Assistant listener and resolves', async () => {
  const received: ChartCaptureRequest[] = []
  const stop = onChartCapture(async value => { received.push(value) })
  await sendChartCaptureToAssistant(request)
  stop()
  expect(received).toEqual([request])
})

it('does not fabricate success when no Assistant listener exists', async () => {
  await expect(sendChartCaptureToAssistant(request)).rejects.toThrow('Assistant is not available')
})

it('listener failures propagate without clearing the caller contract', async () => {
  const failure = vi.fn(async () => { throw new Error('AI provider unavailable') })
  const stop = onChartCapture(failure)
  await expect(sendChartCaptureToAssistant(request)).rejects.toThrow('AI provider unavailable')
  stop()
  expect(failure).toHaveBeenCalledOnce()
})
