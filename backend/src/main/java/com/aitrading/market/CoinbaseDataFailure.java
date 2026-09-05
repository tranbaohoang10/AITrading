package com.aitrading.market;

public final class CoinbaseDataFailure extends RuntimeException {
    private final String code;
    private final int status;
    public CoinbaseDataFailure(String code,int status) { super("Coinbase market data request rejected"); this.code=code; this.status=status; }
    public String code() { return code; }
    public int status() { return status; }
}
