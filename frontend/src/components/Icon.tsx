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
}

export function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.info} />
    </svg>
  )
}
