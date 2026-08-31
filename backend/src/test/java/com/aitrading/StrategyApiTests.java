package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import com.aitrading.strategy.*;
import com.aitrading.dsl.*;
import java.io.ByteArrayInputStream;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties="spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class StrategyApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired StrategyService strategies;
    @Autowired DslValidator validator;
    final JsonMapper json=JsonMapper.builder().build();
    record Actor(HttpClient client,String csrf,UUID id) { }
    Actor a,b;
    static final String BASE="/api/strategies";
    @BeforeAll static void ownedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize()
                .startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");jdbc.update("DELETE FROM trading.app_user");
        a=actor("strategy-a@example.test");b=actor("strategy-b@example.test");
    }
    Actor actor(String email) throws Exception {
        String password="Synthetic market fixture phrase!";auth.register(email,"Researcher",password);
        var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).connectTimeout(Duration.ofSeconds(3)).build();
        var anon=new Actor(client,null,null);
        String token=tree(send(anon,"GET","/api/auth/csrf",new byte[0],null,Map.of(),false),200).get("token").asString();
        byte[] body=("email="+URLEncoder.encode(email,StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
        assertThat(send(anon,"POST","/api/auth/login",body,token,Map.of("Content-Type","application/x-www-form-urlencoded"),false).statusCode()).isEqualTo(204);
        String fresh=tree(send(anon,"GET","/api/auth/csrf",new byte[0],null,Map.of(),false),200).get("token").asString();
        UUID id=UUID.fromString(tree(send(anon,"GET","/api/auth/me",new byte[0],null,Map.of(),false),200).get("id").asString());return new Actor(client,fresh,id);
    }
    HttpResponse<String> send(Actor actor,String method,String path,byte[] body,String csrf,Map<String,String> headers,boolean chunked) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(15));
        builder.header("Content-Type",headers.getOrDefault("Content-Type","application/json"));
        headers.forEach((key,value)->{if(!key.equals("Content-Type"))builder.header(key,value);});if(csrf!=null)builder.header("X-CSRF-TOKEN",csrf);
        var publisher=chunked?HttpRequest.BodyPublishers.ofInputStream(()->new ByteArrayInputStream(body)):HttpRequest.BodyPublishers.ofByteArray(body);
        return actor.client().send(builder.method(method,publisher).build(),HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> call(Actor actor,String method,String path,Object body) throws Exception {
        return send(actor,method,path,body==null?new byte[0]:json.writeValueAsBytes(body),actor.csrf(),Map.of(),false);
    }
    JsonNode tree(HttpResponse<String> response,int status) {assertThat(response.statusCode()).as(response.body()).isEqualTo(status);return json.readTree(response.body());}
    String fixture() throws Exception {return java.nio.file.Files.readString(Path.of("src/test/resources/dsl/price-action.json"));}
    Map<String,Object> body(int revision,String text,String mode) {return new HashMap<>(Map.of("requestId",UUID.randomUUID().toString(),"expectedRevision",revision,"title","Private strategy","draftText",text,"mode",mode));}
    JsonNode create(Actor actor) throws Exception {return tree(call(actor,"POST",BASE,Map.of("requestId",UUID.randomUUID().toString(),"title","Private strategy")),200);}
    String path(JsonNode revision) {return BASE+"/"+revision.get("strategyId").asString();}
    long count(String table) {return jdbc.queryForObject("SELECT count(*) FROM trading."+table,Long.class);}

    @Test void ownedDraftAndValidatedRevisionsKeepExactImmutableTextAndCanonicalMetadata() throws Exception {
        var first=create(a);assertThat(first.get("revision").asInt()).isEqualTo(1);assertThat(first.get("draftText").asString()).isEmpty();
        var draft=tree(call(a,"POST",path(first)+"/versions",body(1,"\t incomplete {\n","DRAFT")),200);
        assertThat(draft.get("draftText").asString()).isEqualTo("\t incomplete {\n");assertThat(draft.get("canonicalJson").isNull()).isTrue();
        var valid=tree(call(a,"POST",path(first)+"/versions",body(2,fixture(),"VALIDATED")),200);
        var expected=validator.validate(fixture().getBytes(StandardCharsets.UTF_8)).document();
        assertThat(valid.get("canonicalJson").asString()).isEqualTo(expected.canonicalJson());assertThat(valid.get("hash").asString()).isEqualTo(expected.hash());
        assertThat(valid.get("schemaVersion").asString()).isEqualTo("1.0.0");assertThat(valid.get("validatorVersion").asString()).isEqualTo("1.0.0");
        assertThat(valid.get("minimumBars").asInt()).isEqualTo(expected.minimumBars());assertThat(valid.get("symbol").asString()).isEqualTo("BTC_USDT");
        assertThat(tree(call(a,"GET",path(first),null),200)).isEqualTo(valid);
        assertThat(tree(call(a,"GET",path(first)+"/versions/1",null),200)).isEqualTo(first);
        assertThat(tree(call(a,"GET",path(first)+"/versions/2",null),200)).isEqualTo(draft);
        var list=tree(call(a,"GET",BASE,null),200).get("items").get(0);assertThat(list.has("draftText")).isFalse();assertThat(list.get("revision").asInt()).isEqualTo(3);
        var history=tree(call(a,"GET",path(first)+"/versions?limit=2",null),200);
        assertThat(history.get("items").size()).isEqualTo(2);assertThat(history.get("nextBefore").asInt()).isEqualTo(2);
        assertThat(tree(call(a,"GET",path(first)+"/versions?before=2",null),200).get("items").get(0).get("revision").asInt()).isEqualTo(1);
    }
    @Test void draftBoundsUnicodeAndValidationFailuresNeverPromoteOrTruncateText() throws Exception {
        var first=create(a);int revision=1;
        for(String raw:List.of("","x".repeat(65536),"é".repeat(32768),"\n\r\t\uD83D\uDE00")) {
            var saved=tree(call(a,"POST",path(first)+"/versions",body(revision++,raw,"DRAFT")),200);assertThat(saved.get("draftText").asString()).isEqualTo(raw);
        }
        for(String raw:List.of("x".repeat(65537),"é".repeat(32769),"\0","\u0001","\uD800"))tree(call(a,"POST",path(first)+"/versions",body(revision,raw,"DRAFT")),400);
        for(String raw:List.of("","{","{}",fixture().replace("bar_close","future_bar"),fixture().replace("\"schemaVersion\":", "\"schemaVersion\":\"1.0.0\",\"schemaVersion\":"))) {
            var failure=call(a,"POST",path(first)+"/versions",body(revision,raw,"VALIDATED"));var result=tree(failure,422);
            assertThat(result.get("valid").asBoolean()).isFalse();assertThat(result.get("document").isNull()).isTrue();assertThat(result.get("errors").size()).isBetween(1,20);
            assertThat(failure.body()).doesNotContain("future_bar","Exception","jdbc");
        }
        assertThat(count("strategy_revision")).isEqualTo(revision);
        var request=body(revision,fixture(),"VALIDATED");request.put("title","A".repeat(120));tree(call(a,"POST",path(first)+"/versions",request),200);
        for(String title:List.of(""," ","A".repeat(121),"title\nnewline"))tree(call(a,"POST",BASE,Map.of("requestId",UUID.randomUUID().toString(),"title",title)),400);
    }
    @Test void createAndAppendReplayKeepOriginalIntentEvenAfterNewerRevisions() throws Exception {
        var input=Map.of("requestId",UUID.randomUUID().toString(),"title"," Original ");var first=tree(call(a,"POST",BASE,input),200);
        assertThat(first.get("title").asString()).isEqualTo("Original");
        var save=body(1,fixture(),"VALIDATED");var second=tree(call(a,"POST",path(first)+"/versions",save),200);
        tree(call(a,"POST",path(first)+"/versions",body(2,"new draft","DRAFT")),200);
        assertThat(tree(call(a,"POST",BASE,input),200)).isEqualTo(first);
        assertThat(tree(call(a,"POST",path(first)+"/versions",save),200)).isEqualTo(second);
        assertThat(tree(call(a,"GET",path(first),null),200).get("revision").asInt()).isEqualTo(3);
        save.put("draftText","different");tree(call(a,"POST",path(first)+"/versions",save),409);
        tree(call(a,"POST",BASE,Map.of("requestId",input.get("requestId"),"title","changed")),409);
        tree(call(b,"POST",BASE,input),200);assertThat(count("strategy")).isEqualTo(2);
    }
    @Test void concurrentSameIntentAndStaleWritersCannotDuplicateOrOverwrite() throws Exception {
        var first=create(a);var same=body(1,fixture(),"VALIDATED");
        try(var pool=Executors.newFixedThreadPool(3)) {
            List<Callable<JsonNode>> tasks=List.of(()->tree(call(a,"POST",path(first)+"/versions",same),200),()->tree(call(a,"POST",path(first)+"/versions",same),200));
            var results=pool.invokeAll(tasks);assertThat(results.get(0).get()).isEqualTo(results.get(1).get());
            List<Callable<Integer>> stale=List.of(()->call(a,"POST",path(first)+"/versions",body(2,"one","DRAFT")).statusCode(),()->call(a,"POST",path(first)+"/versions",body(2,"two","DRAFT")).statusCode());
            var statuses=new ArrayList<Integer>();for(var r:pool.invokeAll(stale))statuses.add(r.get());assertThat(statuses).containsExactlyInAnyOrder(200,409);
        }
        assertThat(count("strategy_revision")).isEqualTo(3);
    }
    @Test void allOwnedPathsRejectForeignUsersAndUnknownIdsWithoutLeakingContent() throws Exception {
        var first=create(a);tree(call(a,"POST",path(first)+"/versions",body(1,"private secret-like fixture","DRAFT")),200);
        for(String target:List.of(path(first),BASE+"/"+UUID.randomUUID())) {
            for(String suffix:List.of("","/versions","/versions/1")) {
                var response=call(b,"GET",target+suffix,null);tree(response,404);assertThat(response.body()).doesNotContain("Private strategy","private secret-like fixture",a.id().toString());
            }
            tree(call(b,"POST",target+"/versions",body(2,"B text","DRAFT")),404);tree(call(b,"DELETE",target,Map.of("expectedRevision",2)),404);
        }
        assertThat(tree(call(b,"GET",BASE,null),200).get("items").isEmpty()).isTrue();
        var stale=(UserPrincipal)users.loadUserByUsername("strategy-a@example.test");jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        assertThatThrownBy(()->strategies.save(stale,UUID.fromString(first.get("strategyId").asString()),new StrategyService.Save(UUID.randomUUID().toString(),2,"x","x","DRAFT"))).isInstanceOf(BadCredentialsException.class);
        tree(call(a,"GET",path(first),null),401);
    }
    @Test void failureRollsBackRevisionAndPointerAndDeletionCannotRemoveOtherOwners() throws Exception {
        var first=create(a);var other=create(b);
        jdbc.execute("CREATE FUNCTION trading.reject_strategy_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rejection'; END $$");
        jdbc.execute("CREATE TRIGGER reject_strategy_fixture BEFORE UPDATE ON trading.strategy FOR EACH ROW EXECUTE FUNCTION trading.reject_strategy_fixture()");
        try {var response=call(a,"POST",path(first)+"/versions",body(1,fixture(),"VALIDATED"));tree(response,503);assertThat(response.body()).doesNotContain("fixture rejection","INSERT","Exception");}
        finally {jdbc.execute("DROP TRIGGER reject_strategy_fixture ON trading.strategy");jdbc.execute("DROP FUNCTION trading.reject_strategy_fixture()");}
        assertThat(count("strategy_revision")).isEqualTo(2);assertThat(tree(call(a,"GET",path(first),null),200)).isEqualTo(first);
        tree(call(a,"DELETE",path(first),Map.of("expectedRevision",2)),409);
        assertThat(call(a,"DELETE",path(first),Map.of("expectedRevision",1)).statusCode()).isEqualTo(204);
        tree(call(a,"GET",path(first)+"/versions",null),404);assertThat(tree(call(b,"GET",path(other),null),200)).isEqualTo(other);
        assertThat(count("strategy_revision")).isEqualTo(1);
    }
    @Test void bodyCsrfOriginStrictFieldsAndInertTextAreEnforced() throws Exception {
        var first=create(a);byte[] body=json.writeValueAsBytes(body(1,"draft","DRAFT"));
        tree(send(a,"POST",path(first)+"/versions",body,null,Map.of(),false),403);
        tree(send(a,"POST",path(first)+"/versions",body,b.csrf(),Map.of(),false),403);
        tree(send(a,"POST",path(first)+"/versions",body,a.csrf(),Map.of("Origin","https://hostile.invalid"),false),403);
        tree(call(new Actor(HttpClient.newHttpClient(),null,null),"GET",BASE,null),401);
        for(String field:List.of("ownerId","hash","status","canonicalJson")) {var input=body(1,"draft","DRAFT");input.put(field,"forged");tree(call(a,"POST",path(first)+"/versions",input),400);}
        var wrong=body(1,"draft","DRAFT");wrong.put("expectedRevision","1");tree(call(a,"POST",path(first)+"/versions",wrong),400);
        String duplicate=new String(body,StandardCharsets.UTF_8).replace("\"mode\":","\"mode\":\"DRAFT\",\"mode\":");tree(send(a,"POST",path(first)+"/versions",duplicate.getBytes(StandardCharsets.UTF_8),a.csrf(),Map.of(),false),400);
        byte[] exact=Arrays.copyOf(body,StrategyService.MAX_BODY);Arrays.fill(exact,body.length,exact.length,(byte)' ');tree(send(a,"POST",path(first)+"/versions",exact,a.csrf(),Map.of(),true),200);
        byte[] larger=Arrays.copyOf(exact,exact.length+1);larger[larger.length-1]=' ';tree(send(a,"POST",path(first)+"/versions",larger,a.csrf(),Map.of(),true),413);
        tree(send(a,"POST",BASE,larger,a.csrf(),Map.of(),false),413);tree(send(a,"DELETE",path(first),exact,a.csrf(),Map.of(),false),413);
        tree(send(a,"POST","/api/conversations",exact,a.csrf(),Map.of(),false),413);tree(send(a,"POST","/api/dsl/validate",exact,a.csrf(),Map.of(),false),413);
        String hostile="<script>fixture()</script> '; DROP TABLE strategy; -- https://internal.invalid ../../file";
        var saved=tree(call(a,"POST",path(first)+"/versions",body(2,hostile,"DRAFT")),200);assertThat(saved.get("draftText").asString()).isEqualTo(hostile);assertThat(count("app_user")).isEqualTo(2);
    }
    @Test void paginationIsStableAndRejectsInvalidCursorsAndVersionBounds() throws Exception {
        var one=create(a);create(a);create(a);jdbc.update("UPDATE trading.strategy SET created_at='2024-01-01T00:00:00Z'");
        var page=tree(call(a,"GET",BASE+"?limit=1",null),200);var seen=new HashSet<String>();seen.add(page.get("items").get(0).get("id").asString());var added=create(a);
        while(!page.get("nextCursor").isNull()) {page=tree(call(a,"GET",BASE+"?limit=1&cursor="+page.get("nextCursor").asString(),null),200);for(var item:page.get("items"))assertThat(seen.add(item.get("id").asString())).isTrue();}
        assertThat(seen).hasSize(3).doesNotContain(added.get("strategyId").asString());
        for(String query:List.of("?limit=0","?limit=51","?cursor=bad","?cursor="+"x".repeat(129)))tree(call(a,"GET",BASE+query,null),400);
        for(String query:List.of("?limit=0","?before=0","?before=102","?before=-1","?before=1.5"))tree(call(a,"GET",path(one)+"/versions"+query,null),400);
        for(String version:List.of("0","101","1.5","-1"))tree(call(a,"GET",path(one)+"/versions/"+version,null),400);
        tree(call(a,"GET",path(one)+"/versions/2",null),404);
    }
    @Test void strategyAndRevisionQuotasAreAtomicAndReplayWorksAtLimit() throws Exception {
        var first=create(a);UUID strategy=UUID.fromString(first.get("strategyId").asString());
        jdbc.update("""
                INSERT INTO trading.strategy(id,owner_id,request_id,request_hash,current_revision)
                SELECT gen_random_uuid(),owner_id,gen_random_uuid(),request_hash,1 FROM trading.strategy CROSS JOIN generate_series(1,98) WHERE id=?
                """,strategy);
        jdbc.update("""
                INSERT INTO trading.strategy_revision(strategy_id,revision,request_id,request_hash,title,draft_text,status)
                SELECT s.id,1,gen_random_uuid(),r.request_hash,r.title,r.draft_text,r.status FROM trading.strategy s CROSS JOIN trading.strategy_revision r WHERE r.strategy_id=? AND s.id<>r.strategy_id
                """,strategy);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Callable<Integer>> tasks=List.of(()->call(a,"POST",BASE,Map.of("requestId",UUID.randomUUID().toString(),"title","new")).statusCode(),()->call(a,"POST",BASE,Map.of("requestId",UUID.randomUUID().toString(),"title","new")).statusCode());
            var statuses=new ArrayList<Integer>();for(var r:pool.invokeAll(tasks))statuses.add(r.get());assertThat(statuses).containsExactlyInAnyOrder(200,409);
        }
        assertThat(count("strategy")).isEqualTo(100);
        jdbc.update("""
                INSERT INTO trading.strategy_revision(strategy_id,revision,request_id,request_hash,title,draft_text,status)
                SELECT strategy_id,n,gen_random_uuid(),request_hash,title,draft_text,status FROM trading.strategy_revision CROSS JOIN generate_series(2,99) n WHERE strategy_id=? AND revision=1
                """,strategy);jdbc.update("UPDATE trading.strategy SET current_revision=99 WHERE id=?",strategy);
        var payload=body(99,"last","DRAFT");var competitor=body(99,"other last","DRAFT");Map<String,Object> winner;
        try(var pool=Executors.newFixedThreadPool(2)) {
            var one=pool.submit(()->call(a,"POST",path(first)+"/versions",payload).statusCode());
            var two=pool.submit(()->call(a,"POST",path(first)+"/versions",competitor).statusCode());
            int firstStatus=one.get(),secondStatus=two.get();assertThat(List.of(firstStatus,secondStatus)).containsExactlyInAnyOrder(200,409);
            winner=firstStatus==200?payload:competitor;
        }
        tree(call(a,"POST",path(first)+"/versions",body(100,"over","DRAFT")),409);tree(call(a,"POST",path(first)+"/versions",winner),200);
        assertThat(tree(call(a,"GET",path(first),null),200).get("revision").asInt()).isEqualTo(100);
    }
    @Test void concurrentReadSaveDeleteAndPerUserRateLimitsRemainSafe() throws Exception {
        var first=create(a);
        try(var pool=Executors.newFixedThreadPool(3)) {
            var start=new CountDownLatch(1);
            var read=pool.submit(()->{start.await();return call(a,"GET",path(first),null);});
            var save=pool.submit(()->{start.await();return call(a,"POST",path(first)+"/versions",body(1,"new draft","DRAFT"));});
            var delete=pool.submit(()->{start.await();return call(a,"DELETE",path(first),Map.of("expectedRevision",1));});start.countDown();
            int s=save.get().statusCode(),d=delete.get().statusCode();assertThat((s==200&&d==409)||(s==404&&d==204)).isTrue();
            var snapshot=read.get();assertThat(snapshot.statusCode()).isIn(200,404);if(snapshot.statusCode()==200)assertThat(tree(snapshot,200).get("revision").asInt()).isIn(1,2);
        }
        String bucket=AuthRateLimiter.bucketKey("str-write",a.id().toString());jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=59 WHERE bucket_key=?",bucket);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> create=()->call(a,"POST",BASE,Map.of("requestId",UUID.randomUUID().toString(),"title","rate")).statusCode();
            var statuses=new ArrayList<Integer>();for(var r:pool.invokeAll(List.of(create,create)))statuses.add(r.get());assertThat(statuses).containsExactlyInAnyOrder(200,429);
        }
        create(b);tree(call(a,"GET",BASE,null),200);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=300 WHERE bucket_key=?",AuthRateLimiter.bucketKey("str-read",a.id().toString()));tree(call(a,"GET",BASE,null),429);tree(call(b,"GET",BASE,null),200);
        jdbc.update("UPDATE trading.auth_rate_bucket SET window_start=window_start-1 WHERE bucket_key=?",bucket);create(a);
    }
}
