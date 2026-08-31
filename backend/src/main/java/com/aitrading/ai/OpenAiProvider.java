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
        if(!configuration.configured())throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);
        AiProviderProtocol.validateContext(context);
        var body=Map.of("model",configuration.model(),"instructions",AiProviderProtocol.INSTRUCTIONS,"input",context,
                "text",Map.of("format",Map.of("type","json_schema","name","quant_answer_v1","strict",true,"schema",AiProviderProtocol.SCHEMA)),
                "store",false,"stream",false,"tools",List.of(),"tool_choice","none","max_output_tokens",2048,"truncation","disabled");
        var request=HttpRequest.newBuilder(endpoint).timeout(timeout).header("Content-Type","application/json")
                .header("Authorization","Bearer "+key).POST(HttpRequest.BodyPublishers.ofByteArray(AiProviderProtocol.JSON.writeValueAsBytes(body))).build();
        return AiProviderProtocol.withoutSecret(decode(transport.send(request,timeout)),key);
    }
    static AiAnswer decode(byte[] bytes) {
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
        if(!"output_text".equals(content.path("type").asString()) || !content.path("text").isString()
                || content.path("text").asString().length()>16384)throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
        return AiProviderProtocol.answer(content.get("text").asString());
    }
}
