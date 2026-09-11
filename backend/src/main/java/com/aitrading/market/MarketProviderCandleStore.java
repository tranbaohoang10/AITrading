package com.aitrading.market;

import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketProviderCandleStore {
    public record Coverage(Instant availableFrom,Instant firstStored,Instant lastStored,long candleCount,String status,String errorCode,Instant updatedAt) {}
    private final JdbcTemplate jdbc;
    public MarketProviderCandleStore(JdbcTemplate jdbc){this.jdbc=jdbc;}

    @Transactional public int upsert(MarketSymbolRegistry.Route route,List<MarketDataProvider.Candle> rows) {
        if(rows==null||rows.size()>50_000)throw new IllegalArgumentException("Invalid candle batch");
        Instant previous=null;
        for(var row:rows){if(row==null||row.time().getEpochSecond()%60!=0||previous!=null&&!row.time().isAfter(previous))throw new IllegalArgumentException("Invalid candle batch");previous=row.time();}
        int[] changed=jdbc.batchUpdate("""
                INSERT INTO trading.provider_market_candle(instrument_id,timeframe,open_time,open,high,low,close,volume,provider,synced_at)
                VALUES(?,'1m',?,?,?,?,?,?,?,clock_timestamp())
                ON CONFLICT(instrument_id,timeframe,open_time) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,provider=excluded.provider,synced_at=clock_timestamp()
                """,new BatchPreparedStatementSetter(){public int getBatchSize(){return rows.size();}public void setValues(PreparedStatement statement,int index)throws SQLException{var row=rows.get(index);statement.setObject(1,route.instrumentId());statement.setTimestamp(2,Timestamp.from(row.time()));statement.setBigDecimal(3,row.open());statement.setBigDecimal(4,row.high());statement.setBigDecimal(5,row.low());statement.setBigDecimal(6,row.close());statement.setBigDecimal(7,row.volume());statement.setString(8,route.provider());}});
        return Arrays.stream(changed).map(value->value<0?1:value).sum();
    }
    public List<MarketDataProvider.Candle> read(MarketSymbolRegistry.Route route,String timeframe,Instant from,Instant to,int limit) {
        MarketDataProvider.range(timeframe,from,to);if(limit<1||limit>20_000)throw new IllegalArgumentException("Invalid candle limit");
        int factor=MarketDataProvider.seconds(timeframe)/60;long rawLimit=Math.min(2_000_000L,(long)limit*factor+factor);
        var rows=jdbc.query("""
                SELECT open_time,open,high,low,close,COALESCE(volume,0) volume FROM trading.provider_market_candle
                WHERE instrument_id=? AND timeframe='1m' AND open_time>=? AND open_time<? ORDER BY open_time LIMIT ?
                """,(rs,n)->new MarketDataProvider.Candle(rs.getObject("open_time",OffsetDateTime.class).toInstant(),rs.getBigDecimal("open"),rs.getBigDecimal("high"),rs.getBigDecimal("low"),rs.getBigDecimal("close"),rs.getBigDecimal("volume")),route.instrumentId(),Timestamp.from(from),Timestamp.from(to),rawLimit);
        var aggregated=MarketTimeframeAggregator.aggregate(rows,timeframe);return aggregated.size()<=limit?aggregated:List.copyOf(aggregated.subList(0,limit));
    }
    public Instant lastStored(MarketSymbolRegistry.Route route){return jdbc.queryForObject("SELECT max(open_time) FROM trading.provider_market_candle WHERE instrument_id=? AND timeframe='1m'",(rs,n)->{var value=rs.getObject(1,OffsetDateTime.class);return value==null?null:value.toInstant();},route.instrumentId());}
    public Instant firstStored(MarketSymbolRegistry.Route route){return jdbc.queryForObject("SELECT min(open_time) FROM trading.provider_market_candle WHERE instrument_id=? AND timeframe='1m'",(rs,n)->{var value=rs.getObject(1,OffsetDateTime.class);return value==null?null:value.toInstant();},route.instrumentId());}
    public void state(MarketSymbolRegistry.Route route,Instant available,Instant through,String status,String error){jdbc.update("""
            INSERT INTO trading.provider_market_sync_state(instrument_id,provider,timeframe,historical_available_from,synced_through,status,error_code,updated_at)
            VALUES(?,?,'1m',?,?,?,?,clock_timestamp()) ON CONFLICT(instrument_id,provider,timeframe) DO UPDATE SET historical_available_from=excluded.historical_available_from,synced_through=excluded.synced_through,status=excluded.status,error_code=excluded.error_code,updated_at=clock_timestamp()
            """,route.instrumentId(),route.provider(),timestamp(available),timestamp(through),status,error);}
    public Coverage coverage(MarketSymbolRegistry.Route route){return jdbc.query("""
            SELECT s.historical_available_from,min(c.open_time) first_stored,max(c.open_time) last_stored,count(c.*) candle_count,
                   COALESCE(s.status,'IDLE') status,s.error_code,COALESCE(s.updated_at,clock_timestamp()) updated_at
            FROM trading.market_instrument i LEFT JOIN trading.provider_market_sync_state s ON s.instrument_id=i.id AND s.provider=? AND s.timeframe='1m'
            LEFT JOIN trading.provider_market_candle c ON c.instrument_id=i.id AND c.timeframe='1m' WHERE i.id=? GROUP BY s.historical_available_from,s.status,s.error_code,s.updated_at
            """,(rs,n)->new Coverage(instant(rs,"historical_available_from"),instant(rs,"first_stored"),instant(rs,"last_stored"),rs.getLong("candle_count"),rs.getString("status"),rs.getString("error_code"),instant(rs,"updated_at")),route.provider(),route.instrumentId()).stream().findFirst().orElse(new Coverage(route.declaredAvailableFrom(),null,null,0,"IDLE",null,Instant.now()));}
    private static Instant instant(ResultSet result,String column)throws SQLException{var value=result.getObject(column,OffsetDateTime.class);return value==null?null:value.toInstant();}
    private static Timestamp timestamp(Instant value){return value==null?null:Timestamp.from(value);}
}
