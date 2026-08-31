package com.aitrading.strategy;

import com.aitrading.dsl.DslValidator;

public final class StrategyValidationFailure extends RuntimeException {
    private final DslValidator.Validation validation;
    public StrategyValidationFailure(DslValidator.Validation validation) {
        super("Strategy validation failed"); this.validation=validation;
    }
    public DslValidator.Validation validation() { return validation; }
}
