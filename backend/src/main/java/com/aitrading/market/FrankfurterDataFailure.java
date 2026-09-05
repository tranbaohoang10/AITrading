package com.aitrading.market;

public final class FrankfurterDataFailure extends RuntimeException {
    private final String code;
    private final int status;
    public FrankfurterDataFailure(String code, int status) { super("Forex reference data request rejected"); this.code = code; this.status = status; }
    public String code() { return code; }
    public int status() { return status; }
}
