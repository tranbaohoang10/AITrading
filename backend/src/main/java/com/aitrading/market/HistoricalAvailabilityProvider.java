package com.aitrading.market;

import java.time.Instant;

public interface HistoricalAvailabilityProvider {
    Instant historicalAvailableFrom(String providerSymbol);
}
