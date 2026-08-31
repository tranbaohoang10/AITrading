import { exportPine, parseArtifact } from './api'
import { account, source, artifact } from './fixtures'

// Node's actual implementation exercises SHA-256; jsdom has no SubtleCrypto.
const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto')

const reply = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status })
const withHash = async (code = artifact.code) => ({ ...artifact, code, codeHash: Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(code))), v => v.toString(16).padStart(2, '0')).join('') })
beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

it('checks actual SHA256 bytes and exact immutable source identity before accepting source text', async () => {
  const saved = await withHash()
  expect(await parseArtifact(saved, source)).toEqual(saved)
  for (const v of [{ ...saved, code: saved.code + 'changed' }, { ...saved, revision: 3 }, { ...saved, dslHash: 'c'.repeat(64) },
    { ...saved, strategyId: account }, { ...saved, schemaVersion: '2.0.0' }, { ...saved, generatorVersion: 'untrusted' },
    { ...saved, limitations: [] }, { ...saved, createdAt: 'invalid' }, { ...saved, codeHash: 'Z'.repeat(64) }]) {
    await expect(parseArtifact(v, source)).rejects.toThrow('Invalid Pine')
  }
})
it('fails closed on invalid target paths, account, draft and oversized code without transporting them', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  for (const v of [{ ...source, strategyId: '../secret' }, { ...source, revision: 0 }, { ...source, revision: 101 }, { ...source, status: 'DRAFT' as const }]) {
    await expect(exportPine(v, account, true)).rejects.toThrow()
  }
  await expect(exportPine(source, '', true)).rejects.toMatchObject({ status: 401 })
  expect(fetcher).not.toHaveBeenCalled()
  await expect(parseArtifact(await withHash('//@version=6\n' + 'é'.repeat(65536)), source)).rejects.toThrow('Invalid Pine')
})
it('binds GET and delayed CSRF POST to captured owner and sends no unsaved draft or arbitrary source', async () => {
  const saved = await withHash(), fetcher = vi.fn().mockResolvedValueOnce(reply(saved)); vi.stubGlobal('fetch', fetcher)
  expect(await exportPine(source, account)).toEqual(saved)
  expect(new Headers(fetcher.mock.calls[0][1].headers).get('X-Workspace-User')).toBe(account)
  let release!: (r: Response) => void
  fetcher.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve })).mockResolvedValueOnce(reply(saved))
  const pending = exportPine(source, account, true)
  release(reply({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-from-replacement-session' }))
  await pending
  expect(fetcher.mock.calls[2][0]).toBe(`/api/strategies/${source.strategyId}/versions/2/pine`)
  expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'POST', body: '{}', credentials: 'same-origin', cache: 'no-store' })
  expect(new Headers(fetcher.mock.calls[2][1].headers).get('X-Workspace-User')).toBe(account)
  expect(new Headers(fetcher.mock.calls[2][1].headers).get('X-CSRF-TOKEN')).toBe('synthetic-from-replacement-session')
})
it('bounds streamed JSON and maps only allowlisted diagnostics while preserving auth errors', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  fetcher.mockResolvedValueOnce(new Response(' '.repeat(512 * 1024 + 1)))
  await expect(exportPine(source, account)).rejects.toThrow('Invalid Pine')
  fetcher.mockResolvedValueOnce(reply({ code: 'TARGET_PERIOD_LIMIT' }, 422))
  await expect(exportPine(source, account)).rejects.toThrow('period must not exceed 200')
  fetcher.mockResolvedValueOnce(reply({ code: '<script>private injected detail</script>' }, 422))
  await expect(exportPine(source, account)).rejects.toThrow('This DSL is not supported')
  fetcher.mockResolvedValueOnce(reply({}, 401))
  await expect(exportPine(source, account)).rejects.toMatchObject({ status: 401 })
  fetcher.mockResolvedValueOnce(reply({}, 429))
  await expect(exportPine(source, account)).rejects.toMatchObject({ status: 429 })
})
