import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const email = process.env.PB031_TEST_EMAIL
const password = process.env.PB031_TEST_PASSWORD
if (!email || !password) throw new Error('Ephemeral synthetic credentials are required.')

const targets = await fetch('http://127.0.0.1:9223/json').then(response => response.json())
const page = targets.find(item => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5173/'))
if (!page) throw new Error('The authenticated local Quant browser tab is not available.')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((accept, reject) => { socket.addEventListener('open', accept, { once: true }); socket.addEventListener('error', reject, { once: true }) })
let nextId = 0
const pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data), request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result)
})
const send = (method, params = {}) => new Promise((accept, reject) => { const id = ++nextId; pending.set(id, { resolve: accept, reject }); socket.send(JSON.stringify({ id, method, params })) })
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text)
  return response.result.value
}
const waitFor = async expression => {
  for (let attempt = 0; attempt < 100; attempt += 1) { if (await evaluate(expression)) return; await new Promise(done => setTimeout(done, 100)) }
  throw new Error(`Timed out waiting for ${expression}`)
}
const click = label => evaluate(`(() => { const node = [...document.querySelectorAll('button,summary')].find(item => item.getAttribute('aria-label') === ${JSON.stringify(label)} || item.textContent.trim() === ${JSON.stringify(label)}); if (!node) return false; node.click(); return true })()`)

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' })
await waitFor("document.readyState === 'complete'")
await waitFor("document.querySelector('input[type=email]') !== null || document.querySelector('[data-layout]') !== null")
if (await evaluate("document.querySelector('input[type=email]') !== null")) {
  await evaluate(`(async () => {
    const registrationToken = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(response => response.json())
    const registration = await fetch('/api/auth/register', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', [registrationToken.headerName]: registrationToken.token },
      body: JSON.stringify({ email: ${JSON.stringify(email)}, displayName: 'PB031 Visual QA', password: ${JSON.stringify(password)} })
    })
    if (!registration.ok && registration.status !== 409) throw new Error('Synthetic registration failed: ' + registration.status)
    const token = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(response => response.json())
    const login = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', [token.headerName]: token.token },
      body: new URLSearchParams({ email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)} })
    })
    if (!login.ok) throw new Error('Synthetic login failed: ' + login.status)
    location.reload()
  })()`)
}
await waitFor("document.querySelector('[data-layout]') !== null")
await evaluate(`(async () => {
  const current = await fetch('/api/datasets?limit=20', { credentials: 'same-origin' }).then(response => response.json())
  if (current.items?.length) return
  const rows = ['timestamp,open,high,low,close,volume']
  let price = 100
  for (let index = 0; index < 100; index += 1) {
    const open = price, close = open + Math.sin(index / 5) * 1.4 + (index % 3 - 1) * .35
    rows.push([new Date(Date.UTC(2026, 7, 1, index)).toISOString().replace('.000Z', 'Z'), open.toFixed(2), (Math.max(open, close) + .6).toFixed(2), (Math.min(open, close) - .55).toFixed(2), close.toFixed(2), String(200 + index)].join(','))
    price = close
  }
  const account = await fetch('/api/auth/me', { credentials: 'same-origin' }).then(response => response.json())
  const token = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(response => response.json())
  const imported = await fetch('/api/datasets/import', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Workspace-User': account.id, [token.headerName]: token.token },
    body: JSON.stringify({ requestId: crypto.randomUUID(), name: 'PB-031 Visual Data', symbol: 'QUANT_TEST', timeframe: '1h', sourceKind: 'SYNTHETIC', sourceLabel: 'Deterministic responsive review only', csv: rows.join('\\n') })
  })
  if (!imported.ok) throw new Error('Synthetic dataset import failed: ' + imported.status)
  location.reload()
})()`)
await waitFor("document.querySelector('[data-layout]') !== null && document.body.innerText.includes('PB-031 Visual Data')")
await waitFor("document.querySelector('[data-testid=chart-view]') !== null")

const outputDirectory = resolve('specs/PB-031/test-evidence')
await mkdir(outputDirectory, { recursive: true })
const results = []
const capture = async (name, width, height) => {
  await new Promise(done => setTimeout(done, 180))
  const metrics = await evaluate(`({
    layout: document.querySelector('[data-layout]')?.dataset.layout,
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.documentElement.clientWidth,
    qRailButtons: document.querySelectorAll('[data-testid$=sidebar] > button').length,
    chartToolbarWidth: Math.round(document.querySelector('[data-testid=chart-toolbar]')?.getBoundingClientRect().width || 0),
    chartTools: document.querySelectorAll('[aria-label="Chart tools"] button').length,
    nestedOverflow: [...document.querySelectorAll('*')].filter(node => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1).slice(0, 8).map(node => ({ tag: node.tagName, label: node.getAttribute('aria-label'), test: node.getAttribute('data-testid'), classes: node.className?.toString().slice(0, 100) }))
  })`)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  await writeFile(resolve(outputDirectory, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
  results.push({ name, width, height, ...metrics })
}

await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await capture('refinement-desktop-1920', 1920, 1080)
if (!await click('Workspace')) throw new Error('Q navigation trigger is missing')
await waitFor(`document.querySelector('[aria-label="Expanded navigation"]') !== null`)
await capture('refinement-desktop-drawer', 1920, 1080)
if (!await click('Close navigation panel')) throw new Error('Navigation close control is missing')

if (!await click('Indicators')) throw new Error('Indicator control is missing')
if (!await click('+ sma')) throw new Error('SMA control is missing')
if (!await click('Indicators')) throw new Error('Indicator menu did not close')
await waitFor(`document.querySelector('[aria-label="Active indicators"]') !== null`)
await evaluate("document.querySelector('[role=img]')?.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))")
await waitFor("document.querySelector('[role=img]')?.getAttribute('aria-label')?.includes('of 100 loaded')")
await capture('refinement-desktop-indicator-zoom', 1920, 1080)

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
if (!await click('Chart settings')) throw new Error('Chart settings control is missing')
await waitFor(`document.querySelector('[aria-label="Chart timezone"]') !== null`)
await capture('refinement-desktop-settings', 1440, 900)
if (!await click('Close chart settings')) throw new Error('Chart settings close control is missing')
if (!await click('Chart capture and export')) throw new Error('Capture control is missing')
await waitFor("document.body.innerText.includes('Download PNG') && document.body.innerText.includes('Send to chat')")
await capture('refinement-desktop-export', 1440, 900)

await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
await evaluate("document.querySelector('details[open]')?.removeAttribute('open')")
await capture('refinement-tablet-1024', 1024, 768)

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await capture('refinement-mobile-390', 390, 844)

if (results.some(result => result.overflow)) throw new Error('Horizontal overflow detected: ' + JSON.stringify(results))
if (results.filter(result => result.layout !== 'mobile').some(result => result.qRailButtons !== 1)) throw new Error('The Q rail contains duplicated permanent controls: ' + JSON.stringify(results))
socket.close()
console.log(JSON.stringify(results, null, 2))
