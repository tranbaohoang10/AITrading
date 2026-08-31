CREATE TABLE trading.conversation (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    title VARCHAR(120) NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    last_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_sequence BETWEEN 0 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id, request_id)
);
CREATE INDEX conversation_owner_created ON trading.conversation(owner_id, created_at DESC, id DESC);

CREATE TABLE trading.conversation_message (
    conversation_id UUID NOT NULL REFERENCES trading.conversation(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL CHECK (sequence > 0),
    request_id UUID NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(conversation_id, sequence),
    UNIQUE(conversation_id, request_id)
);
