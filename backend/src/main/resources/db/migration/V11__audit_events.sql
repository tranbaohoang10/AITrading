CREATE TABLE trading.audit_event (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    owner_id UUID REFERENCES trading.app_user(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    category VARCHAR(16) NOT NULL CHECK (category IN ('AUTH','RESOURCE','SECURITY','JOB')),
    operation VARCHAR(32) NOT NULL CHECK (operation IN ('LOGIN','LOGOUT','REGISTER','PROFILE','PASSWORD','AUTH_OTHER',
        'CONVERSATIONS','DATASETS','STRATEGIES','BACKTESTS','JOURNAL','DSL','AI','AUDIT','OTHER',
        'JOB_QUEUED','JOB_RUNNING','JOB_SUCCEEDED','JOB_FAILED','JOB_CANCELLED','JOB_DELETED')),
    method VARCHAR(8) NOT NULL CHECK (method IN ('GET','HEAD','OPTIONS','POST','PUT','PATCH','DELETE','OTHER','JOB')),
    http_status INTEGER CHECK (http_status BETWEEN 100 AND 599),
    resource_id UUID,
    error_code VARCHAR(48) CHECK (error_code IN ('WORKER_UNCONFIGURED','WORKER_RESOURCE_UNAVAILABLE','WORKER_TIMEOUT',
        'WORKER_OUTPUT_LIMIT','WORKER_INVALID_RESULT','WORKER_FAILED','WORKER_INTERRUPTED','QUEUE_EXPIRED',
        'JOB_CANCELLED','CREDENTIAL_REVOKED','SNAPSHOT_INVALID','ENGINE_REJECTED')),
    CHECK ((category='JOB' AND method='JOB' AND http_status IS NULL AND resource_id IS NOT NULL AND operation LIKE 'JOB_%')
        OR (category<>'JOB' AND method<>'JOB' AND http_status IS NOT NULL AND resource_id IS NULL AND error_code IS NULL AND operation NOT LIKE 'JOB_%'))
);
CREATE INDEX audit_owner_id ON trading.audit_event(owner_id,id DESC);
CREATE INDEX audit_retention ON trading.audit_event(occurred_at,id);

CREATE FUNCTION trading.guard_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' AND (OLD.occurred_at < clock_timestamp()-interval '30 days'
        OR (OLD.owner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM trading.app_user WHERE id=OLD.owner_id))) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Audit rows are immutable during retention' USING ERRCODE='23514';
END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON trading.audit_event
    FOR EACH ROW EXECUTE FUNCTION trading.guard_audit_event();

ALTER TABLE trading.backtest_job ADD COLUMN audit_request_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE FUNCTION trading.audit_job_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    item trading.backtest_job;
    action VARCHAR(32);
BEGIN
    IF TG_OP='UPDATE' AND NEW.state=OLD.state THEN RETURN NEW; END IF;
    IF TG_OP='DELETE' THEN item:=OLD; action:='JOB_DELETED';
    ELSE item:=NEW; action:='JOB_'||NEW.state; END IF;
    -- Account privacy deletion cascades both jobs and audit, without recreating rows.
    IF EXISTS(SELECT 1 FROM trading.app_user WHERE id=item.owner_id) THEN
        INSERT INTO trading.audit_event(owner_id,request_id,category,operation,method,resource_id,error_code)
        VALUES(item.owner_id,item.audit_request_id,'JOB',action,'JOB',item.id,item.error_code);
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER backtest_audit AFTER INSERT OR UPDATE OR DELETE ON trading.backtest_job
    FOR EACH ROW EXECUTE FUNCTION trading.audit_job_transition();
