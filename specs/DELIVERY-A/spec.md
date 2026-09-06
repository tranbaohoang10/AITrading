# Trading Research Library — Issue #42

06/09/2026, Asia/Ho_Chi_Minh. Requirements: [Issue #42](https://github.com/tranbaohoang10/AITrading/issues/42).

## Goal and Use Case
UC-A: authenticated owner stores, browses, inspects, versions and asks private research sources. Entry: Library navigation. Preconditions: valid session. Main flow: load catalog, filter/search metadata, select document, inspect extracted text/version history, upload or ask selected/current sources. Alternate: browse existing Image Analysis results. Failure: bounded errors retain intent and never fabricate sources/answers. Postcondition: immutable saved version or explicitly uncertain outcome, exact provenance retained.

## Acceptance criteria
- A1: compact Quant workspace, All/Documents/Images, real metadata search (160 characters), three desktop panes, tablet drawer/filter disclosure and mobile single column, no page overflow.
- A2: owner-scoped catalog (100), detail/version history (50) and extracted preview (100 KiB, 200 chunks); metadata reflects stored source. No raw PDF/HTML rendering.
- A3: dialog upload/new version preserves 2 MiB, PDF 50 pages, 100 KiB extraction, expectedVersion, requestId and immutable versions. Uncertain retry resends frozen file/title/target/version/request ID.
- A4: explicit delete confirmation explains retained citation snapshots. Reconcile lost delete response through catalog; never silently delete a newer version.
- A5: selected-current-source and global RAG share retrieval/provider/provenance pipeline, exact citations separated from answer; provider/hash details disclosed separately. Insufficient/failure honest.
- A6: existing image-analysis API/domain reused without invented thumbnails or duplicate persistence.
- A7: session/expected-account/CSRF/Origin, owner access, stale responses, rate limits, XSS/bounds/replay/concurrency remain covered; dialog keyboard/focus/Escape/restore focus.
- A8: tests, browser QA 1440/1024/390, dependency/security checks, normal main commit/push, exact SHA and CI verified before close.

## Current-source audit
Start SHA 32e795682ef8b69dad587b0b1c993197648b9a42. Backend already supports 100 documents/owner, 50 immutable versions/document, 2 MiB file, PDF 1–50 pages, UTF-8 extraction 100 KiB, chunks up to 3000 characters and 200/PDF; top four lexical retrieval matches from current versions. TXT pageCount is stored as 1 but has no physical page attribution. Existing list lacks filename/type; no detail/preview/selected RAG endpoints. Existing UI generates a new requestId after failure and deletes without confirmation: these require repair. Images API returns up to 50 analysis records including dimensions/evidence, not original thumbnail/filename.

## Security and data
No migrations/dependencies. Parameterized owner joins, credential validation, bounded text-only output, current-version provenance validation; no executable content, URL fetching or semantic-search claim. Keep immutable citations after source deletion. No live trading/payment scope.

## Definition of Done
All A1–A8 verified, CNPM/test evidence current, no unresolved high/critical issues, scoped Vietnamese Refs commit pushed and CI PASS, then explicit closure.
