package com.aitrading.market;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public final class MarketSymbolRegistry {
    public record Route(UUID instrumentId,String canonicalSymbol,String displaySymbol,String assetClass,String provider,
            String providerSymbol,String base,String quote,Instant declaredAvailableFrom,boolean realtimeSupported) {}
    private record Seed(String canonical,String asset,String provider,String providerSymbol,String base,String quote,Instant available,boolean realtime) {}
    private final JdbcTemplate jdbc;private final Map<String,Seed> seeds;
    public MarketSymbolRegistry(JdbcTemplate jdbc){this.jdbc=jdbc;this.seeds=seeds();}
    @PostConstruct void initialize(){for(var seed:new LinkedHashSet<>(seeds.values()))upsert(seed);}
    public Route resolve(String value){if(value==null||value.length()>80)throw new IllegalArgumentException("Invalid market symbol");var seed=seeds.get(normalize(value));if(seed==null)throw new IllegalArgumentException("Unsupported market symbol");var mapped=jdbc.queryForList("SELECT instrument_id FROM trading.instrument_provider_mapping WHERE provider=? AND provider_symbol=? AND active=true ORDER BY provider_priority LIMIT 1",UUID.class,seed.provider(),seed.providerSymbol());if(!mapped.isEmpty())return route(mapped.getFirst(),seed);upsert(seed);UUID id=jdbc.queryForObject("SELECT id FROM trading.market_instrument WHERE canonical_key=?",UUID.class,key(seed));return route(id,seed);}
    public List<Route> routes(){return new LinkedHashSet<>(seeds.values()).stream().map(seed->resolve(seed.canonical())).toList();}
    private void upsert(Seed seed){var existing=jdbc.queryForList("SELECT instrument_id FROM trading.instrument_provider_mapping WHERE provider=? AND provider_symbol=? ORDER BY active DESC,provider_priority LIMIT 1",UUID.class,seed.provider(),seed.providerSymbol());UUID id;if(!existing.isEmpty()){id=existing.getFirst();jdbc.update("UPDATE trading.market_instrument SET active=true,updated_at=clock_timestamp() WHERE id=?",id);jdbc.update("UPDATE trading.instrument_provider_mapping SET active=true,supported_modes=?,supported_timeframes='1m',last_seen_at=clock_timestamp() WHERE provider=? AND provider_symbol=?",seed.realtime()?"HISTORICAL,REALTIME":"HISTORICAL",seed.provider(),seed.providerSymbol());}else{UUID proposed=UUID.nameUUIDFromBytes(("market:"+key(seed)).getBytes(StandardCharsets.UTF_8));id=jdbc.queryForObject("""
            INSERT INTO trading.market_instrument(id,canonical_key,asset_class,canonical_symbol,display_symbol,name,exchange,currency,base_currency,quote_currency,instrument_type,metadata_priority,active)
            VALUES(?,?,?,?,?,?,?, ?,?,?,?,100,true)
            ON CONFLICT(canonical_key) DO UPDATE SET active=true,updated_at=clock_timestamp()
            RETURNING id
            """,UUID.class,proposed,key(seed),seed.asset(),seed.canonical(),seed.canonical(),seed.canonical(),exchange(seed),seed.quote(),seed.base(),seed.quote(),"SPOT");
        jdbc.update("""
            INSERT INTO trading.instrument_provider_mapping(provider,provider_symbol,provider_exchange,instrument_id,provider_priority,supported_modes,supported_timeframes,provider_timezone,active,last_seen_at)
            VALUES(?,?,?, ?,10,?,'1m','UTC',true,clock_timestamp())
            ON CONFLICT(provider,provider_symbol,provider_exchange) DO UPDATE SET instrument_id=excluded.instrument_id,supported_modes=excluded.supported_modes,supported_timeframes='1m',active=true,last_seen_at=clock_timestamp()
            """,seed.provider(),seed.providerSymbol(),exchange(seed),id,seed.realtime()?"HISTORICAL,REALTIME":"HISTORICAL");}
        jdbc.update("INSERT INTO trading.instrument_alias(instrument_id,alias,normalized_alias,source_provider) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",id,seed.canonical(),normalize(seed.canonical()),seed.provider());}
    private static String exchange(Seed seed){return switch(seed.provider()){case "ALPACA"->"US";case "BINANCE"->"Binance";default->"Dukascopy";};}
    private static String key(Seed seed){return Set.of("CRYPTO","FOREX","COMMODITY").contains(seed.asset())?InstrumentCatalogProvider.pairKey(seed.asset(),seed.base(),seed.quote(),"SPOT"):InstrumentCatalogProvider.listingKey(seed.asset(),exchange(seed),seed.canonical());}
    private static Route route(UUID id,Seed seed){return new Route(id,seed.canonical(),seed.canonical(),seed.asset(),seed.provider(),seed.providerSymbol(),seed.base(),seed.quote(),seed.available(),seed.realtime());}
    private static String normalize(String value){return value.strip().toUpperCase(Locale.ROOT).replace("BINANCE:","").replace("DUKASCOPY:","").replace("/","").replace("-","").replace("_","");}
    private static Map<String,Seed> seeds(){var rows=List.of(
            new Seed("AAPL","STOCK","ALPACA","AAPL","AAPL","USD",Instant.parse("2017-01-01T00:00:00Z"),true),new Seed("MSFT","STOCK","ALPACA","MSFT","MSFT","USD",Instant.parse("2017-01-01T00:00:00Z"),true),new Seed("NVDA","STOCK","ALPACA","NVDA","NVDA","USD",Instant.parse("2017-01-01T00:00:00Z"),true),new Seed("SPY","ETF","ALPACA","SPY","SPY","USD",Instant.parse("2017-01-01T00:00:00Z"),true),new Seed("QQQ","ETF","ALPACA","QQQ","QQQ","USD",Instant.parse("2017-01-01T00:00:00Z"),true),new Seed("DIA","ETF","ALPACA","DIA","DIA","USD",Instant.parse("2017-01-01T00:00:00Z"),true),
            new Seed("BTC/USDT","CRYPTO","BINANCE","BTCUSDT","BTC","USDT",Instant.parse("2017-08-17T00:00:00Z"),true),new Seed("ETH/USDT","CRYPTO","BINANCE","ETHUSDT","ETH","USDT",Instant.parse("2017-08-17T00:00:00Z"),true),
            new Seed("EUR/USD","FOREX","DUKASCOPY","EURUSD","EUR","USD",Instant.parse("2003-05-04T19:00:00Z"),false),new Seed("GBP/USD","FOREX","DUKASCOPY","GBPUSD","GBP","USD",Instant.parse("2003-05-04T20:00:00Z"),false),new Seed("USD/JPY","FOREX","DUKASCOPY","USDJPY","USD","JPY",Instant.parse("2003-05-04T17:00:00Z"),false),new Seed("AUD/USD","FOREX","DUKASCOPY","AUDUSD","AUD","USD",Instant.parse("2003-08-03T17:00:00Z"),false),new Seed("USD/CAD","FOREX","DUKASCOPY","USDCAD","USD","CAD",Instant.parse("2003-08-03T17:00:00Z"),false),new Seed("USD/CHF","FOREX","DUKASCOPY","USDCHF","USD","CHF",Instant.parse("2003-05-04T20:00:00Z"),false),new Seed("NZD/USD","FOREX","DUKASCOPY","NZDUSD","NZD","USD",Instant.parse("2003-08-03T17:00:00Z"),false),
            new Seed("XAU/USD","COMMODITY","DUKASCOPY","XAUUSD","XAU","USD",Instant.parse("2003-05-05T00:01:00Z"),false),new Seed("XAG/USD","COMMODITY","DUKASCOPY","XAGUSD","XAG","USD",Instant.parse("2003-05-04T23:09:00Z"),false),new Seed("XPT/USD","COMMODITY","DUKASCOPY","XPTCMDUSD","XPT","USD",Instant.parse("2021-11-01T00:00:00Z"),false),new Seed("XPD/USD","COMMODITY","DUKASCOPY","XPDCMDUSD","XPD","USD",Instant.parse("2021-07-04T22:00:00Z"),false));var result=new LinkedHashMap<String,Seed>();for(var row:rows){for(var alias:List.of(row.canonical(),row.providerSymbol(),row.provider()+":"+row.providerSymbol()))result.put(normalize(alias),row);}return Map.copyOf(result);}
}
