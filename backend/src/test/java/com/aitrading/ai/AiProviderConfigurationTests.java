package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;

class AiProviderConfigurationTests {
    static final String KEY="synthetic-provider-config-key-only";
    @Test void geminiDefaultAndExplicitOverrideDoNotChangeOpenAiConfiguration() {
        for(String model:Arrays.asList(null,"","gemini-2.5-flash","gemini-3.5-flash")) {
            try(var provider=AiProviderConfiguration.select("gemini",true,KEY,"",model)) {
                assertThat(provider.configuration()).isEqualTo(new AiProvider.Configuration(true,"gemini",
                        model==null || model.isEmpty()?"gemini-3.5-flash":model));
            }
        }
        try(var provider=AiProviderConfiguration.select("openai",true,"",KEY,"")) {
            assertThat(provider.configuration().configured()).isFalse();
        }
        try(var context=new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().remove("systemEnvironment");context.getEnvironment().getPropertySources().remove("systemProperties");
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("synthetic",Map.of("AITRADING_AI_ENABLED","true","GEMINI_API_KEY",KEY)));
            context.register(AiProviderConfiguration.class);context.refresh();
            assertThat(context.getBean(AiProvider.class).configuration()).isEqualTo(new AiProvider.Configuration(true,"gemini","gemini-3.5-flash"));
        }
    }
    @Test void factorySelectsExactlyOneProviderWithItsOwnKeyAndNoFallback() {
        try(var gemini=AiProviderConfiguration.select("gemini",true,KEY,"","gemini-2.5-flash");
            var openai=AiProviderConfiguration.select("openai",true,"",KEY,"configured-test-model")) {
            assertThat(gemini).isInstanceOf(GeminiProvider.class);assertThat(openai).isInstanceOf(OpenAiProvider.class);
            assertThat(gemini.configuration()).isEqualTo(new AiProvider.Configuration(true,"gemini","gemini-2.5-flash"));
            assertThat(openai.configuration().configured()).isTrue();
        }
        for(var provider:List.of(AiProviderConfiguration.select("gemini",true,"",KEY,"gemini-2.5-flash"),AiProviderConfiguration.select("openai",true,KEY,"","model"),
                AiProviderConfiguration.select("gemini",false,KEY,KEY,"gemini-2.5-flash"),AiProviderConfiguration.select("gemini",true,KEY,KEY," "))) {
            try(provider){assertThat(provider.configuration().configured()).isFalse();assertThat(provider.configuration().model()).isNull();
                assertThatThrownBy(()->provider.answer(List.of(new AiProvider.ContextMessage("user","synthetic")))).isInstanceOfSatisfying(AiFailure.class,e->assertThat(e.code()).isEqualTo(AiFailure.Code.AI_UNCONFIGURED));}
        }
    }
    @Test void unsupportedSelectorIsNotEchoedAndCannotEnableAnyProvider() {
        for(String selector:Arrays.asList(null,"","Gemini","gemini ",KEY,"https://untrusted.invalid")) {
            try(var p=AiProviderConfiguration.select(selector,true,KEY,KEY,"gemini-2.5-flash")) {
                assertThat(p.configuration()).isEqualTo(new AiProvider.Configuration(false,null,null));
                assertThatThrownBy(()->p.answer(List.of())).hasMessage("AI_UNCONFIGURED").hasNoCause();
            }
        }
    }
    @Test void springEnvironmentBindsOneSelectedBeanWithGeminiAsSafeDefault() {
        for(String selector:List.of("gemini","openai")) {
            try(var context=new AnnotationConfigApplicationContext()) {
                var values=new HashMap<String,Object>();values.put("AITRADING_AI_PROVIDER",selector);values.put("AITRADING_AI_ENABLED","true");
                values.put("GEMINI_API_KEY",KEY);values.put("OPENAI_API_KEY",KEY);values.put("AITRADING_AI_MODEL",selector.equals("gemini")?"gemini-2.5-flash":"configured-test-model");
                context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("synthetic",values));
                context.register(AiProviderConfiguration.class);context.refresh();
                assertThat(context.getBeansOfType(AiProvider.class)).hasSize(1);
                assertThat(context.getBean(AiProvider.class).configuration().provider()).isEqualTo(selector);
            }
        }
        try(var context=new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().remove("systemEnvironment");context.getEnvironment().getPropertySources().remove("systemProperties");
            context.register(AiProviderConfiguration.class);context.refresh();
            assertThat(context.getBean(AiProvider.class).configuration()).isEqualTo(new AiProvider.Configuration(false,"gemini",null));
        }
    }
}
