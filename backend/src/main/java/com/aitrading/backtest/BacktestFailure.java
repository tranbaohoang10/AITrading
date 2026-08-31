package com.aitrading.backtest;

public final class BacktestFailure extends RuntimeException {
    public enum Code { WORKER_UNCONFIGURED, WORKER_RESOURCE_UNAVAILABLE, WORKER_TIMEOUT, WORKER_OUTPUT_LIMIT,
        WORKER_INVALID_RESULT, WORKER_FAILED, WORKER_INTERRUPTED, QUEUE_EXPIRED, JOB_CANCELLED, CREDENTIAL_REVOKED,
        SNAPSHOT_INVALID, ENGINE_REJECTED }
    private final Code code;
    public BacktestFailure(Code code){super(code.name());this.code=code;}
    public Code code(){return code;}
}
