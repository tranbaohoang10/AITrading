package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.notification.*;
import com.aitrading.auth.*;
import com.aitrading.backtest.*;
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
import org.springframework.dao.DataAccessException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres","aitrading.backtest.scheduler=false"})
class NotificationApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired NotificationService notices;
    @Autowired BacktestStore jobs;
    @Autowired StrategyService strategies;
    @Autowired MarketService market;
    @Autowired PythonWorker worker;
    final JsonMapper json=JsonMapper.builder().build();
    record Actor(HttpClient client,String csrf,UUID id,String email) { }
    Actor a,b;
    @BeforeAll static void ownedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize().startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup()throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");jdbc.update("DELETE FROM trading.app_user");
        a=actor("notification-a@example.test");b=actor("notification-b@example.test");
    }
    Actor actor(String email)throws Exception {
        String password="Synthetic notification fixture phrase!";auth.register(email,"Notification researcher",password);
        var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).connectTimeout(Duration.ofSeconds(3)).build();
        var anon=new Actor(client,null,null,email);
        String token=tree(call(anon,"GET","/api/auth/csrf",null,Map.of()),200).get("token").asString();
        var login=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/login")).header("Content-Type","application/x-www-form-urlencoded").header("X-CSRF-TOKEN",token)
            .POST(HttpRequest.BodyPublishers.ofString("email="+URLEncoder.encode(email,StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8))).build();
        assertThat(client.send(login,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(204);
        String fresh=tree(call(anon,"GET","/api/auth/csrf",null,Map.of()),200).get("token").asString();
        UUID id=UUID.fromString(tree(call(anon,"GET","/api/auth/me",null,Map.of()),200).get("id").asString());
        return new Actor(client,fresh,id,email);
    }
    HttpResponse<String> call(Actor actor,String method,String path,Object body,Map<String,String> headers)throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(20)).header("Content-Type","application/json");
        if(actor.id()!=null&&!headers.containsKey("X-Workspace-User"))request.header("X-Workspace-User",actor.id().toString());
        if(actor.csrf()!=null&&!headers.containsKey("X-CSRF-TOKEN"))request.header("X-CSRF-TOKEN",actor.csrf());
        headers.forEach(request::header);
        return actor.client().send(request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
    }
    JsonNode tree(HttpResponse<String> r,int expected){assertThat(r.statusCode()).as(r.body()).isEqualTo(expected);return json.readTree(r.body());}
    UserPrincipal principal(Actor actor){return (UserPrincipal)users.loadUserByUsername(actor.email());}
    Map<String,Object> jobInput()throws Exception {
        var sample=json.readTree(Files.readAllBytes(Path.of("../python/examples/long-next-open.json")));
        var created=strategies.create(principal(a),new StrategyService.Create(UUID.randomUUID().toString(),"Notification synthetic"));
        strategies.save(principal(a),created.strategyId(),new StrategyService.Save(UUID.randomUUID().toString(),1,created.title(),json.writeValueAsString(sample.get("dsl")),"VALIDATED"));
        StringBuilder csv=new StringBuilder("timestamp,open,high,low,close,volume\n");
        for(var candle:sample.get("dataset").get("candles")){var cells=new ArrayList<String>();for(String field:List.of("timestamp","open","high","low","close","volume"))cells.add(candle.get(field).asString());csv.append(String.join(",",cells)).append('\n');}
        var data=market.create(principal(a),new MarketService.Import(UUID.randomUUID().toString(),"Notification synthetic data","TEST_USD","1h","SYNTHETIC","Local fixture",csv.toString()));
        return Map.of("requestId",UUID.randomUUID().toString(),"strategyId",created.strategyId().toString(),"revision",2,"datasetId",data.id().toString());
    }
    UUID create()throws Exception {return UUID.fromString(tree(call(a,"POST","/api/backtests",jobInput(),Map.of()),200).get("id").asString());}
    NotificationService.Notice cancelled()throws Exception {UUID job=create();jobs.cancel(principal(a),job);return notices.list(principal(a),25,null).items().getFirst();}
    String path(String id){return "/api/backtests/notifications/"+id+"/read";}
    @Test void actualPythonCompletionNotifiesOnceAndLogicalJobDeletionPreservesNotice()throws Exception {
        UUID id=create();assertThat(notices.list(principal(a),25,null).items()).isEmpty();
        var work=jobs.claim();var result=worker.run(work,()->jobs.running(work));jobs.finish(work,result,null);jobs.finish(work,result,null);
        var page=tree(call(a,"GET","/api/backtests/notifications",null,Map.of()),200);
        assertThat(page.get("items").size()).isEqualTo(1);assertThat(page.get("unreadCount").asLong()).isEqualTo(1);
        var n=page.get("items").get(0);assertThat(n.get("jobId").asString()).isEqualTo(id.toString());assertThat(n.get("state").asString()).isEqualTo("SUCCEEDED");
        assertThat(n.get("readAt").isNull()).isTrue();assertThat(n.get("errorCode").isNull()).isTrue();
        assertThat(page.toString()).doesNotContain("Notification synthetic",a.email(),"inputJson","resultJson","ownerId","dsl","password");
        jdbc.update("UPDATE trading.backtest_job SET state=state WHERE id=?",id);
        jobs.delete(principal(a),id);assertThat(notices.list(principal(a),25,null).items()).hasSize(1);
        var read=tree(call(a,"POST",path(n.get("id").asString()),Map.of(),Map.of()),200);assertThat(read.get("readAt").isNull()).isFalse();
        assertThat(tree(call(a,"GET","/api/backtests/notifications",null,Map.of()),200).get("unreadCount").asLong()).isZero();
    }
    @Test void cancelFailureExpiryAndRetryAreDifferentUniqueTerminalJobs()throws Exception {
        UUID id=create();jobs.cancel(principal(a),id);jobs.cancel(principal(a),id);
        var retried=jobs.retry(principal(a),id,UUID.randomUUID(),true);var work=jobs.claim();jobs.finish(work,null,BacktestFailure.Code.WORKER_FAILED);
        var expired=jobs.retry(principal(a),retried.id(),UUID.randomUUID(),true);
        jdbc.update("UPDATE trading.backtest_job SET lease_until=clock_timestamp()-interval '1 minute' WHERE id=?",expired.id());jobs.expire();jobs.expire();
        var items=notices.list(principal(a),25,null).items();assertThat(items).hasSize(3);
        assertThat(items.stream().map(NotificationService.Notice::jobId)).containsExactly(expired.id(),retried.id(),id);
        assertThat(items.stream().map(NotificationService.Notice::errorCode)).containsExactly("QUEUE_EXPIRED","WORKER_FAILED","JOB_CANCELLED");
        assertThat(items.stream().map(NotificationService.Notice::state)).containsExactly("FAILED","FAILED","CANCELLED");
        jdbc.update("DELETE FROM trading.app_user WHERE id=?",a.id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_notification WHERE owner_id=?",Integer.class,a.id())).isZero();
    }
    @Test void notificationFailureRollsBackJobAndAuditThenRecoveryCreatesExactlyOnce()throws Exception {
        UUID id=create();
        jdbc.execute("CREATE FUNCTION trading.pb022_fail_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic-private-notification'; END $$");
        jdbc.execute("CREATE TRIGGER pb022_fail BEFORE INSERT ON trading.backtest_notification FOR EACH ROW EXECUTE FUNCTION trading.pb022_fail_notice()");
        try {
            var failure=call(a,"POST","/api/backtests/"+id+"/cancel",Map.of(),Map.of());tree(failure,503);
            assertThat(failure.body()).doesNotContain("synthetic-private", "SQL", "Exception");
            assertThat(jobs.get(principal(a),id).state()).isEqualTo("QUEUED");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.audit_event WHERE resource_id=? AND operation='JOB_CANCELLED'",Integer.class,id)).isZero();
            assertThat(notices.list(principal(a),25,null).items()).isEmpty();
        }finally{jdbc.execute("DROP TRIGGER pb022_fail ON trading.backtest_notification");jdbc.execute("DROP FUNCTION trading.pb022_fail_notice()");}
        jobs.cancel(principal(a),id);assertThat(notices.list(principal(a),25,null).items()).hasSize(1);
    }
    @Test void ownerIdentityCsrfRevocationAndMassAssignmentAreEnforced()throws Exception {
        var notice=cancelled();String path=path(notice.id());
        var other=tree(call(b,"GET","/api/backtests/notifications",null,Map.of()),200);
        assertThat(other.get("items").size()).isZero();assertThat(other.get("unreadCount").asLong()).isZero();
        tree(call(b,"POST",path,Map.of(),Map.of()),404);
        tree(call(a,"POST",path("9223372036854775807"),Map.of(),Map.of()),404);
        tree(call(a,"POST",path,Map.of(),Map.of("X-Workspace-User",b.id().toString())),401);
        tree(call(a,"GET","/api/backtests/notifications",null,Map.of("X-Workspace-User",b.id().toString())),401);
        tree(call(new Actor(a.client(),null,null,a.email()),"GET","/api/backtests/notifications",null,Map.of()),401);
        tree(call(new Actor(HttpClient.newHttpClient(),null,null,""),"GET","/api/backtests/notifications",null,Map.of()),401);
        tree(call(a,"POST",path,Map.of(),Map.of("X-CSRF-TOKEN","wrong")),403);
        tree(call(a,"POST",path,Map.of("ownerId",b.id().toString()),Map.of()),400);
        assertThat(notices.list(principal(a),25,null).unreadCount()).isEqualTo(1);
        var user=principal(a);jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        assertThatThrownBy(()->notices.read(user,notice.id())).isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);
        tree(call(a,"GET","/api/backtests/notifications",null,Map.of()),401);
    }
    @Test void idempotentAndConcurrentReadPreservesFirstTimestampAndCount()throws Exception {
        var notice=cancelled();var principal=principal(a);
        try(var pool=Executors.newFixedThreadPool(4)) {
            var attempts=new ArrayList<Future<NotificationService.Notice>>();
            for(int i=0;i<8;i++)attempts.add(pool.submit(()->notices.read(principal,notice.id())));
            var first=attempts.getFirst().get(15,TimeUnit.SECONDS);assertThat(first.readAt()).isNotNull();
            for(var attempt:attempts)assertThat(attempt.get(15,TimeUnit.SECONDS)).isEqualTo(first);
            assertThat(tree(call(a,"POST",path(notice.id()),Map.of(),Map.of()),200).get("readAt").asString()).isEqualTo(first.readAt().toString());
        }
        assertThat(notices.list(principal,25,null).unreadCount()).isZero();
        assertThat(notices.list(principal,25,null).items()).hasSize(1);
    }
    @Test void concurrentFinishAndCancelPublishOnlyTheWinningTerminalState()throws Exception {
        var principal=principal(a);
        try(var pool=Executors.newFixedThreadPool(2)) {
            for(int i=0;i<3;i++) {
                UUID id=create();var work=jobs.claim();var result=worker.run(work,()->jobs.running(work));
                var start=new CountDownLatch(1);
                var finish=pool.submit(()->{start.await();jobs.finish(work,result,null);return true;});
                var cancel=pool.submit(()->{start.await();return jobs.cancel(principal,id);});
                start.countDown();finish.get(15,TimeUnit.SECONDS);cancel.get(15,TimeUnit.SECONDS);
                String state=jobs.get(principal,id).state();assertThat(state).isIn("SUCCEEDED","CANCELLED");
                assertThat(jdbc.queryForList("SELECT state FROM trading.backtest_notification WHERE job_id=?",String.class,id)).containsExactly(state);
                jobs.finish(work,result,null);jobs.cancel(principal,id);
                assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_notification WHERE job_id=?",Integer.class,id)).isEqualTo(1);
            }
        }
    }
    void seed(int count,boolean expired) {
        jdbc.update("INSERT INTO trading.backtest_notification(owner_id,job_id,state,created_at) SELECT ?,gen_random_uuid(),'SUCCEEDED',clock_timestamp()-"+(expired?"interval '31 days'":"interval '1 minute'")+" FROM generate_series(1,?)",a.id(),count);
    }
    @Test void boundedKeysetPagesCountsAndInputValidationAreSafe()throws Exception {
        seed(55,false);var page=tree(call(a,"GET","/api/backtests/notifications?limit=25",null,Map.of()),200);
        assertThat(page.get("items").size()).isEqualTo(25);assertThat(page.get("unreadCount").asLong()).isEqualTo(55);
        String cursor=page.get("nextCursor").asString();var next=tree(call(a,"GET","/api/backtests/notifications?limit=25&before="+cursor,null,Map.of()),200);
        assertThat(next.get("items").size()).isEqualTo(25);assertThat(Long.parseLong(next.get("items").get(0).get("id").asString())).isLessThan(Long.parseLong(cursor));
        var last=tree(call(a,"GET","/api/backtests/notifications?before="+next.get("nextCursor").asString(),null,Map.of()),200);
        assertThat(last.get("items").size()).isEqualTo(5);assertThat(last.get("nextCursor").isNull()).isTrue();
        for(String query:List.of("limit=0","limit=51","limit=2147483648","limit=synthetic-private","before=0","before=01","before=-1","before=9223372036854775808","before=1%27OR%271%27%3D%271")) {
            var failure=call(a,"GET","/api/backtests/notifications?"+query,null,Map.of());tree(failure,400);assertThat(failure.body()).doesNotContain("synthetic-private","Exception");
        }
        for(String bad:List.of("0","01","-1","9223372036854775808","1%27OR%271%27%3D%271"))tree(call(a,"POST",path(bad),Map.of(),Map.of()),400);
    }
    @Test void expiryRetentionAndPrivacyAreBounded()throws Exception {
        var fresh=cancelled();seed(5001,true);
        String expired=jdbc.queryForObject("SELECT id::text FROM trading.backtest_notification WHERE owner_id=? AND created_at<clock_timestamp()-interval '30 days' LIMIT 1",String.class,a.id());
        assertThat(notices.list(principal(a),25,null).unreadCount()).isEqualTo(1);
        tree(call(a,"POST",path(expired),Map.of(),Map.of()),404);
        assertThat(notices.purge()).isEqualTo(5000);assertThat(notices.purge()).isEqualTo(1);assertThat(notices.purge()).isZero();
        assertThat(notices.list(principal(a),25,null).items()).containsExactly(fresh);
        jdbc.update("DELETE FROM trading.app_user WHERE id=?",a.id());assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_notification WHERE owner_id=?",Integer.class,a.id())).isZero();
    }
    @Test void notificationReadAndMutationShareExistingOwnerRateBudgets()throws Exception {
        var notice=cancelled();jdbc.update("DELETE FROM trading.auth_rate_bucket");
        for(int i=0;i<300;i++)tree(call(a,"GET","/api/backtests/notifications",null,Map.of()),200);
        tree(call(a,"GET","/api/backtests/notifications",null,Map.of()),429);
        tree(call(b,"GET","/api/backtests/notifications",null,Map.of()),200);
        for(int i=0;i<30;i++)tree(call(a,"POST",path(notice.id()),Map.of(),Map.of()),200);
        tree(call(a,"POST",path(notice.id()),Map.of(),Map.of()),429);
        assertThat(notices.list(principal(a),25,null).unreadCount()).isZero();
    }
}
