package com.aitrading.market;

/** Fixed validation code and one-based CSV line only; never retains input data. */
public final class MarketDataFailure extends RuntimeException {
    private final String code;
    private final int line;
    public MarketDataFailure(String code, int line) {
        super("CSV does not satisfy the supported market-data contract.");
        this.code=code; this.line=line;
    }
    public String code() { return code; }
    public int line() { return line; }
}
