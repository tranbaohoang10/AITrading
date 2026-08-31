package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import com.aitrading.pine.*;
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
import org.springframework.security.authentication.BadCredentialsException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties="spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class PineExportApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired StrategyService strategies;
    @Autowired PineExportService exports;
    final JsonMapper json=JsonMapper.builder().build();
    record Actor(HttpClient client,String csrf,UUID id) { }
    Actor a,b;
    @BeforeAll static void ownedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize().startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");jdbc.update("DELETE FROM trading.app_user");
        a=actor("pine-a@example.test");b=actor("pine-b@example.test");
    }
    Actor actor(String email) throws Exception {
        String password="Synthetic Pine fixture phrase!";auth.register(email,"Researcher",password);
        var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).connectTimeout(Duration.ofSeconds(3)).build();
        var anon=new Actor(client,null,null);
        String token=tree(call(anon,"GET","/api/auth/csrf",null,Map.of()),200).get("token").asString();
        var login=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/login")).header("Content-Type","application/x-www-form-urlencoded").header("X-CSRF-TOKEN",token).POST(HttpRequest.BodyPublishers.ofString("email="+URLEncoder.encode(email,StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8))).build();
        assertThat(client.send(login,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(204);
        String fresh=tree(call(anon,"GET","/api/auth/csrf",null,Map.of()),200).get("token").asString();
        UUID id=UUID.fromString(tree(call(anon,"GET","/api/auth/me",null,Map.of()),200).get("id").asString());return new Actor(client,fresh,id);
    }
    HttpResponse<String> call(Actor actor,String method,String path,Object body,Map<String,String> headers) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(20)).header("Content-Type","application/json");
        if(actor.id()!=null&&!headers.containsKey("X-Workspace-User"))builder.header("X-Workspace-User",actor.id().toString());
        if(actor.csrf()!=null&&!headers.containsKey("X-CSRF-TOKEN"))builder.header("X-CSRF-TOKEN",actor.csrf());
        headers.forEach(builder::header);
        return actor.client().send(builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
    }
    JsonNode tree(HttpResponse<String> r,int status){assertThat(r.statusCode()).as(r.body()).isEqualTo(status);return json.readTree(r.body());}
    UserPrincipal principal(Actor actor){return (UserPrincipal)users.loadUserByUsername(actor==a?"pine-a@example.test":"pine-b@example.test");}
    StrategyService.Revision source(Actor actor) throws Exception {
        var first=strategies.create(principal(actor),new StrategyService.Create(UUID.randomUUID().toString(),"Synthetic export"));
        return strategies.save(principal(actor),first.strategyId(),new StrategyService.Save(UUID.randomUUID().toString(),1,"Synthetic export",Files.readString(Path.of("src/test/resources/dsl/price-action.json")),"VALIDATED"));
    }
    String path(StrategyService.Revision r){return "/api/strategies/"+r.strategyId()+"/versions/"+r.revision()+"/pine";}
    @Test void immutableOwnedExportPersistsAndReplaysAfterNewerDraftAndCascadesOnlyForItsOwner() throws Exception {
        var source=source(a);String path=path(source);
        tree(call(a,"GET",path,null,Map.of()),404);
        var saved=tree(call(a,"POST",path,Map.of(),Map.of()),200);
        assertThat(saved.get("dslHash").asString()).isEqualTo(source.hash());assertThat(saved.get("codeHash").asString()).isEqualTo(PineGenerator.hash(saved.get("code").asString()));
        assertThat(saved.get("generatorVersion").asString()).isEqualTo(PineGenerator.VERSION);assertThat(saved.get("limitations").size()).isEqualTo(5);
        assertThat(tree(call(a,"GET",path,null,Map.of()),200)).isEqualTo(saved);
        strategies.save(principal(a),source.strategyId(),new StrategyService.Save(UUID.randomUUID().toString(),2,"Later draft","not valid","DRAFT"));
        assertThat(tree(call(a,"POST",path,Map.of(),Map.of()),200)).isEqualTo(saved);
        for(String target:List.of(path,"/api/strategies/"+UUID.randomUUID()+"/versions/2/pine"))for(String method:List.of("GET","POST")) {
            var response=call(b,method,target,method.equals("POST")?Map.of():null,Map.of());tree(response,404);assertThat(response.body()).doesNotContain(source.hash(),"//@version",a.id().toString());
        }
        var other=source(b);exports.create(principal(b),other.strategyId(),2);
        strategies.delete(principal(a),source.strategyId(),3);tree(call(a,"GET",path,null,Map.of()),404);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.pine_export",Integer.class)).isEqualTo(1);
        tree(call(b,"GET",path(other),null,Map.of()),200);
    }
    @Test void csrfIdentityRevocationInvalidBodiesAndResourceIdsFailBeforeGeneration() throws Exception {
        var source=source(a);String path=path(source);
        tree(call(new Actor(HttpClient.newHttpClient(),null,null),"GET",path,null,Map.of()),401);
        tree(call(new Actor(a.client(),null,a.id()),"POST",path,Map.of(),Map.of()),403);
        tree(call(a,"POST",path,Map.of(),Map.of("X-CSRF-TOKEN",b.csrf())),403);
        tree(call(a,"POST",path,Map.of(),Map.of("Origin","https://hostile.invalid")),403);
        tree(call(a,"POST",path,Map.of(),Map.of("X-Workspace-User",b.id().toString())),401);
        tree(call(new Actor(a.client(),a.csrf(),null),"GET",path,null,Map.of()),401);
        for(Object body:List.of(Map.of("ownerId",b.id()),Map.of("code","alert(1)"),List.of(),"text"))tree(call(a,"POST",path,body,Map.of()),400);
        for(String value:List.of("0","101","01","1e0","-1"))tree(call(a,"GET",path.replace("/2/","/"+value+"/"),null,Map.of()),400);
        tree(call(a,"POST",path.replace("/2/","/1/"),Map.of(),Map.of()),422);
        var stale=principal(a);jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        assertThatThrownBy(()->exports.create(stale,source.strategyId(),2)).isInstanceOf(BadCredentialsException.class);
        tree(call(a,"GET",path,null,Map.of()),401);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.pine_export",Integer.class)).isZero();
    }
    @Test void concurrentSameRevisionReturnsOneArtifactAndQuotaRaceCannotExceed100() throws Exception {
        var source=source(a);var owner=principal(a);
        try(var pool=Executors.newFixedThreadPool(3)) {
            List<Callable<PineExportService.Artifact>> calls=List.of(()->exports.create(owner,source.strategyId(),2),()->exports.create(owner,source.strategyId(),2),()->exports.create(owner,source.strategyId(),2));
            var results=pool.invokeAll(calls);assertThat(results.get(0).get()).isEqualTo(results.get(1).get()).isEqualTo(results.get(2).get());
            assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.pine_export",Integer.class)).isEqualTo(1);
            // Synthetic historical generator rows exercise the per-owner quota without 99 irrelevant compilations.
            jdbc.update("""
                    INSERT INTO trading.pine_export(strategy_id,revision,generator_version,dsl_hash,schema_version,validator_version,code_hash,code)
                    SELECT strategy_id,revision,'fixture-'||n,dsl_hash,schema_version,validator_version,code_hash,code FROM trading.pine_export CROSS JOIN generate_series(1,98) n
                    """);
            var second=source(a);var third=source(a);
            List<Callable<String>> writes=List.of(()->attempt(owner,second),()->attempt(owner,third));var statuses=new ArrayList<String>();for(var result:pool.invokeAll(writes))statuses.add(result.get());
            assertThat(statuses).containsExactlyInAnyOrder("created","quota");
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.pine_export",Integer.class)).isEqualTo(100);
        tree(call(a,"POST",path(source),Map.of(),Map.of()),200); // Idempotent retry still succeeds at quota.
        var bSource=source(b);tree(call(b,"POST",path(bSource),Map.of(),Map.of()),200);
    }
    String attempt(UserPrincipal owner,StrategyService.Revision r){try{exports.create(owner,r.strategyId(),2);return "created";}catch(com.aitrading.api.ResourceFailure e){assertThat(e.status()).isEqualTo(409);return "quota";}}
    @Test void databaseFailureRollsBackAndCorruptProvenanceNeverReturnsUntrustedCode() throws Exception {
        var source=source(a);String path=path(source);
        jdbc.execute("CREATE FUNCTION trading.reject_pine_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private fixture detail'; END $$");
        jdbc.execute("CREATE TRIGGER reject_pine_fixture BEFORE INSERT ON trading.pine_export FOR EACH ROW EXECUTE FUNCTION trading.reject_pine_fixture()");
        try {var response=call(a,"POST",path,Map.of(),Map.of());tree(response,503);assertThat(response.body()).doesNotContain("private fixture detail","INSERT","Exception");}
        finally{jdbc.execute("DROP TRIGGER reject_pine_fixture ON trading.pine_export");jdbc.execute("DROP FUNCTION trading.reject_pine_fixture()");}
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.pine_export",Integer.class)).isZero();
        tree(call(a,"POST",path,Map.of(),Map.of()),200);
        jdbc.update("UPDATE trading.pine_export SET code='untrusted fixture' WHERE strategy_id=?",source.strategyId());
        for(String method:List.of("GET","POST")){var response=call(a,method,path,method.equals("POST")?Map.of():null,Map.of());assertThat(tree(response,422).get("code").asString()).isEqualTo("ARTIFACT_PROVENANCE_MISMATCH");assertThat(response.body()).doesNotContain("untrusted fixture");}
    }
    @Test void bodyAndExistingStrategyRateLimitBoundExportResources() throws Exception {
        var source=source(a);String path=path(source);
        tree(call(a,"POST",path,Map.of("code","x".repeat(16384)),Map.of()),413);
        tree(call(a,"POST",path,Map.of(),Map.of()),200);
        jdbc.update("DELETE FROM trading.auth_rate_bucket");
        for(int i=0;i<60;i++)tree(call(a,"POST",path,Map.of(),Map.of()),200);
        var limited=call(a,"POST",path,Map.of(),Map.of());tree(limited,429);assertThat(limited.headers().firstValue("Retry-After")).isPresent();
        tree(call(a,"GET",path,null,Map.of()),200);
    }
}
