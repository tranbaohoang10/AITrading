package com.aitrading.market;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class InstrumentCatalogStore {
    private static final int PAGE_SIZE=50;
    private final JdbcTemplate jdbc;
    public InstrumentCatalogStore(JdbcTemplate jdbc){this.jdbc=jdbc;}

    @Transactional
    public void replaceSnapshot(InstrumentCatalogProvider.Descriptor descriptor,List<InstrumentCatalogProvider.Candidate> rows) {
        if(rows==null||rows.isEmpty()||rows.size()>100000||rows.stream().anyMatch(row->!descriptor.providerId().equals(row.provider())))
            throw new IllegalArgumentException("Invalid provider snapshot");
        jdbc.update("UPDATE trading.instrument_provider_mapping SET active=FALSE WHERE provider=?",descriptor.providerId());
        jdbc.update("DELETE FROM trading.instrument_alias WHERE source_provider=?",descriptor.providerId());
        for(int start=0;start<rows.size();start+=1000)upsertChunk(rows.subList(start,Math.min(rows.size(),start+1000)));
        reconcileReferenceMappings();
        jdbc.update("UPDATE trading.market_instrument i SET active=EXISTS(SELECT 1 FROM trading.instrument_provider_mapping m WHERE m.instrument_id=i.id AND m.active),updated_at=CURRENT_TIMESTAMP WHERE i.active IS DISTINCT FROM EXISTS(SELECT 1 FROM trading.instrument_provider_mapping m WHERE m.instrument_id=i.id AND m.active)");
        jdbc.update("INSERT INTO trading.instrument_catalog_sync(provider,status,last_attempt_at,last_success_at,row_count,consecutive_failures,failure_code,updated_at) VALUES(?,'SUCCESS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,0,NULL,CURRENT_TIMESTAMP) ON CONFLICT(provider) DO UPDATE SET status='SUCCESS',last_attempt_at=CURRENT_TIMESTAMP,last_success_at=CURRENT_TIMESTAMP,row_count=EXCLUDED.row_count,consecutive_failures=0,failure_code=NULL,updated_at=CURRENT_TIMESTAMP",descriptor.providerId(),rows.size());
    }

    private void upsertChunk(List<InstrumentCatalogProvider.Candidate> rows) {
        jdbc.batchUpdate("INSERT INTO trading.market_instrument(id,canonical_key,asset_class,canonical_symbol,display_symbol,name,exchange,mic_code,country,country_code,currency,base_currency,quote_currency,instrument_type,isin,figi,metadata_priority,active,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,TRUE,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET display_symbol=CASE WHEN EXCLUDED.metadata_priority<=trading.market_instrument.metadata_priority THEN EXCLUDED.display_symbol ELSE trading.market_instrument.display_symbol END,name=CASE WHEN EXCLUDED.metadata_priority<=trading.market_instrument.metadata_priority THEN EXCLUDED.name ELSE trading.market_instrument.name END,exchange=CASE WHEN EXCLUDED.metadata_priority<=trading.market_instrument.metadata_priority THEN EXCLUDED.exchange ELSE trading.market_instrument.exchange END,mic_code=COALESCE(trading.market_instrument.mic_code,EXCLUDED.mic_code),country=COALESCE(trading.market_instrument.country,EXCLUDED.country),country_code=COALESCE(trading.market_instrument.country_code,EXCLUDED.country_code),currency=COALESCE(trading.market_instrument.currency,EXCLUDED.currency),base_currency=COALESCE(trading.market_instrument.base_currency,EXCLUDED.base_currency),quote_currency=COALESCE(trading.market_instrument.quote_currency,EXCLUDED.quote_currency),instrument_type=COALESCE(trading.market_instrument.instrument_type,EXCLUDED.instrument_type),isin=COALESCE(trading.market_instrument.isin,EXCLUDED.isin),figi=COALESCE(trading.market_instrument.figi,EXCLUDED.figi),metadata_priority=LEAST(trading.market_instrument.metadata_priority,EXCLUDED.metadata_priority),active=TRUE,updated_at=CURRENT_TIMESTAMP",rows,1000,InstrumentCatalogStore::bindInstrument);
        jdbc.batchUpdate("INSERT INTO trading.instrument_provider_mapping(provider,provider_symbol,provider_exchange,instrument_id,provider_priority,supported_modes,supported_timeframes,provider_timezone,price_increment,active,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,TRUE,CURRENT_TIMESTAMP) ON CONFLICT(provider,provider_symbol,provider_exchange) DO UPDATE SET instrument_id=EXCLUDED.instrument_id,provider_priority=EXCLUDED.provider_priority,supported_modes=EXCLUDED.supported_modes,supported_timeframes=EXCLUDED.supported_timeframes,provider_timezone=EXCLUDED.provider_timezone,price_increment=EXCLUDED.price_increment,active=TRUE,last_seen_at=CURRENT_TIMESTAMP",rows,1000,(statement,row)->{statement.setString(1,row.provider());statement.setString(2,row.providerSymbol());statement.setString(3,InstrumentCatalogProvider.normalizeExchange(row.exchange()));statement.setObject(4,row.id());statement.setInt(5,row.priority());statement.setString(6,String.join(",",row.supportedModes()));statement.setString(7,String.join(",",row.supportedTimeframes()));nullable(statement,8,row.timezone(),Types.VARCHAR);nullable(statement,9,row.priceIncrement(),Types.NUMERIC);});
        var aliases=rows.stream().flatMap(row->row.aliases().stream().map(alias->new Alias(row.id(),alias,InstrumentCatalogProvider.normalizeAlias(alias),row.provider()))).filter(alias->!alias.normalized().isEmpty()).distinct().toList();
        jdbc.batchUpdate("INSERT INTO trading.instrument_alias(instrument_id,alias,normalized_alias,source_provider) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",aliases,2000,(statement,alias)->{statement.setObject(1,alias.instrumentId());statement.setString(2,alias.alias());statement.setString(3,alias.normalized());statement.setString(4,alias.provider());});
    }

    private void reconcileReferenceMappings() {
        jdbc.update("""
                UPDATE trading.instrument_provider_mapping mapping SET instrument_id=reference.instrument_id
                FROM trading.market_instrument source
                JOIN trading.market_instrument target
                  ON target.canonical_symbol=source.canonical_symbol AND target.exchange=source.exchange
                 AND (target.asset_class=source.asset_class OR source.asset_class='STOCK' AND target.asset_class='ETF')
                JOIN trading.instrument_provider_mapping reference
                  ON reference.instrument_id=target.id AND reference.provider='FREE_TICKER_DB' AND reference.active
                WHERE mapping.instrument_id=source.id AND mapping.provider<>'FREE_TICKER_DB' AND mapping.active
                """);
    }

    private static void bindInstrument(PreparedStatement statement,InstrumentCatalogProvider.Candidate row)throws SQLException {
        statement.setObject(1,row.id());statement.setString(2,row.canonicalKey());statement.setString(3,row.assetClass());
        statement.setString(4,row.canonicalSymbol());statement.setString(5,row.displaySymbol());statement.setString(6,row.name());
        statement.setString(7,InstrumentCatalogProvider.normalizeExchange(row.exchange()));nullable(statement,8,row.micCode(),Types.VARCHAR);
        nullable(statement,9,row.country(),Types.VARCHAR);nullable(statement,10,row.countryCode(),Types.CHAR);nullable(statement,11,row.currency(),Types.VARCHAR);
        nullable(statement,12,row.baseCurrency(),Types.VARCHAR);nullable(statement,13,row.quoteCurrency(),Types.VARCHAR);nullable(statement,14,row.instrumentType(),Types.VARCHAR);
        nullable(statement,15,row.isin(),Types.VARCHAR);nullable(statement,16,row.figi(),Types.VARCHAR);statement.setInt(17,row.priority());
    }
    private static void nullable(PreparedStatement statement,int index,Object value,int type)throws SQLException {if(value==null)statement.setNull(index,type);else statement.setObject(index,value,type);}
    private record Alias(UUID instrumentId,String alias,String normalized,String provider){}

    public void running(String provider){jdbc.update("INSERT INTO trading.instrument_catalog_sync(provider,status,last_attempt_at,updated_at) VALUES(?,'RUNNING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(provider) DO UPDATE SET status='RUNNING',last_attempt_at=CURRENT_TIMESTAMP,failure_code=NULL,updated_at=CURRENT_TIMESTAMP",provider);}
    public void disabled(String provider){jdbc.update("INSERT INTO trading.instrument_catalog_sync(provider,status,updated_at) VALUES(?,'DISABLED',CURRENT_TIMESTAMP) ON CONFLICT(provider) DO UPDATE SET status='DISABLED',failure_code=NULL,updated_at=CURRENT_TIMESTAMP",provider);}
    public void failed(String provider,String code){jdbc.update("INSERT INTO trading.instrument_catalog_sync(provider,status,last_attempt_at,consecutive_failures,failure_code,updated_at) VALUES(?,'FAILED',CURRENT_TIMESTAMP,1,?,CURRENT_TIMESTAMP) ON CONFLICT(provider) DO UPDATE SET status='FAILED',last_attempt_at=CURRENT_TIMESTAMP,consecutive_failures=trading.instrument_catalog_sync.consecutive_failures+1,failure_code=EXCLUDED.failure_code,updated_at=CURRENT_TIMESTAMP",provider,code);}

    public record Page(List<MarketDataProvider.Instrument> items,String nextCursor){}

    public Page search(String query,String assetClass,String exchange,String country,boolean active,String cursor) {
        String q=query==null?"":query.strip(),asset=assetClass==null?"":assetClass.strip().toUpperCase(Locale.ROOT);
        String venue=exchange==null?"":exchange.strip(),nation=country==null?"":country.strip();
        if(q.length()>64||venue.length()>80||nation.length()>80||!asset.isEmpty()&&!Set.of("CRYPTO","STOCK","ETF","FOREX","COMMODITY","FUTURES","CFD").contains(asset))throw new IllegalArgumentException("Invalid catalog query");
        String binding=digest(q+"|"+asset+"|"+venue+"|"+nation+"|"+active);int offset=decodeCursor(cursor,binding);
        String normalized=InstrumentCatalogProvider.normalizeAlias(q),contains="%"+q+"%";
        var rows=jdbc.query(SEARCH_SQL,(result,index)->map(result),q,q,q,normalized,q,contains,q,contains,asset,asset,venue,venue,nation,nation,nation,active,q,contains,contains,normalized+"%",offset,PAGE_SIZE+1);
        boolean more=rows.size()>PAGE_SIZE;List<MarketDataProvider.Instrument> items=more?List.copyOf(rows.subList(0,PAGE_SIZE)):List.copyOf(rows);
        return new Page(items,more?encodeCursor(binding,offset+PAGE_SIZE):null);
    }

    private static final String SEARCH_SQL="""
            WITH filtered AS (
              SELECT i.*,
                CASE WHEN ?<>'' AND UPPER(i.canonical_symbol)=UPPER(?) THEN 0
                     WHEN ?<>'' AND EXISTS(SELECT 1 FROM trading.instrument_alias exact_alias WHERE exact_alias.instrument_id=i.id AND exact_alias.normalized_alias=?) THEN 1
                     WHEN ?<>'' AND UPPER(i.canonical_symbol) LIKE UPPER(?) THEN 2
                     WHEN ?<>'' AND UPPER(i.name) LIKE UPPER(?) THEN 3 ELSE 4 END match_rank,
                CASE i.asset_class
                  WHEN 'CRYPTO' THEN COALESCE(array_position(ARRAY['BTC','ETH','SOL','XRP','ADA','DOGE','LINK','AVAX','LTC','BCH','DOT','SUI','UNI','AAVE','XLM','HBAR'],i.base_currency),999)
                  WHEN 'STOCK' THEN COALESCE(array_position(ARRAY['AAPL','NVDA','MSFT','TSLA','AMZN','META','GOOGL','GOOG','AMD'],i.canonical_symbol),999)
                  WHEN 'ETF' THEN COALESCE(array_position(ARRAY['SPY','QQQ','IWM','DIA'],i.canonical_symbol),999)
                  WHEN 'FOREX' THEN COALESCE(array_position(ARRAY['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD'],COALESCE(i.base_currency,'')||COALESCE(i.quote_currency,'')),999)
                  WHEN 'COMMODITY' THEN COALESCE(array_position(ARRAY['XAU','XAG','XPT','XPD','WTICO','BCO','NATGAS'],i.base_currency),999)
                  ELSE 999 END featured_position,
                CASE WHEN i.asset_class='CRYPTO' THEN CASE i.quote_currency WHEN 'USD' THEN 0 WHEN 'USDT' THEN 1 ELSE 2 END
                     WHEN i.asset_class IN ('FOREX','COMMODITY') THEN CASE i.quote_currency WHEN 'USD' THEN 0 WHEN 'EUR' THEN 1 WHEN 'GBP' THEN 2 WHEN 'JPY' THEN 3 ELSE 4 END
                     ELSE 0 END featured_quote_position,
                ROW_NUMBER() OVER(PARTITION BY i.asset_class ORDER BY i.canonical_symbol,i.exchange,i.id) class_position
              FROM trading.market_instrument i
              WHERE (?='' OR i.asset_class=?) AND (?='' OR UPPER(i.exchange)=UPPER(?))
                AND (?='' OR UPPER(COALESCE(i.country_code,''))=UPPER(?) OR UPPER(COALESCE(i.country,''))=UPPER(?))
                AND (?=FALSE OR i.active=TRUE)
                AND (?='' OR UPPER(i.canonical_symbol) LIKE UPPER(?) OR UPPER(i.name) LIKE UPPER(?)
                  OR EXISTS(SELECT 1 FROM trading.instrument_alias a WHERE a.instrument_id=i.id AND a.normalized_alias LIKE ?))
            ), page AS (
              SELECT * FROM filtered ORDER BY match_rank,featured_position,featured_quote_position,CASE asset_class WHEN 'CRYPTO' THEN 0 WHEN 'STOCK' THEN 1 WHEN 'ETF' THEN 2 WHEN 'FOREX' THEN 3 WHEN 'COMMODITY' THEN 4 ELSE 5 END,class_position,canonical_symbol,exchange,id
              OFFSET ? LIMIT ?
            )
            SELECT p.*,m.provider,m.provider_symbol,m.supported_modes,m.supported_timeframes,m.provider_timezone,m.price_increment
            FROM page p LEFT JOIN LATERAL (
              SELECT x.* FROM trading.instrument_provider_mapping x WHERE x.instrument_id=p.id AND x.active
              ORDER BY CASE WHEN x.supported_modes='' THEN 1 ELSE 0 END,x.provider_priority,x.provider LIMIT 1
            ) m ON TRUE
            ORDER BY p.match_rank,p.featured_position,p.featured_quote_position,CASE p.asset_class WHEN 'CRYPTO' THEN 0 WHEN 'STOCK' THEN 1 WHEN 'ETF' THEN 2 WHEN 'FOREX' THEN 3 WHEN 'COMMODITY' THEN 4 ELSE 5 END,p.class_position,p.canonical_symbol,p.exchange,p.id
            """;

    private static MarketDataProvider.Instrument map(ResultSet row)throws SQLException {
        String provider=row.getString("provider"),providerSymbol=row.getString("provider_symbol");
        String modes=row.getString("supported_modes"),timeframes=row.getString("supported_timeframes");
        return new MarketDataProvider.Instrument(row.getObject("id",UUID.class).toString(),row.getString("display_symbol"),providerSymbol==null?row.getString("canonical_symbol"):providerSymbol,provider==null?"REFERENCE":provider,row.getString("asset_class"),row.getString("base_currency"),row.getString("quote_currency"),row.getString("exchange"),row.getString("currency"),"CATALOG",row.getString("provider_timezone"),row.getBigDecimal("price_increment"),null,null,null,null,null,null,null,null,modes==null||modes.isBlank()?"REFERENCE_ONLY":"ROUTABLE",csv(modes),csv(timeframes),"UNKNOWN",row.getString("name"));
    }
    private static List<String> csv(String value){return value==null||value.isBlank()?List.of():List.of(value.split(","));}
    public Map<String,Long> counts(){return jdbc.query("SELECT asset_class,COUNT(*) count FROM trading.market_instrument WHERE active GROUP BY asset_class ORDER BY asset_class",result->{var counts=new LinkedHashMap<String,Long>();while(result.next())counts.put(result.getString(1),result.getLong(2));return counts;});}
    public List<Map<String,Object>> syncStatus(){return jdbc.query("SELECT provider,status,last_attempt_at,last_success_at,row_count,consecutive_failures,failure_code FROM trading.instrument_catalog_sync ORDER BY provider",(row,index)->{var value=new LinkedHashMap<String,Object>();value.put("provider",row.getString(1));value.put("status",row.getString(2));value.put("lastAttemptAt",instant(row,3));value.put("lastSuccessAt",instant(row,4));value.put("rowCount",row.getInt(5));value.put("consecutiveFailures",row.getInt(6));value.put("failureCode",row.getString(7));return value;});}
    private static Instant instant(ResultSet row,int index)throws SQLException {Timestamp value=row.getTimestamp(index);return value==null?null:value.toInstant();}
    private static String digest(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))).substring(0,24);}catch(Exception impossible){throw new IllegalStateException(impossible);}}
    private static String encodeCursor(String binding,int offset){return Base64.getUrlEncoder().withoutPadding().encodeToString((binding+":"+offset).getBytes(StandardCharsets.UTF_8));}
    private static int decodeCursor(String cursor,String binding){if(cursor==null||cursor.isBlank())return 0;if(cursor.length()>80)throw new IllegalArgumentException("Invalid cursor");try{String[] parts=new String(Base64.getUrlDecoder().decode(cursor),StandardCharsets.UTF_8).split(":");if(parts.length!=2)throw new IllegalArgumentException("Invalid cursor");int offset=Integer.parseInt(parts[1]);if(!binding.equals(parts[0])||offset<0||offset>100000||offset%PAGE_SIZE!=0)throw new IllegalArgumentException("Invalid cursor");return offset;}catch(RuntimeException invalid){throw new IllegalArgumentException("Invalid cursor");}}
}
