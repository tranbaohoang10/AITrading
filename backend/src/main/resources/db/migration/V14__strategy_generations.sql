CREATE TABLE trading.strategy_generation (
    strategy_id UUID NOT NULL REFERENCES trading.strategy(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES trading.conversation(id) ON DELETE CASCADE,
    expected_revision INTEGER NOT NULL CHECK (expected_revision BETWEEN 1 AND 100),
    expected_conversation_version BIGINT NOT NULL CHECK (expected_conversation_version > 0),
    source_sequence BIGINT NOT NULL CHECK (source_sequence BETWEEN 1 AND 1999),
    context_start BIGINT NOT NULL CHECK (context_start > 0),
    context_count INTEGER NOT NULL CHECK (context_count BETWEEN 1 AND 20),
    context_hash CHAR(64) NOT NULL CHECK (context_hash ~ '^[0-9a-f]{64}$'),
    provider VARCHAR(16) NOT NULL CHECK (provider IN ('gemini','openai')),
    model VARCHAR(128) NOT NULL,
    state VARCHAR(16) NOT NULL CHECK (state IN ('PENDING','READY','CLARIFICATION','FAILED','CANCELLED','REJECTED','ACCEPTED')),
    error_code VARCHAR(32),
    proposal_json TEXT CHECK (octet_length(proposal_json) <= 524288),
    dsl_hash CHAR(64) CHECK (dsl_hash ~ '^[0-9a-f]{64}$'),
    accepted_revision INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '40 seconds'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(strategy_id,request_id),
    FOREIGN KEY(strategy_id,accepted_revision) REFERENCES trading.strategy_revision(strategy_id,revision),
    CHECK (context_start <= source_sequence),
    CHECK ((state='PENDING' AND error_code IS NULL AND proposal_json IS NULL AND dsl_hash IS NULL AND accepted_revision IS NULL)
        OR (state IN ('FAILED','CANCELLED') AND error_code IS NOT NULL AND proposal_json IS NULL AND dsl_hash IS NULL AND accepted_revision IS NULL)
        OR (state='CLARIFICATION' AND error_code IS NULL AND proposal_json IS NOT NULL AND dsl_hash IS NULL AND accepted_revision IS NULL)
        OR (state='READY' AND error_code IS NULL AND proposal_json IS NOT NULL AND dsl_hash IS NOT NULL AND accepted_revision IS NULL)
        OR (state='REJECTED' AND error_code IS NULL AND proposal_json IS NOT NULL AND accepted_revision IS NULL)
        OR (state='ACCEPTED' AND error_code IS NULL AND proposal_json IS NOT NULL AND dsl_hash IS NOT NULL AND accepted_revision=expected_revision+1))
);
CREATE UNIQUE INDEX strategy_generation_pending ON trading.strategy_generation(strategy_id) WHERE state='PENDING';
CREATE INDEX strategy_generation_conversation ON trading.strategy_generation(conversation_id);
