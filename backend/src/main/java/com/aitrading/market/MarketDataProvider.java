package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Backend-normalized market facts. Provider identity is part of every request. */
public interface MarketDataProvider {
    record Capabilities(String providerId, String displayName, List<String> assetClasses,
            List<String> supportedTimeframes, boolean historical, boolean realtime,
            boolean delayed, boolean snapshot, boolean eod, boolean bulkHistorical,
            boolean historicalReplaySupported, boolean symbolSearchSupported,
            boolean requiresApiKey, boolean requiresEntitlement, boolean displayAllowed,
            String licenseStatus, String coverageDiscoveryMode, int maxCandlesPerRequest,
            String providerTimezone, boolean configured, List<String> limitations) {}
    record Instrument(String instrumentId, String displaySymbol, String providerSymbol,
            String provider, String assetClass, String base, String quote, String exchange,
            String currency, String market, String timezone, BigDecimal priceIncrement,
            BigDecimal quantityIncrement, Integer quantityPrecision, BigDecimal minQuantity,
            BigDecimal minNotional, String sizeUnit, BigDecimal contractSize,
            BigDecimal pointValue, BigDecimal lotSize, String sizingStatus,
            List<String> supportedModes, List<String> supportedTimeframes,
            String historyCoverageStatus) {}
    record Candle(Instant time, BigDecimal open, BigDecimal high, BigDecimal low,
            BigDecimal close, BigDecimal volume) {
        public Candle {
            if(time==null || !valid(open,false) || !valid(high,false) || !valid(low,false)
                    || !valid(close,false) || !valid(volume,true)
                    || high.compareTo(open.max(close).max(low))<0
                    || low.compareTo(open.min(close).min(high))>0)
                throw new IllegalArgumentException("Invalid provider candle");
        }
        private static boolean valid(BigDecimal n, boolean zero) {
            return n!=null && n.scale()<=12 && n.precision()<=28
                    && (zero?n.signum()>=0:n.signum()>0)
                    && n.compareTo(new BigDecimal("1000000000000000"))<=0;
        }
    }
    record Coverage(String provider, String instrument, String timeframe, String status,
            Instant earliestAvailableUtc, Instant latestAvailableUtc, Instant verifiedFromUtc,
            Instant verifiedThroughUtc, Instant checkedAt, int maxCandlesPerRequest,
            boolean bulkAvailable, List<String> limitations) {}
    Capabilities capabilities();
    List<Instrument> search(String query);
    Instrument instrument(String symbol);
    List<Candle> history(String symbol, String timeframe, Instant from, Instant to);

    static int seconds(String timeframe) {
        if(timeframe==null) throw new IllegalArgumentException("Invalid timeframe");
        return switch(timeframe) {
            case "1m" -> 60; case "5m" -> 300; case "15m" -> 900;
            case "30m" -> 1800; case "1h" -> 3600; case "4h" -> 14400;
            case "1d" -> 86400; default -> throw new IllegalArgumentException("Invalid timeframe");
        };
    }
    static void range(String timeframe, Instant from, Instant to) {
        int step=seconds(timeframe);
        if(from==null || to==null || from.isBefore(Instant.parse("2000-01-01T00:00:00Z"))
                || !to.isAfter(from) || to.isAfter(Instant.now())
                || to.getEpochSecond()-from.getEpochSecond()>(long)step*20000
                || to.getEpochSecond()-from.getEpochSecond()>366L*86400)
            throw new IllegalArgumentException("Invalid historical range");
    }
}
