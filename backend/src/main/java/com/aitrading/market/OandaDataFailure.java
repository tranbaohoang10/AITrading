package com.aitrading.market;

public class OandaDataFailure extends RuntimeException {
    private final String code;private final int status;
    OandaDataFailure(String code,int status){super(code);this.code=code;this.status=status;}
    public String code(){return code;}public int status(){return status;}
}
