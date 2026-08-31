package com.aitrading.pine;

/** Fixed diagnostics only; never echo submitted source. */
public final class PineFailure extends RuntimeException {
    private final String code;
    public PineFailure(String code) { super("Pine export rejected"); this.code = code; }
    public String code() { return code; }
}
