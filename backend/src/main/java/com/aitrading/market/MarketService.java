package com.aitrading.market;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketService {
    private final JdbcTemplate jdbc;
    private final MarketCsvParser parser;
    public record Import(String requestId,String name,String symbol,String timeframe,String sourceKind,String sourceLabel,String csv) { }
    public record Dataset(UUID id,String name,String symbol,String timeframe,String timezone,String sourceKind,String sourceLabel,
            String rawHash,String dataHash,String formatVersion,int candleCount,long gapCount,Instant firstTime,Instant lastTime,Instant createdAt) { }
    public record Candle(int ordinal,Instant time,String open,String high,String low,String close,String volume) { }
    public record Page(List<Dataset> items,String nextCursor) { public Page {items=List.copyOf(items);} }
    public record Candles(Dataset dataset,int start,int total,List<Candle> items) { public Candles {items=List.copyOf(items);} }
    public MarketService(JdbcTemplate jdbc,MarketCsvParser parser) {this.jdbc=jdbc;this.parser=parser;}

    public static UUID id(String value) {
        if(value==null||!value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw new IllegalArgumentException("Invalid ID");
        return UUID.fromString(value);
    }
    public static int integer(String value,int fallback,int min,int max) {
        if(value==null)return fallback;
        if(!value.matches("0|[1-9][0-9]{0,5}"))throw new IllegalArgumentException("Invalid page parameter");
        int parsed=Integer.parseInt(value);
        if(parsed<min||parsed>max)throw new IllegalArgumentException("Invalid page parameter");
        return parsed;
    }
    private String text(String value) {
        if(value==null)throw new IllegalArgumentException("Missing metadata");
        value=value.strip();
        if(value.isEmpty()||value.length()>120||value.codePoints().anyMatch(c->Character.isISOControl(c)||(c>=0xD800&&c<=0xDFFF)))
            throw new IllegalArgumentException("Invalid metadata");
        return value;
    }
    private Dataset row(ResultSet rs,int unused) throws SQLException {
        return new Dataset(rs.getObject("id",UUID.class),rs.getString("name"),rs.getString("symbol"),rs.getString("timeframe"),"UTC",
                rs.getString("source_kind"),rs.getString("source_label"),rs.getString("raw_hash"),rs.getString("data_hash"),rs.getString("format_version"),
                rs.getInt("candle_count"),rs.getLong("gap_count"),rs.getObject("first_time",OffsetDateTime.class).toInstant(),
                rs.getObject("last_time",OffsetDateTime.class).toInstant(),rs.getObject("created_at",OffsetDateTime.class).toInstant());
    }
    private void lockUser(UserPrincipal user) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())
            throw new BadCredentialsException("Invalid session");
    }
    private Dataset owned(UserPrincipal user,UUID id,boolean lock) {
        return jdbc.query("SELECT * FROM trading.market_dataset WHERE id=? AND owner_id=?"+(lock?" FOR UPDATE":""),this::row,id,user.id())
                .stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    public Dataset get(UserPrincipal user,UUID id) {return owned(user,id,false);}

    @Transactional
    public Dataset create(UserPrincipal user,Import request) {
        UUID requestId=id(request.requestId());String name=text(request.name()),source=text(request.sourceLabel());
        String symbol=MarketCsvParser.symbol(request.symbol());MarketCsvParser.timeframeSeconds(request.timeframe());
        if(request.sourceKind()==null||!Set.of("USER_UPLOAD","SYNTHETIC").contains(request.sourceKind()))throw new IllegalArgumentException("Invalid source kind");
        var parsed=parser.parse(request.csv(),symbol,request.timeframe(),Instant.now());
        String fingerprint=MarketCsvParser.hash(String.join("\n",name,symbol,request.timeframe(),request.sourceKind(),source,parsed.rawHash(),parsed.dataHash()));
        lockUser(user);
        var existing=jdbc.queryForList("SELECT id,request_hash FROM trading.market_dataset WHERE owner_id=? AND request_id=?",user.id(),requestId);
        if(!existing.isEmpty()) {
            if(!fingerprint.equals(existing.getFirst().get("request_hash")))throw ResourceFailure.conflict();
            return owned(user,(UUID)existing.getFirst().get("id"),false);
        }
        Long count=jdbc.queryForObject("SELECT count(*) FROM trading.market_dataset WHERE owner_id=?",Long.class,user.id());
        if(count==null||count>=50)throw ResourceFailure.conflict();
        UUID dataset=UUID.randomUUID();
        jdbc.update("""
                INSERT INTO trading.market_dataset(id,owner_id,request_id,request_hash,name,symbol,timeframe,source_kind,source_label,raw_hash,data_hash,
                candle_count,gap_count,first_time,last_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,dataset,user.id(),requestId,fingerprint,name,symbol,request.timeframe(),request.sourceKind(),source,parsed.rawHash(),parsed.dataHash(),
                parsed.candles().size(),parsed.gapCount(),Timestamp.from(parsed.candles().getFirst().time()),Timestamp.from(parsed.candles().getLast().time()));
        List<Object[]> batch=new ArrayList<>(parsed.candles().size());int ordinal=0;
        for(var candle:parsed.candles())batch.add(new Object[]{dataset,ordinal++,Timestamp.from(candle.time()),candle.open(),candle.high(),candle.low(),candle.close(),candle.volume()});
        jdbc.batchUpdate("INSERT INTO trading.market_candle(dataset_id,ordinal,open_time,open,high,low,close,volume) VALUES (?,?,?,?,?,?,?,?)",batch);
        return owned(user,dataset,false);
    }

    public Page list(UserPrincipal user,int limit,String cursor) {
        List<Dataset> rows;
        if(cursor==null)rows=jdbc.query("SELECT * FROM trading.market_dataset WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT ?",this::row,user.id(),limit+1);
        else {
            if(cursor.length()>128||!cursor.matches("[A-Za-z0-9_-]+"))throw new IllegalArgumentException("Invalid cursor");
            String[] decoded=new String(Base64.getUrlDecoder().decode(cursor),StandardCharsets.UTF_8).split("\\|",-1);
            if(decoded.length!=2)throw new IllegalArgumentException("Invalid cursor");
            Instant created;
            try{created=Instant.parse(decoded[0]);}catch(DateTimeException invalid){throw new IllegalArgumentException("Invalid cursor");}
            if(created.isBefore(Instant.EPOCH)||created.isAfter(Instant.parse("2101-01-01T00:00:00Z")))throw new IllegalArgumentException("Invalid cursor");
            UUID last=id(decoded[1]);
            rows=jdbc.query("SELECT * FROM trading.market_dataset WHERE owner_id=? AND (created_at,id)<(?,?) ORDER BY created_at DESC,id DESC LIMIT ?",
                    this::row,user.id(),Timestamp.from(created),last,limit+1);
        }
        boolean more=rows.size()>limit;List<Dataset> items=rows.subList(0,Math.min(limit,rows.size()));
        Dataset last=items.isEmpty()?null:items.getLast();
        String next=more?Base64.getUrlEncoder().withoutPadding().encodeToString((last.createdAt()+"|"+last.id()).getBytes(StandardCharsets.UTF_8)):null;
        return new Page(items,next);
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Candles candles(UserPrincipal user,UUID id,String start,int limit) {
        Dataset dataset=owned(user,id,false);
        int from=integer(start,Math.max(0,dataset.candleCount()-limit),0,dataset.candleCount());
        List<Candle> rows=jdbc.query("""
                SELECT c.* FROM trading.market_candle c JOIN trading.market_dataset d ON d.id=c.dataset_id
                WHERE c.dataset_id=? AND d.owner_id=? AND c.ordinal>=? ORDER BY c.ordinal LIMIT ?
                """,(rs,index)->new Candle(rs.getInt("ordinal"),rs.getObject("open_time",OffsetDateTime.class).toInstant(),
                MarketCsvParser.decimal(rs.getBigDecimal("open")),MarketCsvParser.decimal(rs.getBigDecimal("high")),MarketCsvParser.decimal(rs.getBigDecimal("low")),
                MarketCsvParser.decimal(rs.getBigDecimal("close")),MarketCsvParser.decimal(rs.getBigDecimal("volume"))),id,user.id(),from,limit);
        return new Candles(dataset,from,dataset.candleCount(),rows);
    }
    @Transactional
    public void delete(UserPrincipal user,UUID id,String expectedHash) {
        if(expectedHash==null||!expectedHash.matches("[0-9a-f]{64}"))throw new IllegalArgumentException("Invalid fingerprint");
        lockUser(user);var dataset=owned(user,id,true);
        if(!dataset.dataHash().equals(expectedHash))throw ResourceFailure.conflict();
        jdbc.update("DELETE FROM trading.market_dataset WHERE id=? AND owner_id=?",id,user.id());
    }
}
