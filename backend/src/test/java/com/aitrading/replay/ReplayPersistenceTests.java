package com.aitrading.replay;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.*;
import com.aitrading.journal.JournalService;
import com.aitrading.market.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties="spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class ReplayPersistenceTests {
    @Autowired ReplayService replay;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired JournalService journal;
    @MockitoBean MarketHistoryService market;
    UserPrincipal a,b;
    Instant start=Instant.parse("2025-01-01T00:00:00Z");
    BigDecimal n(String value){return new BigDecimal(value);}
    @BeforeEach void setup() {
        assertNotNull(System.getenv("AITRADING_TEST_CLUSTER"));
        jdbc.update("DELETE FROM trading.app_user");
        auth.register("replay-a@example.test","A","Synthetic replay phrase 123!");
        auth.register("replay-b@example.test","B","Synthetic replay phrase 123!");
        a=principal("replay-a@example.test");b=principal("replay-b@example.test");
        var meta=new BinanceArchiveProvider().instrument("BTCUSDT");
        when(market.replaySupported("BINANCE")).thenReturn(true);
        when(market.instrument("BINANCE","BTCUSDT")).thenReturn(meta);
        when(market.history(eq("BINANCE"),eq("BTCUSDT"),eq("1h"),any(),any())).thenReturn(List.of(
                candle(0,"100","105","95","100"),candle(1,"100","105","95","102"),candle(2,"100","125","85","100")));
    }
    UserPrincipal principal(String email) {
        UUID id=jdbc.queryForObject("SELECT id FROM trading.app_user WHERE email=?",UUID.class,email);
        Long version=jdbc.queryForObject("SELECT credential_version FROM trading.app_user WHERE id=?",Long.class,id);
        return new UserPrincipal(id,email,"unused",version);
    }
    MarketDataProvider.Candle candle(int hour,String open,String high,String low,String close){return new MarketDataProvider.Candle(start.plusSeconds(hour*3600L),n(open),n(high),n(low),n(close),n("1"));}
    ReplayService.Create createInput(){return new ReplayService.Create(UUID.randomUUID().toString(),"BINANCE","BTCUSDT","1h",start,start.plusSeconds(10800),"10000","0","0");}
    ReplayService.Command cmd(int v,String action,ReplayService.Order order){return new ReplayService.Command(UUID.randomUUID().toString(),v,action,order,null,null);}
    @Test void prefixOnlyDuplicateConfirmConservativeCloseAndImmutableJournal() {
        var input=createInput();var view=replay.create(a,input);
        assertEquals(view.id(),replay.create(a,input).id());assertEquals(1,view.candles().size());
        assertThrows(ResourceFailure.class,()->replay.view(b,view.id()));
        var order=new ReplayService.Order("LONG","100","90","120","RISK_PERCENT","1");
        var confirm=cmd(1,"CONFIRM",order);
        replay.execute(a,view.id(),confirm);replay.execute(a,view.id(),confirm);
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM trading.replay_trade",Integer.class));
        assertThrows(ResourceFailure.class,()->replay.execute(a,view.id(),cmd(1,"STEP",null)));
        var step=replay.execute(a,view.id(),cmd(2,"STEP",null));assertEquals(2,step.candles().size());
        assertEquals("OPEN",step.trades().getFirst().state());
        var closed=replay.execute(a,view.id(),cmd(3,"STEP",null));
        assertEquals(0,n("9900").compareTo(closed.balance()));
        assertEquals("BOTH_TOUCHED_STOP_FIRST",closed.trades().getFirst().ambiguity());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM trading.journal_entry WHERE source='REPLAY'",Integer.class));
        UUID journalId=jdbc.queryForObject("SELECT id FROM trading.journal_entry",UUID.class);
        var entry=journal.get(a,journalId);var d=entry.data();
        var tampered=new JournalService.Input(d.symbol(),d.timeframe(),d.settlementCurrency(),d.side(),d.state(),"999",d.entryPrice(),d.exitPrice(),d.entryFee(),d.exitFee(),d.entryTime(),d.exitTime(),d.entryReason(),d.notes(),d.datasetId());
        assertThrows(ResourceFailure.class,()->journal.write(a,journalId,new JournalService.Write(UUID.randomUUID().toString(),1,tampered)));
        var review=new JournalService.Input(d.symbol(),d.timeframe(),d.settlementCurrency(),d.side(),d.state(),d.quantity(),d.entryPrice(),d.exitPrice(),d.entryFee(),d.exitFee(),d.entryTime(),d.exitTime(),"Reviewed reason","Review notes",d.datasetId());
        assertEquals("Review notes",journal.write(a,journalId,new JournalService.Write(UUID.randomUUID().toString(),1,review)).entry().data().notes());
    }
    @Test void futureFixtureMutationDoesNotChangeRevealedState() {
        var first=replay.create(a,createInput());
        when(market.history(eq("BINANCE"),eq("BTCUSDT"),eq("1h"),any(),any())).thenReturn(List.of(
                candle(0,"100","105","95","100"),candle(1,"500","900","100","700")));
        var changed=replay.create(a,createInput());
        assertEquals(first.candles(),changed.candles());assertEquals(first.equity(),changed.equity());
    }
    @Test void dailyNotesAreOwnerScopedAndExactRetriesDoNotOverwriteNewerEdits() {
        var range=JournalService.range("2025-01-01","2025-01-01","UTC","USDT");
        var input=new JournalService.DayNote("Review of synthetic trades",0);
        var first=journal.saveNote(a,range,input);
        assertEquals(first,journal.saveNote(a,range,input));
        assertEquals(new JournalService.DayNote("",0),journal.note(b,range));
        assertThrows(ResourceFailure.class,()->journal.saveNote(a,range,new JournalService.DayNote("stale competing edit",0)));
        var next=journal.saveNote(a,range,new JournalService.DayNote("newer review",1));
        assertEquals(2,next.version());
        assertThrows(ResourceFailure.class,()->journal.saveNote(a,range,input));
        assertThrows(IllegalArgumentException.class,()->journal.saveNote(a,range,new JournalService.DayNote("á".repeat(2001),2)));
    }
    @Test void simultaneousIdenticalCommandsHaveOneDurableEffect() throws Exception {
        var session=replay.create(a,createInput());
        var confirm=cmd(1,"CONFIRM",new ReplayService.Order("SHORT","100","110","80","RISK_PERCENT","1"));
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate=new java.util.concurrent.CountDownLatch(1);
            var first=pool.submit(()->{gate.await();return replay.execute(a,session.id(),confirm);});
            var second=pool.submit(()->{gate.await();return replay.execute(a,session.id(),confirm);});
            gate.countDown();
            assertEquals(first.get(10,java.util.concurrent.TimeUnit.SECONDS).version(),second.get(10,java.util.concurrent.TimeUnit.SECONDS).version());
        }
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM trading.replay_trade",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM trading.replay_command",Integer.class));
        var opened=replay.execute(a,session.id(),cmd(2,"STEP",null));
        var closed=replay.execute(a,session.id(),cmd(opened.version(),"CLOSE",null));
        assertEquals(0,n("9980").compareTo(closed.balance()));
        var range=JournalService.range("2025-01-01","2025-01-01","UTC","USDT");
        assertEquals(1,journal.page(a,range,1,20,"BTCUSDT","SHORT","CLOSED","REPLAY",session.id().toString()).totalItems());
        assertEquals(0,journal.page(a,range,1,20,"BTCUSDT","LONG","CLOSED","REPLAY",null).totalItems());
        assertEquals(0,journal.page(b,range,1,20,null,null,null,"REPLAY",session.id().toString()).totalItems());
    }
}
