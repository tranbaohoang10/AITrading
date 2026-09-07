package com.aitrading.replay;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.journal.JournalService;
import com.aitrading.market.*;
import java.math.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class ReplayService {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final JdbcTemplate jdbc;
    private final MarketHistoryService history;
    private final JournalService journal;
    public ReplayService(JdbcTemplate jdbc,MarketHistoryService history,JournalService journal){this.jdbc=jdbc;this.history=history;this.journal=journal;}
    public record Create(String requestId,String provider,String instrument,String timeframe,Instant from,Instant to,
            String initialBalance,String commissionBps,String slippageBps) {}
    public record Order(String side,String entry,String stop,String target,String sizingMode,String size) {}
    public record Command(String requestId,int expectedVersion,String action,Order order,String stop,String target) {}
    public record Trade(UUID id,String state,String side,BigDecimal quantity,BigDecimal intendedEntry,
            BigDecimal stop,BigDecimal target,BigDecimal entry,Instant entryTime,BigDecimal exit,Instant exitTime,
            BigDecimal entryFee,BigDecimal exitFee,String exitReason,String ambiguity,BigDecimal netPnl) {}
    public record View(UUID id,String provider,String instrument,String timeframe,String currency,int cursor,int version,
            String status,BigDecimal initialBalance,BigDecimal balance,BigDecimal equity,BigDecimal realizedPnl,
            BigDecimal openPnl,MarketDataProvider.Instrument metadata,List<MarketDataProvider.Candle> candles,
            List<Trade> trades,String ambiguityPolicy,boolean simulation) {
        public View withCandles(List<MarketDataProvider.Candle> visible) {
            return new View(id,provider,instrument,timeframe,currency,cursor,version,status,initialBalance,
                    balance,equity,realizedPnl,openPnl,metadata,visible,trades,ambiguityPolicy,simulation);
        }
    }
    private void lock(UserPrincipal user) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())
            throw new BadCredentialsException("Invalid session");
    }
    private Map<String,Object> owned(UserPrincipal user,UUID id) {
        return jdbc.queryForList("SELECT * FROM trading.replay_session WHERE id=? AND owner_id=? FOR UPDATE",id,user.id())
                .stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    private static String hash(Object value){return MarketCsvParser.hash(JSON.writeValueAsString(value));}
    private boolean duplicate(UserPrincipal user,UUID request,UUID session,String hash) {
        var old=jdbc.queryForList("SELECT session_id,request_hash FROM trading.replay_command WHERE owner_id=? AND request_id=?",user.id(),request);
        if(old.isEmpty())return false;
        if(!old.getFirst().get("session_id").equals(session)||!old.getFirst().get("request_hash").equals(hash))throw ResourceFailure.conflict();
        return true;
    }
    private void command(UserPrincipal user,UUID request,UUID session,String hash,int version) {
        jdbc.update("INSERT INTO trading.replay_command(owner_id,request_id,session_id,request_hash,applied_version) VALUES(?,?,?,?,?)",user.id(),request,session,hash,version);
    }
    private BigDecimal cost(String value) {
        if(value==null||!value.matches("(0|[1-9][0-9]{0,3})(\\.[0-9]{1,4})?"))throw new IllegalArgumentException("Invalid simulation cost");
        var n=new BigDecimal(value);if(n.compareTo(new BigDecimal("1000"))>0)throw new IllegalArgumentException("Invalid simulation cost");return n;
    }
    @Transactional
    public View create(UserPrincipal user,Create input) {
        if(input==null)throw new IllegalArgumentException("Invalid replay request");
        UUID request=UUID.fromString(input.requestId());String hash=hash(input);
        lock(user);
        var prior=jdbc.queryForList("SELECT session_id,request_hash FROM trading.replay_command WHERE owner_id=? AND request_id=?",user.id(),request);
        if(!prior.isEmpty()) {
            if(!prior.getFirst().get("request_hash").equals(hash))throw ResourceFailure.conflict();
            return view(user,(UUID)prior.getFirst().get("session_id"));
        }
        if(jdbc.queryForObject("SELECT count(*) FROM trading.replay_session WHERE owner_id=?",Integer.class,user.id())>=50)throw ResourceFailure.conflict();
        var balance=ReplayExecution.positive(input.initialBalance());var commission=cost(input.commissionBps());var slip=cost(input.slippageBps());
        if(!history.replaySupported(input.provider()))throw new IllegalArgumentException("Provider does not support trading Replay");
        var instrument=history.instrument(input.provider(),input.instrument());
        var candles=history.history(input.provider(),input.instrument(),input.timeframe(),input.from(),input.to());
        if(candles.size()<2)throw new IllegalArgumentException("Historical range unavailable");
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO trading.replay_session(id,owner_id,provider,instrument,timeframe,requested_start,requested_end,cursor,
              initial_balance,balance,currency,commission_bps,slippage_bps,instrument_snapshot,history_snapshot,status)
            VALUES(?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,'ACTIVE')
            """,id,user.id(),input.provider(),input.instrument(),input.timeframe(),Timestamp.from(input.from()),Timestamp.from(input.to()),
                balance,balance,instrument.currency(),commission,slip,JSON.writeValueAsString(instrument),JSON.writeValueAsString(candles));
        command(user,request,id,hash,1);return view(user,id);
    }
    private List<MarketDataProvider.Candle> candles(Map<String,Object> session){return List.of(JSON.readValue((String)session.get("history_snapshot"),MarketDataProvider.Candle[].class));}
    private List<Trade> trades(UUID id){return jdbc.query("SELECT facts FROM trading.replay_trade WHERE session_id=? ORDER BY id",(r,n)->JSON.readValue(r.getString(1),Trade.class),id);}
    @Transactional public List<Map<String,Object>> list(UserPrincipal user) {
        lock(user);return jdbc.queryForList("SELECT id,provider,instrument,timeframe,status,version,created_at FROM trading.replay_session WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 50",user.id());
    }
    @Transactional public View view(UserPrincipal user,UUID id) {
        lock(user);var s=owned(user,id);var all=candles(s);int cursor=(Integer)s.get("cursor");
        var trades=trades(id);BigDecimal balance=(BigDecimal)s.get("balance"),initial=(BigDecimal)s.get("initial_balance"),open=BigDecimal.ZERO;
        for(var t:trades)if(t.state().equals("OPEN"))open=open.add(ReplayExecution.pnl(t.side(),t.quantity(),t.entry(),all.get(cursor).close(),t.entryFee()));
        return new View(id,(String)s.get("provider"),(String)s.get("instrument"),(String)s.get("timeframe"),(String)s.get("currency"),cursor,
                (Integer)s.get("version"),(String)s.get("status"),initial,balance,balance.add(open),balance.subtract(initial),open,
                JSON.readValue((String)s.get("instrument_snapshot"),MarketDataProvider.Instrument.class),
                List.copyOf(all.subList(0,cursor+1)),trades,(String)s.get("ambiguity_policy"),true);
    }
    private BigDecimal fee(BigDecimal price,BigDecimal quantity,Map<String,Object> s) {
        return price.multiply(quantity).multiply((BigDecimal)s.get("commission_bps")).divide(new BigDecimal("10000"),8,RoundingMode.HALF_EVEN);
    }
    private void save(UserPrincipal user,UUID session,Trade t) {
        jdbc.update("INSERT INTO trading.replay_trade(id,session_id,owner_id,state,facts) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state,facts=EXCLUDED.facts",
                t.id(),session,user.id(),t.state(),JSON.writeValueAsString(t));
    }
    private Trade close(UserPrincipal user,UUID session,Map<String,Object> s,Trade t,BigDecimal price,Instant time,String reason,String ambiguity) {
        BigDecimal exitFee=fee(price,t.quantity(),s),net=ReplayExecution.pnl(t.side(),t.quantity(),t.entry(),price,t.entryFee().add(exitFee));
        Trade closed=new Trade(t.id(),"CLOSED",t.side(),t.quantity(),t.intendedEntry(),t.stop(),t.target(),t.entry(),t.entryTime(),price,time,t.entryFee(),exitFee,reason,ambiguity,net);
        save(user,session,closed);
        var input=new JournalService.Input((String)s.get("instrument"),(String)s.get("timeframe"),(String)s.get("currency"),t.side(),"CLOSED",
                t.quantity().stripTrailingZeros().toPlainString(),t.entry().stripTrailingZeros().toPlainString(),price.stripTrailingZeros().toPlainString(),
                t.entryFee().stripTrailingZeros().toPlainString(),exitFee.stripTrailingZeros().toPlainString(),t.entryTime().toString(),time.toString(),"Replay simulation", "",null);
        var saved=journal.write(user,null,new JournalService.Write(t.id().toString(),0,input));
        String provenance=JSON.writeValueAsString(Map.of("provider",s.get("provider"),"instrument",s.get("instrument"),"timeframe",s.get("timeframe"),"session",session,"simulation",true,"execution",closed));
        jdbc.update("UPDATE trading.journal_entry SET source='REPLAY',replay_session_id=?,replay_trade_id=?,provenance=? WHERE id=? AND owner_id=?",session,t.id(),provenance,saved.entry().id(),user.id());
        jdbc.update("UPDATE trading.replay_trade SET journal_id=? WHERE id=?",saved.entry().id(),t.id());
        jdbc.update("UPDATE trading.replay_session SET balance=balance+? WHERE id=?",net,session);
        return closed;
    }
    @Transactional public View execute(UserPrincipal user,UUID id,Command input) {
        if(input==null||input.action()==null)throw new IllegalArgumentException("Invalid replay command");
        UUID request=UUID.fromString(input.requestId());String hash=hash(input);lock(user);var s=owned(user,id);
        if(duplicate(user,request,id,hash))return view(user,id);
        int version=(Integer)s.get("version"),cursor=(Integer)s.get("cursor");
        if(input.expectedVersion()!=version||!s.get("status").equals("ACTIVE"))throw ResourceFailure.conflict();
        var all=candles(s);var active=trades(id).stream().filter(t->Set.of("OPEN","PENDING_ENTRY").contains(t.state())).findFirst().orElse(null);
        BigDecimal slip=(BigDecimal)s.get("slippage_bps");
        switch(input.action()) {
            case "CONFIRM" -> {
                if(active!=null||input.order()==null||cursor>=all.size()-1)throw ResourceFailure.conflict();
                var o=input.order();BigDecimal entry=ReplayExecution.positive(o.entry()),stop=ReplayExecution.positive(o.stop()),target=ReplayExecution.positive(o.target());
                var meta=JSON.readValue((String)s.get("instrument_snapshot"),MarketDataProvider.Instrument.class);
                var sizing=ReplayExecution.size(o.side(),(BigDecimal)s.get("balance"),entry,stop,target,o.sizingMode(),ReplayExecution.positive(o.size()),meta.quantityIncrement());
                save(user,id,new Trade(UUID.randomUUID(),"PENDING_ENTRY",o.side(),sizing.quantity(),entry,stop,target,null,null,null,null,BigDecimal.ZERO,BigDecimal.ZERO,null,null,null));
            }
            case "STEP" -> {
                if(cursor>=all.size()-1)throw ResourceFailure.conflict();
                var candle=all.get(++cursor);
                if(active!=null) {
                    if(active.state().equals("PENDING_ENTRY")) {
                        var price=ReplayExecution.slipped(candle.open(),active.side(),true,slip);
                        if(price.multiply(active.quantity()).add(fee(price,active.quantity(),s)).compareTo((BigDecimal)s.get("balance"))>0) {
                            active=new Trade(active.id(),"CANCELLED",active.side(),active.quantity(),active.intendedEntry(),active.stop(),active.target(),null,null,null,null,BigDecimal.ZERO,BigDecimal.ZERO,"INSUFFICIENT_BALANCE",null,null);
                        } else active=new Trade(active.id(),"OPEN",active.side(),active.quantity(),active.intendedEntry(),active.stop(),active.target(),price,candle.time(),null,null,fee(price,active.quantity(),s),BigDecimal.ZERO,null,null,null);
                        save(user,id,active);
                    }
                    if(active.state().equals("OPEN")) {
                        var exit=ReplayExecution.trigger(active.side(),active.stop(),active.target(),candle,slip);
                        if(exit!=null)close(user,id,s,active,exit.price(),candle.time(),exit.reason(),exit.ambiguity());
                        else if(cursor==all.size()-1)close(user,id,s,active,ReplayExecution.slipped(candle.close(),active.side(),false,slip),candle.time(),"END_OF_REPLAY",null);
                    }
                }
                jdbc.update("UPDATE trading.replay_session SET cursor=? WHERE id=?",cursor,id);
            }
            case "LEVELS" -> {
                if(active==null||!active.state().equals("OPEN"))throw ResourceFailure.conflict();
                var stop=ReplayExecution.positive(input.stop());var target=ReplayExecution.positive(input.target());
                ReplayExecution.levels(active.side(),all.get(cursor).close(),stop,target);
                save(user,id,new Trade(active.id(),active.state(),active.side(),active.quantity(),active.intendedEntry(),stop,target,active.entry(),active.entryTime(),null,null,active.entryFee(),BigDecimal.ZERO,null,null,null));
            }
            case "CLOSE","END" -> {
                if(active!=null&&active.state().equals("OPEN"))close(user,id,s,active,ReplayExecution.slipped(all.get(cursor).close(),active.side(),false,slip),all.get(cursor).time(),input.action().equals("END")?"END_OF_REPLAY":"MANUAL",null);
                else if(active!=null)save(user,id,new Trade(active.id(),"CANCELLED",active.side(),active.quantity(),active.intendedEntry(),active.stop(),active.target(),null,null,null,null,BigDecimal.ZERO,BigDecimal.ZERO,"CANCELLED",null,null));
                else if(input.action().equals("CLOSE"))throw ResourceFailure.conflict();
                if(input.action().equals("END"))jdbc.update("UPDATE trading.replay_session SET status='ENDED' WHERE id=?",id);
            }
            default -> throw new IllegalArgumentException("Invalid replay action");
        }
        jdbc.update("UPDATE trading.replay_session SET version=version+1 WHERE id=?",id);
        command(user,request,id,hash,version+1);return view(user,id);
    }
}
