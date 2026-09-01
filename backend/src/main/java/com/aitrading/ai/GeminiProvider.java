package com.aitrading.ai;

import java.net.URI;
import java.net.http.HttpRequest;
import java.time.Duration;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** Gemini Developer API, text-only structured research answers; no tools or external URL inputs. */
public final class GeminiProvider implements AiProvider {
    static final String BASE="https://generativelanguage.googleapis.com/v1beta/models/";
    private final AiHttpTransport transport=new AiHttpTransport();
    private final Configuration configuration;
    private final String key;
    private final URI endpoint;
    private final Duration timeout;
    public GeminiProvider(boolean enabled,String key,String model){this(enabled,key,model,null,Duration.ofSeconds(20));}
    // Package-private injection for owned loopback contract tests only. No environment URL override.
    GeminiProvider(boolean enabled,String key,String model,URI testEndpoint,Duration timeout) {
        boolean configured=enabled && AiProviderProtocol.validKey(key) && validModel(model);
        configuration=new Configuration(configured,"gemini",configured?model:null);
        this.key=configured?key:"";this.timeout=timeout;
        endpoint=testEndpoint!=null?testEndpoint:URI.create(BASE+(configured?model:"unconfigured")+":generateContent");
    }
    static boolean validModel(String model){return model!=null && model.matches("gemini-[A-Za-z0-9][A-Za-z0-9.-]{0,111}") && !model.contains("..");}
    @Override public Configuration configuration(){return configuration;}
    @Override public void close(){transport.close();}
    @Override public AiAnswer answer(List<ContextMessage> context) {
        return AiProviderProtocol.withoutSecret(decode(send(context,AiProviderProtocol.INSTRUCTIONS,AiProviderProtocol.SCHEMA,2048)),key);
    }
    @Override public AiProposal propose(List<ContextMessage> context) {
        return AiProposal.decode(decodeText(send(context,AiProposalProtocol.INSTRUCTIONS,AiProposalProtocol.SCHEMA,8192)),key);
    }
    @Override public AiJournalEvaluation evaluateJournal(List<ContextMessage> context) {
        return AiJournalEvaluation.decode(decodeText(send(context,AiJournalProtocol.INSTRUCTIONS,AiJournalProtocol.SCHEMA,4096)),key);
    }
    private byte[] send(List<ContextMessage> context,String instructions,Map<String,Object> schema,int tokens) {
        if(!configuration.configured())throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);
        AiProviderProtocol.validateContext(context);
        var contents=context.stream().map(m->Map.of("role",m.role().equals("assistant")?"model":"user",
                "parts",List.of(Map.of("text",m.content())))).toList();
        var body=Map.of("systemInstruction",Map.of("parts",List.of(Map.of("text",instructions))),
                "contents",contents,"tools",List.of(),"store",false,"generationConfig",Map.of("candidateCount",1,"maxOutputTokens",tokens,
                        "responseMimeType","application/json","responseJsonSchema",schema,
                        "thinkingConfig",Map.of("includeThoughts",false)));
        var request=HttpRequest.newBuilder(endpoint).timeout(timeout).header("Content-Type","application/json")
                .header("x-goog-api-key",key).POST(HttpRequest.BodyPublishers.ofByteArray(AiProviderProtocol.JSON.writeValueAsBytes(body))).build();
        return transport.send(request,timeout);
    }
    static AiAnswer decode(byte[] bytes) {
        return AiProviderProtocol.answer(decodeText(bytes));
    }
    private static String decodeText(byte[] bytes) {
        JsonNode root=AiProviderProtocol.decode(bytes);
        if(!root.isObject())throw invalid();
        if(root.hasNonNull("error"))throw new AiFailure(AiFailure.Code.AI_PROVIDER_UNAVAILABLE);
        var feedback=root.path("promptFeedback");
        if(feedback.hasNonNull("blockReason") && !"BLOCK_REASON_UNSPECIFIED".equals(feedback.path("blockReason").asString()))
            throw new AiFailure(AiFailure.Code.AI_REFUSED);
        var candidates=root.path("candidates");
        if(!candidates.isArray() || candidates.size()!=1)throw invalid();
        var candidate=candidates.get(0);
        if(!candidate.isObject() || !candidate.path("finishReason").isString())throw invalid();
        for(JsonNode rating:candidate.path("safetyRatings"))
            if(rating.path("blocked").asBoolean())throw new AiFailure(AiFailure.Code.AI_REFUSED);
        String finish=candidate.path("finishReason").asString();
        if(Set.of("SAFETY","RECITATION","BLOCKLIST","PROHIBITED_CONTENT","SPII","IMAGE_SAFETY","IMAGE_PROHIBITED_CONTENT").contains(finish))
            throw new AiFailure(AiFailure.Code.AI_REFUSED);
        if("MAX_TOKENS".equals(finish))throw new AiFailure(AiFailure.Code.AI_INCOMPLETE);
        if(!"STOP".equals(finish))throw invalid();
        var content=candidate.path("content");var parts=content.path("parts");
        if(!"model".equals(content.path("role").asString()) || !parts.isArray() || parts.size()!=1)throw invalid();
        var part=parts.get(0);
        if(!part.isObject() || !Set.of("text","thought","thoughtSignature").containsAll(part.propertyNames()) || !part.path("text").isString()
                || (part.has("thought") && (!part.path("thought").isBoolean() || part.path("thought").asBoolean())))throw invalid();
        // Optional opaque wire metadata is discarded, never stored/replayed as application context.
        if(part.has("thoughtSignature")) {
            var signature=part.get("thoughtSignature");
            if(!signature.isString() || signature.asString().isEmpty())throw invalid();
            try{Base64.getDecoder().decode(signature.asString());}catch(IllegalArgumentException malformed){throw invalid();}
        }
        return part.get("text").asString();
    }
    private static AiFailure invalid(){return new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);}
}
