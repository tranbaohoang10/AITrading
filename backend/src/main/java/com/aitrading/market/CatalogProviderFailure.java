package com.aitrading.market;

final class CatalogProviderFailure extends RuntimeException {
    private final String code;private final boolean transientFailure;
    CatalogProviderFailure(String code,boolean transientFailure){super(code);this.code=code;this.transientFailure=transientFailure;}
    String code(){return code;}boolean transientFailure(){return transientFailure;}
}
