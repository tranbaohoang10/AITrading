CREATE TABLE trading.private_document(
 id UUID PRIMARY KEY,owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,title VARCHAR(160) NOT NULL,current_version INTEGER NOT NULL DEFAULT 1 CHECK(current_version BETWEEN 1 AND 50),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(owner_id,request_id)
);
CREATE TABLE trading.private_document_version(
 document_id UUID NOT NULL REFERENCES trading.private_document(id) ON DELETE CASCADE,version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 50),
 request_id UUID NOT NULL,filename VARCHAR(200) NOT NULL,media_type VARCHAR(32) NOT NULL CHECK(media_type IN('text/plain','application/pdf')),
 content_hash CHAR(64) NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),source_bytes BYTEA NOT NULL CHECK(octet_length(source_bytes)<=2097152),
 extracted_text TEXT NOT NULL CHECK(octet_length(extracted_text) BETWEEN 1 AND 102400),page_count INTEGER NOT NULL CHECK(page_count BETWEEN 1 AND 50),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(document_id,version),UNIQUE(document_id,request_id)
);
CREATE TABLE trading.private_document_chunk(
 document_id UUID NOT NULL,version INTEGER NOT NULL,chunk_index INTEGER NOT NULL CHECK(chunk_index BETWEEN 0 AND 199),page_number INTEGER,
 content TEXT NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 4096),content_hash CHAR(64) NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),
 PRIMARY KEY(document_id,version,chunk_index),FOREIGN KEY(document_id,version) REFERENCES trading.private_document_version(document_id,version) ON DELETE CASCADE,
 CHECK(page_number IS NULL OR page_number BETWEEN 1 AND 50)
);
CREATE INDEX private_document_owner ON trading.private_document(owner_id,updated_at DESC);
CREATE TABLE trading.private_document_rag_attempt(
 id UUID PRIMARY KEY,owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
 question_hash CHAR(64) NOT NULL CHECK(question_hash~'^[0-9a-f]{64}$'),
 result_kind VARCHAR(16) NOT NULL CHECK(result_kind IN('answer','clarification','insufficient','failed')),
 answer TEXT CHECK(answer IS NULL OR octet_length(answer)<=12000),assumptions_json TEXT NOT NULL CHECK(octet_length(assumptions_json)<=4096),
 provider VARCHAR(16),model VARCHAR(128),error_code VARCHAR(32),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK((result_kind='failed')=(error_code IS NOT NULL)),CHECK((provider IS NULL)=(model IS NULL))
);
CREATE TABLE trading.private_document_rag_citation(
 attempt_id UUID NOT NULL REFERENCES trading.private_document_rag_attempt(id) ON DELETE CASCADE,
 ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 1 AND 4),document_id UUID NOT NULL,version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 50),
 chunk_index INTEGER NOT NULL CHECK(chunk_index BETWEEN 0 AND 199),page_number INTEGER,title VARCHAR(160) NOT NULL,
 excerpt TEXT NOT NULL CHECK(octet_length(excerpt) BETWEEN 1 AND 4096),content_hash CHAR(64) NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),
 PRIMARY KEY(attempt_id,ordinal),CHECK(page_number IS NULL OR page_number BETWEEN 1 AND 50)
);
CREATE INDEX private_document_rag_owner ON trading.private_document_rag_attempt(owner_id,created_at DESC);
