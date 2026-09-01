package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class AiProposalTests {
    final JsonMapper json=JsonMapper.builder().build();
    String encoded(Object value){return json.writeValueAsString(Map.of("result",value));}
    @Test void closedProposalAndClarificationContractsAreStrictAndImmutable() {
        var proposal=AiProposal.decode(encoded(Map.of("kind","proposal","explanation","Review first","assumptions",List.of("Synthetic"),"questions",List.of(),"dslJson","{}")),"secret-not-present");
        assertThat(proposal.kind()).isEqualTo("proposal");assertThat(proposal.assumptions()).isUnmodifiable();
        var clarification=AiProposal.decode(encoded(clarification("Missing risk")),"secret-not-present");
        assertThat(clarification.dslJson()).isNull();
        for(Object invalid:List.of(
                Map.of("kind","proposal","explanation","x","assumptions",List.of(),"questions",List.of("not allowed"),"dslJson","{}"),
                clarification("x"),
                Map.of("kind","proposal","explanation","x","assumptions",List.of(),"questions",List.of(),"dslJson","{}","code","run()"),
                Map.of("kind","proposal","explanation","x".repeat(1501),"assumptions",List.of(),"questions",List.of(),"dslJson","{}")))
            assertThatThrownBy(()->AiProposal.decode(encoded(invalid),"secret-not-present")).isInstanceOfSatisfying(AiFailure.class,e->assertThat(e.code()).isEqualTo(AiFailure.Code.AI_INVALID_RESPONSE));
    }
    private Map<String,Object> clarification(String explanation) {
        var value=new LinkedHashMap<String,Object>(); value.put("kind","clarification"); value.put("explanation",explanation);
        value.put("assumptions",List.of()); value.put("questions",explanation.equals("x")?List.of():List.of("Risk size?")); value.put("dslJson",null); return value;
    }
    @Test void malformedDslAndDecodedSecretEchoFailBeforePersistence() {
        String key="synthetic-proposal-secret-key-value";
        String escaped="{\"metadata\":\"\\"+"u0073"+key.substring(1)+"\"}";
        for(String value:List.of("{",encoded(Map.of("metadata",key)),escaped)) {
            var outer=encoded(Map.of("kind","proposal","explanation","x","assumptions",List.of(),"questions",List.of(),"dslJson",value));
            assertThatThrownBy(()->AiProposal.decode(outer,key)).as("reject %s",value).isInstanceOfSatisfying(AiFailure.class,e->assertThat(e.code()).isEqualTo(AiFailure.Code.AI_INVALID_RESPONSE));
        }
        assertThatThrownBy(()->new AiProposal("proposal","x",Collections.nCopies(6,"a"),List.of(),"{}"))
                .isInstanceOf(AiFailure.class);
    }
    @Test void trustedGuidanceUsesBundledNeutralSchemaWithoutToolsOrUrls() {
        assertThat(AiProposalProtocol.INSTRUCTIONS).contains("AITrading Strategy DSL 1.0.0","clarification","Dow, Wyckoff","no look-ahead");
        String policy=AiProposalProtocol.INSTRUCTIONS.substring(0,AiProposalProtocol.INSTRUCTIONS.indexOf("{\r\n")>0?AiProposalProtocol.INSTRUCTIONS.indexOf("{\r\n"):AiProposalProtocol.INSTRUCTIONS.indexOf("{\n"));
        assertThat(policy).doesNotContain("http://","https://");
        assertThat(AiProposalProtocol.SCHEMA.get("additionalProperties")).isEqualTo(false);
        assertThat(AiProposalProtocol.SCHEMA.toString()).contains("anyOf","maxItems=0","minItems=1");
    }
}
