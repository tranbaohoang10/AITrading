CREATE TABLE trading.backtest_notification (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES trading.app_user(id) ON DELETE CASCADE,
    job_id UUID NOT NULL UNIQUE,
    state VARCHAR(16) NOT NULL CHECK (state IN ('SUCCEEDED','FAILED','CANCELLED')),
    error_code VARCHAR(48) CHECK (error_code IN ('WORKER_UNCONFIGURED','WORKER_RESOURCE_UNAVAILABLE','WORKER_TIMEOUT',
        'WORKER_OUTPUT_LIMIT','WORKER_INVALID_RESULT','WORKER_FAILED','WORKER_INTERRUPTED','QUEUE_EXPIRED',
        'JOB_CANCELLED','CREDENTIAL_REVOKED','SNAPSHOT_INVALID','ENGINE_REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    read_at TIMESTAMPTZ,
    CHECK ((state='SUCCEEDED' AND error_code IS NULL) OR (state<>'SUCCEEDED' AND error_code IS NOT NULL))
);
CREATE INDEX notification_owner_id ON trading.backtest_notification(owner_id,id DESC);
CREATE INDEX notification_unread ON trading.backtest_notification(owner_id,created_at) WHERE read_at IS NULL;
CREATE INDEX notification_retention ON trading.backtest_notification(created_at,id);

CREATE FUNCTION trading.notify_backtest_terminal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO trading.backtest_notification(owner_id,job_id,state,error_code)
    VALUES(NEW.owner_id,NEW.id,NEW.state,NEW.error_code)
    ON CONFLICT(job_id) DO NOTHING;
    RETURN NEW;
END $$;
CREATE TRIGGER backtest_notification AFTER UPDATE OF state ON trading.backtest_job
    FOR EACH ROW WHEN (OLD.state IN ('QUEUED','RUNNING') AND NEW.state IN ('SUCCEEDED','FAILED','CANCELLED'))
    EXECUTE FUNCTION trading.notify_backtest_terminal();
