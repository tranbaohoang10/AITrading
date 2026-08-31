CREATE TABLE trading.app_user (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
    display_name VARCHAR(80) NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
    password_hash VARCHAR(255) NOT NULL,
    credential_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Spring Session JDBC PostgreSQL schema; Flyway owns initialization.
CREATE TABLE trading.spring_session (
    primary_id CHAR(36) PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    creation_time BIGINT NOT NULL,
    last_access_time BIGINT NOT NULL,
    max_inactive_interval INT NOT NULL,
    expiry_time BIGINT NOT NULL,
    principal_name VARCHAR(254)
);
CREATE UNIQUE INDEX spring_session_ix1 ON trading.spring_session (session_id);
CREATE INDEX spring_session_ix2 ON trading.spring_session (expiry_time);
CREATE INDEX spring_session_ix3 ON trading.spring_session (principal_name);
CREATE TABLE trading.spring_session_attributes (
    session_primary_id CHAR(36) NOT NULL REFERENCES trading.spring_session(primary_id) ON DELETE CASCADE,
    attribute_name VARCHAR(200) NOT NULL,
    attribute_bytes BYTEA NOT NULL,
    PRIMARY KEY (session_primary_id, attribute_name)
);

CREATE TABLE trading.auth_rate_bucket (
    bucket_key VARCHAR(80) NOT NULL,
    window_start BIGINT NOT NULL,
    attempts INT NOT NULL CHECK (attempts > 0),
    PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX auth_rate_bucket_expiry ON trading.auth_rate_bucket(window_start);
