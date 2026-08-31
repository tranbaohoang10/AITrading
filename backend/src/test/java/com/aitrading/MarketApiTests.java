package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import com.aitrading.market.*;
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
class MarketApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired MarketService market;
    final JsonMapper json=JsonMapper.builder().build();
    record Actor(HttpClient client,String csrf,UUID id) { }
    Actor a,b;
    static final String BASE="/api/datasets";
    @BeforeAll static void ownedDatabase() {
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize()
                .startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");jdbc.update("DELETE FROM trading.app_user");
        a=actor("market-a@example.test");b=actor("market-b@example.test");
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
    String csv(int count) {
        StringBuilder result=new StringBuilder("timestamp,open,high,low,close,volume\n");
        for(int i=0;i<count;i++)result.append(Instant.parse("2024-01-01T00:00:00Z").plusSeconds(i*3600L)).append(",100.12345678,102,99,101,0\n");
        return result.toString();
    }
    Map<String,String> body(String requestId,int count) {return new HashMap<>(Map.of("requestId",requestId,"name","Private research A","symbol","TEST_USD","timeframe","1h","sourceKind","SYNTHETIC","sourceLabel","Owned test fixture","csv",csv(count)));}
    JsonNode create(Actor actor,int count) throws Exception {return tree(call(actor,"POST",BASE+"/import",body(UUID.randomUUID().toString(),count)),200);}
    String path(JsonNode dataset) {return BASE+"/"+dataset.get("id").asString();}
    long count(String table) {return jdbc.queryForObject("SELECT count(*) FROM trading."+table,Long.class);}

    @Test void actualOwnedImportHasExactDecimalsHashesStablePagesAndCascade() throws Exception {
        var dataset=create(a,8);var other=create(b,1);
        assertThat(dataset.get("formatVersion").asString()).isEqualTo("ohlcv-v1");assertThat(dataset.get("timezone").asString()).isEqualTo("UTC");
        assertThat(dataset.get("rawHash").asString()).isEqualTo(MarketCsvParser.hash(csv(8)));
        assertThat(dataset.get("candleCount").asInt()).isEqualTo(8);assertThat(dataset.get("gapCount").asLong()).isZero();
        var latest=tree(call(a,"GET",path(dataset)+"/candles?limit=3",null),200);
        assertThat(latest.get("start").asInt()).isEqualTo(5);assertThat(latest.get("total").asInt()).isEqualTo(8);
        assertThat(latest.get("items").get(0).get("ordinal").asInt()).isEqualTo(5);
        assertThat(latest.get("items").get(0).get("open").asString()).isEqualTo("100.12345678");
        assertThat(latest.get("items").get(0).get("volume").asString()).isEqualTo("0");
        assertThat(tree(call(a,"GET",path(dataset)+"/candles?start=0&limit=3",null),200).get("items").get(0).get("ordinal").asInt()).isZero();
        assertThat(tree(call(a,"GET",path(dataset)+"/candles?start=8",null),200).get("items").isEmpty()).isTrue();
        assertThat(tree(call(a,"GET",path(dataset),null),200)).isEqualTo(dataset);
        tree(call(a,"DELETE",path(dataset),Map.of("expectedDataHash","0".repeat(64))),409);
        assertThat(call(a,"DELETE",path(dataset),Map.of("expectedDataHash",dataset.get("dataHash").asString())).statusCode()).isEqualTo(204);
        tree(call(a,"GET",path(dataset),null),404);tree(call(b,"GET",path(other),null),200);
        assertThat(count("market_candle")).isEqualTo(1);assertThat(count("app_user")).isEqualTo(2);
    }
    @Test void ownerPredicatesRejectAllForeignReadsPagesAndDeletesWithNoLeaks() throws Exception {
        var dataset=create(a,1);
        for(String target:List.of(path(dataset),BASE+"/"+UUID.randomUUID())) {
            for(var result:List.of(call(b,"GET",target,null),call(b,"GET",target+"/candles",null),call(b,"DELETE",target,Map.of("expectedDataHash",dataset.get("dataHash").asString())))) {
                tree(result,404);assertThat(result.body()).doesNotContain("Private research",dataset.get("dataHash").asString(),a.id().toString());
            }
        }
        assertThat(tree(call(b,"GET",BASE,null),200).get("items").isEmpty()).isTrue();
        assertThat(count("market_dataset")).isEqualTo(1);
    }
    @Test void invalidCsvMetadataAndUnknownFieldsCannotPartiallyPersistOrExecute() throws Exception {
        for(String invalid:List.of("wrong\n",csv(1).replace("100.12345678","=CMD()"),csv(1)+csv(1).split("\n")[1])) {
            var payload=body(UUID.randomUUID().toString(),1);payload.put("csv",invalid);
            var response=call(a,"POST",BASE+"/import",payload);var problem=tree(response,422);
            assertThat(problem.get("code").asString()).startsWith("CSV_");assertThat(response.body()).doesNotContain("=CMD()","100.12345678","Exception","jdbc");
        }
        var owner=body(UUID.randomUUID().toString(),1);owner.put("ownerId",b.id().toString());tree(call(a,"POST",BASE+"/import",owner),400);
        var traversal=body(UUID.randomUUID().toString(),1);traversal.put("symbol","../../secret");tree(call(a,"POST",BASE+"/import",traversal),400);
        var missing=body(UUID.randomUUID().toString(),1);missing.remove("sourceKind");tree(call(a,"POST",BASE+"/import",missing),400);
        assertThat(count("market_dataset")).isZero();assertThat(count("market_candle")).isZero();
        var inert=body(UUID.randomUUID().toString(),1);inert.put("name","<script>fixture()</script> '); DROP TABLE x;--");
        var dataset=tree(call(a,"POST",BASE+"/import",inert),200);assertThat(dataset.get("name").asString()).isEqualTo(inert.get("name"));assertThat(count("app_user")).isEqualTo(2);
    }
    @Test void concurrentIdempotencyPreservesOneDatasetAndConflictingIntentIsRejected() throws Exception {
        var payload=body(UUID.randomUUID().toString(),3);
        try(var pool=Executors.newFixedThreadPool(3)) {
            List<Callable<JsonNode>> jobs=List.of(()->tree(call(a,"POST",BASE+"/import",payload),200),()->tree(call(a,"POST",BASE+"/import",payload),200),()->tree(call(a,"POST",BASE+"/import",payload),200));
            Set<String> ids=new HashSet<>();for(var result:pool.invokeAll(jobs))ids.add(result.get().get("id").asString());assertThat(ids).hasSize(1);
        }
        assertThat(count("market_dataset")).isEqualTo(1);assertThat(count("market_candle")).isEqualTo(3);
        payload.put("name","Different intent");tree(call(a,"POST",BASE+"/import",payload),409);
        tree(call(b,"POST",BASE+"/import",payload),200);assertThat(count("market_dataset")).isEqualTo(2);
    }
    @Test void concurrentQuotaCheckSerializesOnOwnerAndReplayStillWorksAtLimit() throws Exception {
        var original=body(UUID.randomUUID().toString(),1);var first=tree(call(a,"POST",BASE+"/import",original),200);
        jdbc.update("""
                INSERT INTO trading.market_dataset(id,owner_id,request_id,request_hash,name,symbol,timeframe,source_kind,source_label,raw_hash,data_hash,candle_count,gap_count,first_time,last_time)
                SELECT gen_random_uuid(),owner_id,gen_random_uuid(),request_hash,name,symbol,timeframe,source_kind,source_label,raw_hash,data_hash,candle_count,gap_count,first_time,last_time
                FROM trading.market_dataset CROSS JOIN generate_series(1,48) WHERE id=?
                """,UUID.fromString(first.get("id").asString()));
        jdbc.update("""
                INSERT INTO trading.market_candle(dataset_id,ordinal,open_time,open,high,low,close,volume)
                SELECT d.id,c.ordinal,c.open_time,c.open,c.high,c.low,c.close,c.volume FROM trading.market_dataset d
                CROSS JOIN trading.market_candle c WHERE c.dataset_id=? AND d.id<>c.dataset_id
                """,UUID.fromString(first.get("id").asString()));
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Callable<Integer>> jobs=List.of(()->call(a,"POST",BASE+"/import",body(UUID.randomUUID().toString(),1)).statusCode(),()->call(a,"POST",BASE+"/import",body(UUID.randomUUID().toString(),1)).statusCode());
            List<Integer> statuses=new ArrayList<>();for(var result:pool.invokeAll(jobs))statuses.add(result.get());assertThat(statuses).containsExactlyInAnyOrder(200,409);
        }
        assertThat(count("market_dataset")).isEqualTo(50);assertThat(count("market_candle")).isEqualTo(50);
        assertThat(tree(call(a,"POST",BASE+"/import",original),200)).isEqualTo(first);
    }
    @Test void realBatchFailureRollsBackParentAndAlreadyInsertedCandles() throws Exception {
        jdbc.execute("CREATE FUNCTION trading.reject_market_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.ordinal=1 THEN RAISE EXCEPTION 'fixture batch rejection'; END IF; RETURN NEW; END $$");
        jdbc.execute("CREATE TRIGGER reject_market_fixture BEFORE INSERT ON trading.market_candle FOR EACH ROW EXECUTE FUNCTION trading.reject_market_fixture()");
        try {
            var response=call(a,"POST",BASE+"/import",body(UUID.randomUUID().toString(),3));tree(response,503);
            assertThat(response.body()).doesNotContain("fixture batch rejection","INSERT","Exception","100.12345678");
            assertThat(count("market_dataset")).isZero();assertThat(count("market_candle")).isZero();
        } finally {jdbc.execute("DROP TRIGGER reject_market_fixture ON trading.market_candle");jdbc.execute("DROP FUNCTION trading.reject_market_fixture()");}
        create(a,2);assertThat(count("market_candle")).isEqualTo(2);
    }
    @Test void keysetListRemainsStableDuringNewImportAndRejectsInvalidPagination() throws Exception {
        var one=create(a,1);create(a,1);create(a,1);
        jdbc.update("UPDATE trading.market_dataset SET created_at='2024-01-01T00:00:00Z'");
        var page=tree(call(a,"GET",BASE+"?limit=1",null),200);Set<String> seen=new HashSet<>();seen.add(page.get("items").get(0).get("id").asString());
        var added=create(a,1);
        while(!page.get("nextCursor").isNull()) {
            page=tree(call(a,"GET",BASE+"?limit=1&cursor="+page.get("nextCursor").asString(),null),200);
            for(var item:page.get("items"))assertThat(seen.add(item.get("id").asString())).isTrue();
        }
        assertThat(seen).hasSize(3).doesNotContain(added.get("id").asString());
        for(String query:List.of("?limit=0","?limit=51","?limit=-1","?limit=1.5","?cursor=bad","?cursor="+"x".repeat(129)))tree(call(a,"GET",BASE+query,null),400);
        for(String query:List.of("?limit=0","?limit=501","?start=-1","?start=2","?start=1.5"))tree(call(a,"GET",path(one)+"/candles"+query,null),400);
        tree(call(a,"GET",BASE+"/1-1-1-1-1",null),400);
    }
    @Test void bodyLimitsCsrfOriginAndCurrentCredentialsAreEnforced() throws Exception {
        byte[] data=json.writeValueAsBytes(body(UUID.randomUUID().toString(),1));
        tree(send(a,"POST",BASE+"/import",data,null,Map.of(),false),403);
        tree(send(a,"POST",BASE+"/import",data,b.csrf(),Map.of(),false),403);
        tree(send(a,"POST",BASE+"/import",data,a.csrf(),Map.of("Origin","https://hostile.invalid"),false),403);
        tree(call(new Actor(HttpClient.newHttpClient(),null,null),"GET",BASE,null),401);
        byte[] exact=Arrays.copyOf(data,MarketCsvParser.MAX_IMPORT_BYTES);Arrays.fill(exact,data.length,exact.length,(byte)' ');
        tree(send(a,"POST",BASE+"/import",exact,a.csrf(),Map.of(),true),200);
        byte[] tooLarge=Arrays.copyOf(exact,exact.length+1);tooLarge[tooLarge.length-1]=(byte)' ';
        tree(send(a,"POST",BASE+"/import",tooLarge,a.csrf(),Map.of(),false),413);
        tree(send(a,"POST",BASE+"/import",tooLarge,a.csrf(),Map.of(),true),413);
        tree(send(a,"POST","/api/conversations",exact,a.csrf(),Map.of(),false),413);
        tree(send(a,"POST","/api/dsl/validate",exact,a.csrf(),Map.of(),false),413);
        var stale=(UserPrincipal)users.loadUserByUsername("market-a@example.test");
        jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        var request=new MarketService.Import(UUID.randomUUID().toString(),"Test","TEST_USD","1h","SYNTHETIC","Test",csv(1));
        assertThatThrownBy(()->market.create(stale,request)).isInstanceOf(BadCredentialsException.class);
        tree(call(a,"POST",BASE+"/import",body(UUID.randomUUID().toString(),1)),401);
    }
    @Test void importThrottleIsAtomicAndUserScopedAcrossForwardedHeaderSpoofing() throws Exception {
        create(a,1);String bucket=AuthRateLimiter.bucketKey("data-import",a.id().toString());
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=9 WHERE bucket_key=?",bucket);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Callable<Integer>> jobs=new ArrayList<>();for(int i=0;i<2;i++)jobs.add(()->send(a,"POST",BASE+"/import",json.writeValueAsBytes(body(UUID.randomUUID().toString(),1)),a.csrf(),Map.of("X-Forwarded-For",UUID.randomUUID().toString()),false).statusCode());
            List<Integer> statuses=new ArrayList<>();for(var result:pool.invokeAll(jobs))statuses.add(result.get());assertThat(statuses).containsExactlyInAnyOrder(200,429);
        }
        assertThat(call(a,"POST",BASE+"/import",body(UUID.randomUUID().toString(),1)).headers().firstValue("Retry-After")).contains("900");
        create(b,1);tree(call(a,"GET",BASE,null),200);
        jdbc.update("UPDATE trading.auth_rate_bucket SET window_start=window_start-1 WHERE bucket_key=?",bucket);create(a,1);
    }

    @Test void concurrentReadAndDuplicateDeleteNeverReturnPartialSnapshotOrDeleteAnotherDataset() throws Exception {
        var retained=create(b,2);
        for(int attempt=0;attempt<3;attempt++) {
            var dataset=create(a,25);var start=new CountDownLatch(1);
            try(var pool=Executors.newFixedThreadPool(3)) {
                var read=pool.submit(()->{start.await();return call(a,"GET",path(dataset)+"/candles?start=0&limit=25",null);});
                Callable<Integer> remove=()->{start.await();return call(a,"DELETE",path(dataset),Map.of("expectedDataHash",dataset.get("dataHash").asString())).statusCode();};
                var first=pool.submit(remove);var second=pool.submit(remove);start.countDown();
                assertThat(List.of(first.get(),second.get())).containsExactlyInAnyOrder(204,404);
                var response=read.get();assertThat(response.statusCode()).isIn(200,404);
                if(response.statusCode()==200) {
                    var snapshot=tree(response,200);assertThat(snapshot.get("total").asInt()).isEqualTo(25);
                    assertThat(snapshot.get("items").size()).isEqualTo(25);
                    assertThat(snapshot.get("items").get(24).get("ordinal").asInt()).isEqualTo(24);
                }
            }
            tree(call(a,"GET",path(dataset),null),404);
        }
        tree(call(b,"GET",path(retained),null),200);assertThat(count("market_candle")).isEqualTo(2);
    }

    @Test void maximumDatasetPersistsAllRowsAndReadDeleteThrottlesStayIndependent() throws Exception {
        var dataset=create(a,5000);
        assertThat(count("market_candle")).isEqualTo(5000);
        var last=tree(call(a,"GET",path(dataset)+"/candles?start=4500&limit=500",null),200);
        assertThat(last.get("items").size()).isEqualTo(500);
        assertThat(last.get("items").get(499).get("ordinal").asInt()).isEqualTo(4999);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=300 WHERE bucket_key=?",AuthRateLimiter.bucketKey("data-read",a.id().toString()));
        tree(call(a,"GET",BASE,null),429);tree(call(b,"GET",BASE,null),200);
        tree(call(a,"DELETE",path(dataset),Map.of("expectedDataHash","0".repeat(64))),409);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=30 WHERE bucket_key=?",AuthRateLimiter.bucketKey("data-delete",a.id().toString()));
        tree(call(a,"DELETE",path(dataset),Map.of("expectedDataHash",dataset.get("dataHash").asString())),429);
        assertThat(count("market_candle")).isEqualTo(5000);
        jdbc.update("UPDATE trading.auth_rate_bucket SET window_start=window_start-1 WHERE bucket_key=?",AuthRateLimiter.bucketKey("data-delete",a.id().toString()));
        assertThat(call(a,"DELETE",path(dataset),Map.of("expectedDataHash",dataset.get("dataHash").asString())).statusCode()).isEqualTo(204);
        assertThat(count("market_candle")).isZero();
    }
}
