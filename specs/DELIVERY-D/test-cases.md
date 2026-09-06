# Test cases

| ID | Scenario | Evidence |
|---|---|---|
| D-01 | Status with missing keys | PASS — `MarketIntelligenceServiceTests`; UI renders NOT_CONFIGURED |
| D-02 | News query >80 chars / invalid timezone | PASS — service validation test |
| D-03 | Calendar reversed or >32-day range | PASS — service validation test |
| D-04 | Auth/rate-limit boundary | PASS — SecurityConfig/AuthGuard route; full backend regression |
| D-05 | Provider response absent | PASS — UI shows empty/unavailable, never fake headlines/events |
| D-06 | Live provider article/calendar | BLOCKED — no authorized provider credential and adapter intentionally pending |
