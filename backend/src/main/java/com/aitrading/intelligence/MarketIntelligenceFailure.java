package com.aitrading.intelligence;

public final class MarketIntelligenceFailure extends RuntimeException {
    private final String code;
    private final int status;
    public MarketIntelligenceFailure(String code, int status) { super("Market intelligence provider unavailable"); this.code = code; this.status = status; }
    public String code() { return code; }
    public int status() { return status; }
}
