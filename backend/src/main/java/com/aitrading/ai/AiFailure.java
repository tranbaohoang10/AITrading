package com.aitrading.ai;

/** Safe fixed codes only: never retain provider body, key, prompt or exception cause. */
public final class AiFailure extends RuntimeException {
    public enum Code { AI_UNCONFIGURED, AI_TIMEOUT, AI_RATE_LIMITED, AI_PROVIDER_AUTH,
        AI_PROVIDER_UNAVAILABLE, AI_PROVIDER_REJECTED, AI_INVALID_RESPONSE, AI_REFUSED,
        AI_INCOMPLETE, AI_RESPONSE_LIMIT, AI_BUSY, AI_CANCELLED, AI_EXPIRED, AI_STALE_CONTEXT }
    private final Code code;
    public AiFailure(Code code) { super(code.name()); this.code=code; }
    public Code code() { return code; }
}
