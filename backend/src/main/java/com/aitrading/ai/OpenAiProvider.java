package com.aitrading.ai;

import java.net.URI;
import java.net.http.HttpRequest;
import java.time.Duration;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** Optional OpenAI adapter; application services depend only on AiProvider. */
public final class OpenAiProvider implements AiProvider {
    public static final int MAX_RESPONSE=AiProviderProtocol.MAX_RESPONSE;
    static final URI ENDPOINT=URI.create("https://api.openai.com/v1/responses");
    private final AiHttpTransport transport=new AiHttpTransport();
    private final URI endpoint;
    private final Duration timeout;
    private final String key;
    private final Configuration configuration;
    public OpenAiProvider(boolean enabled,String key,String model){this(enabled,key,model,ENDPOINT,Duration.ofSeconds(20));}
    // Package-private injection for owned local HTTP tests only; no configurable production URL.
    OpenAiProvider(boolean enabled,String key,String model,URI endpoint,Duration timeout) {
        boolean configured=enabled && AiProviderProtocol.validKey(key)
                && model!=null && model.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
        this.key=configured?key:"";
        configuration=new Configuration(configured,"openai",configured?model:null);
        this.endpoint=endpoint;this.timeout=timeout;
    }
    @Override public Configuration configuration(){return configuration;}
    @Override public void close(){transport.close();}
    public void shutdown(){close();}
    @Override public AiAnswer answer(List<ContextMessage> context) {
        return AiProviderProtocol.withoutSecret(decode(send(context,AiProviderProtocol.INSTRUCTIONS,AiProviderProtocol.SCHEMA,"quant_answer_v1",2048)),key);
    }
    @Override public AiProposal propose(List<ContextMessage> context) {
        return AiProposal.decode(decodeText(send(context,AiProposalProtocol.INSTRUCTIONS,AiProposalProtocol.SCHEMA,"strategy_proposal_v1",8192)),key);
    }
    @Override public AiJournalEvaluation evaluateJournal(List<ContextMessage> context) {
        return AiJournalEvaluation.decode(decodeText(send(context,AiJournalProtocol.INSTRUCTIONS,AiJournalProtocol.SCHEMA,"journal_evaluation_v1",4096)),key);
    }
    @Override public AiImageAnalysis analyzeImage(ImageRequest image) {
        AiImageProtocol.validate(image);if(!configuration.configured())throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);
        String data="data:image/png;base64,"+Base64.getEncoder().encodeToString(image.pngBytes());
        var content=List.of(Map.of("type","input_text","text",image.question()),Map.of("type","input_image","image_url",data,"detail","high"));
        var body=Map.of("model",configuration.model(),"instructions",AiImageProtocol.INSTRUCTIONS,"input",List.of(Map.of("role","user","content",content)),
                "text",Map.of("format",Map.of("type","json_schema","name","chart_image_analysis_v1","strict",true,"schema",AiImageProtocol.SCHEMA)),
                "store",false,"stream",false,"tools",List.of(),"tool_choice","none","max_output_tokens",4096,"truncation","disabled");
        var request=HttpRequest.newBuilder(endpoint).timeout(timeout).header("Content-Type","application/json").header("Authorization","Bearer "+key)
                .POST(HttpRequest.BodyPublishers.ofByteArray(AiProviderProtocol.JSON.writeValueAsBytes(body))).build();
        return AiImageProtocol.withoutSecret(AiImageProtocol.decode(decodeText(transport.send(request,timeout))),key);
    }
    private byte[] send(List<ContextMessage> context,String instructions,Map<String,Object> schema,String schemaName,int tokens) {
        if(!configuration.configured())throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);
        AiProviderProtocol.validateContext(context);
        var body=Map.of("model",configuration.model(),"instructions",instructions,"input",context,
                "text",Map.of("format",Map.of("type","json_schema","name",schemaName,"strict",true,"schema",schema)),
                "store",false,"stream",false,"tools",List.of(),"tool_choice","none","max_output_tokens",tokens,"truncation","disabled");
        var request=HttpRequest.newBuilder(endpoint).timeout(timeout).header("Content-Type","application/json")
                .header("Authorization","Bearer "+key).POST(HttpRequest.BodyPublishers.ofByteArray(AiProviderProtocol.JSON.writeValueAsBytes(body))).build();
        return transport.send(request,timeout);
    }
    static AiAnswer decode(byte[] bytes) {
        return AiProviderProtocol.answer(decodeText(bytes));
    }
    private static String decodeText(byte[] bytes) {
        JsonNode root=AiProviderProtocol.decode(bytes);
        if(root==null || !root.isObject() || !root.has("status"))throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
        if(!"completed".equals(root.path("status").asString()))throw new AiFailure(AiFailure.Code.AI_INCOMPLETE);
        if(root.hasNonNull("error"))throw new AiFailure(AiFailure.Code.AI_PROVIDER_UNAVAILABLE);
        JsonNode output=root.path("output");
        if(!output.isArray() || output.isEmpty() || output.size()>8)throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
        JsonNode message=null;
        for(JsonNode item:output) {
            if("reasoning".equals(item.path("type").asString()))continue;
            if(!"message".equals(item.path("type").asString()) || message!=null || !"assistant".equals(item.path("role").asString())
                    || !"completed".equals(item.path("status").asString()))throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
            message=item;
        }
        if(message==null || !message.path("content").isArray() || message.path("content").size()!=1)
            throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
        JsonNode content=message.path("content").get(0);
        if("refusal".equals(content.path("type").asString()))throw new AiFailure(AiFailure.Code.AI_REFUSED);
        if(!"output_text".equals(content.path("type").asString()) || !content.path("text").isString())throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
        return content.get("text").asString();
    }
}
