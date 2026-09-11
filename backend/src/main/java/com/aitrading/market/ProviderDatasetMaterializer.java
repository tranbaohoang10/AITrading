package com.aitrading.market;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.*;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProviderDatasetMaterializer {
    public record Result(UUID datasetId,String symbol,String timeframe,int candleCount,Instant firstTime,Instant lastTime,String dataHash) {}
    private final JdbcTemplate jdbc;private final MarketSymbolRegistry registry;private final MarketProviderCandleStore store;
    public ProviderDatasetMaterializer(JdbcTemplate jdbc,MarketSymbolRegistry registry,MarketProviderCandleStore store){this.jdbc=jdbc;this.registry=registry;this.store=store;}
    @Transactional public Result materialize(UserPrincipal user,String requestId,String symbol,String timeframe,Instant from,Instant to){UUID request=MarketService.id(requestId);var route=registry.resolve(symbol);var rows=store.read(route,timeframe,from,to,20_000);if(rows.isEmpty())throw new IllegalArgumentException("No local provider candles");if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())throw new BadCredentialsException("Invalid session");String storedSymbol=route.canonicalSymbol().replace('/','-');String rawHash=MarketCsvParser.hash(serialize(route,timeframe,rows));String dataHash=dataHash(storedSymbol,timeframe,rows);var existing=jdbc.query("SELECT id,candle_count,first_time,last_time,data_hash FROM trading.market_dataset WHERE owner_id=? AND request_id=?",(rs,n)->result(rs,route.canonicalSymbol(),timeframe),user.id(),request);if(!existing.isEmpty()){if(!existing.getFirst().dataHash().equals(dataHash))throw ResourceFailure.conflict();return existing.getFirst();}UUID id=UUID.randomUUID();long gaps=gaps(rows,MarketDataProvider.seconds(timeframe));jdbc.update("""
            INSERT INTO trading.market_dataset(id,owner_id,request_id,request_hash,name,symbol,timeframe,source_kind,source_label,raw_hash,data_hash,candle_count,gap_count,first_time,last_time)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,id,user.id(),request,MarketCsvParser.hash(request+"|"+rawHash+"|"+dataHash),route.displaySymbol()+" provider data",storedSymbol,timeframe,"PROVIDER",route.provider()+" "+route.providerSymbol(),rawHash,dataHash,rows.size(),gaps,Timestamp.from(rows.getFirst().time()),Timestamp.from(rows.getLast().time()));jdbc.batchUpdate("INSERT INTO trading.market_candle(dataset_id,ordinal,open_time,open,high,low,close,volume) VALUES(?,?,?,?,?,?,?,?)",new BatchPreparedStatementSetter(){public int getBatchSize(){return rows.size();}public void setValues(PreparedStatement statement,int index)throws SQLException{var row=rows.get(index);statement.setObject(1,id);statement.setInt(2,index);statement.setTimestamp(3,Timestamp.from(row.time()));statement.setBigDecimal(4,row.open());statement.setBigDecimal(5,row.high());statement.setBigDecimal(6,row.low());statement.setBigDecimal(7,row.close());statement.setBigDecimal(8,row.volume());}});return new Result(id,route.canonicalSymbol(),timeframe,rows.size(),rows.getFirst().time(),rows.getLast().time(),dataHash);}
    private static Result result(ResultSet rs,String symbol,String timeframe)throws SQLException{return new Result(rs.getObject("id",UUID.class),symbol,timeframe,rs.getInt("candle_count"),rs.getObject("first_time",OffsetDateTime.class).toInstant(),rs.getObject("last_time",OffsetDateTime.class).toInstant(),rs.getString("data_hash"));}
    private static String serialize(MarketSymbolRegistry.Route route,String timeframe,List<MarketDataProvider.Candle> rows){var text=new StringBuilder(route.canonicalSymbol()).append('|').append(route.provider()).append('|').append(timeframe).append('\n');for(var row:rows)text.append(row.time()).append(',').append(row.open()).append(',').append(row.high()).append(',').append(row.low()).append(',').append(row.close()).append(',').append(row.volume()).append('\n');return text.toString();}
    static String dataHash(String symbol,String timeframe,List<MarketDataProvider.Candle> rows){var text=new StringBuilder(MarketCsvParser.FORMAT).append('\n').append(symbol).append('\n').append(timeframe).append("\nUTC\n");for(var row:rows)text.append(row.time()).append(',').append(MarketCsvParser.decimal(row.open())).append(',').append(MarketCsvParser.decimal(row.high())).append(',').append(MarketCsvParser.decimal(row.low())).append(',').append(MarketCsvParser.decimal(row.close())).append(',').append(MarketCsvParser.decimal(row.volume())).append('\n');return MarketCsvParser.hash(text.toString());}
    private static long gaps(List<MarketDataProvider.Candle> rows,int seconds){long gaps=0;for(int index=1;index<rows.size();index++){long distance=Duration.between(rows.get(index-1).time(),rows.get(index).time()).getSeconds();if(distance>seconds)gaps+=distance/seconds-1;}return gaps;}
}
