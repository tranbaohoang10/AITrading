package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;

/** Runs the complete existing HTTP/PostgreSQL authorization/race suite through real Gemini wire parsing. */
class GeminiAiApiTests extends AiApiTests {
    @Override boolean useGemini(){return true;}
    @Test void switchingPreservesHistoricalProviderAndNeverReexecutesOldAttempts()throws Exception {
        UUID id=conversation(a,"Synthetic switching fixture"),first=UUID.randomUUID();
        probe.gemini.set(false);
        var old=tree(call(a,"POST",path(id),body(first,2,1)),200);
        assertThat(old.get("provider").asString()).isEqualTo("openai");
        probe.gemini.set(true);
        assertThat(tree(call(a,"POST",path(id),body(first,2,1)),200)).isEqualTo(old);
        assertThat(probe.calls.get()).isEqualTo(1);
        conversations.append(user(a),id,UUID.randomUUID(),"Synthetic new Gemini turn");
        var fresh=tree(call(a,"POST",path(id),body(UUID.randomUUID(),4,3)),200);
        assertThat(fresh.get("provider").asString()).isEqualTo("gemini");
        assertThat(probe.calls.get()).isEqualTo(2);
        var restarted=new AiService(turns,probe);
        assertThat(restarted.get(user(a),id,first).provider()).isEqualTo("openai");
        assertThat(restarted.latest(user(a),id).provider()).isEqualTo("gemini");
        assertThat(jdbc.queryForList("SELECT provider FROM trading.ai_turn WHERE conversation_id=? ORDER BY created_at",String.class,id))
                .containsExactly("openai","gemini");
        assertThatThrownBy(()->jdbc.update("UPDATE trading.ai_turn SET provider='arbitrary' WHERE conversation_id=?",id))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void geminiExpectedAccountAndCapabilityNeverExposeCredential()throws Exception {
        UUID id=conversation(a,"Synthetic owned prompt");
        var capability=tree(call(a,"GET","/api/ai/capabilities",null),200);
        assertThat(capability.get("provider").asString()).isEqualTo("gemini");
        assertThat(capability.propertyNames()).containsExactlyInAnyOrder("configured","provider","model");
        assertThat(capability.toString()).doesNotContain("synthetic-gemini-test-key","GEMINI_API_KEY");
        tree(send(a,"POST",path(id),json.writeValueAsString(body(UUID.randomUUID(),2,1)),a.csrf(),Map.of("X-Workspace-User",b.id().toString())),401);
        tree(send(new Actor(a.client(),a.csrf(),null,a.email()),"GET","/api/ai/capabilities","",null,Map.of()),401);
        assertThat(probe.calls.get()).isZero();assertThat(assistants(id)).isZero();
    }
}
