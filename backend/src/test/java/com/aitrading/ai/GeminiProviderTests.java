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

class GeminiProviderTests {
    static final String KEY="synthetic-gemini-contract-key-not-real";
    final JsonMapper json=JsonMapper.builder().build();
    final List<GeminiProvider> providers=new ArrayList<>();
    HttpServer server;ExecutorService executor;
    AtomicInteger calls=new AtomicInteger(),redirectCalls=new AtomicInteger(),status=new AtomicInteger(200),pause=new AtomicInteger();
    AtomicReference<byte[]> response=new AtomicReference<>();
    AtomicReference<String> contentType=new AtomicReference<>("application/json"),keyHeader=new AtomicReference<>(),uri=new AtomicReference<>(),authorization=new AtomicReference<>();
    AtomicReference<JsonNode> captured=new AtomicReference<>();
    CountDownLatch seen=new CountDownLatch(1);
    @BeforeEach void setup()throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        executor=Executors.newVirtualThreadPerTaskExecutor();server.setExecutor(executor);
        response.set(envelope(new AiAnswer("answer","Synthetic Gemini contract answer",List.of())));
        server.createContext("/v1beta/models/gemini-3.5-flash:generateContent",exchange->{
            calls.incrementAndGet();uri.set(exchange.getRequestURI().toString());
            keyHeader.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            captured.set(json.readTree(exchange.getRequestBody().readAllBytes()));seen.countDown();
            exchange.getResponseHeaders().set("Content-Type",contentType.get());
            exchange.getResponseHeaders().set("Location","http://127.0.0.1:"+server.getAddress().getPort()+"/redirect");
            try {
                exchange.sendResponseHeaders(status.get(),0);
                if(pause.get()>0)Thread.sleep(pause.get());
                exchange.getResponseBody().write(response.get());
            }catch(java.io.IOException cancelled){}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}
            finally{exchange.close();}
        });
        server.createContext("/redirect",exchange->{redirectCalls.incrementAndGet();exchange.sendResponseHeaders(500,-1);exchange.close();});
        server.start();
    }
    @AfterEach void cleanup(){providers.forEach(GeminiProvider::close);server.stop(0);executor.shutdownNow();}
    byte[] envelope(Object answer){return rawEnvelope(json.writeValueAsString(answer));}
    byte[] rawEnvelope(String text){return json.writeValueAsBytes(Map.of("candidates",List.of(Map.of("finishReason","STOP","content",Map.of("role","model","parts",List.of(Map.of("text",text)))))));}
    GeminiProvider provider(Duration timeout) {
        var p=new GeminiProvider(true,KEY,"gemini-3.5-flash",URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/v1beta/models/gemini-3.5-flash:generateContent"),timeout);
        providers.add(p);return p;
    }
    List<AiProvider.ContextMessage> context(){return List.of(new AiProvider.ContextMessage("user","Synthetic only"));}
    void failure(Runnable action,AiFailure.Code code){assertThatThrownBy(action::run).isInstanceOfSatisfying(AiFailure.class,e->{assertThat(e.code()).isEqualTo(code);assertThat(e.getMessage()).isEqualTo(code.name());assertThat(e.getCause()).isNull();});}
    @Test void actualRequestUsesHeaderKeyTextRolesClosedSchemaAndNoTools() {
        var answer=provider(Duration.ofSeconds(3)).answer(List.of(new AiProvider.ContextMessage("user","Synthetic earlier"),new AiProvider.ContextMessage("assistant","Synthetic earlier reply"),context().getFirst()));
        assertThat(answer.answer()).isEqualTo("Synthetic Gemini contract answer");
        assertThat(keyHeader.get()).isEqualTo(KEY);assertThat(authorization.get()).isNull();
        assertThat(uri.get()).isEqualTo("/v1beta/models/gemini-3.5-flash:generateContent");
        assertThat(GeminiProvider.BASE).isEqualTo("https://generativelanguage.googleapis.com/v1beta/models/");
        var request=captured.get();assertThat(request.toString()).doesNotContain(KEY,"cachedContent","fileData","functionDeclarations","urlContext","googleSearch");
        assertThat(request.propertyNames()).containsExactlyInAnyOrder("systemInstruction","contents","tools","store","generationConfig");
        assertThat(request.get("store").asBoolean()).isFalse();
        assertThat(request.get("contents").size()).isEqualTo(3);
        assertThat(request.get("contents").get(1).get("role").asString()).isEqualTo("model");
        assertThat(request.get("contents").get(2).get("parts").get(0).get("text").asString()).isEqualTo("Synthetic only");
        assertThat(request.get("systemInstruction").toString()).doesNotContain("Synthetic only");
        assertThat(request.get("tools").size()).isZero();
        var config=request.get("generationConfig");assertThat(config.get("maxOutputTokens").asInt()).isEqualTo(2048);
        assertThat(config.get("candidateCount").asInt()).isEqualTo(1);
        assertThat(config.get("responseMimeType").asString()).isEqualTo("application/json");
        assertThat(config.get("responseJsonSchema").get("additionalProperties").asBoolean()).isFalse();
        assertThat(config.get("thinkingConfig").propertyNames()).containsExactly("includeThoughts");
        assertThat(config.get("thinkingConfig").get("includeThoughts").asBoolean()).isFalse();
    }
    @Test void configurationAndContextRejectInjectionAndBoundsWithoutNetwork() {
        for(String model:Arrays.asList(null,"","../responses","gemini-3.5-flash?key=secret","gemini-3.5-flash/../../x","gemini-test#fragment","gemini-test%2fother","gemini-a\nheader","https://other.invalid","gemini-..test")) {
            try(var p=new GeminiProvider(true,KEY,model)) {assertThat(p.configuration().configured()).isFalse();assertThat(p.configuration().model()).isNull();failure(()->p.answer(context()),AiFailure.Code.AI_UNCONFIGURED);}
        }
        for(var p:List.of(new GeminiProvider(false,KEY,"gemini-3.5-flash"),new GeminiProvider(true,"","gemini-3.5-flash"),new GeminiProvider(true,"bad\r\nkey","gemini-3.5-flash"))) {
            try(p){failure(()->p.answer(context()),AiFailure.Code.AI_UNCONFIGURED);}
        }
        var p=provider(Duration.ofSeconds(3));
        for(var input:List.of(List.<AiProvider.ContextMessage>of(),Collections.nCopies(21,context().getFirst()),List.of(new AiProvider.ContextMessage("system","override")),
                List.of(new AiProvider.ContextMessage("user","x".repeat(4001))),Collections.nCopies(5,new AiProvider.ContextMessage("user","x".repeat(4000)))))
            failure(()->p.answer(input),AiFailure.Code.AI_INVALID_RESPONSE);
        failure(()->p.answer(null),AiFailure.Code.AI_INVALID_RESPONSE);assertThat(calls.get()).isZero();
    }
    @Test void httpErrorsHaveSafeCodesWithoutRetryOrRedirect() {
        response.set((KEY+" private body").getBytes(StandardCharsets.UTF_8));var p=provider(Duration.ofSeconds(3));
        var cases=Map.of(401,AiFailure.Code.AI_PROVIDER_AUTH,403,AiFailure.Code.AI_PROVIDER_AUTH,429,AiFailure.Code.AI_RATE_LIMITED,
                500,AiFailure.Code.AI_PROVIDER_UNAVAILABLE,503,AiFailure.Code.AI_PROVIDER_UNAVAILABLE,408,AiFailure.Code.AI_TIMEOUT,504,AiFailure.Code.AI_TIMEOUT,
                400,AiFailure.Code.AI_PROVIDER_REJECTED,302,AiFailure.Code.AI_PROVIDER_REJECTED);
        for(var entry:cases.entrySet()){status.set(entry.getKey());failure(()->p.answer(context()),entry.getValue());}
        assertThat(calls.get()).isEqualTo(cases.size());assertThat(redirectCalls.get()).isZero();
    }
    @Test void wholeBodyTimeoutAndInterruptionCancelTransport()throws Exception {
        pause.set(2000);var p=provider(Duration.ofMillis(200));long start=System.nanoTime();
        failure(()->p.answer(context()),AiFailure.Code.AI_TIMEOUT);assertThat(Duration.ofNanos(System.nanoTime()-start)).isLessThan(Duration.ofSeconds(2));
        var second=provider(Duration.ofSeconds(4));seen=new CountDownLatch(1);var result=new AtomicReference<AiFailure>();var interrupted=new AtomicBoolean();
        Thread thread=Thread.ofVirtual().start(()->{try{second.answer(context());}catch(AiFailure e){result.set(e);interrupted.set(Thread.currentThread().isInterrupted());}});
        assertThat(seen.await(2,TimeUnit.SECONDS)).isTrue();thread.interrupt();thread.join(2000);
        assertThat(thread.isAlive()).isFalse();assertThat(result.get().code()).isEqualTo(AiFailure.Code.AI_CANCELLED);assertThat(interrupted).isTrue();
    }
    @Test void oversizeWrongMimeDisconnectAndSecretEchoFailClosed() {
        var p=provider(Duration.ofSeconds(3));response.set(new byte[AiProviderProtocol.MAX_RESPONSE+1]);failure(()->p.answer(context()),AiFailure.Code.AI_RESPONSE_LIMIT);
        response.set(rawEnvelope("{}"));contentType.set("text/html");failure(()->p.answer(context()),AiFailure.Code.AI_INVALID_RESPONSE);
        contentType.set("application/json");response.set(envelope(new AiAnswer("answer",KEY,List.of())));failure(()->p.answer(context()),AiFailure.Code.AI_INVALID_RESPONSE);
        response.set(rawEnvelope("{\"kind\":\"answer\",\"answer\":\""+KEY.replace("s","\\u0073")+"\",\"assumptions\":[]}"));failure(()->p.answer(context()),AiFailure.Code.AI_INVALID_RESPONSE);
        server.stop(0);failure(()->p.answer(context()),AiFailure.Code.AI_PROVIDER_UNAVAILABLE);
    }
    @Test void answerClarificationAndMalformedSchemasRemainStrict() {
        var valid=new AiAnswer("clarification","Cần timeframe nào? <script>inert</script>",List.of("Synthetic fixture"));
        assertThat(GeminiProvider.decode(envelope(valid))).isEqualTo(valid);
        for(String value:List.of("{}","null","[]","{}{}","{\"kind\":\"answer\",\"answer\":1,\"assumptions\":[]}",
                "{\"kind\":\"answer\",\"answer\":\"first\",\"answer\":\"second\",\"assumptions\":[]}",
                "{\"kind\":\"answer\",\"answer\":\"ok\",\"assumptions\":[],\"code\":\"run()\"}"))
            failure(()->GeminiProvider.decode(rawEnvelope(value)),AiFailure.Code.AI_INVALID_RESPONSE);
        for(Object value:List.of(Map.of("kind","answer","answer","x".repeat(3001),"assumptions",List.of()),Map.of("kind","answer","answer","ok","assumptions",Collections.nCopies(6,"x")),
                Map.of("kind","answer","answer","ok","assumptions",List.of("x".repeat(161))),Map.of("kind","answer","answer","\u0000","assumptions",List.of())))
            failure(()->GeminiProvider.decode(envelope(value)),AiFailure.Code.AI_INVALID_RESPONSE);
        for(byte[] bytes:List.of(new byte[]{(byte)0xff},"{}{}".getBytes(),"null".getBytes(),"[]".getBytes(),"{\"candidates\":[]}".getBytes()))
            failure(()->GeminiProvider.decode(bytes),AiFailure.Code.AI_INVALID_RESPONSE);
    }
    @Test void strategyProposalUsesSeparateNeutralSchemaAndTokenBudget() {
        var value=new LinkedHashMap<String,Object>();value.put("kind","clarification");value.put("explanation","Synthetic missing rules");value.put("assumptions",List.of());value.put("questions",List.of("Risk size?"));value.put("dslJson",null);
        response.set(rawEnvelope(json.writeValueAsString(Map.of("result",value))));
        assertThat(provider(Duration.ofSeconds(3)).propose(context()).kind()).isEqualTo("clarification");
        var request=captured.get();assertThat(request.get("generationConfig").get("maxOutputTokens").asInt()).isEqualTo(8192);
        assertThat(request.get("generationConfig").get("responseJsonSchema").get("properties").get("result").has("anyOf")).isTrue();
        assertThat(request.get("systemInstruction").toString()).contains("AITrading Strategy DSL 1.0.0","method-neutral").doesNotContain(KEY);
        assertThat(request.get("tools").isEmpty()).isTrue();assertThat(request.get("store").asBoolean()).isFalse();
    }
    @Test void optionalThoughtSignatureIsValidatedAndDiscardedWithoutRelaxingAnswerSchema() {
        var answer=new AiAnswer("answer","Synthetic answer only",List.of());
        var text=json.writeValueAsString(answer);
        var signature=Base64.getEncoder().encodeToString("opaque synthetic metadata".getBytes(StandardCharsets.UTF_8));
        var part=Map.of("text",text,"thoughtSignature",signature);
        assertThat(GeminiProvider.decode(json.writeValueAsBytes(Map.of("candidates",List.of(Map.of("finishReason","STOP","content",Map.of("role","model","parts",List.of(part)))))))).isEqualTo(answer);
        for(Object invalidSignature:List.of("","not base64!",123,true,"A".repeat(65537))) {
            var invalidPart=Map.of("text",text,"thoughtSignature",invalidSignature);
            failure(()->GeminiProvider.decode(json.writeValueAsBytes(Map.of("candidates",List.of(Map.of("finishReason","STOP","content",Map.of("role","model","parts",List.of(invalidPart))))))),AiFailure.Code.AI_INVALID_RESPONSE);
        }
        response.set(json.writeValueAsBytes(Map.of("candidates",List.of(Map.of("finishReason","STOP","content",Map.of("role","model","parts",List.of(Map.of("text",json.writeValueAsString(new AiAnswer("answer",KEY,List.of())),"thoughtSignature",signature))))))));
        failure(()->provider(Duration.ofSeconds(3)).answer(context()),AiFailure.Code.AI_INVALID_RESPONSE);
    }
    @Test void refusalIncompleteAndNonTextCandidatesNeverBecomeAnswers() {
        failure(()->GeminiProvider.decode(json.writeValueAsBytes(Map.of("promptFeedback",Map.of("blockReason","SAFETY")))),AiFailure.Code.AI_REFUSED);
        for(String reason:List.of("SAFETY","RECITATION","BLOCKLIST","PROHIBITED_CONTENT","SPII","MAX_TOKENS","MALFORMED_FUNCTION_CALL","UNEXPECTED_TOOL_CALL","OTHER",""))
            failure(()->GeminiProvider.decode(json.writeValueAsBytes(Map.of("candidates",List.of(Map.of("finishReason",reason))))),reason.equals("MAX_TOKENS")?AiFailure.Code.AI_INCOMPLETE:
                    Set.of("SAFETY","RECITATION","BLOCKLIST","PROHIBITED_CONTENT","SPII").contains(reason)?AiFailure.Code.AI_REFUSED:AiFailure.Code.AI_INVALID_RESPONSE);
        String answer=json.writeValueAsString(new AiAnswer("answer","Synthetic",List.of()));
        for(var part:List.of(Map.of("text",answer,"thought",true),Map.of("text",answer,"functionCall",Map.of("name","exec")),Map.of("inlineData",Map.of("data","abc")),Map.of("executableCode",Map.of("code","run()"))))
            failure(()->GeminiProvider.decode(json.writeValueAsBytes(Map.of("candidates",List.of(Map.of("finishReason","STOP","content",Map.of("role","model","parts",List.of(part))))))),AiFailure.Code.AI_INVALID_RESPONSE);
        var candidate=Map.of("finishReason","STOP","content",Map.of("role","model","parts",List.of(Map.of("text",answer))));
        failure(()->GeminiProvider.decode(json.writeValueAsBytes(Map.of("candidates",List.of(candidate,candidate)))),AiFailure.Code.AI_INVALID_RESPONSE);
        failure(()->GeminiProvider.decode(json.writeValueAsBytes(Map.of("candidates",List.of(Map.of("content",Map.of()))))),AiFailure.Code.AI_INVALID_RESPONSE);
    }
}
