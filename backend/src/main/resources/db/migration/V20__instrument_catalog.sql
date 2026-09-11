CREATE TABLE trading.market_instrument (
    id UUID PRIMARY KEY,
    canonical_key VARCHAR(240) NOT NULL UNIQUE CHECK (length(canonical_key) BETWEEN 3 AND 240),
    asset_class VARCHAR(16) NOT NULL CHECK (asset_class IN ('CRYPTO','STOCK','ETF','FOREX','COMMODITY','FUTURES','CFD')),
    canonical_symbol VARCHAR(64) NOT NULL CHECK (length(canonical_symbol) BETWEEN 1 AND 64),
    display_symbol VARCHAR(80) NOT NULL CHECK (length(display_symbol) BETWEEN 1 AND 80),
    name VARCHAR(200) NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    exchange VARCHAR(80) NOT NULL DEFAULT '',
    mic_code VARCHAR(12),
    country VARCHAR(80),
    country_code CHAR(2),
    currency VARCHAR(12),
    base_currency VARCHAR(12),
    quote_currency VARCHAR(12),
    instrument_type VARCHAR(40),
    isin VARCHAR(16),
    figi VARCHAR(20),
    metadata_priority INTEGER NOT NULL CHECK (metadata_priority BETWEEN 0 AND 1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX market_instrument_search ON trading.market_instrument(asset_class,active,canonical_symbol,name);
CREATE INDEX market_instrument_exchange ON trading.market_instrument(exchange,country_code,active);
CREATE INDEX market_instrument_route ON trading.market_instrument(canonical_symbol,exchange,asset_class);
CREATE INDEX market_instrument_isin ON trading.market_instrument(asset_class,isin) WHERE isin IS NOT NULL;

CREATE TABLE trading.instrument_provider_mapping (
    provider VARCHAR(32) NOT NULL CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,31}$'),
    provider_symbol VARCHAR(64) NOT NULL CHECK (length(provider_symbol) BETWEEN 1 AND 64),
    provider_exchange VARCHAR(80) NOT NULL DEFAULT '',
    instrument_id UUID NOT NULL REFERENCES trading.market_instrument(id) ON DELETE CASCADE,
    provider_priority INTEGER NOT NULL CHECK (provider_priority BETWEEN 0 AND 1000),
    supported_modes VARCHAR(120) NOT NULL DEFAULT '',
    supported_timeframes VARCHAR(120) NOT NULL DEFAULT '',
    provider_timezone VARCHAR(64),
    price_increment NUMERIC(28,12),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(provider,provider_symbol,provider_exchange)
);
CREATE INDEX instrument_provider_instrument ON trading.instrument_provider_mapping(instrument_id,active,provider_priority);
CREATE INDEX instrument_provider_active_source ON trading.instrument_provider_mapping(provider,active,instrument_id);

CREATE TABLE trading.instrument_alias (
    instrument_id UUID NOT NULL REFERENCES trading.market_instrument(id) ON DELETE CASCADE,
    alias VARCHAR(160) NOT NULL CHECK (length(alias) BETWEEN 1 AND 160),
    normalized_alias VARCHAR(160) NOT NULL CHECK (normalized_alias ~ '^[A-Z0-9]{1,160}$'),
    source_provider VARCHAR(32) NOT NULL,
    PRIMARY KEY(instrument_id,normalized_alias,source_provider)
);
CREATE INDEX instrument_alias_search ON trading.instrument_alias(normalized_alias,instrument_id);

CREATE TABLE trading.instrument_catalog_sync (
    provider VARCHAR(32) PRIMARY KEY CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,31}$'),
    status VARCHAR(16) NOT NULL CHECK (status IN ('DISABLED','RUNNING','SUCCESS','FAILED')),
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count BETWEEN 0 AND 100000),
    consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures BETWEEN 0 AND 1000000),
    failure_code VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
