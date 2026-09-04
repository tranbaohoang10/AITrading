export type CaptureRegion = { x: number; y: number; width: number; height: number }
export type ChartCaptureContext = {
  symbol: string
  provider: 'COINBASE' | 'IMPORTED_DATASET'
  timeframe: string
  visibleTimeRange: { from: string; to: string }
  capturedTimeRange: { from: string; to: string }
  approximateCapturedPriceRange: { lower: number; upper: number }
  currentPrice: number
  selectedDrawingIds: string[]
}
export type ChartCaptureRequest = { blob: Blob; prompt: string; context: ChartCaptureContext; region: CaptureRegion; fullChart?: boolean }

const captureEvent = 'quant:chart-capture'

export async function captureSvgRegion(svg: SVGSVGElement, region: CaptureRegion, excludeSelector = '[data-capture-overlay]'): Promise<Blob> {
  const bounds = svg.getBoundingClientRect()
  const viewBox = svg.viewBox.baseVal
  const sourceWidth = viewBox.width || Math.max(1, bounds.width)
  const sourceHeight = viewBox.height || Math.max(1, bounds.height)
  const safe = {
    x: Math.max(0, Math.min(sourceWidth, region.x)),
    y: Math.max(0, Math.min(sourceHeight, region.y)),
    width: Math.max(1, Math.min(sourceWidth - region.x, region.width)),
    height: Math.max(1, Math.min(sourceHeight - region.y, region.height)),
  }
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.querySelectorAll(excludeSelector).forEach(node => node.remove())
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('viewBox', `${safe.x} ${safe.y} ${safe.width} ${safe.height}`)
  copy.setAttribute('width', String(safe.width))
  copy.setAttribute('height', String(safe.height))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Chart capture failed.')); image.src = url })
    const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(safe.width * scale)); canvas.height = Math.max(1, Math.round(safe.height * scale))
    const context = canvas.getContext('2d'); if (!context) throw new Error('Chart capture is unavailable in this browser.')
    context.fillStyle = '#08090b'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Chart capture failed.')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

export function sendChartCaptureToAssistant(request: ChartCaptureRequest): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Assistant is unavailable outside the workspace.'))
  return new Promise((resolve, reject) => {
    const detail: { request: ChartCaptureRequest; handled: boolean; resolve: () => void; reject: (error: unknown) => void } = { request, handled: false, resolve, reject }
    window.dispatchEvent(new CustomEvent(captureEvent, { detail }))
    queueMicrotask(() => { if (!detail.handled) reject(new Error('Assistant is not available in this workspace.')) })
  })
}

export function onChartCapture(listener: (request: ChartCaptureRequest) => Promise<void>): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ request: ChartCaptureRequest; handled: boolean; resolve: () => void; reject: (error: unknown) => void }>).detail
    if (!detail || detail.handled) return
    detail.handled = true
    void listener(detail.request).then(detail.resolve, detail.reject)
  }
  window.addEventListener(captureEvent, handler)
  return () => window.removeEventListener(captureEvent, handler)
}
