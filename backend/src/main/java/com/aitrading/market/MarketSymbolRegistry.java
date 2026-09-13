package com.aitrading.market;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public final class MarketSymbolRegistry {
    private static final Instant UNKNOWN_AVAILABLE_FROM = Instant.parse("2000-01-01T00:00:00Z");

    public record Route(UUID instrumentId, String canonicalSymbol, String displaySymbol, String assetClass,
            String provider, String providerSymbol, String base, String quote, Instant declaredAvailableFrom,
            boolean realtimeSupported) {}

    private record Seed(String canonical, String asset, String provider, String providerSymbol, String base,
            String quote, Instant available, boolean realtime) {}

    private final JdbcTemplate jdbc;
    private final CtraderMarketDataClient ctrader;
    private final Map<String, List<Seed>> seeds;
    private final Map<String, MarketDataProvider> providers;

    public MarketSymbolRegistry(JdbcTemplate jdbc, List<MarketDataProvider> providers,
            CtraderMarketDataClient ctrader) {
        this.jdbc = jdbc;
        this.ctrader = ctrader;
        var providerMap = new TreeMap<String, MarketDataProvider>();
        for (var provider : providers) providerMap.put(provider.capabilities().providerId(), provider);
        this.providers = Map.copyOf(providerMap);
        this.seeds = seeds();
    }

    @PostConstruct
    void initialize() {
        for (var options : seeds.values()) for (var seed : options) {
            if (!providerConfigured(seed.provider()) && !seed.provider().equals("DUKASCOPY")) continue;
            upsert(seed);
        }
    }

    public Route resolve(String value) {
        if (value == null || value.length() > 80) throw new IllegalArgumentException("Invalid market symbol");
        var canonical = canonical(value);
        var seed = select(canonical).orElseThrow(() -> new IllegalArgumentException("Unsupported market symbol"));
        return persisted(seed);
    }

    public Route resolveProviderSymbol(String provider, String providerSymbol) {
        if (provider == null || providerSymbol == null || providerSymbol.length() > 80)
            throw new IllegalArgumentException("Invalid provider symbol");
        var market = providers.get(provider.toUpperCase(Locale.ROOT));
        if (market == null || !market.capabilities().configured())
            throw new IllegalArgumentException("Provider unavailable");
        var item = market.instrument(providerSymbol);
        var canonical = canonical(item.displaySymbol());
        var available = market instanceof HistoricalAvailabilityProvider source
                ? source.historicalAvailableFrom(providerSymbol) : UNKNOWN_AVAILABLE_FROM;
        var seed = new Seed(canonical, item.assetClass(), market.capabilities().providerId(), providerSymbol,
                item.base(), item.quote(), available, item.supportedModes().contains("REALTIME"));
        return persisted(seed);
    }

    public Route fallback(Route failed) {
        if (failed == null) throw new IllegalArgumentException("Invalid market route");
        var options = seeds.get(normalize(failed.canonicalSymbol()));
        if (options == null) return null;
        if (failed.assetClass().equals("COMMODITY") && !failed.provider().equals("CTRADER") && ctrader.configured()) {
            var dynamic = ctraderSeed(failed.canonicalSymbol()).orElse(null);
            if (dynamic != null) return persisted(dynamic);
        }
        for (var seed : options) {
            if (seed.provider().equals(failed.provider()) || !providerConfigured(seed.provider())) continue;
            return persisted(seed);
        }
        return null;
    }

    public List<Route> routes() {
        return seeds.values().stream().map(List::getFirst).map(Seed::canonical).distinct().map(this::resolve).toList();
    }

    private Route persisted(Seed seed) {
        var mapped = jdbc.queryForList("SELECT instrument_id FROM trading.instrument_provider_mapping "
                + "WHERE provider=? AND provider_symbol=? AND active=true ORDER BY provider_priority LIMIT 1",
                UUID.class, seed.provider(), seed.providerSymbol());
        if (!mapped.isEmpty()) return route(mapped.getFirst(), seed);
        upsert(seed);
        UUID id = jdbc.queryForObject("SELECT id FROM trading.market_instrument WHERE canonical_key=?", UUID.class,
                key(seed));
        return route(id, seed);
    }

    private Optional<Seed> select(String canonical) {
        var options = seeds.get(normalize(canonical));
        if (options == null) return Optional.empty();
        var asset = options.getFirst().asset();
        if (asset.equals("FOREX")) {
            if (ctrader.configured()) {
                var actual = ctraderSeed(canonical);
                if (actual.isPresent()) return actual;
            }
            return options.stream().filter(seed -> providerConfigured(seed.provider())).findFirst();
        }
        if (asset.equals("COMMODITY")) {
            var capital = options.stream().filter(seed -> seed.provider().equals("CAPITAL")
                    && providerConfigured(seed.provider())).findFirst();
            if (capital.isPresent()) return capital;
            if (ctrader.configured()) {
                var actual = ctraderSeed(canonical);
                if (actual.isPresent()) return actual;
            }
            return options.stream().filter(seed -> providerConfigured(seed.provider())).findFirst();
        }
        return options.stream().filter(seed -> providerConfigured(seed.provider())).findFirst();
    }

    private Optional<Seed> ctraderSeed(String canonical) {
        try {
            var needle = normalize(canonical);
            return ctrader.catalog().stream()
                    .filter(item -> normalize(item.name()).equals(needle)
                            || normalize(item.base() + item.quote()).equals(needle))
                    .findFirst()
                    .map(item -> new Seed(canonical, item.assetClass(), "CTRADER", Long.toString(item.id()),
                            item.base(), item.quote(), UNKNOWN_AVAILABLE_FROM, true));
        } catch (RuntimeException unavailable) {
            return Optional.empty();
        }
    }

    private boolean providerConfigured(String provider) {
        var value = providers.get(provider);
        return value != null && value.capabilities().configured();
    }

    private void upsert(Seed seed) {
        var existing = jdbc.queryForList("SELECT instrument_id FROM trading.instrument_provider_mapping "
                + "WHERE provider=? AND provider_symbol=? ORDER BY active DESC,provider_priority LIMIT 1",
                UUID.class, seed.provider(), seed.providerSymbol());
        UUID id;
        if (!existing.isEmpty()) {
            id = existing.getFirst();
            jdbc.update("UPDATE trading.market_instrument SET active=true,updated_at=clock_timestamp() WHERE id=?", id);
            jdbc.update("UPDATE trading.instrument_provider_mapping SET active=true,supported_modes=?,"
                    + "supported_timeframes='1m',last_seen_at=clock_timestamp() WHERE provider=? AND provider_symbol=?",
                    seed.realtime() ? "HISTORICAL,REALTIME" : "HISTORICAL", seed.provider(), seed.providerSymbol());
        } else {
            UUID proposed = UUID.nameUUIDFromBytes(("market:" + key(seed)).getBytes(StandardCharsets.UTF_8));
            id = jdbc.queryForObject("""
                    INSERT INTO trading.market_instrument(id,canonical_key,asset_class,canonical_symbol,display_symbol,name,exchange,currency,base_currency,quote_currency,instrument_type,metadata_priority,active)
                    VALUES(?,?,?,?,?,?,?, ?,?,?,?,100,true)
                    ON CONFLICT(canonical_key) DO UPDATE SET active=true,updated_at=clock_timestamp()
                    RETURNING id
                    """, UUID.class, proposed, key(seed), seed.asset(), seed.canonical(), seed.canonical(),
                    seed.canonical(), exchange(seed), seed.quote(), seed.base(), seed.quote(), type(seed));
            jdbc.update("""
                    INSERT INTO trading.instrument_provider_mapping(provider,provider_symbol,provider_exchange,instrument_id,provider_priority,supported_modes,supported_timeframes,provider_timezone,active,last_seen_at)
                    VALUES(?,?,?, ?,10,?,'1m','UTC',true,clock_timestamp())
                    ON CONFLICT(provider,provider_symbol,provider_exchange) DO UPDATE SET instrument_id=excluded.instrument_id,supported_modes=excluded.supported_modes,supported_timeframes='1m',active=true,last_seen_at=clock_timestamp()
                    """, seed.provider(), seed.providerSymbol(), exchange(seed), id,
                    seed.realtime() ? "HISTORICAL,REALTIME" : "HISTORICAL");
        }
        jdbc.update("INSERT INTO trading.instrument_alias(instrument_id,alias,normalized_alias,source_provider) "
                + "VALUES(?,?,?,?) ON CONFLICT DO NOTHING", id, seed.canonical(), normalize(seed.canonical()),
                seed.provider());
    }

    private static String canonical(String value) {
        var normalized = normalize(value);
        return switch (normalized) {
            case "EURUSD" -> "EUR/USD"; case "GBPUSD" -> "GBP/USD"; case "USDJPY" -> "USD/JPY";
            case "AUDUSD" -> "AUD/USD"; case "USDCAD" -> "USD/CAD"; case "USDCHF" -> "USD/CHF";
            case "NZDUSD" -> "NZD/USD"; case "XAUUSD", "GOLD" -> "XAU/USD";
            case "XAGUSD", "SILVER" -> "XAG/USD"; case "XPTUSD", "PLATINUM" -> "XPT/USD";
            case "XPDUSD", "PALLADIUM" -> "XPD/USD"; default -> value.strip().toUpperCase(Locale.ROOT);
        };
    }

    private static String exchange(Seed seed) {
        return switch (seed.provider()) {
            case "ALPACA" -> "US"; case "BINANCE" -> "Binance"; case "CAPITAL" -> "Capital.com";
            case "CTRADER" -> "cTrader"; default -> "Dukascopy";
        };
    }

    private static String type(Seed seed) { return seed.provider().equals("CAPITAL") ? "CFD" : "SPOT"; }
    private static String key(Seed seed) {
        return Set.of("CRYPTO", "FOREX", "COMMODITY").contains(seed.asset())
                ? InstrumentCatalogProvider.pairKey(seed.asset(), seed.base(), seed.quote(), type(seed))
                : InstrumentCatalogProvider.listingKey(seed.asset(), exchange(seed), seed.canonical());
    }

    private static Route route(UUID id, Seed seed) {
        return new Route(id, seed.canonical(), seed.canonical(), seed.asset(), seed.provider(), seed.providerSymbol(),
                seed.base(), seed.quote(), seed.available(), seed.realtime());
    }

    private static String normalize(String value) {
        return value.strip().toUpperCase(Locale.ROOT).replace("BINANCE:", "").replace("DUKASCOPY:", "")
                .replace("CAPITAL:", "").replace("CTRADER:", "").replace("/", "").replace("-", "")
                .replace("_", "").replace(" ", "");
    }

    private static Map<String, List<Seed>> seeds() {
        var rows = List.of(
                new Seed("AAPL", "STOCK", "ALPACA", "AAPL", "AAPL", "USD", Instant.parse("2017-01-01T00:00:00Z"), true),
                new Seed("MSFT", "STOCK", "ALPACA", "MSFT", "MSFT", "USD", Instant.parse("2017-01-01T00:00:00Z"), true),
                new Seed("NVDA", "STOCK", "ALPACA", "NVDA", "NVDA", "USD", Instant.parse("2017-01-01T00:00:00Z"), true),
                new Seed("SPY", "ETF", "ALPACA", "SPY", "SPY", "USD", Instant.parse("2017-01-01T00:00:00Z"), true),
                new Seed("QQQ", "ETF", "ALPACA", "QQQ", "QQQ", "USD", Instant.parse("2017-01-01T00:00:00Z"), true),
                new Seed("DIA", "ETF", "ALPACA", "DIA", "DIA", "USD", Instant.parse("2017-01-01T00:00:00Z"), true),
                new Seed("BTC/USDT", "CRYPTO", "BINANCE", "BTCUSDT", "BTC", "USDT", Instant.parse("2017-08-17T00:00:00Z"), true),
                new Seed("ETH/USDT", "CRYPTO", "BINANCE", "ETHUSDT", "ETH", "USDT", Instant.parse("2017-08-17T00:00:00Z"), true),
                new Seed("EUR/USD", "FOREX", "CAPITAL", "EURUSD", "EUR", "USD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("GBP/USD", "FOREX", "CAPITAL", "GBPUSD", "GBP", "USD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("USD/JPY", "FOREX", "CAPITAL", "USDJPY", "USD", "JPY", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("AUD/USD", "FOREX", "CAPITAL", "AUDUSD", "AUD", "USD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("USD/CAD", "FOREX", "CAPITAL", "USDCAD", "USD", "CAD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("USD/CHF", "FOREX", "CAPITAL", "USDCHF", "USD", "CHF", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("NZD/USD", "FOREX", "CAPITAL", "NZDUSD", "NZD", "USD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("XAU/USD", "COMMODITY", "CAPITAL", "GOLD", "XAU", "USD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("XAG/USD", "COMMODITY", "CAPITAL", "SILVER", "XAG", "USD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("XPT/USD", "COMMODITY", "CAPITAL", "PLATINUM", "XPT", "USD", Instant.parse("2024-01-03T00:00:00Z"), true),
                new Seed("XPD/USD", "COMMODITY", "CAPITAL", "PALLADIUM", "XPD", "USD", Instant.parse("2024-01-03T00:00:00Z"), true));
        var result = new LinkedHashMap<String, List<Seed>>();
        for (var row : rows) {
            var options = new ArrayList<>(result.getOrDefault(normalize(row.canonical()), List.of()));
            options.add(row);
            if (row.asset().equals("FOREX") || row.asset().equals("COMMODITY")) {
                var fallback = row.provider().equals("CAPITAL") ?
                        new Seed(row.canonical(), row.asset(), "DUKASCOPY", row.providerSymbol(), row.base(), row.quote(),
                                row.available(), false) : row;
                if (fallback.provider().equals("DUKASCOPY")) options.add(fallback);
            }
            result.put(normalize(row.canonical()), List.copyOf(options));
        }
        return Map.copyOf(result);
    }
}
