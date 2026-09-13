package com.aitrading.market;

import java.util.*;

final class CuratedMarketUniverse {
    private static final Set<String> CRYPTO=Set.of("BTC","ETH","SOL","XRP","ADA","DOGE","LINK","AVAX","LTC","BCH","DOT","SUI","UNI","AAVE","XLM","HBAR");
    private static final Set<String> STOCKS=Set.of("AAPL","NVDA","MSFT","TSLA","AMZN","META","GOOGL","GOOG","AMD");
    private static final Set<String> ETFS=Set.of("SPY","QQQ","IWM","DIA");
    private static final Set<String> FOREX=Set.of("EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","EURGBP","EURJPY","GBPJPY","AUDJPY");
    private static final Set<String> COMMODITIES=Set.of("XAU","XAG","XPT","XPD","USOIL","WTICO","BCO","NATGAS");

    private CuratedMarketUniverse() { }

    static boolean includes(MarketDataProvider.Instrument item) {
        String assetClass=InstrumentCatalogProvider.normalizeAssetClass(item.assetClass());
        String symbol=upper(item.providerSymbol());
        String base=upper(item.base());
        String quote=upper(item.quote());
        return switch(assetClass) {
            case "CRYPTO" -> CRYPTO.contains(base)&&Set.of("USD","USDT").contains(quote);
            case "STOCK" -> STOCKS.contains(symbol);
            case "ETF" -> ETFS.contains(symbol);
            case "FOREX" -> FOREX.contains(base+quote);
            case "COMMODITY" -> COMMODITIES.contains(base);
            default -> false;
        };
    }

    private static String upper(String value){return value==null?"":value.toUpperCase(Locale.ROOT);}
}
