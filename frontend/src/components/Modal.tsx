import { useEffect, useRef, type ReactNode } from 'react'

/** Native modality supplies inert background, Escape handling and focus containment. */
export function Modal({ open, label, onClose, children, testId }: {
  open: boolean; label: string; onClose: () => void; children: ReactNode; testId?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    return () => { dialog.close(); trigger?.focus() }
  }, [open])

  return <dialog ref={ref} aria-label={label} data-testid={open ? testId : undefined}
    className="app-modal" onCancel={(event) => { event.preventDefault(); close.current() }}
    onKeyDown={(event) => {
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]'))
          .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0)
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) close.current() }}>
    {open && children}
  </dialog>
}
