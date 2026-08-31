package com.aitrading.ai;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

@org.springframework.context.annotation.Configuration(proxyBeanMethods=false)
public class AiProviderConfiguration {
    static final String DEFAULT_GEMINI_MODEL="gemini-3.5-flash";
    @Bean(destroyMethod="close")
    AiProvider selectedAiProvider(@Value("${AITRADING_AI_PROVIDER:gemini}") String provider,
            @Value("${AITRADING_AI_ENABLED:false}") boolean enabled,
            @Value("${GEMINI_API_KEY:}") String geminiKey,@Value("${OPENAI_API_KEY:}") String openAiKey,
            @Value("${AITRADING_AI_MODEL:}") String model) {
        return select(provider,enabled,geminiKey,openAiKey,model);
    }
    static AiProvider select(String provider,boolean enabled,String geminiKey,String openAiKey,String model) {
        if("gemini".equals(provider))return new GeminiProvider(enabled,geminiKey,
                model==null || model.isEmpty()?DEFAULT_GEMINI_MODEL:model);
        if("openai".equals(provider))return new OpenAiProvider(enabled,openAiKey,model);
        return new AiProvider() {
            @Override public Configuration configuration(){return new Configuration(false,null,null);}
            @Override public AiAnswer answer(List<ContextMessage> context){throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);}
        };
    }
}
