package com.aitrading.strategy;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.dsl.DslValidator;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import tools.jackson.databind.json.JsonMapper;

@Service
public class StrategyService {
    public static final int MAX_BODY=512*1024;
    private final JdbcTemplate jdbc;
    private final DslValidator validator;
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private static final String JOIN="SELECT r.* FROM trading.strategy_revision r JOIN trading.strategy s ON s.id=r.strategy_id ";
    public record Create(String requestId,String title) { }
    public record Save(String requestId,Integer expectedRevision,String title,String draftText,String mode) { }
    public record Revision(UUID strategyId,int revision,String title,String draftText,String status,String canonicalJson,String hash,
            String schemaVersion,String validatorVersion,Integer minimumBars,String symbol,String timeframe,Instant createdAt) { }
    public record Brief(UUID id,int revision,String title,String status,String symbol,String timeframe,Instant createdAt) { }
    public record Page(List<Brief> items,String nextCursor) { public Page {items=List.copyOf(items);} }
    public record History(List<Brief> items,Integer nextBefore) { public History {items=List.copyOf(items);} }
    public StrategyService(JdbcTemplate jdbc,DslValidator validator) {this.jdbc=jdbc;this.validator=validator;}
    public static UUID id(String text) {
        if(text==null||!text.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw new IllegalArgumentException("Invalid ID");
        return UUID.fromString(text);
    }
    public static int integer(String value,int fallback,int max) {
        if(value==null)return fallback;
        if(!value.matches("[1-9][0-9]{0,2}"))throw new IllegalArgumentException("Invalid number");
        int number=Integer.parseInt(value);if(number>max)throw new IllegalArgumentException("Invalid number");return number;
    }
    private String checked(String value,boolean draft) {
        if(value==null)throw new IllegalArgumentException("Missing text");
        if(!draft)value=value.strip();
        if((!draft&&(value.isEmpty()||value.length()>120))||value.length()>65536||value.getBytes(StandardCharsets.UTF_8).length>65536
                ||value.codePoints().anyMatch(c->(c>=0xD800&&c<=0xDFFF)||(Character.isISOControl(c)&&!(draft&&(c=='\r'||c=='\n'||c=='\t')))))
            throw new IllegalArgumentException("Invalid text");
        return value;
    }
    private String fingerprint(Object... parts) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsBytes(parts)));}
        catch(NoSuchAlgorithmException impossible){throw new IllegalStateException("SHA256 unavailable",impossible);}
    }
    private Revision row(ResultSet r,int unused)throws SQLException {
        return new Revision(r.getObject("strategy_id",UUID.class),r.getInt("revision"),r.getString("title"),r.getString("draft_text"),r.getString("status"),
                r.getString("canonical_json"),r.getString("hash"),r.getString("schema_version"),r.getString("validator_version"),
                r.getObject("minimum_bars",Integer.class),r.getString("symbol"),r.getString("timeframe"),r.getObject("created_at",OffsetDateTime.class).toInstant());
    }
    private Brief brief(ResultSet r,int unused)throws SQLException {
        return new Brief(r.getObject("strategy_id",UUID.class),r.getInt("revision"),r.getString("title"),r.getString("status"),r.getString("symbol"),r.getString("timeframe"),r.getObject("created_at",OffsetDateTime.class).toInstant());
    }
    private void lockUser(UserPrincipal user) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())
            throw new BadCredentialsException("Invalid session");
    }
    private int current(UserPrincipal user,UUID id,boolean lock) {
        return jdbc.queryForList("SELECT current_revision FROM trading.strategy WHERE id=? AND owner_id=?"+(lock?" FOR UPDATE":""),Integer.class,id,user.id())
                .stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    private void expected(Integer value,int current) {
        if(value==null||value<1||value>100)throw new IllegalArgumentException("Invalid revision");
        if(value!=current)throw ResourceFailure.conflict();
    }
    public Revision get(UserPrincipal user,UUID id,Integer revision) {
        String where=revision==null?"r.revision=s.current_revision":"r.revision=?";
        Object[] args=revision==null?new Object[]{id,user.id()}:new Object[]{id,user.id(),revision};
        return jdbc.query(JOIN+"WHERE s.id=? AND s.owner_id=? AND "+where,this::row,args).stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    public Page list(UserPrincipal user,int limit,String cursor) {
        String sql="SELECT r.strategy_id,r.revision,r.title,r.status,r.symbol,r.timeframe,s.created_at FROM trading.strategy s JOIN trading.strategy_revision r ON r.strategy_id=s.id AND r.revision=s.current_revision WHERE s.owner_id=? ";
        List<Brief> rows;
        if(cursor==null)rows=jdbc.query(sql+"ORDER BY s.created_at DESC,s.id DESC LIMIT ?",this::brief,user.id(),limit+1);
        else {
            if(cursor.length()>128||!cursor.matches("[A-Za-z0-9_-]+"))throw new IllegalArgumentException("Invalid cursor");
            String[] values=new String(Base64.getUrlDecoder().decode(cursor),StandardCharsets.UTF_8).split("\\|",-1);
            if(values.length!=2)throw new IllegalArgumentException("Invalid cursor");
            Instant time;try{time=Instant.parse(values[0]);}catch(DateTimeException invalid){throw new IllegalArgumentException("Invalid cursor");}
            if(time.isBefore(Instant.EPOCH)||time.isAfter(Instant.parse("2101-01-01T00:00:00Z")))throw new IllegalArgumentException("Invalid cursor");
            rows=jdbc.query(sql+"AND (s.created_at,s.id)<(?,?) ORDER BY s.created_at DESC,s.id DESC LIMIT ?",this::brief,user.id(),Timestamp.from(time),id(values[1]),limit+1);
        }
        boolean more=rows.size()>limit;var items=rows.subList(0,Math.min(limit,rows.size()));var last=items.isEmpty()?null:items.getLast();
        return new Page(items,more?Base64.getUrlEncoder().withoutPadding().encodeToString((last.createdAt()+"|"+last.id()).getBytes(StandardCharsets.UTF_8)):null);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public History history(UserPrincipal user,UUID id,int limit,int before) {
        current(user,id,false);
        var rows=jdbc.query(JOIN+"WHERE s.id=? AND s.owner_id=? AND r.revision<? ORDER BY r.revision DESC LIMIT ?",this::brief,id,user.id(),before,limit+1);
        boolean more=rows.size()>limit;var items=rows.subList(0,Math.min(limit,rows.size()));
        return new History(items,more?items.getLast().revision():null);
    }
    private void insert(UUID id,int revision,UUID request,String fingerprint,String title,String draft,String mode,DslValidator.ValidatedDsl validated) {
        String symbol=null,timeframe=null;
        if(validated!=null){var market=JSON.readTree(validated.canonicalJson()).get("market");symbol=market.get("symbol").asString();timeframe=market.get("timeframe").asString();}
        jdbc.update("""
                INSERT INTO trading.strategy_revision(strategy_id,revision,request_id,request_hash,title,draft_text,status,canonical_json,hash,
                schema_version,validator_version,minimum_bars,symbol,timeframe) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,id,revision,request,fingerprint,title,draft,mode,validated==null?null:validated.canonicalJson(),validated==null?null:validated.hash(),
                validated==null?null:validated.schemaVersion(),validated==null?null:validated.validatorVersion(),validated==null?null:validated.minimumBars(),symbol,timeframe);
    }
    @Transactional
    public Revision create(UserPrincipal user,Create request) {
        UUID requestId=id(request.requestId());String title=checked(request.title(),false),hash=fingerprint(title);
        lockUser(user);
        var rows=jdbc.queryForList("SELECT id,request_hash FROM trading.strategy WHERE owner_id=? AND request_id=?",user.id(),requestId);
        if(!rows.isEmpty()) {
            if(!hash.equals(rows.getFirst().get("request_hash")))throw ResourceFailure.conflict();
            return get(user,(UUID)rows.getFirst().get("id"),1);
        }
        if(jdbc.queryForObject("SELECT count(*) FROM trading.strategy WHERE owner_id=?",Long.class,user.id())>=100)throw ResourceFailure.conflict();
        UUID id=UUID.randomUUID();jdbc.update("INSERT INTO trading.strategy(id,owner_id,request_id,request_hash,current_revision) VALUES (?,?,?,?,1)",id,user.id(),requestId,hash);
        insert(id,1,requestId,hash,title,"","DRAFT",null);return get(user,id,1);
    }
    @Transactional
    public Revision save(UserPrincipal user,UUID id,Save request) {
        UUID requestId=id(request.requestId());String title=checked(request.title(),false),draft=checked(request.draftText(),true);
        if(request.mode()==null||!Set.of("DRAFT","VALIDATED").contains(request.mode()))throw new IllegalArgumentException("Invalid mode");
        if(request.expectedRevision()==null||request.expectedRevision()<1||request.expectedRevision()>100)throw new IllegalArgumentException("Invalid revision");
        String hash=fingerprint(request.expectedRevision(),title,draft,request.mode());lockUser(user);int current=current(user,id,true);
        var replay=jdbc.queryForList("SELECT revision,request_hash FROM trading.strategy_revision WHERE strategy_id=? AND request_id=?",id,requestId);
        if(!replay.isEmpty()) {
            if(!hash.equals(replay.getFirst().get("request_hash")))throw ResourceFailure.conflict();
            return get(user,id,(Integer)replay.getFirst().get("revision"));
        }
        expected(request.expectedRevision(),current);if(current>=100)throw ResourceFailure.conflict();
        DslValidator.ValidatedDsl document=null;
        if(request.mode().equals("VALIDATED")) {
            DslValidator.Validation result;
            try{result=validator.validate(draft.getBytes(StandardCharsets.UTF_8));}
            catch(IllegalArgumentException malformed){result=new DslValidator.Validation(false,null,List.of(new DslValidator.Diagnostic("","MALFORMED_JSON","Document is not supported JSON.")));}
            if(!result.valid())throw new StrategyValidationFailure(result);
            document=result.document();
        }
        insert(id,current+1,requestId,hash,title,draft,request.mode(),document);
        jdbc.update("UPDATE trading.strategy SET current_revision=?,updated_at=clock_timestamp() WHERE id=? AND owner_id=?",current+1,id,user.id());
        return get(user,id,current+1);
    }
    @Transactional
    public void delete(UserPrincipal user,UUID id,Integer expected) {
        lockUser(user);expected(expected,current(user,id,true));
        jdbc.update("DELETE FROM trading.strategy WHERE id=? AND owner_id=?",id,user.id());
    }
}
