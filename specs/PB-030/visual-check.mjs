import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const email = process.env.PB030_TEST_EMAIL
const password = process.env.PB030_TEST_PASSWORD
if (!email || !password) throw new Error('Synthetic test credentials are required.')

const targets = await fetch('http://127.0.0.1:9223/json').then(response => response.json())
const page = targets.find(item => item.type === 'page')
if (!page) throw new Error('No Chrome page target is available.')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let nextId = 0
const pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  if (message.error) request.reject(new Error(message.error.message))
  else request.resolve(message.result)
})
const send = (method, params = {}) => new Promise((resolveRequest, reject) => {
  const id = ++nextId
  pending.set(id, { resolve: resolveRequest, reject })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text)
  return response.result.value
}
const waitFor = async expression => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(expression)) return
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error(`Timed out waiting for ${expression}`)
}
const click = label => evaluate(`(() => { const item = [...document.querySelectorAll('button,summary')].find(node => node.getAttribute('aria-label') === ${JSON.stringify(label)} || node.textContent.trim() === ${JSON.stringify(label)}); if (!item) return false; item.click(); return true })()`)

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' })
await waitFor("document.readyState === 'complete'")
await waitFor("document.querySelector('input[type=email]') !== null || document.querySelector('[data-layout]') !== null")
if (await evaluate("document.querySelector('input[type=email]') !== null")) {
  await evaluate(`(async () => {
    const token = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(response => response.json())
    const response = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', [token.headerName]: token.token },
      body: new URLSearchParams({ email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)} })
    })
    if (!response.ok) throw new Error('Synthetic browser login failed: ' + response.status)
    location.reload()
  })()`)
}
await waitFor("document.querySelector('[data-layout]') !== null")

await evaluate(`(async () => {
  const current = await fetch('/api/datasets?limit=20', { credentials: 'same-origin' }).then(response => response.json())
  if (current.items?.length) return
  const rows = ['timestamp,open,high,low,close,volume']
  let price = 64200
  for (let index = 0; index < 96; index += 1) {
    const open = price
    const close = open + Math.sin(index / 4) * 110 + (index % 3 - 1) * 38
    const high = Math.max(open, close) + 95 + (index % 5) * 8
    const low = Math.min(open, close) - 90 - (index % 4) * 7
    rows.push([new Date(Date.UTC(2026, 7, 1, index)).toISOString().replace('.000Z', 'Z'), open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2), String(1200 + index * 13)].join(','))
    price = close
  }
  const account = await fetch('/api/auth/me', { credentials: 'same-origin' }).then(response => response.json())
  const token = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(response => response.json())
  const response = await fetch('/api/datasets/import', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Workspace-User': account.id, [token.headerName]: token.token },
    body: JSON.stringify({ requestId: crypto.randomUUID(), name: 'PB-030 Visual Data', symbol: 'BTCUSDT', timeframe: '1h', sourceKind: 'SYNTHETIC', sourceLabel: 'Responsive UI review', csv: rows.join('\\n') })
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))
    throw new Error('Synthetic dataset import failed: ' + response.status + ' ' + (problem.code || 'unknown'))
  }
  location.reload()
})()`)
await waitFor("document.querySelector('[data-layout]') !== null && document.body.innerText.includes('PB-030 Visual Data')")

const outputDirectory = resolve('specs/PB-030/test-evidence')
await mkdir(outputDirectory, { recursive: true })
const results = []
const capture = async (name, width, height) => {
  await new Promise(resolveWait => setTimeout(resolveWait, 250))
  const metrics = await evaluate(`({
    layout: document.querySelector('[data-layout]')?.dataset.layout,
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.documentElement.clientWidth,
    chartTools: !!document.querySelector('[aria-label="Chart tools"]'),
    avatar: !!document.querySelector('[aria-label="Open account"]')
  })`)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  await writeFile(resolve(outputDirectory, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
  results.push({ name, width, height, ...metrics })
}

await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await capture('desktop-1920', 1920, 1080)
if (!await click('New chat')) throw new Error('New chat control is missing')
await waitFor("document.querySelector('[aria-label=\"Conversation menu\"]') !== null")
if (!await click('Conversation history')) throw new Error('Conversation history control is missing')
await waitFor("document.querySelector('[aria-label=\"Conversation history panel\"]') !== null")
if (!await click('Conversation menu')) throw new Error('Conversation actions menu is missing')
await waitFor("document.body.innerText.includes('Rename conversation') && document.body.innerText.includes('Delete conversation')")
await capture('desktop-1920-chat-menu', 1920, 1080)
if (!await click('Delete conversation')) throw new Error('Delete conversation action is missing')
await waitFor("document.body.innerText.includes('Confirm delete')")
if (!await click('Cancel')) throw new Error('Delete confirmation cancel action is missing')
await evaluate('location.reload()')
await waitFor("document.querySelector('[data-layout]') !== null && document.body.innerText.includes('PB-030 Visual Data')")

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
if (!await click('Chart capture and export')) throw new Error('Chart export control is missing')
await waitFor("document.body.innerText.includes('Download PNG') && document.body.innerText.includes('Send to chat')")
await capture('desktop-1440-export', 1440, 900)
if (!await click('Download PNG')) throw new Error('Chart download action is missing')
await waitFor("document.body.innerText.includes('PNG downloaded')")
await click('Chart capture and export')

await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
if (!await click('Open AI Chat')) throw new Error('Tablet assistant control is missing')
await waitFor("document.querySelector('[data-testid=tablet-chat-drawer]') !== null")
await capture('tablet-1024-assistant', 1024, 768)
await click('Close AI Chat')

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await capture('mobile-390-chart', 390, 844)
if (!await click('Open navigation')) throw new Error('Mobile navigation control is missing')
await waitFor("document.querySelector('[data-testid=navigation-drawer]') !== null")
if (!await click('Assistant')) throw new Error('Mobile Assistant route is missing')
await waitFor("document.querySelector('[data-view=ai-chat]') !== null")
await capture('mobile-390-assistant', 390, 844)

if (results.some(result => result.overflow)) throw new Error('Horizontal overflow detected: ' + JSON.stringify(results))
socket.close()
console.log(JSON.stringify(results, null, 2))
