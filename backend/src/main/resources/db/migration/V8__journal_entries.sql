CREATE TABLE trading.journal_entry (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 100),
    symbol VARCHAR(32) NOT NULL CHECK (symbol ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$'),
    timeframe VARCHAR(3) NOT NULL CHECK (timeframe IN ('1m','5m','15m','30m','1h','4h','1d')),
    settlement_currency VARCHAR(12) NOT NULL CHECK (settlement_currency ~ '^[A-Z0-9]{2,12}$'),
    side VARCHAR(5) NOT NULL CHECK (side IN ('LONG','SHORT')),
    state VARCHAR(6) NOT NULL CHECK (state IN ('OPEN','CLOSED')),
    quantity NUMERIC NOT NULL CHECK (quantity>0 AND quantity<=1000000000000 AND scale(quantity)<=8),
    entry_price NUMERIC NOT NULL CHECK (entry_price>0 AND entry_price<=1000000000000 AND scale(entry_price)<=8),
    exit_price NUMERIC CHECK (exit_price>0 AND exit_price<=1000000000000 AND scale(exit_price)<=8),
    entry_fee NUMERIC NOT NULL CHECK (entry_fee>=0 AND entry_fee<=1000000000000 AND scale(entry_fee)<=8),
    exit_fee NUMERIC NOT NULL CHECK (exit_fee>=0 AND exit_fee<=1000000000000 AND scale(exit_fee)<=8),
    entry_time TIMESTAMPTZ NOT NULL CHECK (entry_time>='2000-01-01T00:00:00Z' AND entry_time<'2101-01-01T00:00:00Z'),
    exit_time TIMESTAMPTZ CHECK (exit_time>='2000-01-01T00:00:00Z' AND exit_time<'2101-01-01T00:00:00Z'),
    entry_reason TEXT NOT NULL CHECK (octet_length(entry_reason) BETWEEN 1 AND 2000),
    notes TEXT NOT NULL CHECK (octet_length(notes)<=4000),
    -- Provenance only: deleting an uploaded dataset must not delete manual records.
    dataset_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(id,owner_id),
    CHECK ((state='OPEN' AND exit_price IS NULL AND exit_time IS NULL AND exit_fee=0)
       OR (state='CLOSED' AND exit_price IS NOT NULL AND exit_time IS NOT NULL AND exit_time>=entry_time))
);
CREATE INDEX journal_owner_activity ON trading.journal_entry
    (owner_id,settlement_currency,(COALESCE(exit_time,entry_time)) DESC,id DESC);

CREATE TABLE trading.journal_write (
    owner_id UUID NOT NULL,
    request_id UUID NOT NULL,
    entry_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    applied_version INTEGER NOT NULL CHECK (applied_version BETWEEN 1 AND 100),
    PRIMARY KEY(owner_id,request_id),
    UNIQUE(entry_id,applied_version),
    FOREIGN KEY(entry_id,owner_id) REFERENCES trading.journal_entry(id,owner_id) ON DELETE CASCADE
);
