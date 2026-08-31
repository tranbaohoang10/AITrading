CREATE TABLE trading.backtest_job (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    strategy_id UUID NOT NULL,
    strategy_revision INTEGER NOT NULL CHECK (strategy_revision BETWEEN 1 AND 100),
    strategy_title VARCHAR(120) NOT NULL,
    dataset_id UUID NOT NULL,
    dataset_name VARCHAR(120) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    timeframe VARCHAR(3) NOT NULL,
    source_kind VARCHAR(16) NOT NULL,
    retry_of UUID,
    credential_version BIGINT NOT NULL,
    input_json TEXT NOT NULL CHECK (octet_length(input_json)<=2097152),
    input_hash CHAR(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
    dsl_hash CHAR(64) NOT NULL CHECK (dsl_hash ~ '^[0-9a-f]{64}$'),
    data_hash CHAR(64) NOT NULL CHECK (data_hash ~ '^[0-9a-f]{64}$'),
    candle_count INTEGER NOT NULL CHECK (candle_count BETWEEN 1 AND 5000),
    state VARCHAR(16) NOT NULL CHECK (state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
    error_code VARCHAR(48),
    result_json TEXT CHECK (octet_length(result_json)<=33554432),
    result_hash CHAR(64) CHECK (result_hash ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    started_at TIMESTAMPTZ,
    lease_until TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp()+INTERVAL '5 minutes'),
    finished_at TIMESTAMPTZ,
    UNIQUE(owner_id,request_id),
    CHECK ((state IN ('QUEUED','RUNNING') AND error_code IS NULL AND result_json IS NULL AND result_hash IS NULL AND finished_at IS NULL)
        OR (state='SUCCEEDED' AND error_code IS NULL AND result_json IS NOT NULL AND result_hash IS NOT NULL AND finished_at IS NOT NULL)
        OR (state IN ('FAILED','CANCELLED') AND error_code IS NOT NULL AND result_json IS NULL AND result_hash IS NULL AND finished_at IS NOT NULL)),
    CHECK (state NOT IN ('RUNNING','SUCCEEDED') OR started_at IS NOT NULL)
);
CREATE INDEX backtest_owner_created ON trading.backtest_job(owner_id,created_at DESC,id DESC);
CREATE INDEX backtest_active ON trading.backtest_job(state,created_at,id) WHERE state IN ('QUEUED','RUNNING');
