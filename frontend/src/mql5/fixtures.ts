import type { Revision } from '../strategy/api'
import type { Artifact } from './api'

export const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const source: Revision = {
  strategyId: '11111111-1111-4111-8111-111111111111', revision: 2, title: 'Synthetic MQL5 research', draftText: '{}',
  status: 'VALIDATED', canonicalJson: '{}', hash: 'a'.repeat(64), schemaVersion: '1.0.0', validatorVersion: '1.0.0',
  minimumBars: 1, symbol: 'DEMO', timeframe: '1h', createdAt: '2024-01-01T00:00:00Z',
}
export const artifact: Artifact = {
  strategyId: source.strategyId, revision: source.revision, dslHash: source.hash!, schemaVersion: '1.0.0', validatorVersion: '1.0.0',
  generatorVersion: 'mql5-research-1.0.0', codeHash: 'b'.repeat(64), code: '#property strict\n// <script>alert(1)</script> inert fixture\nint OnStart() { return 0; }\n',
  createdAt: '2024-01-01T01:00:00Z', limitations: ['Synthetic test fixture; no target validation claim.'],
}
