import { useEffect, useState } from 'react'
import type { ViewportMode } from '../types'

function getViewportMode(): ViewportMode {
  if (window.innerWidth < 768) return 'mobile'
  if (window.innerWidth < 1200) return 'tablet'
  return 'desktop'
}

export function useViewportMode() {
  const [mode, setMode] = useState<ViewportMode>(getViewportMode)

  useEffect(() => {
    const updateMode = () => setMode(getViewportMode())
    window.addEventListener('resize', updateMode)
    return () => window.removeEventListener('resize', updateMode)
  }, [])

  return mode
}
