package com.aitrading.backtest;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.dsl.DslValidator;
import com.aitrading.market.*;
import com.aitrading.strategy.StrategyService;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BacktestStore {
    private final JdbcTemplate jdbc;
    private final StrategyService strategies;
    private final MarketService market;
    private final DslValidator validator;
    public record Create(String requestId,String strategyId,Integer revision,String datasetId){}
    public record Job(UUID id,UUID requestId,UUID strategyId,int revision,String strategyTitle,UUID datasetId,String datasetName,
            String symbol,String timeframe,String sourceKind,UUID retryOf,String state,String errorCode,String inputHash,String dslHash,String dataHash,
            int candleCount,String resultHash,Instant createdAt,Instant startedAt,Instant leaseUntil,Instant finishedAt){}
    public record Page(List<Job> items,String nextCursor){public Page{items=List.copyOf(items);}}
    public record Work(Job job,UUID ownerId,long credentialVersion,String input){}
    public BacktestStore(JdbcTemplate jdbc,StrategyService strategies,MarketService market,DslValidator validator){this.jdbc=jdbc;this.strategies=strategies;this.market=market;this.validator=validator;}
    private Instant time(ResultSet rs,String name)throws SQLException{var value=rs.getObject(name,OffsetDateTime.class);return value==null?null:value.toInstant();}
    private Job row(ResultSet rs,int ignored)throws SQLException {
        return new Job(rs.getObject("id",UUID.class),rs.getObject("request_id",UUID.class),rs.getObject("strategy_id",UUID.class),rs.getInt("strategy_revision"),rs.getString("strategy_title"),
                rs.getObject("dataset_id",UUID.class),rs.getString("dataset_name"),rs.getString("symbol"),rs.getString("timeframe"),rs.getString("source_kind"),rs.getObject("retry_of",UUID.class),
                rs.getString("state"),rs.getString("error_code"),rs.getString("input_hash"),rs.getString("dsl_hash"),rs.getString("data_hash"),rs.getInt("candle_count"),rs.getString("result_hash"),
                time(rs,"created_at"),time(rs,"started_at"),time(rs,"lease_until"),time(rs,"finished_at"));
    }
    private void lockUser(UserPrincipal user) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())
            throw new BadCredentialsException("Invalid session");
    }
    private Job owned(UserPrincipal user,UUID id,boolean lock) {
        return jdbc.query("SELECT * FROM trading.backtest_job WHERE id=? AND owner_id=?"+(lock?" FOR UPDATE":""),this::row,id,user.id())
                .stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    private void admissionLock(){jdbc.execute("SELECT pg_advisory_xact_lock(711001)");}
    private String fingerprint(Object... value){return BacktestJson.hash(BacktestJson.JSON.writeValueAsString(value));}
    private Job replay(UserPrincipal user,UUID request,String hash) {
        var rows=jdbc.queryForList("SELECT id,request_hash FROM trading.backtest_job WHERE owner_id=? AND request_id=?",user.id(),request);
        if(rows.isEmpty())return null;
        if(!hash.equals(rows.getFirst().get("request_hash")))throw ResourceFailure.conflict();
        return owned(user,(UUID)rows.getFirst().get("id"),false);
    }
    private void quota(UserPrincipal user) {
        Long all=jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job",Long.class);
        Long mine=jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job WHERE owner_id=?",Long.class,user.id());
        Long active=jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job WHERE state IN ('QUEUED','RUNNING')",Long.class);
        Long myActive=jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job WHERE owner_id=? AND state IN ('QUEUED','RUNNING')",Long.class,user.id());
        if(all>=100||mine>=20||active>=16||myActive>=2)throw ResourceFailure.conflict();
    }
    @Transactional
    public Job create(UserPrincipal user,Create request,boolean configured) {
        UUID key=StrategyService.id(request.requestId()),strategy=StrategyService.id(request.strategyId()),dataset=MarketService.id(request.datasetId());
        if(request.revision()==null||request.revision()<1||request.revision()>100)throw new IllegalArgumentException("Invalid revision");
        String fingerprint=fingerprint("create",strategy,request.revision(),dataset);lockUser(user);admissionLock();
        Job replay=replay(user,key,fingerprint);if(replay!=null)return replay;
        if(!configured)throw new BacktestFailure(BacktestFailure.Code.WORKER_UNCONFIGURED);
        quota(user);
        var revision=strategies.get(user,strategy,request.revision());var data=market.get(user,dataset);
        if(!revision.status().equals("VALIDATED")||data.gapCount()!=0||!data.symbol().equals(revision.symbol())||!data.timeframe().equals(revision.timeframe())
                ||data.candleCount()<revision.minimumBars()||data.createdAt().isAfter(Instant.now()))throw new BacktestFailure(BacktestFailure.Code.SNAPSHOT_INVALID);
        var validated=validator.validate(revision.canonicalJson().getBytes(StandardCharsets.UTF_8));
        if(!validated.valid()||!validated.document().hash().equals(revision.hash()))throw new BacktestFailure(BacktestFailure.Code.SNAPSHOT_INVALID);
        Instant cutoff=data.lastTime().plusSeconds(MarketCsvParser.timeframeSeconds(data.timeframe()));
        if(cutoff.isAfter(Instant.now()))throw new BacktestFailure(BacktestFailure.Code.SNAPSHOT_INVALID);
        var candles=market.candles(user,dataset,"0",5000);
        var input=Map.of("protocolVersion","1.0.0","dsl",BacktestJson.parse(revision.canonicalJson().getBytes(StandardCharsets.UTF_8),65536),"dataset",
                Map.of("symbol",data.symbol(),"timeframe",data.timeframe(),"timezone","UTC","sourceType",data.sourceKind(),"closedThrough",cutoff.toString(),
                        "candles",candles.items().stream().map(c->Map.of("timestamp",c.time().toString(),"open",c.open(),"high",c.high(),"low",c.low(),"close",c.close(),"volume",c.volume())).toList()));
        String frozen=BacktestJson.canonical(BacktestJson.JSON.valueToTree(input));
        if(frozen.getBytes(StandardCharsets.UTF_8).length>BacktestJson.MAX_INPUT)throw new BacktestFailure(BacktestFailure.Code.SNAPSHOT_INVALID);
        UUID id=UUID.randomUUID();
        jdbc.update("""
                INSERT INTO trading.backtest_job(id,owner_id,request_id,request_hash,strategy_id,strategy_revision,strategy_title,dataset_id,dataset_name,symbol,timeframe,source_kind,
                credential_version,input_json,input_hash,dsl_hash,data_hash,candle_count,state) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'QUEUED')
                """,id,user.id(),key,fingerprint,strategy,revision.revision(),revision.title(),dataset,data.name(),data.symbol(),data.timeframe(),data.sourceKind(),user.credentialVersion(),frozen,
                BacktestJson.hash(frozen),revision.hash(),data.dataHash(),data.candleCount());
        return owned(user,id,false);
    }
    @Transactional
    public Job retry(UserPrincipal user,UUID original,UUID key,boolean configured) {
        String fingerprint=fingerprint("retry",original);lockUser(user);admissionLock();Job replay=replay(user,key,fingerprint);if(replay!=null)return replay;
        var old=owned(user,original,true);if(!Set.of("FAILED","CANCELLED").contains(old.state()))throw ResourceFailure.conflict();
        if(!configured)throw new BacktestFailure(BacktestFailure.Code.WORKER_UNCONFIGURED);quota(user);UUID id=UUID.randomUUID();
        jdbc.update("""
                INSERT INTO trading.backtest_job(id,owner_id,request_id,request_hash,strategy_id,strategy_revision,strategy_title,dataset_id,dataset_name,symbol,timeframe,source_kind,
                retry_of,credential_version,input_json,input_hash,dsl_hash,data_hash,candle_count,state)
                SELECT ?,owner_id,?,?,strategy_id,strategy_revision,strategy_title,dataset_id,dataset_name,symbol,timeframe,source_kind,?,?,input_json,input_hash,dsl_hash,data_hash,candle_count,'QUEUED'
                FROM trading.backtest_job WHERE id=? AND owner_id=?
                """,id,key,fingerprint,original,user.credentialVersion(),original,user.id());
        return owned(user,id,false);
    }
    @Transactional public Job get(UserPrincipal user,UUID id){lockUser(user);return owned(user,id,false);}
    @Transactional public String result(UserPrincipal user,UUID id) {
        lockUser(user);if(!owned(user,id,false).state().equals("SUCCEEDED"))throw ResourceFailure.conflict();
        return jdbc.queryForObject("SELECT result_json FROM trading.backtest_job WHERE id=? AND owner_id=?",String.class,id,user.id());
    }
    public record FrozenCandle(int ordinal,String time,String open,String high,String low,String close,String volume){}
    public record FrozenPage(UUID jobId,String inputHash,String dataHash,String symbol,int start,int total,List<FrozenCandle> items){}
    @Transactional public FrozenPage candles(UserPrincipal user,UUID id,String start,int limit) {
        lockUser(user);var job=owned(user,id,false);
        if(!job.state().equals("SUCCEEDED"))throw ResourceFailure.conflict();
        int from=MarketService.integer(start,0,0,job.candleCount());
        if(limit<1||limit>500)throw new IllegalArgumentException("Invalid limit");
        String input=jdbc.queryForObject("SELECT input_json FROM trading.backtest_job WHERE id=? AND owner_id=?",String.class,id,user.id());
        var rows=BacktestJson.parse(input.getBytes(StandardCharsets.UTF_8),BacktestJson.MAX_INPUT).get("dataset").get("candles");
        var items=new ArrayList<FrozenCandle>();
        for(int i=from;i<Math.min(from+limit,job.candleCount());i++) {
            var c=rows.get(i);items.add(new FrozenCandle(i,c.get("timestamp").asString(),c.get("open").asString(),c.get("high").asString(),
                    c.get("low").asString(),c.get("close").asString(),c.get("volume").asString()));
        }
        return new FrozenPage(id,job.inputHash(),job.dataHash(),job.symbol(),from,job.candleCount(),List.copyOf(items));
    }
    @Transactional public Page list(UserPrincipal user,int limit,String cursor) {
        lockUser(user);String sql="SELECT * FROM trading.backtest_job WHERE owner_id=? ";List<Job> rows;
        if(cursor==null)rows=jdbc.query(sql+"ORDER BY created_at DESC,id DESC LIMIT ?",this::row,user.id(),limit+1);
        else {
            if(cursor.length()>128||!cursor.matches("[A-Za-z0-9_-]+"))throw new IllegalArgumentException("Invalid cursor");
            String[] parts=new String(Base64.getUrlDecoder().decode(cursor),StandardCharsets.UTF_8).split("\\|",-1);
            if(parts.length!=2)throw new IllegalArgumentException("Invalid cursor");Instant at;
            try{at=Instant.parse(parts[0]);}catch(DateTimeException invalid){throw new IllegalArgumentException("Invalid cursor");}
            if(at.isBefore(Instant.EPOCH)||at.isAfter(Instant.parse("2101-01-01T00:00:00Z")))throw new IllegalArgumentException("Invalid cursor");
            rows=jdbc.query(sql+"AND (created_at,id)<(?,?) ORDER BY created_at DESC,id DESC LIMIT ?",this::row,user.id(),Timestamp.from(at),StrategyService.id(parts[1]),limit+1);
        }
        boolean more=rows.size()>limit;var items=rows.subList(0,Math.min(limit,rows.size()));
        return new Page(items,more?Base64.getUrlEncoder().withoutPadding().encodeToString((items.getLast().createdAt()+"|"+items.getLast().id()).getBytes(StandardCharsets.UTF_8)):null);
    }
    private void fail(UUID id,String state,BacktestFailure.Code code) {
        jdbc.update("UPDATE trading.backtest_job SET state=?,error_code=?,finished_at=clock_timestamp() WHERE id=? AND state IN ('QUEUED','RUNNING')",state,code.name(),id);
    }
    @Transactional public Job cancel(UserPrincipal user,UUID id){lockUser(user);owned(user,id,true);fail(id,"CANCELLED",BacktestFailure.Code.JOB_CANCELLED);return owned(user,id,false);}
    @Transactional public void delete(UserPrincipal user,UUID id){lockUser(user);if(Set.of("QUEUED","RUNNING").contains(owned(user,id,true).state()))throw ResourceFailure.conflict();jdbc.update("DELETE FROM trading.backtest_job WHERE id=? AND owner_id=?",id,user.id());}
    @Transactional public void expire() {
        jdbc.update("""
                UPDATE trading.backtest_job SET state='FAILED',error_code=CASE WHEN state='QUEUED' THEN 'QUEUE_EXPIRED' ELSE 'WORKER_INTERRUPTED' END,
                finished_at=clock_timestamp() WHERE state IN ('QUEUED','RUNNING') AND lease_until<=clock_timestamp()
                """);
        jdbc.update("""
                UPDATE trading.backtest_job j SET state='FAILED',error_code='CREDENTIAL_REVOKED',finished_at=clock_timestamp()
                FROM trading.app_user u WHERE j.owner_id=u.id AND j.credential_version<>u.credential_version AND j.state IN ('QUEUED','RUNNING')
                """);
    }
    @Transactional public Work claim() {
        admissionLock();if(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job WHERE state='RUNNING'",Long.class)>=2)return null;
        var rows=jdbc.query("""
                SELECT j.* FROM trading.backtest_job j JOIN trading.app_user u ON u.id=j.owner_id AND u.credential_version=j.credential_version
                WHERE j.state='QUEUED' AND j.lease_until>clock_timestamp() ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED
                """,(rs,n)->new Work(row(rs,n),rs.getObject("owner_id",UUID.class),rs.getLong("credential_version"),rs.getString("input_json")));
        if(rows.isEmpty())return null;var work=rows.getFirst();
        jdbc.update("UPDATE trading.backtest_job SET state='RUNNING',started_at=clock_timestamp(),lease_until=clock_timestamp()+interval '60 seconds' WHERE id=?",work.job().id());
        return work;
    }
    public boolean running(Work work) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM trading.backtest_job j JOIN trading.app_user u ON u.id=j.owner_id
                WHERE j.id=? AND j.owner_id=? AND j.credential_version=? AND u.credential_version=j.credential_version AND j.state='RUNNING' AND j.lease_until>clock_timestamp())
                """,Boolean.class,work.job().id(),work.ownerId(),work.credentialVersion()));
    }
    @Transactional public void finish(Work work,BacktestJson.Result result,BacktestFailure.Code failure) {
        var versions=jdbc.queryForList("SELECT credential_version FROM trading.app_user WHERE id=? FOR UPDATE",Long.class,work.ownerId());if(versions.isEmpty())return;
        var states=jdbc.queryForList("SELECT state FROM trading.backtest_job WHERE id=? AND owner_id=? FOR UPDATE",String.class,work.job().id(),work.ownerId());
        if(states.isEmpty()||!states.getFirst().equals("RUNNING"))return;
        if(versions.getFirst()!=work.credentialVersion())failure=BacktestFailure.Code.CREDENTIAL_REVOKED;
        else if(!running(work))failure=BacktestFailure.Code.WORKER_INTERRUPTED;
        if(failure!=null){fail(work.job().id(),"FAILED",failure);return;}
        if(result==null)throw BacktestJson.invalid();
        jdbc.update("UPDATE trading.backtest_job SET state='SUCCEEDED',result_json=?,result_hash=?,finished_at=clock_timestamp() WHERE id=? AND owner_id=? AND state='RUNNING'",
                result.json(),result.hash(),work.job().id(),work.ownerId());
    }
}
