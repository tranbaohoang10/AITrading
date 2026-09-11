CREATE TABLE trading.provider_market_candle (
    instrument_id UUID NOT NULL REFERENCES trading.market_instrument(id) ON DELETE CASCADE,
    timeframe VARCHAR(3) NOT NULL CHECK (timeframe = '1m'),
    open_time TIMESTAMPTZ NOT NULL,
    open NUMERIC(28,12) NOT NULL CHECK (open > 0 AND open <= 1000000000000000),
    high NUMERIC(28,12) NOT NULL CHECK (high > 0 AND high <= 1000000000000000),
    low NUMERIC(28,12) NOT NULL CHECK (low > 0 AND low <= 1000000000000000),
    close NUMERIC(28,12) NOT NULL CHECK (close > 0 AND close <= 1000000000000000),
    volume NUMERIC(28,12),
    provider VARCHAR(32) NOT NULL CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,31}$'),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (instrument_id, timeframe, open_time),
    CHECK (volume IS NULL OR volume >= 0),
    CHECK (high >= low AND open BETWEEN low AND high AND close BETWEEN low AND high)
);
CREATE INDEX provider_market_candle_range
    ON trading.provider_market_candle(instrument_id, timeframe, open_time);

CREATE TABLE trading.provider_market_sync_state (
    instrument_id UUID NOT NULL REFERENCES trading.market_instrument(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,31}$'),
    timeframe VARCHAR(3) NOT NULL CHECK (timeframe = '1m'),
    historical_available_from TIMESTAMPTZ,
    synced_through TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL CHECK (status IN ('IDLE','RUNNING','READY','PARTIAL','ERROR','UNSUPPORTED')),
    error_code VARCHAR(80),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (instrument_id, provider, timeframe)
);

ALTER TABLE trading.market_dataset DROP CONSTRAINT market_dataset_source_kind_check;
ALTER TABLE trading.market_dataset ADD CONSTRAINT market_dataset_source_kind_check
    CHECK (source_kind IN ('USER_UPLOAD','SYNTHETIC','PROVIDER'));
