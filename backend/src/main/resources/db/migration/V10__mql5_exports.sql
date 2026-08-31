CREATE TABLE trading.mql5_export (
    strategy_id UUID NOT NULL,
    revision INTEGER NOT NULL,
    generator_version VARCHAR(32) NOT NULL,
    dsl_hash CHAR(64) NOT NULL CHECK (dsl_hash ~ '^[0-9a-f]{64}$'),
    schema_version VARCHAR(32) NOT NULL,
    validator_version VARCHAR(32) NOT NULL,
    code_hash CHAR(64) NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    code TEXT NOT NULL CHECK (octet_length(code) BETWEEN 1 AND 131072),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (strategy_id, revision, generator_version),
    FOREIGN KEY (strategy_id, revision) REFERENCES trading.strategy_revision(strategy_id, revision) ON DELETE CASCADE
);
