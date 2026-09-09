import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
const snapshot = () => Math.floor(Date.now() / 1000) * 1000

function schedule() {
  timer = setTimeout(() => {
    listeners.forEach(listener => listener())
    if (listeners.size) schedule()
  }, 1000 - Date.now() % 1000)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) schedule()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) { clearTimeout(timer); timer = undefined }
  }
}

export function useChartClock() {
  return new Date(useSyncExternalStore(subscribe, snapshot, snapshot))
}
