package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.audit.*;
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
class AuditApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired AuditService audit;
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
        a=actor("audit-a@example.test");b=actor("audit-b@example.test");
    }
    Actor actor(String email)throws Exception {
        String password="Synthetic audit fixture phrase!";auth.register(email,"Audit researcher",password);
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
    Map<String,Object> event(HttpResponse<String> response)throws Exception {
        UUID id=UUID.fromString(response.headers().firstValue("X-Request-ID").orElseThrow());
        for(int i=0;i<100;i++) {
            var rows=jdbc.queryForList("SELECT * FROM trading.audit_event WHERE request_id=? AND category<>'JOB'",id);
            if(!rows.isEmpty()){assertThat(rows).hasSize(1);return rows.getFirst();}
            Thread.sleep(20);
        }
        throw new AssertionError("No event for server UUID "+id);
    }
    @Test void authAndResourceCorrelationRedactsAllUntrustedFields()throws Exception {
        String secret="<script>synthetic-secret</script>";
        String forged=UUID.randomUUID().toString();
        var response=call(a,"PATCH","/api/auth/profile",Map.of("displayName",secret),Map.of("X-Request-ID",forged,"User-Agent","synthetic-sensitive-agent"));
        tree(response,200);var row=event(response);
        assertThat(row.get("request_id").toString()).isNotEqualTo(forged);
        assertThat(row).containsEntry("owner_id",a.id()).containsEntry("operation","PROFILE").containsEntry("http_status",200);
        assertThat(row.toString()).doesNotContain(secret,a.email(),a.csrf(),"never-log-query","synthetic-sensitive-agent","password");
        assertThat(row.keySet()).containsExactlyInAnyOrder("id","occurred_at","owner_id","request_id","category","operation","method","http_status","resource_id","error_code");
        var query=call(a,"PATCH","/api/auth/profile?private=never-log-query",Map.of("displayName",secret),Map.of());
        tree(query,400);assertThat(event(query).toString()).doesNotContain("never-log-query",secret);
        var resource=call(a,"POST","/api/strategies",Map.of("requestId",UUID.randomUUID().toString(),"title",secret),Map.of());tree(resource,200);
        assertThat(event(resource)).containsEntry("category","RESOURCE").containsEntry("operation","STRATEGIES");
        assertThat(event(resource).toString()).doesNotContain(secret);
        var rejected=call(a,"POST","/api/strategies",Map.of("password",secret,"ownerId",b.id()),Map.of());tree(rejected,400);
        assertThat(event(rejected)).containsEntry("operation","STRATEGIES").containsEntry("category","SECURITY");
        var logout=call(a,"POST","/api/auth/logout",Map.of(),Map.of());assertThat(logout.statusCode()).isEqualTo(204);
        assertThat(event(logout)).containsEntry("owner_id",a.id()).containsEntry("operation","LOGOUT");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.audit_event WHERE owner_id=? AND operation='LOGIN'",Integer.class,a.id())).isEqualTo(1);
    }
    @Test void accessPaginationAndValidationNeverSelectAnotherOwner()throws Exception {
        for(int i=0;i<4;i++)event(call(a,"PATCH","/api/auth/profile",Map.of("displayName","Name "+i),Map.of()));
        var first=tree(call(a,"GET","/api/audit?limit=2",null,Map.of()),200);
        assertThat(first.get("items").size()).isEqualTo(2);String before=first.get("nextCursor").asString();
        var second=tree(call(a,"GET","/api/audit?limit=2&before="+before,null,Map.of()),200);
        assertThat(Long.parseLong(second.get("items").get(0).get("id").asString())).isLessThan(Long.parseLong(before));
        var other=tree(call(b,"GET","/api/audit",null,Map.of()),200);
        assertThat(other.get("items").size()).isEqualTo(1);assertThat(other.toString()).doesNotContain(a.id().toString(),a.email(),"ownerId");
        for(String query:List.of("limit=0","limit=51","limit=-1","limit=2147483648","limit=synthetic-secret-never-log","before=0","before=-1","before=01","before=9223372036854775808","before=1%27OR%271%27%3D%271"))
            tree(call(a,"GET","/api/audit?"+query,null,Map.of()),400);
        var mismatch=call(a,"GET","/api/audit",null,Map.of("X-Workspace-User",b.id().toString()));tree(mismatch,401);
        assertThat(event(mismatch)).containsEntry("owner_id",a.id()).containsEntry("operation","AUDIT");
        tree(call(new Actor(a.client(),null,null,a.email()),"GET","/api/audit",null,Map.of()),401);
        var anon=call(new Actor(HttpClient.newHttpClient(),null,null,""),"GET","/api/audit",null,Map.of());tree(anon,401);assertThat(event(anon).get("owner_id")).isNull();
        var csrf=call(a,"PATCH","/api/auth/profile",Map.of("displayName","No change"),Map.of("X-CSRF-TOKEN","invalid"));tree(csrf,403);assertThat(event(csrf).get("owner_id")).isNull();
        tree(call(a,"DELETE","/api/audit",Map.of(),Map.of()),403);
        var user=principal(a);jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        assertThatThrownBy(()->audit.list(user,25,null)).isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);
        tree(call(a,"GET","/api/audit",null,Map.of()),401);
    }
    @Test void auditReadBudgetIsPerOwnerAndFailuresAreSafe()throws Exception {
        jdbc.update("DELETE FROM trading.auth_rate_bucket");
        for(int i=0;i<120;i++)tree(call(a,"GET","/api/audit",null,Map.of()),200);
        var denied=call(a,"GET","/api/audit",null,Map.of());tree(denied,429);assertThat(event(denied)).containsEntry("http_status",429);
        tree(call(b,"GET","/api/audit",null,Map.of()),200);
    }
    @Test void registrationAndPasswordChangeRecordNoCredentialsAndKeepRevocation()throws Exception {
        String password="Synthetic new audit password!";
        var anon=new Actor(HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build(),null,null,"");
        String csrf=tree(call(anon,"GET","/api/auth/csrf",null,Map.of()),200).get("token").asString();
        var registration=call(new Actor(anon.client(),csrf,null,""),"POST","/api/auth/register",Map.of("email","new-audit@example.test","displayName","Private name","password",password),Map.of());
        tree(registration,202);var created=event(registration);
        assertThat(created).containsEntry("operation","REGISTER").containsEntry("owner_id",null);
        assertThat(created.toString()).doesNotContain(password,"new-audit@example.test","Private name",csrf);
        var changed=call(a,"POST","/api/auth/password",Map.of("currentPassword","Synthetic audit fixture phrase!","newPassword",password),Map.of());
        assertThat(changed.statusCode()).isEqualTo(204);var row=event(changed);
        assertThat(row).containsEntry("operation","PASSWORD").containsEntry("owner_id",a.id());
        assertThat(row.toString()).doesNotContain(password,a.csrf(),"Synthetic audit fixture phrase!");
        tree(call(a,"GET","/api/audit",null,Map.of()),401);
    }
    @Test void immutableRetentionBatchAndAccountDeletionAreEnforcedByDatabase()throws Exception {
        var row=event(call(a,"PATCH","/api/auth/profile",Map.of("displayName","Retained"),Map.of()));
        Long id=(Long)row.get("id");
        assertThatThrownBy(()->jdbc.update("UPDATE trading.audit_event SET operation='OTHER' WHERE id=?",id)).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(()->jdbc.update("DELETE FROM trading.audit_event WHERE id=?",id)).isInstanceOf(DataAccessException.class);
        jdbc.update("INSERT INTO trading.audit_event(owner_id,request_id,category,operation,method,http_status,occurred_at) SELECT ?,gen_random_uuid(),'RESOURCE','OTHER','POST',200,clock_timestamp()-interval '31 days' FROM generate_series(1,5001)",a.id());
        assertThat(audit.list(principal(a),50,null).items()).hasSize(2);
        assertThat(audit.purge()).isEqualTo(5000);assertThat(audit.purge()).isEqualTo(1);assertThat(audit.purge()).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.audit_event WHERE id=?",Integer.class,id)).isEqualTo(1);
        jdbc.update("DELETE FROM trading.app_user WHERE id=?",a.id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.audit_event WHERE owner_id=?",Integer.class,a.id())).isZero();
        assertThat(audit.list(principal(b),25,null).items()).hasSize(1);
    }
    @Test void concurrentWritesHaveUniqueIdsAndPurgePreservesFreshRows()throws Exception {
        try(var pool=Executors.newFixedThreadPool(4)) {
            var calls=new ArrayList<Future<Map<String,Object>>>();
            for(int i=0;i<8;i++)calls.add(pool.submit(()->event(call(a,"PATCH","/api/auth/profile",Map.of("displayName","Concurrent"),Map.of()))));
            var ids=new HashSet<Object>();for(var result:calls)ids.add(result.get(20,TimeUnit.SECONDS).get("request_id"));assertThat(ids).hasSize(8);
            jdbc.update("INSERT INTO trading.audit_event(owner_id,request_id,category,operation,method,http_status,occurred_at) SELECT ?,gen_random_uuid(),'RESOURCE','OTHER','POST',200,clock_timestamp()-interval '31 days' FROM generate_series(1,100)",a.id());
            var one=pool.submit(()->audit.purge());var two=pool.submit(()->audit.purge());assertThat(one.get()+two.get()).isEqualTo(100);
        }
        assertThat(audit.list(principal(a),25,null).items()).hasSize(9);
    }
    void failAudit(String condition) {
        jdbc.execute("CREATE FUNCTION trading.pb024_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF "+condition+" THEN RAISE EXCEPTION 'synthetic-secret-never-log'; END IF; RETURN NEW; END $$");
        jdbc.execute("CREATE TRIGGER pb024_fail BEFORE INSERT ON trading.audit_event FOR EACH ROW EXECUTE FUNCTION trading.pb024_fail_audit()");
    }
    void restoreAudit(){jdbc.execute("DROP TRIGGER pb024_fail ON trading.audit_event");jdbc.execute("DROP FUNCTION trading.pb024_fail_audit()");}
    @Test void auditFailureDoesNotUndoCommittedHttpOutcomeOrLeakException()throws Exception {
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(AuditService.class);
        var capture=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();capture.start();logger.addAppender(capture);
        failAudit("NEW.operation='PROFILE'");
        try {
            var response=call(a,"PATCH","/api/auth/profile",Map.of("displayName","Mutation committed"),Map.of());tree(response,200);
            assertThat(jdbc.queryForObject("SELECT display_name FROM trading.app_user WHERE id=?",String.class,a.id())).isEqualTo("Mutation committed");
            for(int i=0;i<100&&capture.list.isEmpty();i++)Thread.sleep(20);
            assertThat(capture.list).hasSize(1);
            var log=capture.list.getFirst();assertThat(log.getFormattedMessage()).isEqualTo("audit_write_unavailable requestId="+response.headers().firstValue("X-Request-ID").orElseThrow());
            assertThat(log.getThrowableProxy()).isNull();assertThat(log.getFormattedMessage()).doesNotContain("synthetic-secret",a.email(),a.csrf());
        } finally{restoreAudit();logger.detachAppender(capture);capture.stop();}
        event(call(a,"PATCH","/api/auth/profile",Map.of("displayName","Recovered"),Map.of()));
    }
    @Test void unavailableAuditReadMakesPublicHealthSafe503AndRecovers()throws Exception {
        jdbc.execute("ALTER TABLE trading.audit_event RENAME TO pb024_audit_unavailable");
        try {
            var response=call(a,"GET","/api/health",null,Map.of());var body=tree(response,503);
            assertThat(body.get("code").asString()).isEqualTo("UNAVAILABLE");
            assertThat(body.get("requestId").asString()).isEqualTo(response.headers().firstValue("X-Request-ID").orElseThrow());
            assertThat(response.body()).doesNotContain("audit_event","postgres","Exception","SQL");
        }finally{jdbc.execute("ALTER TABLE trading.pb024_audit_unavailable RENAME TO audit_event");}
        tree(call(a,"GET","/api/health",null,Map.of()),200);
    }
    @Test void malformedNumericQueryIsNotEchoedInApplicationLogs()throws Exception {
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        var capture=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();capture.start();logger.addAppender(capture);
        try {
            var response=call(a,"GET","/api/audit?limit=synthetic-query-secret",null,Map.of());tree(response,400);
            assertThat(response.body()).doesNotContain("synthetic-query-secret","NumberFormat","Exception");
            event(response);
            assertThat(capture.list.stream().map(ch.qos.logback.classic.spi.ILoggingEvent::getFormattedMessage).toList())
                .noneMatch(message->message.contains("synthetic-query-secret"));
        }finally{logger.detachAppender(capture);capture.stop();}
    }
    Map<String,Object> jobInput()throws Exception {
        var sample=json.readTree(Files.readAllBytes(Path.of("../python/examples/long-next-open.json")));
        var created=strategies.create(principal(a),new StrategyService.Create(UUID.randomUUID().toString(),"Audit synthetic"));
        strategies.save(principal(a),created.strategyId(),new StrategyService.Save(UUID.randomUUID().toString(),1,created.title(),json.writeValueAsString(sample.get("dsl")),"VALIDATED"));
        StringBuilder csv=new StringBuilder("timestamp,open,high,low,close,volume\n");
        for(var candle:sample.get("dataset").get("candles")){var cells=new ArrayList<String>();for(String field:List.of("timestamp","open","high","low","close","volume"))cells.add(candle.get(field).asString());csv.append(String.join(",",cells)).append('\n');}
        var data=market.create(principal(a),new MarketService.Import(UUID.randomUUID().toString(),"Audit synthetic data","TEST_USD","1h","SYNTHETIC","Local fixture",csv.toString()));
        return Map.of("requestId",UUID.randomUUID().toString(),"strategyId",created.strategyId().toString(),"revision",2,"datasetId",data.id().toString());
    }
    List<String> transitions(UUID job){return jdbc.queryForList("SELECT operation FROM trading.audit_event WHERE resource_id=? ORDER BY id",String.class,job);}
    @Test void realJobTransitionsAreAtomicCorrelatedAndReplayDoesNotDuplicate()throws Exception {
        var input=jobInput();var response=call(a,"POST","/api/backtests",input,Map.of());UUID id=UUID.fromString(tree(response,200).get("id").asString());
        UUID trace=UUID.fromString(response.headers().firstValue("X-Request-ID").orElseThrow());
        tree(call(a,"POST","/api/backtests",input,Map.of()),200);assertThat(transitions(id)).containsExactly("JOB_QUEUED");
        failAudit("NEW.category='JOB' AND NEW.operation='JOB_RUNNING'");
        try{assertThatThrownBy(()->jobs.claim()).isInstanceOf(DataAccessException.class);assertThat(jobs.get(principal(a),id).state()).isEqualTo("QUEUED");}
        finally{restoreAudit();}
        var work=jobs.claim();var result=worker.run(work,()->jobs.running(work));jobs.finish(work,result,null);jobs.finish(work,result,null);
        assertThat(transitions(id)).containsExactly("JOB_QUEUED","JOB_RUNNING","JOB_SUCCEEDED");
        jobs.delete(principal(a),id);assertThat(transitions(id)).containsExactly("JOB_QUEUED","JOB_RUNNING","JOB_SUCCEEDED","JOB_DELETED");
        assertThat(jdbc.queryForList("SELECT DISTINCT request_id FROM trading.audit_event WHERE resource_id=?",UUID.class,id)).containsExactly(trace);
        assertThat(jdbc.queryForList("SELECT DISTINCT owner_id FROM trading.audit_event WHERE resource_id=?",UUID.class,id)).containsExactly(a.id());
    }
    @Test void cancellationExpiryFailureAndRetryHaveDistinctTraceableEvents()throws Exception {
        var input=jobInput();UUID id=UUID.fromString(tree(call(a,"POST","/api/backtests",input,Map.of()),200).get("id").asString());
        jobs.cancel(principal(a),id);jobs.cancel(principal(a),id);assertThat(transitions(id)).containsExactly("JOB_QUEUED","JOB_CANCELLED");
        var retry=call(a,"POST","/api/backtests/"+id+"/retry",Map.of("requestId",UUID.randomUUID().toString()),Map.of());UUID retried=UUID.fromString(tree(retry,200).get("id").asString());
        assertThat(jdbc.queryForObject("SELECT audit_request_id FROM trading.backtest_job WHERE id=?",UUID.class,retried)).isEqualTo(UUID.fromString(retry.headers().firstValue("X-Request-ID").orElseThrow()));
        jdbc.update("UPDATE trading.backtest_job SET lease_until=clock_timestamp()-interval '1 minute' WHERE id=?",retried);jobs.expire();jobs.expire();
        assertThat(transitions(retried)).containsExactly("JOB_QUEUED","JOB_FAILED");
        assertThat(jdbc.queryForObject("SELECT error_code FROM trading.audit_event WHERE resource_id=? AND operation='JOB_FAILED'",String.class,retried)).isEqualTo("QUEUE_EXPIRED");
        var last=jobs.retry(principal(a),retried,UUID.randomUUID(),true);var work=jobs.claim();jobs.finish(work,null,BacktestFailure.Code.WORKER_FAILED);
        assertThat(transitions(last.id())).containsExactly("JOB_QUEUED","JOB_RUNNING","JOB_FAILED");
        jdbc.update("DELETE FROM trading.app_user WHERE id=?",a.id());assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.audit_event WHERE owner_id=?",Integer.class,a.id())).isZero();
    }
}
