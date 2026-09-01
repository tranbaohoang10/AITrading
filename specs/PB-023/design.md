# PB-023 design

```mermaid
sequenceDiagram
 actor A as Synthetic owner A
 actor B as Synthetic owner B
 participant F as Request/security filters
 participant API
 participant DB as Disposable PostgreSQL
 A->>F: authenticated private resource writes
 F->>API: valid session + CSRF + expected account
 API->>DB: owner-scoped state
 B->>F: cross-owner, malformed, replay and hostile inputs
 F-->>B: bounded deny response
 A->>F: valid request after denial/restart
 API->>DB: verify A state unchanged
 F-->>A: owner data only
```

```mermaid
classDiagram
 RequestIdFilter --> SecurityConfig
 SecurityConfig --> AuthInputFilter
 AuthInputFilter --> AuthGuardFilter
 AuthGuardFilter --> AuthRateLimiter
 AuthGuardFilter --> PrivateControllers
 PrivateControllers --> OwnerScopedStores
```

No data migration is planned. Security response headers are centralized in the
Spring Security chain. The adversarial smoke treats every response as bounded
untrusted bytes and records only booleans/counts/hashes, never credentials or
private response bodies.
