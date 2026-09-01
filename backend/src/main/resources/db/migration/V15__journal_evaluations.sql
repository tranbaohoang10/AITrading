CREATE TABLE trading.journal_evaluation (
    journal_id UUID NOT NULL REFERENCES trading.journal_entry(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    expected_version INTEGER NOT NULL CHECK(expected_version BETWEEN 1 AND 100),
    snapshot_hash CHAR(64) NOT NULL CHECK(snapshot_hash ~ '^[0-9a-f]{64}$'),
    provider VARCHAR(16) NOT NULL CHECK(provider IN ('gemini','openai')),
    model VARCHAR(128) NOT NULL,
    state VARCHAR(16) NOT NULL CHECK(state IN ('PENDING','READY','INSUFFICIENT','FAILED','CANCELLED')),
    error_code VARCHAR(32),
    result_json TEXT CHECK(octet_length(result_json)<=131072),
    score INTEGER CHECK(score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT(clock_timestamp()+INTERVAL '40 seconds'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(journal_id,request_id),
    CHECK((state='PENDING' AND error_code IS NULL AND result_json IS NULL AND score IS NULL)
       OR (state IN ('FAILED','CANCELLED') AND error_code IS NOT NULL AND result_json IS NULL AND score IS NULL)
       OR (state='READY' AND error_code IS NULL AND result_json IS NOT NULL AND score IS NOT NULL)
       OR (state='INSUFFICIENT' AND error_code IS NULL AND result_json IS NOT NULL AND score IS NULL))
);
CREATE UNIQUE INDEX journal_evaluation_pending ON trading.journal_evaluation(journal_id) WHERE state='PENDING';
CREATE INDEX journal_evaluation_owner ON trading.journal_evaluation(owner_id,created_at DESC);
