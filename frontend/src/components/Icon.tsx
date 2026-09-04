type IconProps = {
  name: string
  className?: string
}

const paths: Record<string, string> = {
  workspace: 'M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z',
  spark: 'm12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z',
  chart: 'M4 18V9m5 9V5m5 13v-7m5 7V7',
  code: 'm9 7-5 5 5 5m6-10 5 5-5 5',
  journal: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3h2m-20 0h2m8-10v2m0 16v2m7-17-1.5 1.5M6.5 17.5 5 19m14 0-1.5-1.5M6.5 6.5 5 5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'm6 6 12 12M18 6 6 18',
  chat: 'M5 5h14v11H9l-4 3V5Z',
  paperclip: 'm8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8',
  play: 'm9 7 8 5-8 5V7Z',
  copy: 'M9 9h10v11H9zM5 15H4V4h10v1',
  chevron: 'm8 10 4 4 4-4',
  info: 'M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0 0h5M3 8V3m9 4v5l3 2',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  send: 'm4 4 16 8-16 8 3-8-3-8Zm3 8h13',
  image: 'M4 5h16v14H4zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-4 7 5-5 3 3 2-2 6 6',
  cursor: 'm5 3 14 8-6 2-2 6L5 3Z',
  trend: 'M4 18 10 8l4 5 6-9M4 18h4',
  ray: 'M4 18 11 10m0 0 9-6m-9 6h.01M4 18h.01',
  horizontal: 'M4 12h16M7 8v8M17 8v8',
  vertical: 'M12 4v16M8 7h8M8 17h8',
  rectangle: 'M5 6h14v12H5z',
  arrow: 'M5 18 18 5m-6 0h6v6',
  channel: 'M4 16 16 4M8 20 20 8',
  fib: 'M4 19 20 5M5 7h14M5 12h14M5 17h14',
  pattern: 'M4 17 8 8l4 6 4-10 4 13M4 20h16',
  shapes: 'M5 6h8v8H5zM15 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  magnet: 'M6 4v9a6 6 0 0 0 12 0V4h-4v9a2 2 0 0 1-4 0V4H6Zm0 4h4m4 0h4',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6Z',
  unlock: 'M8 11V8a4 4 0 0 1 7.5-2M6 11h12v9H6Z',
  brush: 'm5 19 3-1 10-10-3-3L5 15v4Zm9-13 2-2 3 3-2 2',
  text: 'M5 6V4h14v2M12 4v16m-4 0h8',
  ruler: 'm5 19 14-14M8 16l-2-2m5-1-2-2m5-1-2-2m5-1-2-2',
  zoom: 'm21 21-4.4-4.4M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm0-11v7m-3.5-3.5h7',
  camera: 'M4 7h3l1.5-2h7L17 7h3v12H4V7Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  download: 'M12 4v11m-4-4 4 4 4-4M5 20h14',
  upload: 'M12 20V9m-4 4 4-4 4 4M5 4h14',
  microphone: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0m-7 7v3m-3 0h6',
  refresh: 'M20 7v5h-5M4 17v-5h5m9.5-3A7 7 0 0 0 6 7m-.5 8A7 7 0 0 0 18 17',
  pine: 'M8 4h8l3 3v13H8zM16 4v4h4M11 12h5m-5 4h5',
  terminal: 'm5 8 4 4-4 4m6 0h8M4 4h16v16H4z',
  performance: 'M4 18V6m0 12h16M7 14l3-4 3 2 5-6',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  layout: 'M4 5h16v14H4zM12 5v14',
  candle: 'M7 3v4m0 10v4M4 7h6v10H4zM17 3v7m0 8v3m-3-11h6v8h-6z',
  indicator: 'M4 16c3-8 5 4 8-4s4-7 8-2',
  undo: 'M9 7 4 12l5 5m-5-5h9a6 6 0 0 1 6 6',
  redo: 'm15 7 5 5-5 5m5-5h-9a6 6 0 0 0-6 6',
  trash: 'M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5',
  eye: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'm4 4 16 16M9.5 6.4A9.8 9.8 0 0 1 12 6c5.5 0 9 6 9 6a14 14 0 0 1-2.1 2.8M6.2 6.2C4.2 7.8 3 12 3 12s3.5 6 9 6c1 0 1.9-.2 2.7-.5',
  reset: 'M4 8V4m0 0h4M4 4l4 4a7 7 0 1 1-1 9',
  chevronRight: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 18-6-6 6-6',
  logout: 'M10 5H5v14h5m4-4 4-3-4-3m4 3H9',
}

export function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.info} />
    </svg>
  )
}
