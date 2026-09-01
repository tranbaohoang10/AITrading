# PB-019 design

```mermaid
sequenceDiagram
 actor U as Owner
 participant API as ImageAnalysisController
 participant S as ImageAnalysisService
 participant P as AiProvider
 participant DB as PostgreSQL
 U->>API: multipart image + question + requestId
 API->>S: authenticated owner
 S->>S: bound, decode, canonical PNG, SHA256
 S->>P: neutral ImageRequest
 P-->>S: strict ImageAnalysis
 S->>DB: idempotent owner-scoped result
 DB-->>U: persisted analysis
```

```mermaid
classDiagram
 ImageAnalysisController --> ImageAnalysisService
 ImageAnalysisService --> AiProvider
 ImageAnalysisService --> chart_image_analysis
 GeminiProvider ..|> AiProvider
 OpenAiProvider ..|> AiProvider
```

V17 adds one owner-cascaded table. It stores canonical PNG bytes and hashes rather
than filenames, URLs or metadata. Maximum source/canonical bytes are 2 MiB, maximum
dimension 4096 and maximum pixel count 16 million. At most 50 analyses per owner.
