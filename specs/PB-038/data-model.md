# Data model — Chart refinement

No database migration is planned. These are frontend/provider contracts layered
over the existing persisted Replay entities.

## ReplayLaunchDraft

| Field | Type | Rule |
| --- | --- | --- |
| mode | `DAY \| MONTH` | Required |
| day | `YYYY-MM-DD?` | Required in DAY mode |
| month | `YYYY-MM?` | Required in MONTH mode |
| provider/instrument/timeframe | existing selected identity | Immutable during start request |
| rangeFrom/rangeTo | UTC instants | Derived, never browser-local implicit dates |
| coverage | existing coverage response | Start enabled only when usable |

State: `CLOSED → SELECTING → CHECKING_COVERAGE → READY → STARTING → OPEN_REPLAY`.
Failure returns to the same frozen draft for retry.

## PositionSetupDraft

| Field | Type | Rule |
| --- | --- | --- |
| side | `LONG \| SHORT` | Required |
| balance/currency | persisted Replay view | Read-only |
| entryMode | `CURRENT \| PRICE` | Current means latest revealed price |
| entry | positive decimal | Locked after entry fills |
| sizingMode | `RISK_PERCENT \| LOT \| QUANTITY` | LOT exposed only with verified metadata |
| size | positive decimal | Bounded; backend authoritative |
| stopPercent/targetPercent | positive decimal | Derive valid side-specific prices |
| stop/target/quantity/risk/reward/rr | derived preview | Never authoritative until backend response |

Draft changes and chart drawing edits update one state object. Confirm maps to the
existing Replay `CONFIRM` command. Active SL/TP changes map to `LEVELS` once.

## Instrument presentation extension

| Field | Purpose |
| --- | --- |
| providerInstrumentId | Stable provider-specific identity |
| assetClass/provider/exchange/feed | Truthful routing and badges |
| iconKey | Normalized local asset key |
| iconUrl | Optional approved provider URL only |
| iconSource/license | Audit provenance |
| lotSize/contractSize/pointValue/sizingStatus | Gate LOT semantics |

Search pages return a bounded list plus an opaque next cursor. Duplicate provider
identity is rejected; identical display symbols from different venues remain
separate rows.

## ChartDisplayState

Existing per-cell state retains `timezone`, `timeframe` and `showCrosshair`.
Popover-open and pointer coordinates are ephemeral UI state and are not persisted.
Timezone transforms display formatting only; Candle timestamps remain UTC.
