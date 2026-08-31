package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import com.aitrading.chat.ConversationService;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class ConversationTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired ConversationService conversations;
    final JsonMapper json = JsonMapper.builder().build();
    record Actor(HttpClient client, String csrf, UUID id) { }
    Actor a, b;
    String base = "/api/conversations";

    @BeforeAll static void requireOwnedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize()
                .startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");
        jdbc.update("DELETE FROM trading.auth_rate_bucket");
        jdbc.update("DELETE FROM trading.app_user"); // new feature FK cascades only these owned test fixtures
        a = actor("chat-a@example.test"); b = actor("chat-b@example.test");
    }
    Actor actor(String email) throws Exception {
        String password = "Synthetic chat fixture password!";
        auth.register(email, "Researcher", password);
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .connectTimeout(Duration.ofSeconds(3)).build();
        var anon = new Actor(client, null, null);
        String token = tree(send(anon,"GET","/api/auth/csrf","",null,"application/json",Map.of()),200).get("token").asString();
        assertThat(send(anon,"POST","/api/auth/login","email="+URLEncoder.encode(email,StandardCharsets.UTF_8)
                +"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8),token,"application/x-www-form-urlencoded",Map.of()).statusCode()).isEqualTo(204);
        String fresh = tree(send(anon,"GET","/api/auth/csrf","",null,"application/json",Map.of()),200).get("token").asString();
        UUID id = UUID.fromString(tree(send(anon,"GET","/api/auth/me","",null,"application/json",Map.of()),200).get("id").asString());
        return new Actor(client,fresh,id);
    }
    HttpResponse<String> send(Actor actor,String method,String path,String body,String token,String type,Map<String,String> headers) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(8)).header("Content-Type",type);
        if (token != null) request.header("X-CSRF-TOKEN",token);
        headers.forEach(request::header);
        return actor.client().send(request.method(method,HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> call(Actor actor,String method,String path,Object body) throws Exception {
        return send(actor,method,path,body==null?"":json.writeValueAsString(body),actor.csrf(),"application/json",Map.of());
    }
    JsonNode tree(HttpResponse<String> response,int expected) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(expected);
        return json.readTree(response.body());
    }
    JsonNode create(Actor actor) throws Exception { return tree(call(actor,"POST",base,Map.of("requestId",UUID.randomUUID().toString())),200); }
    String path(JsonNode conversation) { return base+"/"+conversation.get("id").asString(); }
    JsonNode append(Actor actor,String path,String content) throws Exception {
        return tree(call(actor,"POST",path+"/messages",Map.of("requestId",UUID.randomUUID().toString(),"content",content)),200);
    }

    @Test void ownedCrudPersistsExactTextMetadataAndCascadeWithoutOtherUserDataLoss() throws Exception {
        var first=create(a); var second=create(a); var other=create(b);
        assertThat(first.get("version").asLong()).isEqualTo(1);
        assertThat(first.get("lastMessage").asString()).isEmpty();
        java.time.Instant.parse(first.get("createdAt").asString());
        String content="Nghiên cứu giá\n\t<script>alert('test')</script> '); DROP TABLE trading.app_user;--";
        assertThat(append(a,path(first),content).get("content").asString()).isEqualTo(content);
        var renamed=tree(call(a,"PATCH",path(first),Map.of("title","  Wyckoff & RSI  ","expectedVersion",2)),200);
        assertThat(renamed.get("title").asString()).isEqualTo("Wyckoff & RSI");
        assertThat(renamed.get("version").asLong()).isEqualTo(3);
        assertThat(renamed.get("createdAt")).isEqualTo(first.get("createdAt"));
        assertThat(tree(call(a,"GET",path(first)+"/messages",null),200).get("items").get(0).get("role").asString()).isEqualTo("user");
        assertThat(tree(call(a,"GET",path(second)+"/messages",null),200).get("items").size()).isZero();
        assertThat(tree(call(a,"GET",base,null),200).get("items").size()).isEqualTo(2);
        assertThat(call(a,"DELETE",path(first),Map.of("expectedVersion",3)).statusCode()).isEqualTo(204);
        tree(call(a,"GET",path(first),null),404);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.conversation_message WHERE conversation_id=?",Long.class,UUID.fromString(first.get("id").asString()))).isZero();
        tree(call(b,"GET",path(other),null),200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.app_user",Long.class)).isEqualTo(2);
    }

    @Test void everyReadAndWriteRejectsAnotherOwnerAndMissingResourcesUniformly() throws Exception {
        var owned=create(a); append(a,path(owned),"Private A context");
        for(String target:List.of(path(owned),base+"/"+UUID.randomUUID())) {
            for(var request:List.of(new Object[]{"GET",target,null},new Object[]{"GET",target+"/messages",null},
                    new Object[]{"PATCH",target,Map.of("title","Attack","expectedVersion",2)},
                    new Object[]{"DELETE",target,Map.of("expectedVersion",2)},
                    new Object[]{"POST",target+"/messages",Map.of("requestId",UUID.randomUUID().toString(),"content","Attack")})) {
                var response=call(b,(String)request[0],(String)request[1],request[2]);
                assertThat(tree(response,404).get("code").asString()).isEqualTo("NOT_FOUND");
                assertThat(response.body()).doesNotContain("Private",a.id().toString(),owned.get("id").asString());
            }
        }
        assertThat(tree(call(b,"GET",base,null),200).get("items").size()).isZero();
        assertThat(tree(call(a,"GET",path(owned)+"/messages",null),200).get("items").size()).isEqualTo(1);
    }

    @Test void concurrentCreateAndAppendReplaysReturnExactlyOneResource() throws Exception {
        var createBody=Map.of("requestId",UUID.randomUUID().toString());
        try(var pool=Executors.newFixedThreadPool(4)) {
            List<Callable<JsonNode>> jobs=new ArrayList<>();
            for(int i=0;i<4;i++) jobs.add(()->tree(call(a,"POST",base,createBody),200));
            Set<String> ids=new HashSet<>();
            for(var future:pool.invokeAll(jobs)) ids.add(future.get().get("id").asString());
            assertThat(ids).hasSize(1);
            String target=base+"/"+ids.iterator().next();
            var body=Map.of("requestId",UUID.randomUUID().toString(),"content","One message");
            jobs.clear(); for(int i=0;i<4;i++) jobs.add(()->tree(call(a,"POST",target+"/messages",body),200));
            for(var future:pool.invokeAll(jobs)) assertThat(future.get().get("sequence").asLong()).isEqualTo(1);
            tree(call(a,"POST",target+"/messages",Map.of("requestId",body.get("requestId"),"content","Changed")),409);
            assertThat(tree(call(a,"GET",target+"/messages",null),200).get("items").size()).isEqualTo(1);
            assertThat(tree(call(a,"GET",target,null),200).get("version").asLong()).isEqualTo(2);
        }
    }

    @Test void concurrentDistinctMessagesHaveContiguousSequencesAndStaleMutationsConflict() throws Exception {
        String target=path(create(a));
        try(var pool=Executors.newFixedThreadPool(8)) {
            List<Callable<JsonNode>> jobs=new ArrayList<>();
            for(int i=0;i<8;i++) { String text="Message "+i; jobs.add(()->append(a,target,text)); }
            Set<Long> sequences=new HashSet<>();
            for(var future:pool.invokeAll(jobs)) sequences.add(future.get().get("sequence").asLong());
            assertThat(sequences).containsExactlyInAnyOrder(1L,2L,3L,4L,5L,6L,7L,8L);
        }
        tree(call(a,"PATCH",target,Map.of("title","Stale","expectedVersion",1)),409);
        tree(call(a,"DELETE",target,Map.of("expectedVersion",1)),409);
        assertThat(tree(call(a,"GET",target,null),200).get("version").asLong()).isEqualTo(9);
    }

    @Test void keysetPagesStayOwnerScopedAndStableUnderRenameAndAppend() throws Exception {
        Set<String> created=new HashSet<>();
        for(int i=0;i<5;i++) created.add(create(a).get("id").asString());
        create(b);
        jdbc.update("UPDATE trading.conversation SET created_at='2026-01-01T00:00:00Z' WHERE owner_id=?",a.id());
        Set<String> seen=new HashSet<>(); String query="?limit=2";
        while(true) {
            var page=tree(call(a,"GET",base+query,null),200);
            for(var item:page.get("items")) { assertThat(seen.add(item.get("id").asString())).isTrue(); append(a,path(item),"Does not reorder creation"); }
            if(page.get("nextCursor").isNull()) break;
            query="?limit=2&cursor="+page.get("nextCursor").asString();
        }
        assertThat(seen).isEqualTo(created);
        for(String suffix:List.of("?limit=0","?limit=51","?limit=-1","?limit=abc","?cursor=bad","?cursor=%00")) tree(call(a,"GET",base+suffix,null),400);
        String outOfRange=Base64.getUrlEncoder().withoutPadding().encodeToString(("+999999-01-01T00:00:00Z|"+UUID.randomUUID()).getBytes(StandardCharsets.UTF_8));
        tree(call(a,"GET",base+"?cursor="+outOfRange,null),400);
    }

    @Test void messagePagesDoNotShiftWhenNewMessagesArrive() throws Exception {
        String target=path(create(a));
        for(int i=1;i<=5;i++) append(a,target,"Message "+i);
        var last=tree(call(a,"GET",target+"/messages?limit=2",null),200);
        assertThat(last.get("items").get(0).get("sequence").asLong()).isEqualTo(4);
        assertThat(last.get("items").get(1).get("sequence").asLong()).isEqualTo(5);
        append(a,target,"Message 6");
        var middle=tree(call(a,"GET",target+"/messages?limit=2&before="+last.get("nextBefore").asLong(),null),200);
        assertThat(middle.get("items").get(0).get("sequence").asLong()).isEqualTo(2);
        assertThat(middle.get("items").get(1).get("sequence").asLong()).isEqualTo(3);
        var first=tree(call(a,"GET",target+"/messages?limit=2&before=2",null),200);
        assertThat(first.get("items").size()).isEqualTo(1); assertThat(first.get("nextBefore").isNull()).isTrue();
        for(String suffix:List.of("?before=0","?before=-1","?before=9223372036854775808","?limit=101")) tree(call(a,"GET",target+"/messages"+suffix,null),400);
    }

    @Test void validationBoundariesAndUnknownSecurityFieldsAreRejected() throws Exception {
        String target=path(create(a));
        tree(call(a,"PATCH",target,Map.of("title","X".repeat(120),"expectedVersion",1)),200);
        append(a,target,"x".repeat(4000)); append(a,target,"x");
        for(String text:List.of(""," ","\u0000","\u0001","x".repeat(4001)))
            tree(call(a,"POST",target+"/messages",Map.of("requestId",UUID.randomUUID().toString(),"content",text)),400);
        for(String title:List.of(""," ","x".repeat(121),"new\ntitle")) tree(call(a,"PATCH",target,Map.of("title",title,"expectedVersion",4)),400);
        for(String payload:List.of("null","{}","{\"requestId\":null}","{\"requestId\":123}",
                "{\"requestId\":\""+UUID.randomUUID()+"\",\"ownerId\":\""+b.id()+"\"}"))
            assertThat(send(a,"POST",base,payload,a.csrf(),"application/json",Map.of()).statusCode()).isEqualTo(400);
        for(Object version:List.of(0,-1,1.5,"4",true)) tree(call(a,"PATCH",target,Map.of("title","Name","expectedVersion",version)),400);
        tree(call(a,"POST",target+"/messages",Map.of("requestId",UUID.randomUUID().toString(),"content","Forged","role","assistant")),400);
        String invalidUnicode="{\"requestId\":\""+UUID.randomUUID()+"\",\"content\":\""+"\\ud800"+"\"}";
        assertThat(send(a,"POST",target+"/messages",invalidUnicode,a.csrf(),"application/json",Map.of()).statusCode()).isEqualTo(400);
        tree(call(a,"GET",base+"/1-1-1-1-1",null),400);
        assertThat(send(a,"POST",target+"/messages","x".repeat(16385),a.csrf(),"application/json",Map.of()).statusCode()).isEqualTo(413);
    }

    @Test void quotaChecksSerializeConcurrentRequestsAndAllowExistingReplayAtLimit() throws Exception {
        var first=create(a); String target=path(first);
        jdbc.update("INSERT INTO trading.conversation(id,owner_id,request_id,title) SELECT gen_random_uuid(),?,gen_random_uuid(),'Seed' FROM generate_series(1,98)",a.id());
        try(var pool=Executors.newFixedThreadPool(2)) {
            var createJobs=List.<Callable<Integer>>of(()->call(a,"POST",base,Map.of("requestId",UUID.randomUUID().toString())).statusCode(),
                    ()->call(a,"POST",base,Map.of("requestId",UUID.randomUUID().toString())).statusCode());
            List<Integer> statuses=new ArrayList<>(); for(var future:pool.invokeAll(createJobs)) statuses.add(future.get());
            assertThat(statuses).containsExactlyInAnyOrder(200,409);
            UUID conversationId=UUID.fromString(first.get("id").asString());
            jdbc.update("INSERT INTO trading.conversation_message(conversation_id,sequence,request_id,role,content) SELECT ?,n,gen_random_uuid(),'user','Seed' FROM generate_series(1,1999) n",conversationId);
            jdbc.update("UPDATE trading.conversation SET last_sequence=1999 WHERE id=?",conversationId);
            var bodies=List.of(Map.of("requestId",UUID.randomUUID().toString(),"content","Last A"),Map.of("requestId",UUID.randomUUID().toString(),"content","Last B"));
            var jobs=List.<Callable<HttpResponse<String>>>of(()->call(a,"POST",target+"/messages",bodies.get(0)),()->call(a,"POST",target+"/messages",bodies.get(1)));
            statuses.clear(); int i=0;
            for(var future:pool.invokeAll(jobs)) { var response=future.get(); statuses.add(response.statusCode());
                if(response.statusCode()==200) assertThat(call(a,"POST",target+"/messages",bodies.get(i)).body()).isEqualTo(response.body()); i++; }
            assertThat(statuses).containsExactlyInAnyOrder(200,409);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.conversation_message WHERE conversation_id=?",Long.class,conversationId)).isEqualTo(2000);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.conversation WHERE owner_id=?",Long.class,a.id())).isEqualTo(100);
        }
    }

    @Test void authCsrfOriginsAndRevokedCredentialsFailAtActualMutationBoundary() throws Exception {
        String target=path(create(a));
        var anon=new Actor(HttpClient.newHttpClient(),null,null);
        tree(call(anon,"GET",base,null),401); tree(call(anon,"GET",target+"/messages",null),401);
        assertThat(send(a,"POST",base,"{}",null,"application/json",Map.of()).statusCode()).isEqualTo(403);
        assertThat(send(a,"DELETE",target,"{\"expectedVersion\":1}",b.csrf(),"application/json",Map.of()).statusCode()).isEqualTo(403);
        assertThat(send(a,"POST",base,"{}",a.csrf(),"application/json",Map.of("Origin","https://hostile.invalid")).statusCode()).isEqualTo(403);
        var stale=(UserPrincipal)users.loadUserByUsername("chat-a@example.test");
        jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        assertThatThrownBy(()->conversations.append(stale,UUID.fromString(target.substring(base.length()+1)),UUID.randomUUID(),"Stale write"))
                .isInstanceOf(BadCredentialsException.class);
        tree(call(a,"GET",target,null),401);
    }

    @Test void perUserMutationThrottleIsAtomicAndDoesNotTrustForwardedHeaders() throws Exception {
        create(a);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=119 WHERE bucket_key=?",AuthRateLimiter.bucketKey("chat-user",a.id().toString()));
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Callable<Integer>> jobs=new ArrayList<>();
            for(int i=0;i<2;i++) jobs.add(()->send(a,"POST",base,json.writeValueAsString(Map.of("requestId",UUID.randomUUID().toString())),a.csrf(),"application/json",Map.of("X-Forwarded-For",UUID.randomUUID().toString())).statusCode());
            List<Integer> statuses=new ArrayList<>();for(var future:pool.invokeAll(jobs)) statuses.add(future.get());
            assertThat(statuses).containsExactlyInAnyOrder(200,429);
        }
        assertThat(call(a,"POST",base,Map.of("requestId",UUID.randomUUID().toString())).headers().firstValue("Retry-After")).contains("900");
        jdbc.update("UPDATE trading.auth_rate_bucket SET window_start=window_start-1 WHERE bucket_key=?",AuthRateLimiter.bucketKey("chat-user",a.id().toString()));
        create(a);
    }

    @Test void actualDatabaseOutageFailsClosedAndRetryPreservesContextWithoutDuplicateMessage() throws Exception {
        String target=path(create(a));
        append(a,target,"Existing private context");
        var pending=Map.of("requestId",UUID.randomUUID().toString(),"content","Retry-safe new message");
        Path data=Path.of(System.getenv("AITRADING_TEST_CLUSTER"));
        String ctl=System.getenv("AITRADING_TEST_PG_CTL");
        Path control=data.getParent().resolve("chat-pg-control.log");
        int stopped=new ProcessBuilder(ctl,"-D",data.toString(),"-m","fast","-t","30","-w","stop")
                .redirectErrorStream(true).redirectOutput(control.toFile()).start().waitFor();
        assertThat(stopped).isZero();
        try {
            for(var result:List.of(call(a,"GET",target+"/messages",null),call(a,"POST",target+"/messages",pending))) {
                assertThat(result.statusCode()).isEqualTo(503);
                assertThat(result.body()).contains("UNAVAILABLE").doesNotContain("context","password","jdbc","Exception");
            }
        } finally {
            int started=new ProcessBuilder(ctl,"-D",data.toString(),"-l",data.getParent().resolve("chat-pg-restart.log").toString(),
                    "-o","-h 127.0.0.1 -p "+System.getenv("AITRADING_TEST_DB_PORT"),"-t","30","-w","start")
                    .redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.appendTo(control.toFile())).start().waitFor();
            assertThat(started).isZero();
        }
        org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(15)).pollInterval(Duration.ofMillis(100)).until(()->{
            var recovered=call(a,"GET",target+"/messages",null);
            assertThat(recovered.statusCode()).isIn(200,503);
            if(recovered.statusCode()==503) return false;
            assertThat(tree(recovered,200).get("items").get(0).get("content").asString()).isEqualTo("Existing private context");
            return true;
        });
        var saved=tree(call(a,"POST",target+"/messages",pending),200);
        assertThat(tree(call(a,"POST",target+"/messages",pending),200)).isEqualTo(saved);
        assertThat(tree(call(a,"GET",target+"/messages",null),200).get("items").size()).isEqualTo(2);
    }
}
