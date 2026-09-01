CREATE TABLE trading.chart_image_analysis(
 id UUID PRIMARY KEY,owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,request_hash CHAR(64) NOT NULL CHECK(request_hash~'^[0-9a-f]{64}$'),
 question VARCHAR(1000) NOT NULL,image_hash CHAR(64) NOT NULL CHECK(image_hash~'^[0-9a-f]{64}$'),
 image_png BYTEA NOT NULL CHECK(octet_length(image_png) BETWEEN 32 AND 2097152),width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 4096),height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 4096),
 result_json TEXT NOT NULL CHECK(octet_length(result_json) BETWEEN 2 AND 32768),provider VARCHAR(16) NOT NULL,model VARCHAR(128) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(owner_id,request_id)
);
CREATE INDEX chart_image_analysis_owner ON trading.chart_image_analysis(owner_id,created_at DESC,id DESC);
