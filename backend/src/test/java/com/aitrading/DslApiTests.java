package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import java.io.ByteArrayInputStream;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class DslApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    final JsonMapper json = JsonMapper.builder().build();
    record Actor(HttpClient client, String csrf, UUID id) { }
    Actor a, b;
    byte[] fixture;
    @BeforeAll static void requireOwnedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize()
                .startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");
        jdbc.update("DELETE FROM trading.app_user");
        a=actor("dsl-a@example.test");b=actor("dsl-b@example.test");
        try(var stream=getClass().getResourceAsStream("/dsl/price-action.json")){fixture=stream.readAllBytes();}
    }
    Actor actor(String email) throws Exception {
        String password="Synthetic DSL test account phrase!";
        auth.register(email,"Researcher",password);
        var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).connectTimeout(Duration.ofSeconds(3)).build();
        var anon=new Actor(client,null,null);
        String token=tree(send(anon,"GET","/api/auth/csrf",new byte[0],null,Map.of(),false),200).get("token").asString();
        byte[] body=("email="+URLEncoder.encode(email,StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
        assertThat(send(anon,"POST","/api/auth/login",body,token,Map.of("Content-Type","application/x-www-form-urlencoded"),false).statusCode()).isEqualTo(204);
        String fresh=tree(send(anon,"GET","/api/auth/csrf",new byte[0],null,Map.of(),false),200).get("token").asString();
        UUID id=UUID.fromString(tree(send(anon,"GET","/api/auth/me",new byte[0],null,Map.of(),false),200).get("id").asString());
        return new Actor(client,fresh,id);
    }
    HttpResponse<String> send(Actor actor,String method,String path,byte[] body,String csrf,Map<String,String> headers,boolean chunked) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(10));
        builder.header("Content-Type",headers.getOrDefault("Content-Type","application/json"));
        headers.forEach((key,value)->{if(!key.equals("Content-Type"))builder.header(key,value);});
        if(csrf!=null)builder.header("X-CSRF-TOKEN",csrf);
        var publisher=chunked?HttpRequest.BodyPublishers.ofInputStream(()->new ByteArrayInputStream(body)):HttpRequest.BodyPublishers.ofByteArray(body);
        return actor.client().send(builder.method(method,publisher).build(),HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> validate(Actor actor,byte[] body) throws Exception {return send(actor,"POST","/api/dsl/validate",body,actor.csrf(),Map.of(),false);}
    JsonNode tree(HttpResponse<String> response,int status) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);return json.readTree(response.body());
    }
    @Test void authenticatedApiReturnsSchemaCapabilitiesAndDeterministicIdentityWithoutPersistence() throws Exception {
        var schema=send(a,"GET","/api/dsl/schema",new byte[0],null,Map.of(),false);
        assertThat(schema.headers().firstValue("Content-Type")).contains("application/schema+json");
        assertThat(tree(schema,200).get("$id").asString()).isEqualTo("urn:aitrading:strategy-dsl:1.0.0");
        assertThat(tree(send(a,"GET","/api/dsl/capabilities",new byte[0],null,Map.of(),false),200).get("operation").asString()).isEqualTo("validation_only");
        var result=tree(validate(a,fixture),200);
        assertThat(result.get("valid").asBoolean()).isTrue();
        assertThat(tree(validate(b,fixture),200)).isEqualTo(result);
        assertThat(tree(validate(a,fixture),200)).isEqualTo(result); // safe stateless replay
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.conversation",Long.class)).isZero();
        assertThat(result.toString()).doesNotContain(a.id().toString(),b.id().toString(),"password","csrf");
    }
    @Test void boundaryDeniesAnonymousCsrfOriginAndRevokedSessions() throws Exception {
        var anon=new Actor(HttpClient.newHttpClient(),null,null);
        for(String path:List.of("/api/dsl/schema","/api/dsl/capabilities"))
            tree(send(anon,"GET",path,new byte[0],null,Map.of(),false),401);
        for(String token:Arrays.asList(null,b.csrf()))
            tree(send(a,"POST","/api/dsl/validate",fixture,token,Map.of(),false),403);
        tree(send(a,"POST","/api/dsl/validate",fixture,a.csrf(),Map.of("Origin","https://hostile.invalid"),false),403);
        jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        tree(validate(a,fixture),401);
        tree(validate(b,fixture),200);
    }
    @Test void malformedSemanticAndUnknownFieldsHaveBoundedRedactedErrors() throws Exception {
        String valid=new String(fixture,StandardCharsets.UTF_8);
        for(String input:List.of("null","{}",valid.replace("\"schemaVersion\": \"1.0.0\"","\"schemaVersion\": \"untrusted-secret-fixture\""),
                valid.replaceFirst("\\{","{\"untrusted-secret-fixture\":\"https://127.0.0.1/private\","))) {
            var response=validate(a,input.getBytes(StandardCharsets.UTF_8));
            var result=tree(response,422);
            assertThat(result.get("valid").asBoolean()).isFalse();assertThat(result.get("errors").size()).isBetween(1,20);
            assertThat(response.body()).doesNotContain("untrusted-secret-fixture","127.0.0.1","Exception","jdbc","password");
        }
        for(String input:List.of("{",valid+"{}","{\"schemaVersion\":1,\"schemaVersion\":2}")) {
            var response=validate(a,input.getBytes(StandardCharsets.UTF_8));
            tree(response,400);assertThat(response.body()).contains("INVALID_REQUEST").doesNotContain("schemaVersion","Exception");
        }
        tree(validate(a,new byte[]{(byte)0xc3,(byte)0x28}),400);
    }
    @Test void exactBodyLimitIncludesChunkedRequestsAndOtherRoutesRemainSmaller() throws Exception {
        byte[] exact=Arrays.copyOf(fixture,65536);Arrays.fill(exact,fixture.length,exact.length,(byte)' ');
        tree(validate(a,exact),200);
        tree(send(a,"POST","/api/dsl/validate",exact,a.csrf(),Map.of(),true),200);
        byte[] tooLarge=Arrays.copyOf(exact,65537);tooLarge[65536]=(byte)' ';
        tree(validate(a,tooLarge),413);
        tree(send(a,"POST","/api/dsl/validate",tooLarge,a.csrf(),Map.of(),true),413);
        tree(send(a,"POST","/api/conversations",exact,a.csrf(),Map.of(),false),413);
        tree(send(a,"POST","/api/auth/register",exact,a.csrf(),Map.of(),true),413);
    }
    @Test void userThrottleIsAtomicIndependentAndCannotBeSpoofedByForwardedHeaders() throws Exception {
        tree(validate(a,fixture),200);
        String bucket=AuthRateLimiter.bucketKey("dsl-user",a.id().toString());
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=119 WHERE bucket_key=?",bucket);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Callable<Integer>> jobs=new ArrayList<>();
            for(int i=0;i<2;i++)jobs.add(()->send(a,"POST","/api/dsl/validate",fixture,a.csrf(),Map.of("X-Forwarded-For",UUID.randomUUID().toString()),false).statusCode());
            List<Integer> statuses=new ArrayList<>();for(var future:pool.invokeAll(jobs))statuses.add(future.get());
            assertThat(statuses).containsExactlyInAnyOrder(200,429);
        }
        var throttled=send(a,"GET","/api/dsl/schema",new byte[0],null,Map.of(),false);
        tree(throttled,429);assertThat(throttled.headers().firstValue("Retry-After")).contains("900");
        tree(validate(b,fixture),200);
        jdbc.update("UPDATE trading.auth_rate_bucket SET window_start=window_start-1 WHERE bucket_key=?",bucket);
        tree(validate(a,fixture),200);
    }
}
