CREATE TABLE trading.replay_session (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    provider VARCHAR(24) NOT NULL,
    instrument VARCHAR(64) NOT NULL,
    timeframe VARCHAR(3) NOT NULL,
    requested_start TIMESTAMPTZ NOT NULL,
    requested_end TIMESTAMPTZ NOT NULL,
    cursor INTEGER NOT NULL CHECK(cursor>=0),
    initial_balance NUMERIC NOT NULL CHECK(initial_balance>0),
    balance NUMERIC NOT NULL,
    currency VARCHAR(12) NOT NULL,
    commission_bps NUMERIC NOT NULL CHECK(commission_bps BETWEEN 0 AND 1000),
    slippage_bps NUMERIC NOT NULL CHECK(slippage_bps BETWEEN 0 AND 1000),
    ambiguity_policy VARCHAR(32) NOT NULL DEFAULT 'STOP_FIRST_CONSERVATIVE',
    instrument_snapshot TEXT NOT NULL CHECK(octet_length(instrument_snapshot)<16000),
    history_snapshot TEXT NOT NULL CHECK(octet_length(history_snapshot)<=4000000),
    status VARCHAR(24) NOT NULL CHECK(status IN ('ACTIVE','ENDED','DATA_UNAVAILABLE')),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(id,owner_id)
);
CREATE INDEX replay_session_owner ON trading.replay_session(owner_id,created_at DESC,id);
CREATE TABLE trading.replay_trade (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    state VARCHAR(16) NOT NULL CHECK(state IN ('PENDING_ENTRY','OPEN','CLOSED','CANCELLED')),
    facts TEXT NOT NULL CHECK(octet_length(facts)<=16000),
    journal_id UUID UNIQUE,
    FOREIGN KEY(session_id,owner_id) REFERENCES trading.replay_session(id,owner_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX replay_one_open ON trading.replay_trade(session_id) WHERE state IN ('PENDING_ENTRY','OPEN');
CREATE TABLE trading.replay_command (
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    session_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL,
    applied_version INTEGER NOT NULL,
    PRIMARY KEY(owner_id,request_id),
    FOREIGN KEY(session_id,owner_id) REFERENCES trading.replay_session(id,owner_id) ON DELETE CASCADE
);
ALTER TABLE trading.journal_entry ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL','REPLAY','BROKER_IMPORT'));
ALTER TABLE trading.journal_entry ADD COLUMN replay_session_id UUID;
ALTER TABLE trading.journal_entry ADD COLUMN replay_trade_id UUID UNIQUE;
ALTER TABLE trading.journal_entry ADD COLUMN provenance TEXT;
CREATE INDEX journal_replay_filter ON trading.journal_entry(owner_id,source,replay_session_id);
CREATE TABLE trading.journal_day_note (
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    zone VARCHAR(64) NOT NULL,
    currency VARCHAR(12) NOT NULL,
    note TEXT NOT NULL CHECK(octet_length(note)<=4000),
    version INTEGER NOT NULL CHECK(version>0),
    PRIMARY KEY(owner_id,day,zone,currency)
);
