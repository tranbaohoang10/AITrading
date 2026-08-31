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
class JournalApiTests {
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
        a=actor("journal-a@example.test");b=actor("journal-b@example.test");
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
    Map<String,Object> data() {
        var data=new HashMap<String,Object>();data.put("symbol","TEST_USD");data.put("timeframe","1h");data.put("settlementCurrency","USD");
        data.put("side","LONG");data.put("state","CLOSED");data.put("quantity","2");data.put("entryPrice","100");data.put("exitPrice","110");
        data.put("entryFee","1");data.put("exitFee","2");data.put("entryTime","2024-01-01T00:00:00Z");data.put("exitTime","2024-01-02T00:00:00Z");
        data.put("entryReason","  Confirmed neutral breakout\nManual observation  ");data.put("notes","Private note\tKhông phải khuyến nghị");data.put("datasetId",null);return data;
    }
    Map<String,Object> write(int version,Map<String,Object> data) {return new HashMap<>(Map.of("requestId",UUID.randomUUID().toString(),"expectedVersion",version,"entry",data));}
    JsonNode create(Actor actor,Map<String,Object> data)throws Exception {return tree(call(actor,"POST",BASE,write(0,data)),200).get("entry");}
    String path(JsonNode entry) {return BASE+"/"+entry.get("id").asString();}
    long count(String table) {return jdbc.queryForObject("SELECT count(*) FROM trading."+table,Long.class);}
    JsonNode totals(String query)throws Exception {return tree(call(a,"GET",BASE+"/summary"+query,null),200).get("totals");}

