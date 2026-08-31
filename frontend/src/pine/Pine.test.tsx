import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthContext } from '../auth/AuthContext'
import { ApiError, currentUser } from '../auth/api'
import { StrategyContext } from '../strategy/StrategyContext'
import type { StrategyContextValue } from '../strategy/StrategyContext'
import { PineWorkspace } from './PineWorkspace'
import { exportPine } from './api'
import { account, source, artifact } from './fixtures'
import type { Revision } from '../strategy/api'

vi.mock('./api', () => ({ exportPine: vi.fn() }))
vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), currentUser: vi.fn() }))
const clear = vi.fn()
const user = { id: account, email: 'pine@example.test', displayName: 'Synthetic' }
function view(selected: Revision | null = source, dirty = false, id = account) {
  return <AuthContext.Provider value={{ user: { ...user, id }, clear, update: vi.fn() }}><StrategyContext.Provider value={{ selected, dirty } as StrategyContextValue}><PineWorkspace /></StrategyContext.Provider></AuthContext.Provider>
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue(user); vi.mocked(exportPine).mockResolvedValue(artifact) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('shows real saved provenance, inert code and explicit dirty/runtime warnings without altering draft', async () => {
  render(view(source, true))
  expect(await screen.findByLabelText('Generated Pine source')).toHaveTextContent('<script>alert(1)</script>')
  expect(document.querySelector('script')).toBeNull()
  expect(screen.getByRole('note')).toHaveTextContent('Unsaved edits are excluded')
  expect(screen.getByText(/Official compiler\/runtime validation is pending/)).toBeInTheDocument()
  expect(exportPine).toHaveBeenCalledWith(source, account, false)
  expect(currentUser).toHaveBeenCalledWith(account)
  fireEvent.click(screen.getByText('Export provenance and limitations'))
  expect(screen.getByText(/Code SHA256:/)).toHaveTextContent(artifact.codeHash)
})
it('does not request or substitute mock code for empty selection and DRAFT', () => {
  const page = render(view(null));expect(screen.getByText(/Select a saved strategy/)).toBeInTheDocument()
  page.rerender(view({ ...source, status: 'DRAFT' }));expect(screen.getByText(/is DRAFT/)).toBeInTheDocument()
  expect(exportPine).not.toHaveBeenCalled()
})
it('generates a missing artifact and retries only the same saved version after uncertain failure', async () => {
  vi.mocked(exportPine).mockRejectedValueOnce(new ApiError(404)).mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce(artifact)
  render(view())
  expect(await screen.findByText(/No saved export is available/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Generate saved revision' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted')
  fireEvent.click(screen.getByRole('button', { name: 'Generate saved revision' }))
  expect(await screen.findByLabelText('Generated Pine source')).toBeInTheDocument()
  expect(vi.mocked(exportPine).mock.calls).toEqual([[source, account, false], [source, account, true], [source, account, true]])
})
it('discards a late response on revision change and never clears the new session from an old failure', async () => {
  let reject!: (error: unknown) => void
  vi.mocked(exportPine).mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
  const page = render(view()), changed = { ...source, revision: 3, hash: 'c'.repeat(64) }
  vi.mocked(exportPine).mockResolvedValueOnce({ ...artifact, revision: 3, dslHash: changed.hash, code: 'New revision only' })
  page.rerender(view(changed))
  expect(await screen.findByLabelText('Generated Pine source')).toHaveTextContent('New revision only')
  await act(async () => reject(new ApiError(401)))
  expect(clear).not.toHaveBeenCalled();expect(screen.getByLabelText('Generated Pine source')).toHaveTextContent('New revision only')
})
it('clears stale-account responses only for the still mounted workspace and hides prior account source', async () => {
  const page = render(view());await screen.findByLabelText('Generated Pine source')
  let resolve!: (v: typeof artifact) => void
  vi.mocked(exportPine).mockReturnValueOnce(new Promise(done => { resolve = done }))
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  page.rerender(view(source, false, other))
  expect(screen.queryByLabelText('Generated Pine source')).not.toBeInTheDocument()
  await act(async () => resolve(artifact))
  await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
  expect(screen.queryByLabelText('Generated Pine source')).not.toBeInTheDocument()
})
it('handles clipboard rejection without losing source and downloads inert text with bounded ASCII filename', async () => {
  const copy = vi.fn().mockRejectedValue(new Error('denied'))
  const testNavigator = Object.create(navigator)
  Object.defineProperty(testNavigator, 'clipboard', { value: { writeText: copy } })
  vi.stubGlobal('navigator', testNavigator)
  const create = vi.fn().mockReturnValue('blob:synthetic-fixture'), revoke = vi.fn()
  class FixtureURL extends URL { static createObjectURL = create; static revokeObjectURL = revoke }
  vi.stubGlobal('URL', FixtureURL)
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toMatch(/^strategy-[a-f0-9-]+-r2-[a-f0-9]{12}\.pine$/) })
  render(view());await screen.findByLabelText('Generated Pine source')
  fireEvent.click(screen.getByRole('button', { name: 'Copy Pine source' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Clipboard unavailable')
  expect(screen.getByLabelText('Generated Pine source')).toBeInTheDocument();expect(copy).toHaveBeenCalledWith(artifact.code)
  fireEvent.click(screen.getByRole('button', { name: 'Download .pine' }))
  expect(create).toHaveBeenCalledOnce();expect(revoke).toHaveBeenCalledWith('blob:synthetic-fixture');expect(click).toHaveBeenCalledOnce()
  click.mockRestore()
})
