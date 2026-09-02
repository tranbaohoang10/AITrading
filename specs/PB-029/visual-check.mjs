import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const email = process.env.PHASE1_TEST_EMAIL
const password = process.env.PHASE1_TEST_PASSWORD
if (!email || !password) throw new Error('Synthetic test credentials are required in the process environment.')

const pages = await fetch('http://127.0.0.1:9223/json').then(response => response.json())
const page = pages.find(item => item.type === 'page')
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
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

const waitFor = async expression => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(expression)) return
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error(`Timed out waiting for ${expression}`)
}

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

const outputDirectory = resolve('specs/PB-029/test-evidence')
await mkdir(outputDirectory, { recursive: true })
const results = []

for (const viewport of [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768, openTabletChat: true },
  { name: 'mobile-390', width: 390, height: 844, openMobileChat: true },
]) {
  await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 640 })
  await new Promise(resolveWait => setTimeout(resolveWait, 350))
  if (viewport.openTabletChat) {
    await evaluate("[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Open AI Chat')?.click()")
    await waitFor("document.querySelector('[data-testid=tablet-chat-drawer]') !== null")
  }
  if (viewport.openMobileChat) {
    await evaluate("[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Open navigation')?.click()")
    await waitFor("document.querySelector('[data-testid=navigation-drawer]') !== null")
    await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Assistant')?.click()")
    await waitFor("document.querySelector('[data-view=ai-chat]') !== null")
  }
  const metrics = await evaluate(`({
    layout: document.querySelector('[data-layout]')?.dataset.layout,
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.documentElement.clientWidth
  })`)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  await writeFile(resolve(outputDirectory, `${viewport.name}.png`), Buffer.from(screenshot.data, 'base64'))
  results.push({ ...viewport, ...metrics })
  if (viewport.openTabletChat) await evaluate("[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Close AI Chat')?.click()")
}

socket.close()
console.log(JSON.stringify(results, null, 2))
