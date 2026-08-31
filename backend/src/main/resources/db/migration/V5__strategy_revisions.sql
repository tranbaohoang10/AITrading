CREATE TABLE trading.strategy (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    current_revision INTEGER NOT NULL CHECK (current_revision BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id,request_id)
);
CREATE INDEX strategy_owner_created ON trading.strategy(owner_id,created_at DESC,id DESC);

CREATE TABLE trading.strategy_revision (
    strategy_id UUID NOT NULL REFERENCES trading.strategy(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 100),
    request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    title VARCHAR(120) NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    draft_text TEXT NOT NULL CHECK (octet_length(draft_text)<=65536),
    status VARCHAR(9) NOT NULL CHECK (status IN ('DRAFT','VALIDATED')),
    canonical_json TEXT,
    hash CHAR(64),
    schema_version VARCHAR(32),
    validator_version VARCHAR(32),
    minimum_bars INTEGER,
    symbol VARCHAR(32),
    timeframe VARCHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(strategy_id,revision),
    UNIQUE(strategy_id,request_id),
    CHECK (
      (status='DRAFT' AND canonical_json IS NULL AND hash IS NULL AND schema_version IS NULL
       AND validator_version IS NULL AND minimum_bars IS NULL AND symbol IS NULL AND timeframe IS NULL)
      OR
      (status='VALIDATED' AND canonical_json IS NOT NULL AND hash IS NOT NULL AND hash ~ '^[0-9a-f]{64}$'
       AND schema_version IS NOT NULL AND validator_version IS NOT NULL AND minimum_bars IS NOT NULL
       AND minimum_bars BETWEEN 1 AND 10000 AND symbol IS NOT NULL AND timeframe IS NOT NULL)
    )
);
