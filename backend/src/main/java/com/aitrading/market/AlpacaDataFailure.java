package com.aitrading.market;

public final class AlpacaDataFailure extends RuntimeException {
    private final String code;
    private final int status;
    public AlpacaDataFailure(String code, int status) { super("Market data request rejected"); this.code=code; this.status=status; }
    public String code() { return code; }
    public int status() { return status; }
}
