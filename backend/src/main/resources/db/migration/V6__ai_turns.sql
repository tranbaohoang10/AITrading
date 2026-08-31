CREATE TABLE trading.ai_turn (
    conversation_id UUID NOT NULL REFERENCES trading.conversation(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    expected_version BIGINT NOT NULL CHECK (expected_version > 0),
    source_sequence BIGINT NOT NULL CHECK (source_sequence BETWEEN 1 AND 1999),
    context_start BIGINT NOT NULL CHECK (context_start > 0),
    context_end BIGINT NOT NULL,
    context_count INTEGER NOT NULL CHECK (context_count BETWEEN 1 AND 20),
    context_hash CHAR(64) NOT NULL CHECK (context_hash ~ '^[0-9a-f]{64}$'),
    state VARCHAR(16) NOT NULL CHECK (state IN ('PENDING','SUCCEEDED','FAILED','CANCELLED')),
    error_code VARCHAR(32),
    provider VARCHAR(16) NOT NULL CHECK (provider = 'openai'),
    model VARCHAR(128) NOT NULL,
    assistant_sequence BIGINT,
    response_json TEXT CHECK (length(response_json) <= 24000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '45 seconds'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (conversation_id, request_id),
    FOREIGN KEY (conversation_id, assistant_sequence) REFERENCES trading.conversation_message(conversation_id, sequence),
    CHECK (context_start <= context_end AND context_end = source_sequence),
    CHECK ((state = 'PENDING' AND error_code IS NULL AND assistant_sequence IS NULL AND response_json IS NULL)
        OR (state = 'SUCCEEDED' AND error_code IS NULL AND assistant_sequence IS NOT NULL AND response_json IS NOT NULL)
        OR (state IN ('FAILED','CANCELLED') AND error_code IS NOT NULL AND assistant_sequence IS NULL AND response_json IS NULL))
);
CREATE UNIQUE INDEX ai_turn_one_pending ON trading.ai_turn(conversation_id) WHERE state='PENDING';
