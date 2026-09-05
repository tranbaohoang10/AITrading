#!/usr/bin/env node
/* global console, process, setTimeout */
/**
 * Owns the AITrading Vite process for local development.  It deliberately
 * never selects a fallback port: the API's CSRF/origin contract is 5173.
 */
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(here, '..')
const repoRoot = resolve(frontendRoot, '..')
const port = 5173
const canonicalUrl = `http://127.0.0.1:${port}`
const statePath = join(repoRoot, 'tmp', 'dev', 'frontend.json')
const viteEntry = join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js')

function samePath(left, right) {
  const a = normalize(left).replaceAll('\\', '/').toLowerCase()
  const b = normalize(right).replaceAll('\\', '/').toLowerCase()
  return a === b
}

async function readState() {
  try {
    const value = JSON.parse(await readFile(statePath, 'utf8'))
    if (typeof value?.pid !== 'number' || value.port !== port || typeof value.repoRoot !== 'string') return null
    return value
  } catch { return null }
}

async function writeState(pid) {
  await mkdir(dirname(statePath), { recursive: true })
  const temporary = `${statePath}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify({ pid, port, repoRoot, startedAt: new Date().toISOString() }) + '\n', 'utf8')
  await rename(temporary, statePath)
}

async function removeState(expectedPid) {
  const state = await readState()
  if (!state || expectedPid === undefined || state.pid === expectedPid) await rm(statePath, { force: true })
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

async function processCommand(pid) {
  try {
    if (process.platform === 'win32') {
      const result = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}" | Select-Object -ExpandProperty CommandLine`], { timeout: 5000 })
      return result.stdout.trim()
    }
    const result = await exec('ps', ['-p', String(pid), '-o', 'command='], { timeout: 5000 })
    return result.stdout.trim()
  } catch { return '' }
}

function commandBelongsToRepo(command) {
  return command.toLowerCase().includes(repoRoot.replaceAll('\\', '/').toLowerCase())
    || command.toLowerCase().includes(repoRoot.toLowerCase())
}

async function frontendOwnership(pid) {
  if (!Number.isInteger(pid) || pid < 1 || !processAlive(pid)) return { owned: false, command: '' }
  const command = await processCommand(pid)
  return { owned: commandBelongsToRepo(command) && /vite/i.test(command), command }
}

async function listenerPid() {
  if (process.platform === 'win32') {
    try {
      const result = await exec('netstat.exe', ['-ano', '-p', 'tcp'], { timeout: 5000 })
      const line = result.stdout.split(/\r?\n/).find(value => new RegExp(`^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i').test(value))
      const match = line?.match(/\s(\d+)\s*$/)
      return match ? Number(match[1]) : null
    } catch { return null }
  }
  try {
    const result = await exec('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { timeout: 5000 })
    const pid = Number(result.stdout.trim().split(/\s+/)[0])
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch { return null }
}

async function portIsFree() {
  return await new Promise(resolveFree => {
    const probe = net.createServer()
    probe.once('error', () => resolveFree(false))
    probe.listen({ host: '127.0.0.1', port }, () => probe.close(() => resolveFree(true)))
  })
}

function commandLabel(command) { return command || 'unknown process command' }

async function existingFrontend() {
  const state = await readState()
  if (state && !samePath(state.repoRoot, repoRoot)) return { kind: 'unsafe-state', state }
  if (state && !processAlive(state.pid)) await removeState(state.pid)
  const pid = await listenerPid()
  if (pid === null && await portIsFree()) return null
  const resolvedPid = pid ?? state?.pid
  if (!resolvedPid) return { kind: 'occupied', pid: 'unknown', command: '' }
  const ownership = await frontendOwnership(resolvedPid)
  return ownership.owned ? { kind: 'owned', pid: resolvedPid, command: ownership.command } : { kind: 'occupied', pid: resolvedPid, command: ownership.command }
}

async function waitForExit(pid) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!processAlive(pid)) return true
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250))
  }
  return false
}

async function terminateOwned(pid) {
  const ownership = await frontendOwnership(pid)
  if (!ownership.owned) throw new Error(`Refusing to stop PID ${pid}: ownership could not be verified.`)
  // The PID and repository command were verified above. /T keeps termination
  // scoped to this Vite process tree; /F is required for Windows child workers.
  if (process.platform === 'win32') await exec('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { timeout: 10000 })
  else process.kill(pid, 'SIGTERM')
  if (!await waitForExit(pid)) throw new Error(`AITrading frontend PID ${pid} did not stop within 10 seconds.`)
  await removeState(pid)
  console.log(`Stopped AITrading frontend PID ${pid}.`)
}

async function stop() {
  const state = await readState()
  if (state && !samePath(state.repoRoot, repoRoot)) throw new Error('Refusing to use frontend state created by a different repository.')
  if (state && !processAlive(state.pid)) await removeState(state.pid)
  const existing = await existingFrontend()
  if (!existing) { console.log('AITrading frontend is not running from this repository.'); return 0 }
  if (existing.kind !== 'owned') throw new Error('Refusing to stop port ' + port + ': ownership could not be verified.')
  await terminateOwned(existing.pid)
  return 0
}

async function status() {
  const existing = await existingFrontend()
  if (!existing) { console.log(`Frontend: STOPPED\n${canonicalUrl}`); return 0 }
  if (existing.kind === 'owned') {
    console.log(`Frontend: RUNNING\n${canonicalUrl}\nPID: ${existing.pid}\nOwned by AITrading: yes`)
    return 0
  }
  if (existing.kind === 'unsafe-state') {
    console.log('Frontend: state belongs to another repository; no process will be touched.')
    return 2
  }
  console.log(`Frontend: RUNNING\n${canonicalUrl}\nPID: ${existing.pid}\nOwned by AITrading: no\nProcess: ${commandLabel(existing.command)}`)
  return 2
}

async function start() {
  if (!existsSync(viteEntry)) throw new Error('Vite is not installed. Run npm ci in frontend first.')
  const existing = await existingFrontend()
  if (existing?.kind === 'owned') {
    console.log(`AITrading frontend is already running\n${canonicalUrl}\nPID: ${existing.pid}`)
    return 0
  }
  if (existing?.kind === 'unsafe-state') throw new Error('Frontend state belongs to another repository; refusing to overwrite it.')
  if (existing?.kind === 'occupied') {
    throw new Error(`Port ${port} is occupied by PID ${existing.pid}\nProcess: ${commandLabel(existing.command)}\nStop that process or choose an explicit developer action.`)
  }
  const { spawn } = await import('node:child_process')
  const child = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: frontendRoot, stdio: 'inherit', windowsHide: true,
  })
  await writeState(child.pid)
  let stopping = false
  const requestStop = () => {
    if (stopping) return
    stopping = true
    console.log('Stopping AITrading frontend...')
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  process.on('SIGINT', requestStop)
  process.on('SIGTERM', requestStop)
  return await new Promise(resolveCode => child.once('exit', async code => {
    await removeState(child.pid)
    resolveCode(code ?? 1)
  }))
}

async function main() {
  const action = process.argv[2] ?? 'start'
  if (action === 'start') return start()
  if (action === 'stop') return stop()
  if (action === 'status') return status()
  if (action === 'restart') { await stop(); return start() }
  throw new Error(`Unknown command: ${action}`)
}

main().then(code => { process.exitCode = code }).catch(error => { console.error(error.message); process.exitCode = 2 })
