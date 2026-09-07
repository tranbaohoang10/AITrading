import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { ReplayWorkspace } from './ReplayWorkspace'

const ReplayContext = createContext<(() => void) | null>(null)
export const useOpenReplay = () => useContext(ReplayContext)

function OwnerReplay({ account, children }: { account: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [closeBlocked, setCloseBlocked] = useState(false)
  const close = () => { if (!closeBlocked) setOpen(false) }
  return <ReplayContext.Provider value={() => setOpen(true)}>{children}<Modal open={open} label="Historical Replay Trading" onClose={close}><div className="h-full w-full"><ReplayWorkspace account={account} onClose={close} onCloseBlocked={setCloseBlocked}/></div></Modal></ReplayContext.Provider>
}
/** Above responsive shell branches so resize cannot discard an in-flight command or draft. */
export function ReplayHost({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return auth ? <OwnerReplay key={auth.user.id} account={auth.user.id}>{children}</OwnerReplay> : children
}
