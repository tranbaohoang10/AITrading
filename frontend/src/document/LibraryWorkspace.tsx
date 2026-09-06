import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { ApiError } from '../auth/api'
import * as imagesApi from '../image/api'
import * as api from './api'
import './library.css'

export function DocumentWorkspace() {
  const auth = useAuth()
  return <LibraryWorkspace key={auth?.user.id} account={auth?.user.id} />
}
type Intent = { file: File; title: string; expected: number; target: string | null; requestId: string }
function LibraryWorkspace({ account }: { account?: string }) {
  const [catalog, setCatalog] = useState<api.Saved[]>([]), [images, setImages] = useState<imagesApi.Saved[]>([])
  const [tab, setTab] = useState('All'), [filter, setFilter] = useState('All types'), [search, setSearch] = useState('')
  const [selected, setSelected] = useState(''), [detail, setDetail] = useState<api.Detail | null>(null)
  const [version, setVersion] = useState(0), [preview, setPreview] = useState<api.Preview | null>(null)
  const [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false), [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState(''), [detailError, setDetailError] = useState(''), [imageError, setImageError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false), [target, setTarget] = useState(''), [title, setTitle] = useState(''), [file, setFile] = useState<File | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null), [uploadError, setUploadError] = useState(''), [uploadBusy, setUploadBusy] = useState(false)
  const [deleting, setDeleting] = useState<api.Document | null>(null), [deleteBusy, setDeleteBusy] = useState(false), [deleteError, setDeleteError] = useState('')
  const [drawer, setDrawer] = useState(false), [compact, setCompact] = useState(() => window.innerWidth < 1200)
  const [scope, setScope] = useState('all'), [question, setQuestion] = useState(''), [answer, setAnswer] = useState<api.Answer | null>(null), [askBusy, setAskBusy] = useState(false), [askError, setAskError] = useState('')
  const alive = useRef(true), askEpoch = useRef(0), listEpoch = useRef(0)
  const current = catalog.find(item => item.document.id === selected), selectedImage = images.find(item => item.id === selected)
  useEffect(() => {
    if (!intent) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [intent])
  async function reload() {
    const epoch = ++listEpoch.current
    setLoading(true); setError('')
    try { const values = await api.catalog(account); if (alive.current && epoch === listEpoch.current) setCatalog(values); return values }
    catch { if (alive.current && epoch === listEpoch.current) setError('Could not load private documents. Retry reload.'); return null }
    finally { if (alive.current && epoch === listEpoch.current) setLoading(false) }
  }
  useEffect(() => {
    alive.current = true; void reload(); let active = true
    imagesApi.list(account).then(values => { if (active) setImages(values) }).catch(() => { if (active) setImageError('Could not load image analyses.') })
    const resize = () => setCompact(window.innerWidth < 1200)
    window.addEventListener('resize', resize)
    return () => { active = false; alive.current = false; listEpoch.current++; askEpoch.current++; window.removeEventListener('resize', resize) }
  }, [account])
  useEffect(() => {
    let active = true
    setDetail(null); setPreview(null); setVersion(0); setDetailError(''); setDetailLoading(!!current)
    if (current) api.detail(current.document.id, account).then(value => { if (active) { setDetail(value); setVersion(value.document.currentVersion) } }).catch(() => { if (active) setDetailError('Could not load source details.') }).finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selected, current?.document.currentVersion, account])
  useEffect(() => {
    let active = true
    setPreview(null); setPreviewLoading(!!current && version > 0)
    if (current && version > 0) api.preview(current.document.id, version, account).then(value => { if (active) setPreview(value) }).catch(() => { if (active) setDetailError('Could not load extracted preview.') }).finally(() => { if (active) setPreviewLoading(false) })
    return () => { active = false }
  }, [selected, version, account])
  function select(id: string) { setSelected(id); setDrawer(true); setAnswer(null); setAskError(''); askEpoch.current++; setAskBusy(false) }
  function openUpload(document?: api.Document) {
    if (!intent) { setTarget(document?.id ?? ''); setTitle(document?.title ?? ''); setFile(null); setUploadError('') }
    setUploadOpen(true)
  }
  async function upload(event: FormEvent) {
    event.preventDefault()
    if (uploadBusy || (!intent && !file)) return
    const doc = catalog.find(item => item.document.id === target)?.document
    const frozen = intent ?? { file: file!, title: title.trim(), target: doc?.id ?? null, expected: doc?.currentVersion ?? 0, requestId: crypto.randomUUID() }
    if (frozen.file.size < 1 || frozen.file.size > 2 * 1024 * 1024 || !['text/plain', 'application/pdf'].includes(frozen.file.type)) { setUploadError('Choose a nonempty TXT or PDF, maximum 2 MiB.'); return }
    setIntent(frozen); setUploadBusy(true); setUploadError('')
    try {
      const saved = await api.upload(frozen.file, frozen.title, frozen.expected, frozen.target, frozen.requestId, account)
      if (!alive.current) return
      setIntent(null); setFile(null); setTitle(''); setUploadOpen(false)
      await reload(); if (alive.current) select(saved.document.id)
    } catch (failure) {
      if (!alive.current) return
      if (failure instanceof ApiError && [400, 401, 403, 413, 415, 422, 429].includes(failure.status)) { setIntent(null); setUploadError('Upload rejected. Check the file, session and limits before retrying.') }
      else setUploadError('Outcome uncertain or version conflict. Retry sends exactly the same file and request ID; do not create another upload. Reload the catalog to inspect saved versions.')
    } finally { if (alive.current) setUploadBusy(false) }
  }
  async function remove() {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true); setDeleteError(''); let failed = false
    try { await api.remove(deleting.id, deleting.currentVersion, account) } catch { failed = true }
    const values = await reload()
    if (!alive.current) return
    if (!failed || (values && !values.some(item => item.document.id === deleting.id))) { if (selected === deleting.id) setSelected(''); setAnswer(null); setDeleting(null); setDrawer(false) }
    else setDeleteError('Delete could not be confirmed or the version changed. The original expected version is retained; inspect the catalog before retrying.')
    setDeleteBusy(false)
  }
  async function ask(event: FormEvent) {
    event.preventDefault()
    if (askBusy || (scope === 'selected' && !current)) return
    const epoch = ++askEpoch.current
    setAskBusy(true); setAskError(''); setAnswer(null)
    try { const value = scope === 'selected' ? await api.ask(question, account, current!.document.id) : await api.ask(question, account); if (alive.current && epoch === askEpoch.current) setAnswer(value) }
    catch { if (alive.current && epoch === askEpoch.current) setAskError('RAG request failed. No answer or citation was fabricated.') }
    finally { if (alive.current && epoch === askEpoch.current) setAskBusy(false) }
  }
  const query = search.trim().toLowerCase()
  const docs = tab === 'Images' ? [] : catalog.filter(item => {
    const type = item.version.mediaType === 'application/pdf' ? 'PDF' : 'TXT'
    return (filter === 'All types' || filter === type) && `${item.document.title} ${item.version.filename} ${type}`.toLowerCase().includes(query)
  })
  const imageRows = tab === 'Documents' || !['All types', 'Image'].includes(filter) ? [] : images.filter(item => `${item.question} image`.toLowerCase().includes(query))
  const askPanel = <form onSubmit={ask} aria-label="Ask private documents" className="research-ask">
    <h2>Ask with citations</h2><select aria-label="Research scope" value={scope} onChange={event => { setScope(event.target.value); setAnswer(null); setAskError(''); askEpoch.current++; setAskBusy(false) }}><option value="all">Ask all library</option><option value="selected" disabled={!current}>Ask selected source</option></select>
    {scope === 'selected' && current && <p className="research-meta">Uses {current.document.title} · current v{current.document.currentVersion}</p>}
    <textarea aria-label="Document question" placeholder="Ask your private sources…" required maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)} /><button disabled={askBusy || (scope === 'selected' && !current)}>{askBusy ? 'Retrieving…' : 'Retrieve and answer'}</button>{askError && <p role="alert">{askError}</p>}
    {answer && <article aria-label="RAG answer"><h3>Answer{answer.kind === 'insufficient' ? ' · Insufficient evidence' : ''}</h3><p className="research-text">{answer.answer}</p>{answer.assumptions.map((value, i) => <p key={i}>{value}</p>)}<h3>Sources</h3>{answer.citations.length === 0 ? <p>No matching sources.</p> : <ol className="research-citations">{answer.citations.map((citation, index) => <li key={`${citation.documentId}:${citation.version}:${citation.chunkIndex}`}><strong>[C{index + 1}] {citation.title} · v{citation.version}{citation.pageNumber ? ` · page ${citation.pageNumber}` : ''}</strong><p className="research-text">{citation.excerpt}</p></li>)}</ol>}<details><summary>Details</summary><p>{answer.provider ? `${answer.provider} · ${answer.model}` : 'No provider called.'}</p>{answer.citations.map((c, i) => <p className="research-text" key={i}>C{i + 1} SHA-256: {c.hash}</p>)}</details><p className="research-meta">Private-source research answer; verify citations. Not financial advice or a profitability guarantee.</p></article>}
  </form>
  const detailPane = <div className="research-detail">
    <header className="research-toolbar"><h2>{current ? 'Source details' : selectedImage ? 'Image analysis' : 'Private research'}</h2>{compact && <button onClick={() => setDrawer(false)}>Close details</button>}</header>
    {detailLoading && <p role="status">Loading source details…</p>}{detailError && <p role="alert">{detailError}</p>}
    {current && <><h2>{current.document.title}</h2><p className="research-meta">{current.version.filename} · {current.version.mediaType === 'application/pdf' ? `PDF · ${current.version.pageCount} pages` : 'TXT'} · v{current.document.currentVersion}</p><p className="research-meta">Updated {new Date(current.document.updatedAt).toLocaleString()}</p><div className="research-toolbar"><button onClick={() => openUpload(current.document)}>Upload new version</button><button onClick={() => { setDeleting(current.document); setDeleteError('') }}>Delete</button></div>
      {detail && <label>Version history<select aria-label="Preview version" value={version} onChange={event => { setDetailError(''); setVersion(Number(event.target.value)) }}>{detail.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.filename} · {new Date(v.createdAt).toLocaleString()}</option>)}</select></label>}
      <h3>Extracted preview</h3>{previewLoading && <p role="status">Loading preview…</p>}<div aria-label="Document preview" className="research-preview">{preview?.chunks.map(chunk => <section key={chunk.chunkIndex}>{chunk.pageNumber && <p className="research-meta">Page {chunk.pageNumber}</p>}<p className="research-text">{chunk.text}</p></section>)}</div></>}
    {selectedImage && <><h2>{selectedImage.question}</h2><p className="research-meta">{selectedImage.width}×{selectedImage.height} · {new Date(selectedImage.createdAt).toLocaleString()}</p><ImageEvidence image={selectedImage} /></>}
    {!current && !selectedImage && <p className="research-meta">Select a source to inspect its versions and evidence.</p>}{askPanel}
  </div>
  return <section aria-label="Private document library" className="research-workspace">
    <header className="research-header"><div><h1>Library</h1><p className="research-meta">Your private trading research</p></div><input aria-label="Search library" type="search" placeholder="Search title, filename or type…" maxLength={160} value={search} onChange={event => setSearch(event.target.value)} /><button onClick={() => openUpload()}>+ Upload</button></header>
    <div className="research-toolbar research-tabs" role="tablist" aria-label="Library sources">{['All', 'Documents', 'Images'].map(value => <button role="tab" aria-selected={tab === value} key={value} onClick={() => { setTab(value); setFilter('All types') }}>{value}</button>)}<button onClick={() => void reload()}>Reload</button>{compact && <button onClick={() => setDrawer(true)}>Ask library</button>}</div>
    {error && <p role="alert">{error}</p>}{intent && !uploadOpen && <p role="status">Upload intent retained. <button onClick={() => setUploadOpen(true)}>Resume exact upload</button></p>}
    <div className="research-panes"><aside className="research-filters"><details open={!compact}><summary>Filters</summary><label>Type<select aria-label="Source type" value={filter} onChange={event => setFilter(event.target.value)}>{['All types', 'PDF', 'TXT', 'Image'].map(value => <option key={value}>{value}</option>)}</select></label><p className="research-meta">Private sources only. Search matches metadata, not semantic content.</p></details></aside>
      <div className="research-list"><h2>Research library <span className="research-meta">{docs.length + imageRows.length} sources</span></h2>{loading && <p role="status">Loading private documents…</p>}{imageError && tab !== 'Documents' && <p role="alert">{imageError}</p>}
        {!loading && docs.length + imageRows.length === 0 && <p className="research-empty">{query || filter !== 'All types' ? 'No matching sources.' : tab === 'Images' ? 'No image analyses yet. Add one in Image Analysis.' : 'No private documents yet. Upload a TXT or PDF to begin.'}</p>}
        <ul aria-label="Owned research sources">{docs.map(item => <li key={item.document.id}><button className="research-row" aria-pressed={selected === item.document.id} onClick={() => select(item.document.id)}><span className="research-file-type">{item.version.mediaType === 'application/pdf' ? 'PDF' : 'TXT'}</span><span className="research-row-body"><strong>{item.document.title}</strong><span className="research-meta">{item.version.filename} · v{item.document.currentVersion}{item.version.mediaType === 'application/pdf' ? ` · ${item.version.pageCount} pages` : ''}</span></span><time className="research-meta" dateTime={item.document.updatedAt}>{new Date(item.document.updatedAt).toLocaleDateString()}</time></button></li>)}{imageRows.map(item => <li key={item.id}><button className="research-row" aria-pressed={selected === item.id} onClick={() => select(item.id)}><span className="research-file-type">Image</span><span className="research-row-body"><strong>{item.question}</strong><span className="research-meta">{item.width}×{item.height} · {new Date(item.createdAt).toLocaleString()}</span></span></button></li>)}</ul>
      </div>{!compact && detailPane}</div>
    <Modal open={compact && drawer} label="Research source details" onClose={() => setDrawer(false)}>{detailPane}</Modal>
    <Modal open={uploadOpen} label="Upload private document" onClose={() => { if (!uploadBusy) setUploadOpen(false) }}><form className="research-dialog" onSubmit={upload} aria-label="Upload private document"><header className="research-toolbar"><h2>{intent ? 'Retained upload' : 'Upload source'}</h2><button type="button" disabled={uploadBusy} onClick={() => setUploadOpen(false)}>Close upload</button></header>{uploadError && <p role="alert">{uploadError}</p>}<fieldset disabled={!!intent || uploadBusy}><label>Destination<select aria-label="Document version target" value={target} onChange={event => { setTarget(event.target.value); setTitle(catalog.find(x => x.document.id === event.target.value)?.document.title ?? '') }}><option value="">Create a new document</option>{catalog.map(item => <option value={item.document.id} key={item.document.id}>New version: {item.document.title} · v{item.document.currentVersion}</option>)}</select></label><label>Title<input aria-label="Document title" required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} /></label><label>File<input aria-label="Document file" type="file" required accept=".txt,text/plain,.pdf,application/pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label></fieldset><p className="research-meta">TXT or PDF, maximum 2 MiB. PDF: up to 50 pages; extracted text up to 100 KiB. Sources are data, never instructions.</p><button disabled={uploadBusy}>{uploadBusy ? 'Uploading…' : intent ? 'Retry exact upload' : target ? 'Upload next version' : 'Upload document'}</button>{intent && <button type="button" disabled={uploadBusy} onClick={() => void reload()}>Reload catalog</button>}</form></Modal>
    <Modal open={!!deleting} label="Confirm document deletion" onClose={() => { if (!deleteBusy) setDeleting(null) }}><div className="research-dialog"><h2>Delete {deleting?.title}?</h2><p>The document and all its versions will be deleted. Historical citation snapshots and provenance may remain in saved research records.</p>{deleteError && <p role="alert">{deleteError}</p>}<div className="research-toolbar"><button disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel delete</button><button disabled={deleteBusy} onClick={() => void remove()}>{deleteBusy ? 'Deleting…' : 'Confirm delete'}</button></div></div></Modal>
  </section>
}
function ImageEvidence({ image }: { image: imagesApi.Saved }) {
  const a = image.analysis
  const sections = [['Visible evidence', a.visibleEvidence.map(e => `${e.id} — ${e.observation} (${e.location})`)], ['Visible text / OCR', a.visibleText], ['Inferences', a.inferences.map(i => `${i.statement} [${i.evidenceIds.join(', ')}]`)], ['Missing data', a.missingData], ['Limitations', a.limitations]] as const
  return <div>{sections.map(([heading, values]) => <section key={heading}><h3>{heading}</h3>{values.length ? values.map((value, i) => <p className="research-text" key={i}>{value}</p>) : <p>None reported.</p>}</section>)}<p className="research-meta">Confidence {(a.confidence * 100).toFixed(0)}%. Research interpretation requires verification; not an accepted strategy.</p><details><summary>Details</summary><p>{image.provider} · {image.model}</p><p className="research-text">SHA-256: {image.imageHash}</p></details></div>
}
