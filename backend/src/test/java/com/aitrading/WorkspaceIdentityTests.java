package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import com.aitrading.journal.JournalService;
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
class WorkspaceIdentityTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired JournalService journal;
    final JsonMapper json=JsonMapper.builder().build();
    record Actor(HttpClient client,String csrf,UUID id) { }
    Actor a,b;
    static final String BASE="/api/journal", QUERY="?from=2024-01-01&to=2024-01-31&zone=UTC&currency=USD";
    @BeforeAll static void ownedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize()
                .startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");jdbc.update("DELETE FROM trading.app_user");
        a=actor("identity-a@example.test");b=actor("identity-b@example.test");
    }
    Actor actor(String email) throws Exception {
        String password="Synthetic journal fixture phrase!";auth.register(email,"Researcher",password);
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
        if(actor.id()!=null && !headers.containsKey("X-Workspace-User"))builder.header("X-Workspace-User",actor.id().toString());
        headers.forEach((key,value)->{if(!key.equals("Content-Type"))builder.header(key,value);});if(csrf!=null)builder.header("X-CSRF-TOKEN",csrf);
        var publisher=chunked?HttpRequest.BodyPublishers.ofInputStream(()->new ByteArrayInputStream(body)):HttpRequest.BodyPublishers.ofByteArray(body);
        return actor.client().send(builder.method(method,publisher).build(),HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> call(Actor actor,String method,String path,Object body) throws Exception {
        return send(actor,method,path,body==null?new byte[0]:json.writeValueAsBytes(body),actor.csrf(),Map.of(),false);
    }
    JsonNode tree(HttpResponse<String> response,int status) {assertThat(response.statusCode()).as(response.body()).isEqualTo(status);return json.readTree(response.body());}
    @Test void staleConversationReadAndWriteCannotUseReplacementSession() throws Exception {
        var stale=new Actor(b.client(),b.csrf(),a.id());
        tree(call(stale,"GET","/api/conversations",null),401);
        tree(call(stale,"POST","/api/conversations",Map.of("requestId",UUID.randomUUID().toString())),401);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.conversation",Long.class)).isZero();
        tree(call(b,"GET","/api/conversations",null),200);
    }
    @Test void staleLogoutMustLeaveReplacementSessionAuthenticated() throws Exception {
        var stale=new Actor(b.client(),b.csrf(),a.id());
        tree(call(stale,"POST","/api/auth/logout",null),401);
        assertThat(tree(call(b,"GET","/api/auth/me",null),200).get("id").asString()).isEqualTo(b.id().toString());
        assertThat(call(b,"POST","/api/auth/logout",null).statusCode()).isEqualTo(204);
        tree(call(b,"GET","/api/auth/me",null),401);
    }
    @Test void privateSurfacesRejectMissingWrongMalformedAndAmbiguousIdentity() throws Exception {
        var routes=List.of("/api/conversations","/api/datasets","/api/strategies","/api/backtests",
                "/api/journal"+QUERY,"/api/dsl/schema","/api/dsl/capabilities","/api/ai/capabilities");
        for(var path:routes) {
            tree(call(new Actor(a.client(),a.csrf(),null),"GET",path,null),401);
            tree(call(new Actor(a.client(),a.csrf(),b.id()),"GET",path,null),401);
            tree(send(a,"GET",path,new byte[0],null,Map.of("X-Workspace-User","invalid"),false),401);
            var duplicate=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path))
                    .header("X-Workspace-User",a.id().toString()).header("X-Workspace-User",a.id().toString()).GET().build();
            tree(a.client().send(duplicate,HttpResponse.BodyHandlers.ofString()),401);
            tree(call(a,"GET",path,null),200);
        }
        var stale=new Actor(b.client(),b.csrf(),a.id());
        for(var path:List.of("/api/auth/profile","/api/auth/password","/api/dsl/validate","/api/datasets","/api/strategies","/api/backtests","/api/journal"))
            tree(call(stale,path.endsWith("profile")?"PATCH":"POST",path,Map.of()),401);
        tree(call(stale,"GET","/api/auth/me",null),401);
        tree(call(new Actor(b.client(),b.csrf(),null),"GET","/api/auth/me",null),200);
        tree(call(new Actor(b.client(),b.csrf(),null),"GET","/api/auth/csrf",null),200);
    }
    @Test void staleSubresourcesAndMutationsAreDeniedBeforeValidationOrLookup() throws Exception {
        var stale=new Actor(b.client(),b.csrf(),a.id());
        String key=UUID.randomUUID().toString();
        for(var route:List.of("/api/conversations/"+key,"/api/conversations/"+key+"/messages",
                "/api/conversations/"+key+"/ai-turns","/api/conversations/"+key+"/ai-turns/"+key,
                "/api/datasets/"+key,"/api/datasets/"+key+"/candles","/api/strategies/"+key,
                "/api/strategies/"+key+"/versions","/api/strategies/"+key+"/versions/1",
                "/api/backtests/"+key,"/api/backtests/"+key+"/result","/api/backtests/"+key+"/candles",
                "/api/journal/"+key,"/api/journal/summary"+QUERY)) {
            tree(call(stale,"GET",route,null),401);
            tree(call(stale,"DELETE",route,Map.of()),401);
        }
        for(var route:List.of("/api/conversations/"+key+"/messages","/api/conversations/"+key+"/ai-turns",
                "/api/conversations/"+key+"/ai-turns/"+key+"/cancel","/api/datasets/import",
                "/api/strategies/"+key+"/versions","/api/backtests/"+key+"/retry",
                "/api/backtests/"+key+"/cancel","/api/journal/"+key))
            tree(call(stale,"POST",route,Map.of()),401);
        tree(call(stale,"PATCH","/api/conversations/"+key,Map.of()),401);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.conversation",Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.backtest_job",Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.journal_entry",Long.class)).isZero();
        assertThat(tree(call(b,"GET","/api/auth/me",null),200).get("id").asString()).isEqualTo(b.id().toString());
    }
}
