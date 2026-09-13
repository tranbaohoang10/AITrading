package com.aitrading.market;

import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class MarketProviderRouter {
    private static final Map<String, List<String>> ORDER = Map.of(
            "STOCK", List.of("ALPACA"),
            "ETF", List.of("ALPACA"),
            "CRYPTO", List.of("BINANCE"),
            "FOREX", List.of("CTRADER", "CAPITAL", "DUKASCOPY"),
            "COMMODITY", List.of("CAPITAL", "CTRADER", "DUKASCOPY"));

    private MarketProviderRouter() {}

    public static List<String> providersFor(String assetClass) {
        if (assetClass == null) throw new IllegalArgumentException("Invalid asset class");
        var order = ORDER.get(assetClass.strip().toUpperCase(Locale.ROOT));
        if (order == null) throw new IllegalArgumentException("Unsupported asset class");
        return order;
    }

    public static String primary(String assetClass) { return providersFor(assetClass).getFirst(); }

    public static boolean fallbackAllowed(String assetClass, String provider) {
        return providersFor(assetClass).contains(provider == null ? "" : provider.toUpperCase(Locale.ROOT));
    }
}
