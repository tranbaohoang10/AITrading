package com.aitrading.market;

public class CtraderDataFailure extends RuntimeException {
    private final String code;private final int status;
    CtraderDataFailure(String code,int status){super(code);this.code=code;this.status=status;}
    public String code(){return code;}public int status(){return status;}
}
