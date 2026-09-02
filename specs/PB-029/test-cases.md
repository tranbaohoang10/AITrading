# PB-029 — Test cases

| ID | Category | Procedure | Expected | Status |
| --- | --- | --- | --- | --- |
| TC-01 | UI | Inspect authenticated shell and assistant beside LuxAlgo reference | Neutral near-black terminal; compact assistant; workspace dominant | PASS |
| TC-02 | Functional | Send a new prompt with configured AI | One click saves once, then starts AI using confirmed sequence/version | PASS — real Gemini reply received |
| TC-03 | Failure/idempotency | Lose save acknowledgement, retry, then lose AI acknowledgement and retry/check | Frozen save/AI identities; no duplicate AI start before confirmed save | PASS — automated |
| TC-04 | Cancellation | Cancel a pending AI request while original call is unresolved | Same intent cancelled; late response ignored | PASS — automated |
| TC-05 | History | Create/select/load earlier conversations and inspect compact history | Existing pagination and draft isolation remain | PASS — browser + automated |
| TC-06 | Rename/delete | Rename and delete through the conversation menu | No permanent admin controls; delete requires confirmation | PASS — browser confirmation + automated deletion |
| TC-07 | Provider | Load chat and switch conversations with configured/offline provider | Automatic check; compact status; details accessible; no fake reply | PASS |
| TC-08 | Navigation | Activate Generate from Image | Existing Image Analysis workspace opens | PASS — browser |
| TC-09 | Responsive | Inspect real app at 1920×1080, ~1440, 1024 and 390 | No horizontal overflow; chat/workspace controls usable | PASS — exact browser metrics and screenshots |
| TC-10 | Regression | Run frontend tests, lint and production build | All pass | PASS — 215 tests; lint/build exit 0 |
| TC-11 | Scope/security | Review complete diff, secrets/raw HTML, dependencies and changed paths | Frontend/spec only; no contract/security/target changes | PASS |
