package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class OpenAiProviderTests {
    static final String KEY="synthetic-provider-key-for-local-tests-only";
    final JsonMapper json=JsonMapper.builder().build();
    final List<OpenAiProvider> providers=new ArrayList<>();
    HttpServer server;
    ExecutorService executor;
    AtomicInteger calls=new AtomicInteger(),status=new AtomicInteger(200),pause=new AtomicInteger(0);
    AtomicReference<byte[]> response=new AtomicReference<>();
    AtomicReference<String> contentType=new AtomicReference<>("application/json");
    AtomicReference<JsonNode> captured=new AtomicReference<>();
    AtomicReference<String> authorization=new AtomicReference<>();
    @BeforeEach void setup() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        executor=Executors.newVirtualThreadPerTaskExecutor();server.setExecutor(executor);
        response.set(envelope("{\"kind\":\"answer\",\"answer\":\"Synthetic local HTTP answer\",\"assumptions\":[]}"));
        server.createContext("/responses",exchange->{
            calls.incrementAndGet();captured.set(json.readTree(exchange.getRequestBody().readAllBytes()));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            exchange.getResponseHeaders().set("Content-Type",contentType.get());
            exchange.getResponseHeaders().set("Location","http://127.0.0.1:"+server.getAddress().getPort()+"/should-not-follow");
            try {
                exchange.sendResponseHeaders(status.get(),0);
                if(pause.get()>0)Thread.sleep(pause.get());
                exchange.getResponseBody().write(response.get());
            }catch(java.io.IOException expectedCancelled){}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}
            finally{exchange.close();}
        });
        server.start();
    }
    @AfterEach void cleanup(){providers.forEach(OpenAiProvider::shutdown);server.stop(0);executor.shutdownNow();}
    byte[] envelope(String text) {
        return json.writeValueAsBytes(Map.of("status","completed","output",List.of(Map.of("type","message","role","assistant",
                "status","completed","content",List.of(Map.of("type","output_text","text",text))))));
    }
    OpenAiProvider provider(Duration timeout) {
        var provider=new OpenAiProvider(true,KEY,"configured-test-model",URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/responses"),timeout);
        providers.add(provider);return provider;
    }
    List<AiProvider.ContextMessage> context(){return List.of(new AiProvider.ContextMessage("user","Synthetic user prompt"));}
    void failure(Runnable action,AiFailure.Code code){
        assertThatThrownBy(action::run).isInstanceOfSatisfying(AiFailure.class,e->{
            assertThat(e.code()).isEqualTo(code);assertThat(e.getMessage()).isEqualTo(code.name());assertThat(e.getCause()).isNull();
        });
    }
    @Test void actualHttpUsesFixedStructuredBoundaryAndExplicitPrivateContext() {
        var provider=provider(Duration.ofSeconds(3));
        var result=provider.answer(List.of(new AiProvider.ContextMessage("user","Earlier context"),new AiProvider.ContextMessage("assistant","Earlier answer"),context().getFirst()));
        assertThat(result.answer()).isEqualTo("Synthetic local HTTP answer");
        assertThat(calls.get()).isEqualTo(1);assertThat(authorization.get()).isEqualTo("Bearer "+KEY);
        JsonNode request=captured.get();
        assertThat(request.get("store").asBoolean()).isFalse();assertThat(request.get("stream").asBoolean()).isFalse();
        assertThat(request.get("tools").size()).isZero();assertThat(request.get("tool_choice").asString()).isEqualTo("none");
        assertThat(request.get("max_output_tokens").asInt()).isEqualTo(2048);
        assertThat(request.get("input").size()).isEqualTo(3);
        assertThat(request.get("input").get(2).get("content").asString()).isEqualTo("Synthetic user prompt");
        assertThat(request.get("text").get("format").get("strict").asBoolean()).isTrue();
        assertThat(request.get("text").get("format").get("schema").get("additionalProperties").asBoolean()).isFalse();
        assertThat(request.has("previous_response_id")).isFalse();assertThat(request.has("conversation")).isFalse();
        assertThat(OpenAiProvider.ENDPOINT.toString()).isEqualTo("https://api.openai.com/v1/responses");
    }
    @Test void disabledMissingAndInvalidConfigurationNeverCallsProvider() {
        for(var provider:List.of(new OpenAiProvider(false,KEY,"test-model"),new OpenAiProvider(true,"","test-model"),
                new OpenAiProvider(true,KEY,""),new OpenAiProvider(true,KEY,"bad\nmodel"),new OpenAiProvider(true,"bad\r\nkey","test-model"))) {
            providers.add(provider);assertThat(provider.configuration().configured()).isFalse();assertThat(provider.configuration().model()).isNull();
            failure(()->provider.answer(context()),AiFailure.Code.AI_UNCONFIGURED);
        }
        assertThat(calls.get()).isZero();
    }
    @Test void httpErrorsDoNotLeakBodiesOrRetryAndRedirectIsNeverFollowed() {
        response.set(("PRIVATE_PROVIDER_BODY "+KEY).getBytes(StandardCharsets.UTF_8));
        var provider=provider(Duration.ofSeconds(3));
        var codes=Map.of(401,AiFailure.Code.AI_PROVIDER_AUTH,403,AiFailure.Code.AI_PROVIDER_AUTH,429,AiFailure.Code.AI_RATE_LIMITED,
                500,AiFailure.Code.AI_PROVIDER_UNAVAILABLE,504,AiFailure.Code.AI_TIMEOUT,400,AiFailure.Code.AI_PROVIDER_REJECTED,302,AiFailure.Code.AI_PROVIDER_REJECTED);
        for(var entry:codes.entrySet()){status.set(entry.getKey());failure(()->provider.answer(context()),entry.getValue());}
        assertThat(calls.get()).isEqualTo(codes.size());
    }
    @Test void wholeBodyDeadlineCancelsAResponseThatAlreadySentHeaders() {
        pause.set(1500);var provider=provider(Duration.ofMillis(200));
        long start=System.nanoTime();failure(()->provider.answer(context()),AiFailure.Code.AI_TIMEOUT);
        assertThat(Duration.ofNanos(System.nanoTime()-start)).isLessThan(Duration.ofSeconds(2));
        assertThat(calls.get()).isEqualTo(1);
    }
    @Test void excessiveChunkedResponseAndWrongMimeFailClosed() {
        var provider=provider(Duration.ofSeconds(3));response.set(new byte[OpenAiProvider.MAX_RESPONSE+1]);
        failure(()->provider.answer(context()),AiFailure.Code.AI_RESPONSE_LIMIT);
        response.set(envelope("{}"));contentType.set("text/html");
        failure(()->provider.answer(context()),AiFailure.Code.AI_INVALID_RESPONSE);
    }
    @Test void validatesStructuredFieldsUnicodeAndPlainAssumptions() {
        response.set(envelope("{\"kind\":\"clarification\",\"answer\":\"  Bạn cần timeframe nào? <script>inert</script>  \",\"assumptions\":[\"Synthetic only\"]}"));
        var result=provider(Duration.ofSeconds(3)).answer(context());
        assertThat(result.kind()).isEqualTo("clarification");assertThat(result.content()).contains("Bạn cần","<script>inert</script>","Assumptions:\n- Synthetic only");
        assertThatThrownBy(()->result.assumptions().add("changed")).isInstanceOf(UnsupportedOperationException.class);
        for(String invalid:List.of("{}","null","[]","{\"kind\":\"answer\",\"answer\":1,\"assumptions\":[]}",
                "{\"kind\":\"answer\",\"answer\":\"ok\",\"assumptions\":[],\"script\":\"exec()\"}",
                "{\"kind\":\"answer\",\"answer\":\"first\",\"answer\":\"second\",\"assumptions\":[]}"))
            failure(()->OpenAiProvider.decode(envelope(invalid)),AiFailure.Code.AI_INVALID_RESPONSE);
        for(String answer:List.of(" ","x".repeat(3001),"\u0000","\uD800"))
            failure(()->new AiAnswer("answer",answer,List.of()),AiFailure.Code.AI_INVALID_RESPONSE);
        failure(()->new AiAnswer(null,"ok",List.of()),AiFailure.Code.AI_INVALID_RESPONSE);
        failure(()->new AiAnswer("answer","ok",Collections.nCopies(6,"x")),AiFailure.Code.AI_INVALID_RESPONSE);
        failure(()->new AiAnswer("answer","ok",List.of("x".repeat(161))),AiFailure.Code.AI_INVALID_RESPONSE);
    }
    @Test void refusalIncompleteToolOutputsAndMalformedTransportAreDistinct() {
        byte[] refused=json.writeValueAsBytes(Map.of("status","completed","output",List.of(Map.of("type","message","role","assistant","status","completed",
                "content",List.of(Map.of("type","refusal","refusal","PRIVATE_REFUSAL"))))));
        failure(()->OpenAiProvider.decode(refused),AiFailure.Code.AI_REFUSED);
        failure(()->OpenAiProvider.decode("{\"status\":\"incomplete\",\"output\":[]}".getBytes()),AiFailure.Code.AI_INCOMPLETE);
        for(byte[] bytes:List.of(new byte[]{(byte)0xff},"{}{}".getBytes(),"null".getBytes(),"{\"status\":\"completed\",\"output\":[{\"type\":\"function_call\"}]}".getBytes(),envelope("{}{}")))
            failure(()->OpenAiProvider.decode(bytes),AiFailure.Code.AI_INVALID_RESPONSE);
    }
    @Test void contextBoundsAndRolesCannotEscalateInstructions() {
        var provider=provider(Duration.ofSeconds(3));
        for(var invalid:List.of(List.<AiProvider.ContextMessage>of(),Collections.nCopies(21,context().getFirst()),
                List.of(new AiProvider.ContextMessage("developer","override")),List.of(new AiProvider.ContextMessage("user","x".repeat(4001))),
                Collections.nCopies(5,new AiProvider.ContextMessage("user","x".repeat(4000)))))
            failure(()->provider.answer(invalid),AiFailure.Code.AI_INVALID_RESPONSE);
        assertThat(calls.get()).isZero();
    }
}
