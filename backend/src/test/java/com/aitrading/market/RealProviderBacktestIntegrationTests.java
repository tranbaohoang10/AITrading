package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;

import com.aitrading.auth.AuthService;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.auth.UserRepository;
import com.aitrading.backtest.BacktestStore;
import com.aitrading.backtest.PythonWorker;
import com.aitrading.strategy.StrategyService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@EnabledIfEnvironmentVariable(named="AITRADING_REAL_MARKET",matches="true")
@SpringBootTest(properties={"spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres","aitrading.backtest.scheduler=false"})
class RealProviderBacktestIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired StrategyService strategies;
    @Autowired MarketHistoricalSyncService sync;
    @Autowired ProviderDatasetMaterializer materializer;
    @Autowired BacktestStore backtests;
    @Autowired PythonWorker worker;

    @Test void runsActualPythonBacktestsFromRealLocalBinanceCandlesForEveryRequiredTimeframe() throws Exception {
        jdbc.update("DELETE FROM trading.app_user");
        String email="real-provider-backtest@example.test";
        auth.register(email,"Provider Backtest","Synthetic integration password! 2026");
        var user=(UserPrincipal)users.loadUserByUsername(email);
        Instant from=Instant.parse("2026-09-01T00:00:00Z"),to=Instant.parse("2026-09-08T00:00:00Z");
        assertThat(sync.sync("BTC/USDT",from,to).status()).isEqualTo("READY");
        var hashes=new LinkedHashMap<String,String>();
        for(var entry:Map.of("1m",10080,"5m",2016,"15m",672,"30m",336,"1h",168,"4h",42,"1d",7).entrySet()) {
            var dataset=materializer.materialize(user,UUID.randomUUID().toString(),"BTC/USDT",entry.getKey(),from,to);
            assertThat(dataset.candleCount()).isEqualTo(entry.getValue());
            String hash=run(user,dataset,entry.getKey());
            hashes.put(entry.getKey(),hash);
            System.out.println("BACKTEST_MATRIX|BTC/USDT|BINANCE|"+entry.getKey()+"|"+dataset.candleCount()+"|SUCCEEDED|"+hash);
        }
        var repeated=materializer.materialize(user,UUID.randomUUID().toString(),"BTC/USDT","1m",from,to);
        assertThat(run(user,repeated,"1m")).isEqualTo(hashes.get("1m"));
        System.out.println("BACKTEST_DETERMINISM|BTC/USDT|BINANCE|1m|PASS|"+hashes.get("1m"));
    }

    private String run(UserPrincipal user,ProviderDatasetMaterializer.Result dataset,String timeframe) throws Exception {
        var json=JsonMapper.builder().build();
        var sample=(ObjectNode)json.readTree(Files.readAllBytes(Path.of("../python/examples/long-next-open.json"))).get("dsl");
        var market=(ObjectNode)sample.get("market");
        market.put("symbol","BTC-USDT");
        market.put("timeframe",timeframe);
        var created=strategies.create(user,new StrategyService.Create(UUID.randomUUID().toString(),"Real Binance "+timeframe+" smoke"));
        var revision=strategies.save(user,created.strategyId(),new StrategyService.Save(UUID.randomUUID().toString(),1,created.title(),json.writeValueAsString(sample),"VALIDATED"));
        var job=backtests.create(user,new BacktestStore.Create(UUID.randomUUID().toString(),created.strategyId().toString(),revision.revision(),dataset.datasetId().toString()),worker.configured());
        var work=backtests.claim();
        assertThat(work.job().id()).isEqualTo(job.id());
        var result=worker.run(work,()->backtests.running(work));
        backtests.finish(work,result,null);
        var finished=backtests.get(user,job.id());
        assertThat(finished.state()).isEqualTo("SUCCEEDED");
        assertThat(backtests.result(user,job.id())).contains("resultHash").contains("PROVIDER");
        return finished.resultHash();
    }
}
