import { useRef, useState, type FormEvent } from 'react'
import { brand } from '../brand'
import { mutate } from './api'

export const inputClass = 'mt-2 min-h-11 w-full rounded-sm border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60'
export const buttonClass = 'min-h-11 rounded-sm bg-slate-100 px-5 text-sm font-semibold text-slate-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50'

export function AuthForm({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try {
      if (register) {
        await mutate('/auth/register', { email, displayName: name, password })
        setPassword(''); setRegister(false)
        setNotice('Registration received. Sign in with your credentials. If you already have an account, use its existing password.')
      } else {
        await mutate('/auth/login', { email, password }, 'POST', true)
        setPassword('')
        await onSignedIn()
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to complete the request.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-10 text-slate-100">
    <section className="w-full max-w-md" aria-label="Account access">
      <div className="mb-10 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-sm bg-slate-200 text-sm font-bold text-slate-950">{brand.initials}</span><span className="font-semibold tracking-wide">{brand.name}</span></div>
      <p className="text-xs uppercase tracking-widest text-slate-500">Private research workspace</p>
      <h1 className="mt-3 text-3xl font-semibold">{register ? 'Create an account' : 'Sign in'}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">Keep your strategies, research and trading notes in your own workspace.</p>
      <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-5">
          {register && <label className="block text-sm">Display name<input className={inputClass} value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoComplete="nickname" /></label>}
          <label className="block text-sm">Email<input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="username" spellCheck={false} autoCapitalize="none" /></label>
          <label className="block text-sm">Password<input className={inputClass} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={register ? 12 : 1} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} aria-describedby={register ? 'password-help' : undefined} /></label>
          {register && <p id="password-help" className="text-xs text-slate-400">Use 12–128 characters. Spaces are preserved. Email is a login identifier; this prototype does not verify mailbox ownership.</p>}
          <button className={`${buttonClass} w-full`} type="submit">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm leading-6 text-slate-300">{notice}</p>}
      </form>
      <button disabled={busy} type="button" className="mt-6 min-h-11 text-sm text-slate-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-400" onClick={() => { setRegister(!register); setPassword(''); setError(''); setNotice('') }}>{register ? 'Back to sign in' : 'Create a new account'}</button>
      <p className="mt-10 border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">Prototype research tool. Historical results do not guarantee future returns. Do not reuse a password from another service.</p>
    </section>
  </main>
}
