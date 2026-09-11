package com.aitrading.market;

public final class DukascopyDataFailure extends RuntimeException {
    private final String code;private final int status;
    public DukascopyDataFailure(String code,int status){super(code);this.code=code;this.status=status;}
    public String code(){return code;}public int status(){return status;}
}
