CREATE TABLE trading.market_dataset (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    name VARCHAR(120) NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    symbol VARCHAR(32) NOT NULL CHECK (symbol ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$'),
    timeframe VARCHAR(3) NOT NULL CHECK (timeframe IN ('1m','5m','15m','30m','1h','4h','1d')),
    source_kind VARCHAR(16) NOT NULL CHECK (source_kind IN ('USER_UPLOAD','SYNTHETIC')),
    source_label VARCHAR(120) NOT NULL CHECK (length(source_label) BETWEEN 1 AND 120),
    raw_hash CHAR(64) NOT NULL CHECK (raw_hash ~ '^[0-9a-f]{64}$'),
    data_hash CHAR(64) NOT NULL CHECK (data_hash ~ '^[0-9a-f]{64}$'),
    format_version VARCHAR(16) NOT NULL DEFAULT 'ohlcv-v1' CHECK (format_version='ohlcv-v1'),
    candle_count INTEGER NOT NULL CHECK (candle_count BETWEEN 1 AND 5000),
    gap_count BIGINT NOT NULL CHECK (gap_count>=0),
    first_time TIMESTAMPTZ NOT NULL,
    last_time TIMESTAMPTZ NOT NULL CHECK (last_time>=first_time),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id,request_id)
);
CREATE INDEX market_dataset_owner_created ON trading.market_dataset(owner_id,created_at DESC,id DESC);

CREATE TABLE trading.market_candle (
    dataset_id UUID NOT NULL REFERENCES trading.market_dataset(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 4999),
    open_time TIMESTAMPTZ NOT NULL,
    open NUMERIC(21,8) NOT NULL CHECK (open>0 AND open<=1000000000000),
    high NUMERIC(21,8) NOT NULL CHECK (high>0 AND high<=1000000000000),
    low NUMERIC(21,8) NOT NULL CHECK (low>0 AND low<=1000000000000),
    close NUMERIC(21,8) NOT NULL CHECK (close>0 AND close<=1000000000000),
    volume NUMERIC(21,8) NOT NULL CHECK (volume>=0 AND volume<=1000000000000),
    PRIMARY KEY(dataset_id,ordinal),
    UNIQUE(dataset_id,open_time),
    CHECK (high>=low AND open BETWEEN low AND high AND close BETWEEN low AND high)
);
