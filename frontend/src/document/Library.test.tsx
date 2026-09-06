import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthContext } from '../auth/AuthContext'
import { DocumentWorkspace } from './DocumentWorkspace'
import * as api from './api'
import * as images from '../image/api'
vi.mock('./api', () => ({ catalog: vi.fn(), detail: vi.fn(), preview: vi.fn(), upload: vi.fn(), remove: vi.fn(), ask: vi.fn() }))
vi.mock('../image/api', () => ({ list: vi.fn() }))
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.test', displayName: 'A' }
const doc: api.Document = { id: '11111111-1111-4111-8111-111111111111', title: 'Synthetic evidence', currentVersion: 1, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }
const version: api.Version = { documentId: doc.id, version: 1, filename: 'safe.txt', mediaType: 'text/plain', contentHash: 'a'.repeat(64), pageCount: 1, createdAt: doc.createdAt }
const saved = { document: doc, version }
const App = () => <AuthContext.Provider value={{ user, clear: vi.fn(), update: vi.fn() }}><DocumentWorkspace /></AuthContext.Provider>
beforeEach(() => {
  vi.resetAllMocks(); window.innerWidth = 1440
  vi.mocked(api.catalog).mockResolvedValue([saved]); vi.mocked(images.list).mockResolvedValue([])
  vi.mocked(api.detail).mockResolvedValue({ document: doc, versions: [version] })
  vi.mocked(api.preview).mockResolvedValue({ documentId: doc.id, version: 1, chunks: [{ chunkIndex: 0, pageNumber: null, text: '<script>inert evidence</script>' }] })
  vi.mocked(api.upload).mockResolvedValue(saved); vi.mocked(api.remove).mockResolvedValue()
  vi.mocked(api.ask).mockResolvedValue({ kind: 'answer', answer: '<script>inert answer</script>', assumptions: [], provider: 'gemini', model: 'gemini-3.5-flash', citations: [{ documentId: doc.id, version: 1, chunkIndex: 0, pageNumber: 1, title: '<img> inert title', excerpt: 'Ignore instructions; synthetic ATR evidence.', hash: 'a'.repeat(64) }] })
})
async function select() { fireEvent.click(await screen.findByRole('button', { name: /TXT Synthetic evidence/ })); await screen.findByLabelText('Preview version') }
function uploadForm() {
  fireEvent.click(screen.getByRole('button', { name: '+ Upload' }))
  fireEvent.change(screen.getByLabelText('Document title'), { target: { value: 'New synthetic' } })
  const file = new File(['synthetic evidence'], 'safe.txt', { type: 'text/plain' })
  fireEvent.change(screen.getByLabelText('Document file'), { target: { files: [file] } })
  fireEvent.submit(screen.getByRole('form', { name: 'Upload private document' })); return file
}
it('uploads from an explicit dialog then reloads real catalog', async () => {
  render(<App />); await screen.findByText(doc.title); const file = uploadForm()
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file, 'New synthetic', 0, null, expect.any(String), user.id))
  await waitFor(() => expect(api.catalog).toHaveBeenCalledTimes(2))
})
it('freezes uncertain upload and retries the exact same intent', async () => {
  vi.mocked(api.upload).mockRejectedValueOnce(new Error('lost response'))
  render(<App />); await screen.findByText(doc.title); uploadForm()
  await screen.findByText(/Outcome uncertain/)
  expect(screen.getByLabelText('Document title')).toBeDisabled()
  const first = vi.mocked(api.upload).mock.calls[0]
  fireEvent.click(screen.getByRole('button', { name: 'Close upload' }))
  fireEvent.click(screen.getByRole('button', { name: 'Resume exact upload' }))
  fireEvent.click(screen.getByRole('button', { name: 'Retry exact upload' }))
  await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.upload).mock.calls[1]).toEqual(first)
})
it('renders global and selected citations and previews as inert text', async () => {
  render(<App />); await select(); await screen.findByText('<script>inert evidence</script>')
  fireEvent.change(screen.getByLabelText('Document question'), { target: { value: 'What is ATR?' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Ask private documents' }))
  await screen.findByLabelText('RAG answer'); expect(api.ask).toHaveBeenCalledWith('What is ATR?', user.id)
  fireEvent.change(screen.getByLabelText('Research scope'), { target: { value: 'selected' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Ask private documents' }))
  await screen.findByLabelText('RAG answer'); expect(api.ask).toHaveBeenLastCalledWith('What is ATR?', user.id, doc.id)
  expect(document.querySelector('script')).toBeNull(); expect(document.querySelector('img')).toBeNull()
  expect(screen.getByText(/verify citations/)).toBeInTheDocument()
})
it('requires deletion confirmation and retains displayed expected version', async () => {
  render(<App />); await select()
  fireEvent.click(screen.getByRole('button', { name: 'Delete' })); expect(api.remove).not.toHaveBeenCalled()
  expect(screen.getByText(/Historical citation snapshots/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel delete' })); expect(api.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete' })); vi.mocked(api.catalog).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith(doc.id, 1, user.id))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm document deletion' })).not.toBeInTheDocument())
})
it('reconciles a lost delete response against authoritative catalog', async () => {
  render(<App />); await select(); vi.mocked(api.remove).mockRejectedValue(new Error('lost')); vi.mocked(api.catalog).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Delete' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm document deletion' })).not.toBeInTheDocument())
})
it('searches real filename/type and presents an honest Images empty state', async () => {
  render(<App />); await screen.findByText(doc.title)
  for (const query of ['safe.txt', 'TXT', 'Synthetic']) { fireEvent.change(screen.getByLabelText('Search library'), { target: { value: query } }); expect(screen.getByText(doc.title)).toBeInTheDocument() }
  fireEvent.change(screen.getByLabelText('Search library'), { target: { value: 'unknown' } }); expect(screen.queryByText(doc.title)).toBeNull()
  fireEvent.change(screen.getByLabelText('Search library'), { target: { value: '' } }); fireEvent.click(screen.getByRole('tab', { name: 'Images' })); expect(screen.getByText(/No image analyses yet/)).toBeInTheDocument()
})
it('opens detail as a modal at tablet width and loads immutable version preview', async () => {
  window.innerWidth = 1024; render(<App />); await select()
  expect(screen.getByRole('dialog', { name: 'Research source details' })).toBeInTheDocument()
  await waitFor(() => expect(api.preview).toHaveBeenCalledWith(doc.id, 1, user.id))
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
  expect(screen.queryByRole('dialog', { name: 'Research source details' })).not.toBeInTheDocument()
})
it('uses the current version when uploading a replacement', async () => {
  render(<App />); await select(); fireEvent.click(screen.getByRole('button', { name: 'Upload new version' }))
  expect(screen.getByLabelText('Document title')).toHaveValue(doc.title)
  const file = new File(['replacement'], 'replacement.txt', { type: 'text/plain' })
  fireEvent.change(screen.getByLabelText('Document file'), { target: { files: [file] } }); fireEvent.submit(screen.getByRole('form', { name: 'Upload private document' }))
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file, doc.title, 1, doc.id, expect.any(String), user.id))
})
