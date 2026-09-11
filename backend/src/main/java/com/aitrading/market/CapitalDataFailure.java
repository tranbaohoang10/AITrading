package com.aitrading.market;

public final class CapitalDataFailure extends RuntimeException {
    private final String code;
    private final int status;
    public CapitalDataFailure(String code,int status){super("Capital market data request rejected");this.code=code;this.status=status;}
    public String code(){return code;}
    public int status(){return status;}
}
