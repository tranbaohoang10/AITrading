# PB-018 — private document library and RAG (Issue #23)

Owners upload bounded TXT/PDF data, create immutable versions and query only their
current chunks. Each returned citation identifies document/version/chunk/page and
an exact persisted excerpt/hash. Retrieval is deterministic; no match returns
insufficient without calling AI. Retrieved content is untrusted data and cannot
grant tools, URLs, code execution or cross-owner access.

Every successful, insufficient or failed RAG attempt is append-only with a hashed
question and immutable citation snapshots. Document deletion removes private raw
content while retaining the owner's historical citation provenance until account
deletion. A document/version or credential race after retrieval fails stale and
does not return the provider output.

Limits:2MiB/file,50 pages,100KiB extracted UTF-8,200 chunks,100 documents/owner,
50 versions/document, top4 citations and1000-character question. PDFBox3.0.8 is
the official security-fixed current3.x release. Raw bytes stay private in DB; no
filesystem filename/path or remote fetch. Issue: https://github.com/tranbaohoang10/AITrading/issues/23
