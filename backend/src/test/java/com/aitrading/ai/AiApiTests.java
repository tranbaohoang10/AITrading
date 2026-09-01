package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import com.aitrading.chat.ConversationService;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties="spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
@Import(AiApiTests.TestProvider.class)
class AiApiTests {
    @TestConfiguration(proxyBeanMethods=false)
    static class TestProvider {
        @Bean @Primary ProbeProvider probe() throws Exception{return new ProbeProvider();}
    }
    static class ProbeProvider implements AiProvider,AutoCloseable {
        final JsonMapper json=JsonMapper.builder().build();
        final AtomicInteger calls=new AtomicInteger();
        final AtomicBoolean configured=new AtomicBoolean(true);
        final AtomicBoolean gemini=new AtomicBoolean(false);
        final List<JsonNode> requests=Collections.synchronizedList(new ArrayList<>());
        final AtomicReference<CountDownLatch> gate=new AtomicReference<>(new CountDownLatch(0));
        final AtomicReference<CountDownLatch> seen=new AtomicReference<>(new CountDownLatch(1));
        final AtomicReference<String> mode=new AtomicReference<>("answer");
        final HttpServer server;
        final ExecutorService executor=Executors.newVirtualThreadPerTaskExecutor();
        final OpenAiProvider delegate;
        final GeminiProvider geminiDelegate;
        ProbeProvider() throws Exception {
            server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.setExecutor(executor);
            server.createContext("/",exchange->{
                calls.incrementAndGet();requests.add(json.readTree(exchange.getRequestBody().readAllBytes()));seen.get().countDown();
                try {
                    gate.get().await(8,TimeUnit.SECONDS);
                    Map<String,Object> content=mode.get().equals("refusal")?Map.of("type","refusal","refusal","Synthetic refusal"):
                            Map.of("type","output_text","text",json.writeValueAsString(new AiAnswer("answer","Synthetic provider response <script>inert</script>",List.of("Local HTTP fixture only"))));
                    byte[] bytes=json.writeValueAsBytes(Map.of("status","completed","output",List.of(Map.of("type","message","role","assistant","status","completed","content",List.of(content)))));
                    if(exchange.getRequestURI().getPath().endsWith(":generateContent")) {
                        bytes=json.writeValueAsBytes(mode.get().equals("refusal")?Map.of("promptFeedback",Map.of("blockReason","SAFETY")):
                                Map.of("candidates",List.of(Map.of("finishReason","STOP","content",Map.of("role","model","parts",List.of(Map.of("text",content.get("text"))))))));
                    }
                    exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);
                }catch(InterruptedException interrupted){Thread.currentThread().interrupt();}catch(java.io.IOException cancelled){}
                finally{exchange.close();}
            });server.start();
            delegate=new OpenAiProvider(true,"synthetic-project-test-key-not-real","configured-test-model",URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/responses"),Duration.ofSeconds(5));
            geminiDelegate=new GeminiProvider(true,"synthetic-gemini-test-key-not-real","gemini-3.5-flash",URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/v1beta/models/gemini-3.5-flash:generateContent"),Duration.ofSeconds(5));
        }
        @Override public Configuration configuration(){return new Configuration(configured.get(),gemini.get()?"gemini":"openai",configured.get()?(gemini.get()?"gemini-3.5-flash":"configured-test-model"):null);}
        @Override public AiAnswer answer(List<ContextMessage> context){return (gemini.get()?geminiDelegate:delegate).answer(context);}
        @Override public AiProposal propose(List<ContextMessage> context) {
            calls.incrementAndGet();requests.add(json.valueToTree(context));seen.get().countDown();
            try{gate.get().await(8,TimeUnit.SECONDS);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new AiFailure(AiFailure.Code.AI_CANCELLED);}
            return switch(mode.get()) {
                case "clarification" -> new AiProposal("clarification","More measurable rules are required.",List.of(),List.of("What is the explicit risk size?"),null);
                case "invalid-proposal" -> new AiProposal("proposal","Synthetic invalid fixture.",List.of(),List.of(),"{}");
                case "rate" -> throw new AiFailure(AiFailure.Code.AI_RATE_LIMITED);
                case "unavailable" -> throw new AiFailure(AiFailure.Code.AI_PROVIDER_UNAVAILABLE);
                default -> new AiProposal("proposal","Synthetic validated proposal; no execution.",List.of("Synthetic fixture"),List.of(),fixture());
            };
        }
        @Override public AiJournalEvaluation evaluateJournal(List<ContextMessage> context) {
            calls.incrementAndGet();requests.add(json.valueToTree(context));seen.get().countDown();
            try{gate.get().await(8,TimeUnit.SECONDS);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new AiFailure(AiFailure.Code.AI_CANCELLED);}
            if(mode.get().equals("rate"))throw new AiFailure(AiFailure.Code.AI_RATE_LIMITED);
            if(mode.get().equals("malformed-evidence"))return evaluation("not present in reason");
            if(mode.get().equals("insufficient"))return new AiJournalEvaluation("insufficient","More evidence is required.",List.of(),List.of(),List.of("Record a measurable trigger."),List.of("Which closed-bar trigger supported entry?"),"Research feedback only; not financial advice or a profitability guarantee.");
            return evaluation("closed candle breakout");
        }
        @Override public AiImageAnalysis analyzeImage(ImageRequest image){
            calls.incrementAndGet();requests.add(json.valueToTree(Map.of("question",image.question(),"bytes",image.pngBytes().length)));seen.get().countDown();
            try{gate.get().await(8,TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new AiFailure(AiFailure.Code.AI_CANCELLED);}
            if(mode.get().equals("rate"))throw new AiFailure(AiFailure.Code.AI_RATE_LIMITED);if(mode.get().equals("refusal"))throw new AiFailure(AiFailure.Code.AI_REFUSED);
            if(mode.get().equals("invalid-image"))return new AiImageAnalysis(List.of(),List.of(),List.of(new AiImageAnalysis.Inference("unsupported",List.of())),List.of(),.5,List.of("Synthetic limitation"));
            return new AiImageAnalysis(List.of(new AiImageAnalysis.Evidence("E1","Synthetic green candles rise","center")),List.of("SYNTHETIC"),List.of(new AiImageAnalysis.Inference("Visible upward sequence",List.of("E1"))),List.of("No timeframe or live feed"),.75,List.of("One static synthetic image only; not financial advice."));
        }
        private AiJournalEvaluation evaluation(String evidence){return new AiJournalEvaluation("evaluation","The saved reason is measurable but can define risk better.",List.of(
                new AiJournalEvaluation.Item("specificity",20,evidence,"Name the exact threshold."),new AiJournalEvaluation.Item("evidence",18,evidence,"Record the observed value."),
                new AiJournalEvaluation.Item("risk",8,evidence,"Add risk size."),new AiJournalEvaluation.Item("invalidation",7,evidence,"Add invalidation.")),List.of("Uses a closed candle."),List.of("Define risk and invalidation."),List.of(),"Research feedback only; not financial advice or a profitability guarantee.");}
        private String fixture() {
            try(var input=ProbeProvider.class.getResourceAsStream("/dsl/indicator-trend.json")){return new String(Objects.requireNonNull(input).readAllBytes(),StandardCharsets.UTF_8);}
            catch(java.io.IOException impossible){throw new IllegalStateException("Fixture unavailable");}
        }
        List<String> capturedContext(int index) {
            JsonNode request=requests.get(index);var result=new ArrayList<String>();
            if(request.isArray())for(var item:request)result.add(item.get("content").asString());
            else if(request.has("input"))for(var item:request.get("input"))result.add(item.get("content").asString());
            else for(var item:request.get("contents"))result.add(item.get("parts").get(0).get("text").asString());
            return result;
        }
        void reset(){gate.get().countDown();gate.set(new CountDownLatch(0));seen.set(new CountDownLatch(1));calls.set(0);requests.clear();configured.set(true);mode.set("answer");}
        void block(int expected){gate.set(new CountDownLatch(1));seen.set(new CountDownLatch(expected));}
        void await() throws Exception{assertThat(seen.get().await(4,TimeUnit.SECONDS)).isTrue();}
        @Override public void close(){gate.get().countDown();delegate.shutdown();geminiDelegate.close();server.stop(0);executor.shutdownNow();}
    }
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired ConversationService conversations;
    @Autowired AiTurnStore turns;
    @Autowired AiService ai;
    @Autowired ProbeProvider probe;
    @Autowired AuthRateLimiter limiter;
    final JsonMapper json=JsonMapper.builder().build();
    record Actor(HttpClient client,String csrf,UUID id,String email) { }
    Actor a,b;
    boolean useGemini(){return false;}
    @BeforeAll static void ownedDatabase(){
        assertThat(System.getenv("AITRADING_TEST_CLUSTER")).isNotBlank();
        assertThat(Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize().startsWith(Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }
    @BeforeEach void setup() throws Exception {
        probe.reset();probe.gemini.set(useGemini());jdbc.update("DELETE FROM trading.spring_session");jdbc.update("DELETE FROM trading.auth_rate_bucket");jdbc.update("DELETE FROM trading.app_user");
        a=actor("ai-a@example.test");b=actor("ai-b@example.test");
    }
    @AfterEach void release(){probe.gate.get().countDown();}
    Actor actor(String email) throws Exception {
        String password="Synthetic AI fixture password!";auth.register(email,"Researcher",password);
        var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).connectTimeout(Duration.ofSeconds(3)).build();
        Actor anon=new Actor(client,null,null,email);
        String token=tree(send(anon,"GET","/api/auth/csrf","",null,Map.of()),200).get("token").asString();
        assertThat(send(anon,"POST","/api/auth/login","email="+URLEncoder.encode(email,StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8),token,
                Map.of("Content-Type","application/x-www-form-urlencoded")).statusCode()).isEqualTo(204);
        String csrf=tree(send(anon,"GET","/api/auth/csrf","",null,Map.of()),200).get("token").asString();
        return new Actor(client,csrf,UUID.fromString(tree(send(anon,"GET","/api/auth/me","",null,Map.of()),200).get("id").asString()),email);
    }
    UserPrincipal user(Actor actor){return (UserPrincipal)users.loadUserByUsername(actor.email());}
    HttpResponse<String> send(Actor actor,String method,String path,String body,String csrf,Map<String,String> headers) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(12));
        if(actor.id()!=null && !headers.containsKey("X-Workspace-User")) builder.header("X-Workspace-User",actor.id().toString());
        builder.header("Content-Type",headers.getOrDefault("Content-Type","application/json"));
        headers.forEach((k,v)->{if(!k.equals("Content-Type"))builder.header(k,v);});if(csrf!=null)builder.header("X-CSRF-TOKEN",csrf);
        return actor.client().send(builder.method(method,HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> call(Actor actor,String method,String path,Object body) throws Exception{return send(actor,method,path,body==null?"":json.writeValueAsString(body),actor.csrf(),Map.of());}
    JsonNode tree(HttpResponse<String> response,int code){assertThat(response.statusCode()).as(response.body()).isEqualTo(code);return json.readTree(response.body());}
    UUID conversation(Actor actor,String text){var c=conversations.create(user(actor),UUID.randomUUID());conversations.append(user(actor),c.id(),UUID.randomUUID(),text);return c.id();}
    String path(UUID id){return "/api/conversations/"+id+"/ai-turns";}
    Map<String,Object> body(UUID request,long version,long sequence){return new HashMap<>(Map.of("requestId",request.toString(),"expectedVersion",version,"sourceSequence",sequence));}
    long assistants(UUID id){return jdbc.queryForObject("SELECT count(*) FROM trading.conversation_message WHERE conversation_id=? AND role='assistant'",Long.class,id);}
    void expire(UUID id){jdbc.update("UPDATE trading.ai_turn SET expires_at=clock_timestamp()-interval '1 second' WHERE conversation_id=? AND state='PENDING'",id);}

    @Test void realHttpAndDatabasePersistOwnedAssistantAndContextWithoutSecretExposure() throws Exception {
        UUID id=conversation(a,"Private A context"),other=conversation(b,"Private B must not leak"),request=UUID.randomUUID();
        JsonNode turn=tree(call(a,"POST",path(id),body(request,2,1)),200);
        assertThat(turn.get("state").asString()).isEqualTo("SUCCEEDED");assertThat(turn.get("assistantSequence").asLong()).isEqualTo(2);
        assertThat(turn.get("contextCount").asInt()).isEqualTo(1);
        // Independent SHA256 of UTF-8 [[1,"user","Private A context"]].
        assertThat(turn.get("contextHash").asString()).isEqualTo("a7badaa9a09949b5015bc54573ecb4b43a2c6fde31ea311bb0e6071a2adeba7b");
        var history=conversations.messages(user(a),id,50,null);
        assertThat(history.items()).hasSize(2);assertThat(history.items().getLast().role()).isEqualTo("assistant");
        assertThat(history.items().getLast().content()).contains("Synthetic provider response","<script>inert</script>","Assumptions:");
        assertThat(history.conversation().version()).isEqualTo(3);assertThat(assistants(other)).isZero();
        assertThat(probe.requests.getFirst().toString()).contains("Private A context").doesNotContain("Private B",a.email(),b.email());
        assertThat(call(a,"GET",path(id)+"/"+request,null).body()).doesNotContain("synthetic-project-test-key","Private A context","responseJson");
        assertThat(jdbc.queryForObject("SELECT response_json FROM trading.ai_turn WHERE conversation_id=?",String.class,id)).contains("\"kind\":\"answer\"");
    }
    @Test void ownerAuthenticationCsrfAndMassAssignmentDenyBeforeProvider() throws Exception {
        UUID id=conversation(a,"A"),request=UUID.randomUUID();String route=path(id);var payload=body(request,2,1);
        tree(call(b,"POST",route,payload),404);tree(call(b,"GET",route,null),404);tree(call(b,"GET",route+"/"+request,null),404);tree(call(b,"POST",route+"/"+request+"/cancel",Map.of()),404);
        var anonymous=new Actor(HttpClient.newHttpClient(),null,null,"");tree(call(anonymous,"GET","/api/ai/capabilities",null),401);
        assertThat(send(a,"POST",route,json.writeValueAsString(payload),null,Map.of()).statusCode()).isEqualTo(403);
        assertThat(send(a,"POST",route,json.writeValueAsString(payload),a.csrf(),Map.of("Origin","https://untrusted.invalid")).statusCode()).isEqualTo(403);
        for(String key:List.of("ownerId","model","endpoint","tools","role","content","provider","GEMINI_API_KEY")) {
            var invalid=body(request,2,1);invalid.put(key,"untrusted");tree(call(a,"POST",route,invalid),400);
        }
        assertThat(probe.calls.get()).isZero();
    }
    @Test void malformedRequestsAndCancelQuotaFailBeforeProvider() throws Exception {
        UUID id=conversation(a,"A"),request=UUID.randomUUID();String route=path(id);
        for(String invalid:List.of("{}","null","[]",
                "{\"requestId\":\""+request+"\",\"expectedVersion\":2,\"sourceSequence\":0}",
                "{\"requestId\":\""+request+"\",\"expectedVersion\":2,\"sourceSequence\":1,\"sourceSequence\":1}",
                "{\"requestId\":\"invalid\",\"expectedVersion\":2,\"sourceSequence\":1}"))
            tree(send(a,"POST",route,invalid,a.csrf(),Map.of()),400);
        tree(send(a,"POST",route," ".repeat(16385),a.csrf(),Map.of()),413);
        turns.reserve(user(a),id,request,2L,1L,probe.configuration());
        tree(call(a,"POST",route+"/"+request+"/cancel",Map.of("state","SUCCEEDED")),400);
        limiter.allow("ai-cancel",a.id().toString(),30);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=30 WHERE bucket_key=?",AuthRateLimiter.bucketKey("ai-cancel",a.id().toString()));
        tree(call(a,"POST",route+"/"+request+"/cancel",Map.of()),429);
        assertThat(turns.get(user(a),id,request).state()).isEqualTo("PENDING");
        expire(id);
        assertThat(turns.finish(user(a),id,request,new AiAnswer("answer","Late result",List.of()),null).errorCode()).isEqualTo("AI_EXPIRED");
        assertThat(assistants(id)).isZero();assertThat(probe.calls.get()).isZero();
    }
    @Test void sameRequestReplaysWhilePendingAndAfterSuccessWithoutDuplicateProviderOrMessage() throws Exception {
        UUID id=conversation(a,"A"),request=UUID.randomUUID();var payload=body(request,2,1);probe.block(1);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var first=pool.submit(()->call(a,"POST",path(id),payload));probe.await();
            assertThat(tree(call(a,"POST",path(id),payload),200).get("state").asString()).isEqualTo("PENDING");
            tree(call(a,"POST",path(id),body(UUID.randomUUID(),2,1)),409);
            probe.gate.get().countDown();assertThat(tree(first.get(8,TimeUnit.SECONDS),200).get("state").asString()).isEqualTo("SUCCEEDED");
        }
        probe.configured.set(false);
        assertThat(tree(call(a,"POST",path(id),payload),200).get("state").asString()).isEqualTo("SUCCEEDED");
        tree(call(a,"POST",path(id),body(request,3,1)),409);
        assertThat(probe.calls.get()).isEqualTo(1);assertThat(assistants(id)).isEqualTo(1);
    }
    @Test void latestUserVersionAndContextWindowsAreExactAndBounded() throws Exception {
        UUID id=conversation(a,"old-1");
        for(int i=2;i<=25;i++)conversations.append(user(a),id,UUID.randomUUID(),"message-"+i);
        tree(call(a,"POST",path(id),body(UUID.randomUUID(),25,25)),409);
        var turn=tree(call(a,"POST",path(id),body(UUID.randomUUID(),26,25)),200);
        assertThat(turn.get("contextStart").asLong()).isEqualTo(6);assertThat(turn.get("contextEnd").asLong()).isEqualTo(25);assertThat(turn.get("contextCount").asInt()).isEqualTo(20);
        assertThat(probe.capturedContext(0).getFirst()).isEqualTo("message-6");
        tree(call(a,"POST",path(id),body(UUID.randomUUID(),27,26)),409);
        UUID large=conversation(a,"x".repeat(4000));for(int i=0;i<4;i++)conversations.append(user(a),large,UUID.randomUUID(),"y".repeat(4000));
        var capped=tree(call(a,"POST",path(large),body(UUID.randomUUID(),6,5)),200);
        assertThat(capped.get("contextCount").asInt()).isEqualTo(4);assertThat(capped.get("contextStart").asLong()).isEqualTo(2);
        assertThat(probe.capturedContext(probe.requests.size()-1)).hasSize(4);
    }
    @Test void cancellationAndConcurrentEditDiscardPendingOutput() throws Exception {
        for(boolean cancel:new boolean[]{true,false}) {
            UUID id=conversation(a,"A"),request=UUID.randomUUID();probe.block(1);
            try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
                var pending=pool.submit(()->call(a,"POST",path(id),body(request,2,1)));probe.await();
                if(cancel)assertThat(tree(call(a,"POST",path(id)+"/"+request+"/cancel",Map.of()),200).get("state").asString()).isEqualTo("CANCELLED");
                else conversations.append(user(a),id,UUID.randomUUID(),"Changed context while provider runs");
                probe.gate.get().countDown();var result=tree(pending.get(8,TimeUnit.SECONDS),200);
                assertThat(result.get("errorCode").asString()).isEqualTo(cancel?"AI_CANCELLED":"AI_STALE_CONTEXT");
                assertThat(assistants(id)).isZero();
            }
        }
    }
    @Test void deletionAndCredentialRevocationDuringCallNeverAppend() throws Exception {
        UUID id=conversation(a,"A");probe.block(1);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var pending=pool.submit(()->call(a,"POST",path(id),body(UUID.randomUUID(),2,1)));probe.await();
            conversations.delete(user(a),id,2L);probe.gate.get().countDown();tree(pending.get(8,TimeUnit.SECONDS),404);
        }
        UUID second=conversation(a,"A2");UserPrincipal old=user(a);probe.block(1);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var pending=pool.submit(()->call(a,"POST",path(second),body(UUID.randomUUID(),2,1)));probe.await();
            jdbc.update("UPDATE trading.app_user SET credential_version=credential_version+1 WHERE id=?",a.id());
            probe.gate.get().countDown();tree(pending.get(8,TimeUnit.SECONDS),401);
        }
        assertThat(assistants(second)).isZero();
        assertThatThrownBy(()->turns.get(old,second,UUID.randomUUID())).isInstanceOf(BadCredentialsException.class);
    }
    @Test void expiredPersistedLeaseRecoversWithoutProviderReplay() throws Exception {
        UUID id=conversation(a,"A"),request=UUID.randomUUID();var principal=user(a);
        turns.reserve(principal,id,request,2L,1L,probe.configuration());expire(id);
        assertThat(tree(call(a,"GET",path(id),null),200).get("requestId").asString()).isEqualTo(request.toString());
        // A fresh service has no in-memory attempt state, as after API restart.
        var restarted=new AiService(turns,probe);
        var result=restarted.start(principal,id,request,2L,1L);
        assertThat(result.state()).isEqualTo("FAILED");assertThat(result.errorCode()).isEqualTo("AI_EXPIRED");assertThat(probe.calls.get()).isZero();
        assertThat(restarted.start(principal,id,UUID.randomUUID(),2L,1L).state()).isEqualTo("SUCCEEDED");
        assertThat(probe.calls.get()).isEqualTo(1);
    }
    @Test void providerRefusalAndDisabledConfigAreTruthfulAndRetryExplicit() throws Exception {
        UUID id=conversation(a,"A"),request=UUID.randomUUID();probe.configured.set(false);
        assertThat(tree(call(a,"GET","/api/ai/capabilities",null),200).get("configured").asBoolean()).isFalse();
        assertThat(tree(call(a,"POST",path(id),body(request,2,1)),503).get("code").asString()).isEqualTo("AI_UNCONFIGURED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.ai_turn",Long.class)).isZero();
        probe.configured.set(true);probe.mode.set("refusal");
        assertThat(tree(call(a,"POST",path(id),body(request,2,1)),200).get("errorCode").asString()).isEqualTo("AI_REFUSED");
        probe.mode.set("answer");tree(call(a,"POST",path(id),body(request,2,1)),200);assertThat(probe.calls.get()).isEqualTo(1);
        assertThat(tree(call(a,"POST",path(id),body(UUID.randomUUID(),2,1)),200).get("state").asString()).isEqualTo("SUCCEEDED");
        assertThat(probe.calls.get()).isEqualTo(2);assertThat(assistants(id)).isEqualTo(1);
    }
    @Test void transactionFailureRollsBackAssistantAndVersionThenExpiresSafely() throws Exception {
        UUID id=conversation(a,"A"),request=UUID.randomUUID();
        jdbc.execute("CREATE FUNCTION trading.ai_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic transaction failure'; END $$");
        jdbc.execute("CREATE TRIGGER ai_test_failure BEFORE UPDATE ON trading.conversation FOR EACH ROW EXECUTE FUNCTION trading.ai_test_failure()");
        try{tree(call(a,"POST",path(id),body(request,2,1)),503);}finally{jdbc.execute("DROP TRIGGER ai_test_failure ON trading.conversation");jdbc.execute("DROP FUNCTION trading.ai_test_failure()");}
        assertThat(assistants(id)).isZero();assertThat(conversations.get(user(a),id).version()).isEqualTo(2);
        assertThat(turns.get(user(a),id,request).state()).isEqualTo("PENDING");expire(id);
        assertThat(turns.get(user(a),id,request).errorCode()).isEqualTo("AI_EXPIRED");assertThat(probe.calls.get()).isEqualTo(1);
    }
    @Test void attemptQuotaMessageQuotaAndOwnerDeleteCascadePreserveOtherUsers() throws Exception {
        UUID id=conversation(a,"A");var principal=user(a);
        for(int i=0;i<100;i++){UUID request=UUID.randomUUID();turns.reserve(principal,id,request,2L,1L,probe.configuration());turns.finish(principal,id,request,null,AiFailure.Code.AI_REFUSED);}
        tree(call(a,"POST",path(id),body(UUID.randomUUID(),2,1)),409);
        UUID other=conversation(b,"B");tree(call(b,"POST",path(other),body(UUID.randomUUID(),2,1)),200);
        conversations.delete(principal,id,2L);assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.ai_turn WHERE conversation_id=?",Long.class,id)).isZero();
        assertThat(assistants(other)).isEqualTo(1);
        UUID full=conversation(a,"First");
        jdbc.update("INSERT INTO trading.conversation_message(conversation_id,sequence,request_id,role,content) SELECT ?,n,gen_random_uuid(),'user','Synthetic' FROM generate_series(2,1999) n",full);
        jdbc.update("UPDATE trading.conversation SET last_sequence=1999 WHERE id=?",full);
        assertThat(tree(call(a,"POST",path(full),body(UUID.randomUUID(),2,1999)),200).get("assistantSequence").asLong()).isEqualTo(2000);
        tree(call(a,"POST",path(full),body(UUID.randomUUID(),3,2000)),400);
    }
    @Test void rateBudgetsIncludeExistingChatAndAreOwnerIndependent() throws Exception {
        UUID id=conversation(a,"A");limiter.allow("ai-start",a.id().toString(),10);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=10 WHERE bucket_key=?",AuthRateLimiter.bucketKey("ai-start",a.id().toString()));
        tree(call(a,"POST",path(id),body(UUID.randomUUID(),2,1)),429);
        UUID other=conversation(b,"B");tree(call(b,"POST",path(other),body(UUID.randomUUID(),2,1)),200);
        tree(call(a,"GET","/api/ai/capabilities",null),200);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=300 WHERE bucket_key=?",AuthRateLimiter.bucketKey("ai-read",a.id().toString()));
        tree(call(a,"GET","/api/ai/capabilities",null),429);tree(call(b,"GET","/api/ai/capabilities",null),200);
        jdbc.update("DELETE FROM trading.auth_rate_bucket");limiter.allow("chat-user",a.id().toString(),120);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=120 WHERE bucket_key=?",AuthRateLimiter.bucketKey("chat-user",a.id().toString()));
        tree(call(a,"POST",path(id),body(UUID.randomUUID(),2,1)),429);
    }
    @Test void simultaneousProviderWorkIsBoundedWithoutHiddenQueue() throws Exception {
        List<UUID> ids=new ArrayList<>();for(int i=0;i<5;i++)ids.add(conversation(a,"A"+i));probe.block(4);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<HttpResponse<String>>> pending=new ArrayList<>();
            for(int i=0;i<4;i++){UUID id=ids.get(i);pending.add(pool.submit(()->call(a,"POST",path(id),body(UUID.randomUUID(),2,1))));}
            probe.await();var rejected=tree(call(a,"POST",path(ids.get(4)),body(UUID.randomUUID(),2,1)),200);
            assertThat(rejected.get("errorCode").asString()).isEqualTo("AI_BUSY");assertThat(probe.calls.get()).isEqualTo(4);
            probe.gate.get().countDown();for(var result:pending)assertThat(tree(result.get(8,TimeUnit.SECONDS),200).get("state").asString()).isEqualTo("SUCCEEDED");
        }
    }
}
