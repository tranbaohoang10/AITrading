# PB-035 — Tasks and acceptance mapping

| ID | Work | Paths | AC |
| --- | --- | --- | --- |
| T1 | Make topbar clusters explicit and keep utility actions right-only | `frontend/src/market/LiveChart.tsx`, `frontend/src/components/ChartControls.tsx` | AC-01 |
| T2 | Implement stable AUTO/MANUAL price state, anchored scale zoom, price pan, time pan/zoom and reset shortcuts | `frontend/src/market/CandleChart.tsx` | AC-02–03 |
| T3 | Upgrade grouped left gutter, last-used tools, real Parallel Channel/Price Note, honest disabled pattern entries and More controls | `frontend/src/components/ChartControls.tsx`, `frontend/src/market/chartTypes.ts`, `frontend/src/market/CandleChart.tsx` | AC-04 |
| T4 | Implement transient selection overlay and shared bounded crop pipeline | `frontend/src/market/chartCapture.ts`, `frontend/src/market/CandleChart.tsx`, `frontend/src/components/ChartControls.tsx` | AC-05–06 |
| T5 | Integrate capture request at the existing Assistant boundary or report the exact unsupported provider/API state | `frontend/src/chat/*`, `frontend/src/components/*`, `backend/src/main/java/com/aitrading/ai/*` only if required | AC-06 |
| T6 | Add focused regression/integration tests and execute lint/build/browser QA | `frontend/src/**/*.test.*`, this folder | AC-01–07 |
