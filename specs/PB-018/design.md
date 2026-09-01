# PB-018 design

```mermaid
sequenceDiagram
 actor O as Owner
 participant API
 participant DB
 participant AI as AiProvider
 O->>API: upload multipart TXT/PDF
 API->>API: MIME + extension + magic + UTF8/page/text limits
 API->>DB: owned document/version/chunks
 O->>API: ask bounded question
 API->>DB: deterministic owner-current-version retrieval
 API->>AI: question + top excerpts as untrusted data
 AI-->>API: structured answer
 API-->>O: answer + server-generated citations
```

```mermaid
classDiagram
 DocumentController --> DocumentService
 DocumentService --> AiProvider
 DocumentService --> private_document
 private_document --> private_document_version
 private_document_version --> private_document_chunk
 DocumentService --> RagAttemptStore
 RagAttemptStore --> private_document_rag_attempt
 private_document_rag_attempt --> private_document_rag_citation
```

The multipart resolver owns the upload stream under a 2.2 MiB request limit; the
generic request wrapper never pre-consumes approved document multipart bodies.
PDF parsing uses a fixed 8 MiB PDFBox stream cache plus file/page/extracted-text/
chunk limits. RAG rechecks credential and current document versions after the
provider call before recording or returning output.
