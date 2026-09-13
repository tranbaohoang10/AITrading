package com.aitrading.market;

public interface HistoricalSourceTimeframeProvider {
    String historicalSourceTimeframe();
    default int maximumHistoricalSourceCandles(){return 20_000;}
}