    @Test void ownedCrudAndOpenToClosedUseExactFinancialValuesAndVersionedDeletion()throws Exception {
        var data=data();data.put("state","OPEN");data.put("exitTime",null);data.put("exitPrice",null);data.put("exitFee","0");
        var first=create(a,data);assertThat(first.get("version").asInt()).isEqualTo(1);assertThat(first.get("netPnl").isNull()).isTrue();
        var open=totals(QUERY);assertThat(open.get("open").asInt()).isEqualTo(1);assertThat(open.get("fees").asString()).isEqualTo("0");
        var saved=tree(call(a,"POST",path(first),write(1,data())),200).get("entry");assertThat(saved.get("version").asInt()).isEqualTo(2);
        assertThat(saved.get("grossPnl").asString()).isEqualTo("20");assertThat(saved.get("netPnl").asString()).isEqualTo("17");
        assertThat(saved.get("data").get("entryReason").asString()).isEqualTo("Confirmed neutral breakout\nManual observation");
        assertThat(saved.get("data").get("notes").asString()).isEqualTo(data.get("notes"));
        assertThat(tree(call(a,"GET",path(first),null),200)).isEqualTo(saved);
        assertThat(tree(call(a,"GET",BASE+QUERY,null),200).get("items").get(0)).isEqualTo(saved);
        tree(call(a,"POST",path(first),write(1,data())),409);tree(call(a,"DELETE",path(first),Map.of("expectedVersion",1)),409);
        assertThat(call(a,"DELETE",path(first),Map.of("expectedVersion",2)).statusCode()).isEqualTo(204);tree(call(a,"GET",path(first),null),404);
        assertThat(count("journal_entry")).isZero();assertThat(count("journal_write")).isZero();
    }
    @Test void independentDecimalLongShortLossZeroAndUnitCalculationsNeverRoundOrMix()throws Exception {
        var small=data();small.put("quantity","0.3");small.put("entryPrice","0.1");small.put("exitPrice","0.2");small.put("entryFee","0.001");small.put("exitFee","0.002");
        assertThat(create(a,small).get("netPnl").asString()).isEqualTo("0.027");
        var shortTrade=data();shortTrade.put("side","SHORT");shortTrade.put("exitPrice","90");assertThat(create(a,shortTrade).get("netPnl").asString()).isEqualTo("17");
        var loss=data();loss.put("exitPrice","90");assertThat(create(a,loss).get("netPnl").asString()).isEqualTo("-23");
        var zero=data();zero.put("exitPrice","100");zero.put("entryFee","0");zero.put("exitFee","0");assertThat(create(a,zero).get("netPnl").asString()).isEqualTo("0");
        var feeLoss=data();feeLoss.put("exitPrice","100");assertThat(create(a,feeLoss).get("netPnl").asString()).isEqualTo("-3");
        var other=data();other.put("settlementCurrency","USDT");create(a,other);
        var sum=totals(QUERY);assertThat(sum.get("closed").asInt()).isEqualTo(5);assertThat(sum.get("wins").asInt()).isEqualTo(2);
        assertThat(sum.get("losses").asInt()).isEqualTo(2);assertThat(sum.get("breakeven").asInt()).isEqualTo(1);
        assertThat(sum.get("grossPnl").asString()).isEqualTo("0.03");assertThat(sum.get("fees").asString()).isEqualTo("9.003");assertThat(sum.get("netPnl").asString()).isEqualTo("-8.973");
        assertThat(totals(QUERY.replace("USD","USDT")).get("netPnl").asString()).isEqualTo("17");
        var huge=data();huge.put("quantity","1000000000000");huge.put("entryPrice","0.00000001");huge.put("exitPrice","1000000000000");huge.put("entryFee","0");huge.put("exitFee","0");
        assertThat(create(a,huge).get("netPnl").asString()).isEqualTo("999999999999999999990000");
    }
    @Test void localDayBoundariesLeapYearAndDstUseExitForClosedAndEntryForOpen()throws Exception {
        for(String instant:List.of("2024-03-10T04:59:59.999Z","2024-03-10T05:00:00Z","2024-03-11T03:59:59.999Z","2024-03-11T04:00:00Z")) {
            var data=data();data.put("exitTime",instant);create(a,data);
        }
        String spring="?from=2024-03-10&to=2024-03-10&zone=America/New_York&currency=USD";
        assertThat(totals(spring).get("closed").asInt()).isEqualTo(2);
        assertThat(tree(call(a,"GET",BASE+spring,null),200).get("items").size()).isEqualTo(2);
        for(String instant:List.of("2024-11-03T04:00:00Z","2024-11-04T04:59:59.999Z","2024-11-04T05:00:00Z")) {
            var data=data();data.put("exitTime",instant);create(a,data);
        }
        assertThat(totals(spring.replace("2024-03-10","2024-11-03")).get("closed").asInt()).isEqualTo(2);
        var midnight=data();midnight.put("exitTime","2024-02-29T17:00:00Z");create(a,midnight);
        String local="?from=2024-02-29&to=2024-03-01&zone=Asia/Ho_Chi_Minh&currency=USD";
        var days=tree(call(a,"GET",BASE+"/summary"+local,null),200).get("days");assertThat(days.size()).isEqualTo(2);
        assertThat(days.get(0).get("values").get("closed").asInt()).isZero();assertThat(days.get(1).get("values").get("netPnl").asString()).isEqualTo("17");
        var year=data();year.put("entryTime","2023-12-31T23:59:59Z");year.put("exitTime","2024-01-01T00:00:00Z");create(a,year);
        assertThat(totals("?from=2023-12-31&to=2023-12-31&zone=UTC&currency=USD").get("closed").asInt()).isZero();
        assertThat(totals(QUERY).get("closed").asInt()).isEqualTo(1);
        assertThat(tree(call(a,"GET",BASE+"/summary?from=2024-01-01&to=2024-12-31&zone=UTC&currency=USD",null),200).get("days").size()).isEqualTo(366);
    }
    @Test void reportRangesAndCursorsAreBoundedAndBoundToFilterWithStableTieOrdering()throws Exception {
        create(a,data());create(a,data());create(a,data());
        var page=tree(call(a,"GET",BASE+QUERY+"&limit=1",null),200);String firstCursor=page.get("nextCursor").asString();
        var ids=new HashSet<String>();ids.add(page.get("items").get(0).get("id").asString());
        while(!page.get("nextCursor").isNull()) {page=tree(call(a,"GET",BASE+QUERY+"&limit=1&cursor="+page.get("nextCursor").asString(),null),200);assertThat(ids.add(page.get("items").get(0).get("id").asString())).isTrue();}
        assertThat(ids).hasSize(3);
        tree(call(a,"GET",BASE+QUERY.replace("USD","EUR")+"&cursor="+firstCursor,null),400);
        for(String query:List.of(QUERY+"&limit=0",QUERY+"&limit=51",QUERY+"&cursor=bad",QUERY+"&cursor="+"x".repeat(257),
                QUERY.replace("2024-01-31","2023-12-31"),QUERY.replace("2024-01-31","2025-01-01"),QUERY.replace("UTC","Invalid/Zone"),
                QUERY.replace("UTC","%2B07:00"),QUERY.replace("USD","usd"),QUERY.replace("2024-01-31","2024-02-30"),QUERY.replace("2024-01-01","1999-01-01")))tree(call(a,"GET",BASE+query,null),400);
    }
    @Test void strictAmountsStatesTimesAndNullsAreRejectedWithoutPartialWrites()throws Exception {
        for(String field:List.of("quantity","entryPrice","exitPrice","entryFee","exitFee")) {
            for(Object invalid:Arrays.asList(null,1,"-1","1e2","NaN","Infinity","01","0.000000001","1000000000000.00000001")) {
                var data=data();data.put(field,invalid);tree(call(a,"POST",BASE,write(0,data)),400);
            }
        }
        jdbc.update("DELETE FROM trading.auth_rate_bucket");
        for(String field:List.of("quantity","entryPrice","exitPrice")) {var data=data();data.put(field,"0");tree(call(a,"POST",BASE,write(0,data)),400);}
        for(String instant:List.of("1999-12-31T23:59:59Z","2101-01-01T00:00:00Z","2024-02-30T00:00:00Z","2024-01-01T24:00:00Z",
                "2024-01-01T00:00:60Z","2024-01-01T00:00:00.0001Z","2024-01-01T00:00:00+00:00",Instant.now().plusSeconds(100).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString())) {
            var data=data();data.put("exitTime",instant);tree(call(a,"POST",BASE,write(0,data)),400);
        }
        for(String field:List.of("state","side","timeframe","symbol","settlementCurrency","entryTime","entryReason")) {var data=data();data.put(field,null);tree(call(a,"POST",BASE,write(0,data)),400);}
        var reversed=data();reversed.put("entryTime","2024-01-03T00:00:00Z");tree(call(a,"POST",BASE,write(0,reversed)),400);
        var open=data();open.put("state","OPEN");tree(call(a,"POST",BASE,write(0,open)),400);open.put("exitPrice",null);open.put("exitTime",null);tree(call(a,"POST",BASE,write(0,open)),400);
        var missing=write(0,data());missing.put("entry",null);tree(call(a,"POST",BASE,missing),400);
        assertThat(count("journal_entry")).isZero();assertThat(count("journal_write")).isZero();
    }
    @Test void unicodeTextByteLimitsAndUnknownFieldsCannotBecomeExecutableOrMassAssigned()throws Exception {
        var exact=data();exact.put("entryReason","é".repeat(1000));exact.put("notes","é".repeat(2000));create(a,exact);
        for(String reason:List.of(""," \n\t ","é".repeat(1001),"x".repeat(2001),"\0","\u0001","\uD800")) {
            var data=data();data.put("entryReason",reason);tree(call(a,"POST",BASE,write(0,data)),400);
        }
        var longNote=data();longNote.put("notes","é".repeat(2001));tree(call(a,"POST",BASE,write(0,longNote)),400);
        for(String key:List.of("ownerId","netPnl","role","version")) {var data=data();data.put(key,"forged");tree(call(a,"POST",BASE,write(0,data)),400);}
        var forged=write(0,data());forged.put("ownerId",b.id());tree(call(a,"POST",BASE,forged),400);
        String hostile="<script>fixture()</script> '; DROP TABLE journal_entry; -- ../../file https://internal.invalid";
        var inert=data();inert.put("entryReason",hostile);assertThat(create(a,inert).get("data").get("entryReason").asString()).isEqualTo(hostile);
        assertThat(count("app_user")).isEqualTo(2);assertThat(count("journal_entry")).isEqualTo(2);
    }
    @Test void authenticationOwnershipRevocationCsrfOriginAndBodyBoundsProtectEveryRoute()throws Exception {
        var first=create(a,data());var anonymous=new Actor(HttpClient.newHttpClient(),null,null);
        for(String url:List.of(BASE+QUERY,BASE+"/summary"+QUERY,path(first)))tree(call(anonymous,"GET",url,null),401);
        for(String url:List.of(path(first),BASE+"/"+UUID.randomUUID())) {
            for(var response:List.of(call(b,"GET",url,null),call(b,"POST",url,write(1,data())),call(b,"DELETE",url,Map.of("expectedVersion",1)))) {
                tree(response,404);assertThat(response.body()).doesNotContain("Private note",a.id().toString(),"Confirmed neutral");
            }
        }
        assertThat(tree(call(b,"GET",BASE+QUERY,null),200).get("items").isEmpty()).isTrue();
        assertThat(tree(call(b,"GET",BASE+"/summary"+QUERY,null),200).get("totals").get("closed").asInt()).isZero();
        byte[] input=json.writeValueAsBytes(write(0,data()));
        tree(send(a,"POST",BASE,input,null,Map.of(),false),403);tree(send(a,"POST",BASE,input,b.csrf(),Map.of(),false),403);
        tree(send(a,"POST",BASE,input,a.csrf(),Map.of("Origin","https://hostile.invalid"),false),403);
        byte[] exact=Arrays.copyOf(input,16384);Arrays.fill(exact,input.length,exact.length,(byte)' ');tree(send(a,"POST",BASE,exact,a.csrf(),Map.of(),true),200);
        byte[] larger=Arrays.copyOf(exact,16385);larger[16384]=' ';tree(send(a,"POST",BASE,larger,a.csrf(),Map.of(),true),413);tree(send(a,"POST",BASE,larger,a.csrf(),Map.of(),false),413);
        String duplicate=new String(input,StandardCharsets.UTF_8).replace("\"expectedVersion\":","\"expectedVersion\":0,\"expectedVersion\":");tree(send(a,"POST",BASE,duplicate.getBytes(StandardCharsets.UTF_8),a.csrf(),Map.of(),false),400);
        var stale=(UserPrincipal)users.loadUserByUsername("journal-a@example.test");jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
        UUID id=UUID.fromString(first.get("id").asString());var range=JournalService.range("2024-01-01","2024-01-31","UTC","USD");
        assertThatThrownBy(()->journal.get(stale,id)).isInstanceOf(BadCredentialsException.class);
        assertThatThrownBy(()->journal.summary(stale,range)).isInstanceOf(BadCredentialsException.class);
        assertThatThrownBy(()->journal.list(stale,range,20,null)).isInstanceOf(BadCredentialsException.class);
        tree(call(a,"GET",path(first),null),401);
    }
    @Test void sameIntentReplayReturnsCurrentVersionAndChangedIntentOrStaleWriteConflicts()throws Exception {
        var initial=write(0,data());var first=tree(call(a,"POST",BASE,initial),200).get("entry");
        var changed=data();changed.put("notes","Later note");var edit=write(1,changed);var second=tree(call(a,"POST",path(first),edit),200).get("entry");
        var replay=tree(call(a,"POST",BASE,initial),200);assertThat(replay.get("appliedVersion").asInt()).isEqualTo(1);assertThat(replay.get("entry")).isEqualTo(second);
        assertThat(tree(call(a,"POST",path(first),edit),200).get("entry")).isEqualTo(second);
        initial.put("entry",changed);tree(call(a,"POST",BASE,initial),409);edit.put("entry",data());tree(call(a,"POST",path(first),edit),409);
        tree(call(a,"POST",path(first),write(1,data())),409);tree(call(b,"POST",BASE,initial),200);
        assertThat(count("journal_entry")).isEqualTo(2);assertThat(count("journal_write")).isEqualTo(3);
    }
    @Test void staleWorkspaceCannotWriteItsDraftIntoAnotherTabsNewSession()throws Exception {
        var first=create(b,data());byte[] create=json.writeValueAsBytes(write(0,data()));
        for(String wrong:List.of(a.id().toString(),"",UUID.randomUUID().toString())) {
            tree(send(b,"POST",BASE,create,b.csrf(),Map.of("X-Workspace-User",wrong),false),401);
            tree(send(b,"POST",path(first),json.writeValueAsBytes(write(1,data())),b.csrf(),Map.of("X-Workspace-User",wrong),false),401);
            tree(send(b,"DELETE",path(first),json.writeValueAsBytes(Map.of("expectedVersion",1)),b.csrf(),Map.of("X-Workspace-User",wrong),false),401);
        }
        tree(send(new Actor(b.client(),b.csrf(),null),"POST",BASE,create,b.csrf(),Map.of(),false),401);
        assertThat(count("journal_entry")).isEqualTo(1);assertThat(count("journal_write")).isEqualTo(1);
        assertThat(tree(call(b,"GET",path(first),null),200)).isEqualTo(first);
    }
    @Test void concurrentCreatesUpdatesAndDeletesCannotDuplicateOrLoseAcceptedWrites()throws Exception {
        var same=write(0,data());JsonNode first;
        try(var pool=Executors.newFixedThreadPool(3)) {
            Callable<JsonNode> create=()->tree(call(a,"POST",BASE,same),200);
            var creates=pool.invokeAll(List.of(create,create));assertThat(creates.get(0).get()).isEqualTo(creates.get(1).get());first=creates.get(0).get().get("entry");
            var edit=write(1,data());Callable<JsonNode> update=()->tree(call(a,"POST",path(first),edit),200);
            var updates=pool.invokeAll(List.of(update,update));assertThat(updates.get(0).get()).isEqualTo(updates.get(1).get());
            Callable<Integer> different=()->call(a,"POST",path(first),write(2,data())).statusCode();
            var statuses=new ArrayList<Integer>();for(var result:pool.invokeAll(List.of(different,different)))statuses.add(result.get());assertThat(statuses).containsExactlyInAnyOrder(200,409);
            var start=new CountDownLatch(1);
            var read=pool.submit(()->{start.await();return call(a,"GET",path(first),null).statusCode();});
            var save=pool.submit(()->{start.await();return call(a,"POST",path(first),write(3,data())).statusCode();});
            var delete=pool.submit(()->{start.await();return call(a,"DELETE",path(first),Map.of("expectedVersion",3)).statusCode();});start.countDown();
            int s=save.get(),d=delete.get();assertThat((s==200&&d==409)||(s==404&&d==204)).isTrue();assertThat(read.get()).isIn(200,404);
        }
        assertThat(count("journal_entry")).isLessThanOrEqualTo(1);assertThat(count("journal_write")).isIn(0L,4L);
    }
    JsonNode dataset(Actor actor)throws Exception {
        var input=Map.of("requestId",UUID.randomUUID().toString(),"name","Journal candles","symbol","TEST_USD","timeframe","1h",
                "sourceKind","SYNTHETIC","sourceLabel","Manual test source","csv","timestamp,open,high,low,close,volume\n2024-01-01T00:00:00Z,100,110,90,105,1\n");
        return tree(call(actor,"POST","/api/datasets/import",input),200);
    }
    @Test void sourceMustBeOwnedAndMatchButDeletionPreservesTradeAndReplay()throws Exception {
        var source=dataset(a);var data=data();data.put("datasetId",source.get("id").asString());
        tree(call(b,"POST",BASE,write(0,data)),404);
        var mismatch=new HashMap<>(data);mismatch.put("symbol","OTHER");tree(call(a,"POST",BASE,write(0,mismatch)),404);
        mismatch.put("symbol","TEST_USD");mismatch.put("timeframe","1d");tree(call(a,"POST",BASE,write(0,mismatch)),404);
        var initial=write(0,data);var first=tree(call(a,"POST",BASE,initial),200).get("entry");
        assertThat(call(a,"DELETE","/api/datasets/"+source.get("id").asString(),Map.of("expectedDataHash",source.get("dataHash").asString())).statusCode()).isEqualTo(204);
        assertThat(tree(call(a,"GET",path(first),null),200)).isEqualTo(first);assertThat(tree(call(a,"POST",BASE,initial),200).get("entry")).isEqualTo(first);
        tree(call(a,"POST",path(first),write(1,data)),404);data.put("datasetId",null);tree(call(a,"POST",path(first),write(1,data)),200);
        assertThat(totals(QUERY).get("netPnl").asString()).isEqualTo("17");
    }
    @Test void databaseFailureRollsBackDataAndDedupLedgerAndAccountDeletionCascades()throws Exception {
        var first=create(a,data());create(b,data());
        jdbc.execute("CREATE FUNCTION trading.reject_journal_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private fixture rejection'; END $$");
        jdbc.execute("CREATE TRIGGER reject_journal_fixture BEFORE INSERT ON trading.journal_write FOR EACH ROW EXECUTE FUNCTION trading.reject_journal_fixture()");
        var edit=write(1,data());
        try {
            for(var response:List.of(call(a,"POST",BASE,write(0,data())),call(a,"POST",path(first),edit))) {
                tree(response,503);assertThat(response.body()).doesNotContain("private fixture rejection","INSERT","Exception");
            }
        } finally {jdbc.execute("DROP TRIGGER reject_journal_fixture ON trading.journal_write");jdbc.execute("DROP FUNCTION trading.reject_journal_fixture()");}
        assertThat(count("journal_entry")).isEqualTo(2);assertThat(count("journal_write")).isEqualTo(2);
        assertThat(tree(call(a,"GET",path(first),null),200)).isEqualTo(first);tree(call(a,"POST",path(first),edit),200);
        jdbc.update("DELETE FROM trading.app_user WHERE id=?",a.id());assertThat(count("journal_entry")).isEqualTo(1);assertThat(count("journal_write")).isEqualTo(1);
    }
    @Test void accountAndVersionQuotasRemainAtomicAndReplayResolvesAtLimit()throws Exception {
        var initial=write(0,data());var first=tree(call(a,"POST",BASE,initial),200).get("entry");UUID id=UUID.fromString(first.get("id").asString());
        jdbc.update("""
                INSERT INTO trading.journal_entry(id,owner_id,version,symbol,timeframe,settlement_currency,side,state,quantity,entry_price,exit_price,entry_fee,exit_fee,entry_time,exit_time,entry_reason,notes)
                SELECT gen_random_uuid(),owner_id,1,symbol,timeframe,settlement_currency,side,state,quantity,entry_price,exit_price,entry_fee,exit_fee,entry_time,exit_time,entry_reason,notes
                FROM trading.journal_entry CROSS JOIN generate_series(1,498) WHERE id=?
                """,id);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> create=()->call(a,"POST",BASE,write(0,data())).statusCode();var statuses=new ArrayList<Integer>();
            for(var result:pool.invokeAll(List.of(create,create)))statuses.add(result.get());assertThat(statuses).containsExactlyInAnyOrder(200,409);
        }
        assertThat(count("journal_entry")).isEqualTo(500);tree(call(a,"POST",BASE,initial),200);
        jdbc.update("INSERT INTO trading.journal_write(owner_id,request_id,entry_id,request_hash,applied_version) SELECT owner_id,gen_random_uuid(),entry_id,request_hash,n FROM trading.journal_write CROSS JOIN generate_series(2,99) n WHERE entry_id=? AND applied_version=1",id);
        jdbc.update("UPDATE trading.journal_entry SET version=99 WHERE id=?",id);
        var last=write(99,data());tree(call(a,"POST",path(first),last),200);tree(call(a,"POST",path(first),write(100,data())),409);
        tree(call(a,"POST",path(first),last),200);assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.journal_write WHERE entry_id=?",Long.class,id)).isEqualTo(100);
    }
    @Test void independentReadWriteRateLimitsHaveAtomicBoundariesAndRecover()throws Exception {
        create(a,data());tree(call(a,"GET",BASE+QUERY,null),200);
        String writeBucket=AuthRateLimiter.bucketKey("journal-write",a.id().toString());jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=59 WHERE bucket_key=?",writeBucket);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> create=()->call(a,"POST",BASE,write(0,data())).statusCode();var statuses=new ArrayList<Integer>();
            for(var result:pool.invokeAll(List.of(create,create)))statuses.add(result.get());assertThat(statuses).containsExactlyInAnyOrder(200,429);
        }
        tree(call(a,"GET",BASE+QUERY,null),200);create(b,data());
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=300 WHERE bucket_key=?",AuthRateLimiter.bucketKey("journal-read",a.id().toString()));
        var limited=call(a,"GET",BASE+"/summary"+QUERY,null);tree(limited,429);assertThat(limited.headers().firstValue("Retry-After")).contains("900");
        tree(call(b,"GET",BASE+QUERY,null),200);jdbc.update("UPDATE trading.auth_rate_bucket SET window_start=window_start-1 WHERE bucket_key=?",writeBucket);create(a,data());
    }
}
