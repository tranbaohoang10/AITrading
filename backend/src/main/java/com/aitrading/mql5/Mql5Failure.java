package com.aitrading.mql5;

/** Fixed diagnostics only; never echo submitted source. */
public final class Mql5Failure extends RuntimeException {
    private final String code;
    public Mql5Failure(String code) { super("Mql5 export rejected"); this.code = code; }
    public String code() { return code; }
}
