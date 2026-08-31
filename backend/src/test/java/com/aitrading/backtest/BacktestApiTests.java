package com.aitrading.backtest;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import com.aitrading.market.*;
import com.aitrading.strategy.StrategyService;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres","aitrading.backtest.scheduler=false"})
class BacktestApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired StrategyService strategies;
    @Autowired MarketService market;
    @Autowired BacktestStore store;
    @Autowired PythonWorker worker;
    @Autowired AuthRateLimiter limiter;
    record Actor(HttpClient client,String csrf,UUID id,String email){}
    record Sources(UUID strategy,UUID dataset,String dataHash){}
    Actor a,b;Sources source;
    @BeforeAll static void isolatedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize().startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup()throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");jdbc.update("DELETE FROM trading.app_user");
        a=actor("job-a@example.test");b=actor("job-b@example.test");source=sources(a);assertThat(worker.configured()).isTrue();
    }
    Actor actor(String email)throws Exception {
        String password="Synthetic job fixture password!";auth.register(email,"Synthetic Researcher",password);
        var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).connectTimeout(Duration.ofSeconds(3)).build();
        var anonymous=new Actor(client,null,null,email);String token=tree(send(anonymous,"GET","/api/auth/csrf","",null,Map.of()),200).get("token").asString();
        assertThat(send(anonymous,"POST","/api/auth/login","email="+URLEncoder.encode(email,StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8),token,
                Map.of("Content-Type","application/x-www-form-urlencoded")).statusCode()).isEqualTo(204);
        String csrf=tree(send(anonymous,"GET","/api/auth/csrf","",null,Map.of()),200).get("token").asString();
        return new Actor(client,csrf,UUID.fromString(tree(send(anonymous,"GET","/api/auth/me","",null,Map.of()),200).get("id").asString()),email);
    }
    UserPrincipal user(Actor actor){return (UserPrincipal)users.loadUserByUsername(actor.email());}
    HttpResponse<String> send(Actor actor,String method,String path,String body,String csrf,Map<String,String> headers)throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(15));
        builder.header("Content-Type",headers.getOrDefault("Content-Type","application/json"));headers.forEach((k,v)->{if(!k.equals("Content-Type"))builder.header(k,v);});
        if(csrf!=null)builder.header("X-CSRF-TOKEN",csrf);
        return actor.client().send(builder.method(method,HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> call(Actor actor,String method,String path,Object body)throws Exception{return send(actor,method,path,body==null?"":BacktestJson.JSON.writeValueAsString(body),actor.csrf(),Map.of());}
    JsonNode tree(HttpResponse<String> response,int expected){assertThat(response.statusCode()).as(response.body()).isEqualTo(expected);return BacktestJson.JSON.readTree(response.body());}
    Sources sources(Actor owner)throws Exception {
        var sample=BacktestJson.JSON.readTree(Files.readAllBytes(Path.of("../python/examples/long-next-open.json")));
        var created=strategies.create(user(owner),new StrategyService.Create(UUID.randomUUID().toString(),"Synthetic job strategy <script>inert</script>"));
        strategies.save(user(owner),created.strategyId(),new StrategyService.Save(UUID.randomUUID().toString(),1,created.title(),BacktestJson.JSON.writeValueAsString(sample.get("dsl")),"VALIDATED"));
        StringBuilder csv=new StringBuilder("timestamp,open,high,low,close,volume\n");
        for(var candle:sample.get("dataset").get("candles")){var cells=new ArrayList<String>();for(var field:List.of("timestamp","open","high","low","close","volume"))cells.add(candle.get(field).asString());csv.append(String.join(",",cells)).append('\n');}
        var data=market.create(user(owner),new MarketService.Import(UUID.randomUUID().toString(),"Synthetic data","TEST_USD","1h","SYNTHETIC","Local fixture",csv.toString()));
        return new Sources(created.strategyId(),data.id(),data.dataHash());
    }
    Map<String,Object> body(UUID request,Sources s){return new HashMap<>(Map.of("requestId",request.toString(),"strategyId",s.strategy().toString(),"revision",2,"datasetId",s.dataset().toString()));}
    BacktestStore.Job create(Actor owner,Sources s,UUID key){return store.create(user(owner),new BacktestStore.Create(key.toString(),s.strategy().toString(),2,s.dataset().toString()),true);}
    UUID createHttp(Actor owner,Sources s)throws Exception{return UUID.fromString(tree(call(owner,"POST","/api/backtests",body(UUID.randomUUID(),s)),200).get("id").asString());}
    String path(UUID id){return "/api/backtests/"+id;}
    void complete(BacktestStore.Work work){store.finish(work,worker.run(work,()->store.running(work)),null);}
    @Test void actualHttpPythonAndDatabasePersistHandComputedResultAndHashes()throws Exception {
        UUID id=createHttp(a,source);var work=store.claim();assertThat(work.job().id()).isEqualTo(id);
        assertThat(store.get(user(a),id).state()).isEqualTo("RUNNING");complete(work);
        var job=tree(call(a,"GET",path(id),null),200);assertThat(job.get("state").asString()).isEqualTo("SUCCEEDED");
        var result=tree(call(a,"GET",path(id)+"/result",null),200);
        assertThat(result.get("metrics").get("netProfit").asString()).isEqualTo("100");assertThat(result.get("trades").size()).isEqualTo(1);
        assertThat(result.get("trades").get(0).get("entryPrice").asString()).isEqualTo("100");assertThat(result.get("trades").get(0).get("exitPrice").asString()).isEqualTo("110");
        assertThat(job.get("inputHash").asString()).isEqualTo("38a8086659b4719bac0995ec08fcb4c07d62aa9ba213ce381805ad76d3ed428f");
        assertThat(job.get("resultHash").asString()).isEqualTo("b04fd6e6beb34cea4e48d341fe1057854d82da10d6059ccfbded44fa48353494");
        assertThat(call(a,"GET",path(id),null).body()).doesNotContain("inputJson","resultJson","credentialVersion",a.email());
        assertThat(tree(call(a,"GET","/api/backtests/capabilities",null),200).get("configured").asBoolean()).isTrue();
        UUID second=createHttp(a,source);complete(store.claim());assertThat(store.get(user(a),second).resultHash()).isEqualTo(job.get("resultHash").asString());
    }
    @Test void ownerAuthCsrfAndCallerInjectionRejectBeforeJobAdmission()throws Exception {
        UUID id=createHttp(a,source);var payload=body(UUID.randomUUID(),source);
        tree(call(b,"POST","/api/backtests",payload),404);
        for(String suffix:List.of("","/result"))tree(call(b,"GET",path(id)+suffix,null),404);
        tree(call(b,"POST",path(id)+"/cancel",Map.of()),404);tree(call(b,"POST",path(id)+"/retry",Map.of("requestId",UUID.randomUUID().toString())),404);tree(call(b,"DELETE",path(id),Map.of()),404);
        tree(call(new Actor(HttpClient.newHttpClient(),null,null,""),"GET","/api/backtests",null),401);
        tree(send(a,"POST","/api/backtests",BacktestJson.JSON.writeValueAsString(payload),null,Map.of()),403);
        tree(send(a,"POST","/api/backtests",BacktestJson.JSON.writeValueAsString(payload),a.csrf(),Map.of("Origin","https://untrusted.invalid")),403);
        for(String key:List.of("ownerId","dsl","candles","command","path","environment")){var bad=body(UUID.randomUUID(),source);bad.put(key,"untrusted");tree(call(a,"POST","/api/backtests",bad),400);}
        assertThat(tree(call(b,"GET","/api/backtests",null),200).get("items").size()).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job",Long.class)).isEqualTo(1);
    }
    @Test void exactIdempotencyAndConcurrentAdmissionDoNotDuplicateWork()throws Exception {
        UUID key=UUID.randomUUID();var principal=user(a);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var pending=new ArrayList<Future<BacktestStore.Job>>();for(int i=0;i<6;i++)pending.add(pool.submit(()->store.create(principal,new BacktestStore.Create(key.toString(),source.strategy().toString(),2,source.dataset().toString()),true)));
            Set<UUID> ids=new HashSet<>();for(var result:pending)ids.add(result.get(8,TimeUnit.SECONDS).id());assertThat(ids).hasSize(1);
        }
        var changed=body(key,source);changed.put("revision",1);tree(call(a,"POST","/api/backtests",changed),409);
        assertThat(store.create(principal,new BacktestStore.Create(key.toString(),source.strategy().toString(),2,source.dataset().toString()),false).state()).isEqualTo("QUEUED");
        create(a,source,UUID.randomUUID());tree(call(a,"POST","/api/backtests",body(UUID.randomUUID(),source)),409);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job",Long.class)).isEqualTo(2);
    }
    @Test void frozenCandleWindowsAreOwnedBoundedAndSurviveSourceDeletion()throws Exception {
        UUID id=createHttp(a,source);
        tree(call(a,"GET",path(id)+"/candles",null),409);
        complete(store.claim());
        strategies.delete(user(a),source.strategy(),2);market.delete(user(a),source.dataset(),source.dataHash());
        var first=tree(call(a,"GET",path(id)+"/candles?start=0&limit=2",null),200);
        assertThat(first.get("jobId").asString()).isEqualTo(id.toString());
        assertThat(first.get("dataHash").asString()).isEqualTo(source.dataHash());
        assertThat(first.get("inputHash").asString()).isEqualTo(store.get(user(a),id).inputHash());
        assertThat(first.get("items").size()).isEqualTo(2);
        assertThat(first.get("items").get(1).get("open").asString()).isEqualTo("100");
        var last=tree(call(a,"GET",path(id)+"/candles?start=2&limit=500",null),200);
        assertThat(last.get("items").size()).isEqualTo(1);
        assertThat(last.get("items").get(0).get("ordinal").asInt()).isEqualTo(2);
        assertThat(last.get("items").get(0).get("time").asString()).isEqualTo("2024-01-01T02:00:00Z");
        assertThat(tree(call(a,"GET",path(id)+"/candles?start=3",null),200).get("items").size()).isZero();
        for(String query:List.of("start=-1","start=4","start=1.5","start=abc","limit=0","limit=501","limit=1.5"))
            tree(call(a,"GET",path(id)+"/candles?"+query,null),400);
        tree(call(b,"GET",path(id)+"/candles",null),404);
        tree(call(a,"GET",path(UUID.randomUUID())+"/candles",null),404);
        var anonymous=new Actor(HttpClient.newHttpClient(),null,null,"anonymous");
        tree(call(anonymous,"GET",path(id)+"/candles",null),401);
        assertThat(first.toString()).doesNotContain("ownerId","credentialVersion","canonicalDsl",a.email());
        jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        tree(call(a,"GET",path(id)+"/candles",null),401);
    }
    @Test void frozenSnapshotSurvivesSourceDeletionAndRetryUsesExactInput()throws Exception {
        UUID key=UUID.randomUUID();var first=create(a,source,key);
        strategies.delete(user(a),source.strategy(),2);market.delete(user(a),source.dataset(),source.dataHash());
        assertThat(create(a,source,key).id()).isEqualTo(first.id());
        store.cancel(user(a),first.id());UUID retryKey=UUID.randomUUID();
        var retry=store.retry(user(a),first.id(),retryKey,true);assertThat(retry.inputHash()).isEqualTo(first.inputHash());assertThat(retry.retryOf()).isEqualTo(first.id());
        assertThat(store.retry(user(a),first.id(),retryKey,false).id()).isEqualTo(retry.id());
        complete(store.claim());assertThat(store.get(user(a),retry.id()).state()).isEqualTo("SUCCEEDED");
        store.delete(user(a),first.id());assertThat(store.get(user(a),retry.id()).state()).isEqualTo("SUCCEEDED");
        tree(call(a,"POST",path(retry.id())+"/retry",Map.of("requestId",UUID.randomUUID().toString())),409);
    }
    @Test void queuedRunningCancellationAndRevocationNeverPublishLateResult()throws Exception {
        var queued=create(a,source,UUID.randomUUID());store.cancel(user(a),queued.id());assertThat(store.claim()).isNull();
        var running=create(a,source,UUID.randomUUID());var work=store.claim();var result=worker.run(work,()->true);
        store.cancel(user(a),running.id());store.finish(work,result,null);assertThat(store.get(user(a),running.id()).state()).isEqualTo("CANCELLED");
        tree(call(a,"GET",path(running.id())+"/result",null),409);
        var revoked=create(a,source,UUID.randomUUID());var pending=store.claim();
        jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        store.finish(pending,result,null);
        assertThat(jdbc.queryForObject("SELECT error_code FROM trading.backtest_job WHERE id=?",String.class,revoked.id())).isEqualTo("CREDENTIAL_REVOKED");
        tree(call(a,"GET",path(revoked.id()),null),401);
    }
    @Test void leaseExpiryAndFreshSchedulerRecoverWithoutStartedJobReplay()throws Exception {
        var interrupted=create(a,source,UUID.randomUUID());store.claim();
        jdbc.update("UPDATE trading.backtest_job SET lease_until=clock_timestamp()-interval '1 second' WHERE id=?",interrupted.id());store.expire();
        assertThat(store.get(user(a),interrupted.id()).errorCode()).isEqualTo("WORKER_INTERRUPTED");
        var queued=create(a,source,UUID.randomUUID());
        var restarted=new BacktestScheduler(store,worker);
        try {
            restarted.tick();long deadline=System.nanoTime()+Duration.ofSeconds(8).toNanos();
            while(Set.of("QUEUED","RUNNING").contains(store.get(user(a),queued.id()).state())&&System.nanoTime()<deadline)Thread.sleep(50);
            assertThat(store.get(user(a),queued.id()).state()).isEqualTo("SUCCEEDED");
        }finally{restarted.shutdown();}
        assertThat(store.get(user(a),interrupted.id()).state()).isEqualTo("FAILED");
    }
    @Test void globalClaimsAreBoundedAndQueuedExpiryIsExplicit()throws Exception {
        var other=sources(b);create(a,source,UUID.randomUUID());create(a,source,UUID.randomUUID());create(b,other,UUID.randomUUID());
        Set<UUID> claimed=new HashSet<>();try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var calls=new ArrayList<Future<BacktestStore.Work>>();for(int i=0;i<6;i++)calls.add(pool.submit(store::claim));
            for(var value:calls){var work=value.get(8,TimeUnit.SECONDS);if(work!=null)claimed.add(work.job().id());}
        }
        assertThat(claimed).hasSize(2);assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job WHERE state='RUNNING'",Long.class)).isEqualTo(2);
        jdbc.update("UPDATE trading.backtest_job SET lease_until=clock_timestamp()-interval '1 second' WHERE state='QUEUED'");store.expire();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job WHERE error_code='QUEUE_EXPIRED'",Long.class)).isEqualTo(1);
    }
    @Test void failedAtomicResultTransactionNeverLeavesPartialSuccess()throws Exception {
        var job=create(a,source,UUID.randomUUID());var work=store.claim();var result=worker.run(work,()->true);
        jdbc.execute("CREATE FUNCTION trading.job_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic transaction failure'; END $$");
        jdbc.execute("CREATE TRIGGER job_test_failure BEFORE UPDATE ON trading.backtest_job FOR EACH ROW EXECUTE FUNCTION trading.job_test_failure()");
        try{assertThatThrownBy(()->store.finish(work,result,null)).isInstanceOf(RuntimeException.class);}
        finally{jdbc.execute("DROP TRIGGER job_test_failure ON trading.backtest_job");jdbc.execute("DROP FUNCTION trading.job_test_failure()");}
        assertThat(store.get(user(a),job.id()).state()).isEqualTo("RUNNING");assertThat(store.get(user(a),job.id()).resultHash()).isNull();
        jdbc.update("UPDATE trading.backtest_job SET lease_until=clock_timestamp()-interval '1 second' WHERE id=?",job.id());store.expire();
        assertThat(store.get(user(a),job.id()).state()).isEqualTo("FAILED");
    }
    @Test void invalidDraftMarketGapWarmupAndMalformedRequestsAreRejected()throws Exception {
        var draft=body(UUID.randomUUID(),source);draft.put("revision",1);tree(call(a,"POST","/api/backtests",draft),422);
        for(String invalid:List.of("null","[]","{}","{}{}"))tree(send(a,"POST","/api/backtests",invalid,a.csrf(),Map.of()),400);
        tree(send(a,"POST","/api/backtests"," ".repeat(16385),a.csrf(),Map.of()),413);
        jdbc.update("UPDATE trading.market_dataset SET gap_count=1 WHERE id=?",source.dataset());tree(call(a,"POST","/api/backtests",body(UUID.randomUUID(),source)),422);
        jdbc.update("UPDATE trading.market_dataset SET gap_count=0,symbol='MISMATCH' WHERE id=?",source.dataset());tree(call(a,"POST","/api/backtests",body(UUID.randomUUID(),source)),422);
        jdbc.update("UPDATE trading.market_dataset SET symbol='TEST_USD' WHERE id=?",source.dataset());
        var sample=(tools.jackson.databind.node.ObjectNode)BacktestJson.JSON.readTree(Files.readAllBytes(Path.of("../python/examples/long-next-open.json"))).get("dsl");
        sample.set("indicators",BacktestJson.JSON.readTree("[{\"id\":\"slow\",\"type\":\"SMA\",\"source\":{\"kind\":\"series\",\"field\":\"close\",\"lag\":0},\"period\":10}]"));
        strategies.save(user(a),source.strategy(),new StrategyService.Save(UUID.randomUUID().toString(),2,"Warmup",BacktestJson.JSON.writeValueAsString(sample),"VALIDATED"));
        var warmup=body(UUID.randomUUID(),source);warmup.put("revision",3);tree(call(a,"POST","/api/backtests",warmup),422);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job",Long.class)).isZero();
    }
    @Test void paginationTerminalDeleteAndAccountIsolationRemainExact()throws Exception {
        Set<String> ids=new HashSet<>();for(int i=0;i<4;i++){var job=create(a,source,UUID.randomUUID());ids.add(job.id().toString());store.cancel(user(a),job.id());}
        var first=tree(call(a,"GET","/api/backtests?limit=2",null),200);var second=tree(call(a,"GET","/api/backtests?limit=2&cursor="+first.get("nextCursor").asString(),null),200);
        Set<String> seen=new HashSet<>();for(var page:List.of(first,second))for(var job:page.get("items"))seen.add(job.get("id").asString());assertThat(seen).isEqualTo(ids);
        assertThat(second.get("nextCursor").isNull()).isTrue();tree(call(a,"GET","/api/backtests?limit=0",null),400);
        UUID active=createHttp(a,source);tree(call(a,"DELETE",path(active),Map.of()),409);tree(call(a,"POST",path(active)+"/cancel",Map.of()),200);assertThat(call(a,"DELETE",path(active),Map.of()).statusCode()).isEqualTo(204);
        tree(call(a,"GET",path(active),null),404);assertThat(tree(call(b,"GET","/api/backtests",null),200).get("items").size()).isZero();
    }
    @Test void perUserReadStartMutationRatesAndStoredQuotaCannotBeBypassed()throws Exception {
        UUID id=createHttp(a,source);limiter.allow("job-start",a.id().toString(),10);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=10 WHERE bucket_key=?",AuthRateLimiter.bucketKey("job-start",a.id().toString()));
        tree(call(a,"POST","/api/backtests",body(UUID.randomUUID(),source)),429);
        tree(call(a,"GET",path(id),null),200);jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=300 WHERE bucket_key=?",AuthRateLimiter.bucketKey("job-read",a.id().toString()));tree(call(a,"GET",path(id),null),429);
        tree(call(b,"GET","/api/backtests",null),200);limiter.allow("job-mutate",a.id().toString(),30);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=30 WHERE bucket_key=?",AuthRateLimiter.bucketKey("job-mutate",a.id().toString()));tree(call(a,"POST",path(id)+"/cancel",Map.of()),429);
        store.cancel(user(a),id);
        for(int i=1;i<20;i++){var job=create(a,source,UUID.randomUUID());store.cancel(user(a),job.id());}
        assertThatThrownBy(()->create(a,source,UUID.randomUUID())).isInstanceOf(com.aitrading.api.ResourceFailure.class);
    }
    @Test void databaseWideActiveAndStorageLimitsAreEnforcedAcrossOwners()throws Exception {
        var other=sources(b);create(b,other,UUID.randomUUID());
        // Seed only the isolated DB to the global boundary without hundreds of HTTP calls.
        jdbc.execute("""
                INSERT INTO trading.backtest_job SELECT (jsonb_populate_record(NULL::trading.backtest_job,
                to_jsonb(j)||jsonb_build_object('id',gen_random_uuid(),'request_id',gen_random_uuid()))).*
                FROM trading.backtest_job j CROSS JOIN generate_series(1,15)
                """);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job WHERE state='QUEUED'",Long.class)).isEqualTo(16);
        tree(call(a,"POST","/api/backtests",body(UUID.randomUUID(),source)),409);
        jdbc.update("UPDATE trading.backtest_job SET state='CANCELLED',error_code='JOB_CANCELLED',finished_at=clock_timestamp()");
        jdbc.execute("""
                INSERT INTO trading.backtest_job SELECT (jsonb_populate_record(NULL::trading.backtest_job,
                to_jsonb(j)||jsonb_build_object('id',gen_random_uuid(),'request_id',gen_random_uuid()))).*
                FROM (SELECT * FROM trading.backtest_job LIMIT 1) j CROSS JOIN generate_series(1,84)
                """);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job",Long.class)).isEqualTo(100);
        tree(call(a,"POST","/api/backtests",body(UUID.randomUUID(),source)),409);
    }
}
