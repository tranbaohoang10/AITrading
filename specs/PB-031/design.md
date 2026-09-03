# PB-031 — Design notes

## Architecture

- Keep `MarketProvider` and backend market APIs unchanged.
- Derive display-only candle series and indicators with pure TypeScript helpers.
- Keep chart preferences and drawings in React component state; no persistence or backend mutation.
- Extend the native SVG chart so chart types, overlays, oscillator pane, drawing geometry, and export share the same rendered source.
- Keep the compact workspace navigation driven by the existing `WorkspaceTab` state.
- Reuse conversation and authentication contexts for the expanded sidebar; do not duplicate or reload their data.

## Interaction model

The 52px Q rail remains the stable anchor. Its Q button toggles an overlaid navigation panel, preserving the central workspace size. Dataset controls stay in the chart toolbar. Workspace destinations become icon-first controls. Menus disclose unavailable advanced features rather than implying support.

Higher timeframe selection is valid only when the requested interval is an integer multiple of the native interval. Candles are grouped by UTC epoch buckets; each aggregate uses first open, maximum high, minimum low, last close, and summed volume. The native series is never mutated.

Drawing coordinates are normalized to the chart plot so they survive resizing. An in-memory undo/redo history owns drawing mutations. Text input is an explicit lightweight dialog. Export serializes the real SVG, including active display layers.

## Responsive behavior

- Desktop: slim rail, compact assistant, dominant chart workspace, overlaid expanded navigation.
- Tablet: collapsed/overlay navigation and horizontally scrollable tool strips where necessary.
- Mobile: no viewport overflow; primary chart controls remain reachable and secondary menus wrap or scroll inside their own region.

## Data / API impact

None. No database, Flyway, backend API, authentication, business logic, or stored candle changes.
