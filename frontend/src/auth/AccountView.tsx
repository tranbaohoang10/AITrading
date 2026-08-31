import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import { currentUser, mutate } from './api'
import { buttonClass, inputClass } from './AuthForm'

export function AccountView() {
  const auth = useAuth()
  const [name, setName] = useState(auth?.user.displayName ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)

  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to complete the request.') }
    finally { pending.current = false; setBusy(false) }
  }
  const saveName = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await mutate('/auth/profile', { displayName: name }, 'PATCH')
      const profile = await currentUser(); auth?.update(profile); setName(profile.displayName); setNotice('Display name saved.')
    })
  }
  const changePassword = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await mutate('/auth/password', { currentPassword, newPassword })
      setCurrentPassword(''); setNewPassword(''); auth?.clear()
    })
  }

  return <section aria-label="Account" className="h-full overflow-y-auto p-5 text-slate-100 md:p-10">
    <div className="max-w-xl space-y-8">
      <header><h2 className="text-2xl font-semibold">Account</h2><p className="mt-2 break-words text-sm text-slate-400">{auth?.user.email ?? 'Sign in to manage your account.'}</p></header>
      {auth && <>
        <p className="break-words text-slate-300">{auth.user.displayName}</p>
        <form onSubmit={saveName} className="space-y-4" aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Display name<input className={inputClass} value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoComplete="nickname" /></label><button type="submit" className={buttonClass}>Save display name</button></fieldset>
        </form>
        <form onSubmit={changePassword} className="space-y-4 border-t border-slate-800 pt-7" aria-busy={busy}>
          <h3 className="font-semibold">Change password</h3><p className="text-sm leading-6 text-slate-400">All sessions will end. Sign in again with your new password.</p>
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm">Current password<input className={inputClass} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required maxLength={128} autoComplete="current-password" /></label>
            <label className="block text-sm">New password<input className={inputClass} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></label>
            <button type="submit" className={buttonClass}>Change password</button>
          </fieldset>
        </form>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-slate-300">{notice}</p>}
        <button disabled={busy} type="button" className="min-h-11 border-b border-slate-500 text-sm text-slate-300 focus-visible:outline-2 focus-visible:outline-sky-400" onClick={() => void run(async () => { await mutate('/auth/logout'); auth.clear() })}>Sign out</button>
      </>}
    </div>
  </section>
}
