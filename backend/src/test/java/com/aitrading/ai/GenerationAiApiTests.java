package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.generation.GenerationStore;
import java.net.http.HttpResponse;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.annotation.DirtiesContext;

@DirtiesContext(classMode=DirtiesContext.ClassMode.BEFORE_CLASS)
class GenerationAiApiTests extends AiApiTests {
    UUID strategy(Actor actor)throws Exception {
        return UUID.fromString(tree(call(actor,"POST","/api/strategies",Map.of("requestId",UUID.randomUUID(),"title","Synthetic generated strategy")),200).get("strategyId").asString());
    }
    Map<String,Object> intent(UUID conversation,UUID request,int revision,long conversationVersion,long sequence){return new LinkedHashMap<>(Map.of(
            "requestId",request,"expectedRevision",revision,"conversationId",conversation,"expectedConversationVersion",conversationVersion,"sourceSequence",sequence));}
    String generationPath(UUID strategy){return "/api/strategies/"+strategy+"/generations";}
    @Test void readyProposalNeedsExplicitIdempotentAcceptanceAndKeepsContextOwned()throws Exception {
        UUID target=strategy(a),source=conversation(a,"Synthetic fully specified strategy request"),request=UUID.randomUUID();
        UUID decoy=conversation(a,"Synthetic same-owner decoy");conversation(b,"Synthetic other-owner decoy");
        var started=tree(call(a,"POST",generationPath(target),intent(source,request,1,2,1)),200);
        assertThat(started.get("state").asString()).isEqualTo("READY");assertThat(started.get("provider").asString()).isEqualTo("openai");
        assertThat(started.get("proposal").get("kind").asString()).isEqualTo("proposal");assertThat(started.get("dslHash").asString()).hasSize(64);
        assertThat(probe.capturedContext(0)).containsExactly("Synthetic fully specified strategy request").doesNotContain("Synthetic same-owner decoy","Synthetic other-owner decoy");
        assertThat(tree(call(a,"GET","/api/strategies/"+target,null),200).get("revision").asInt()).isEqualTo(1);
        assertThat(tree(call(b,"GET",generationPath(target)+"/"+request,null),404).get("code").asString()).isEqualTo("NOT_FOUND");
        assertThat(tree(call(a,"POST",generationPath(target)+"/"+request+"/accept",Map.of()),200).get("state").asString()).isEqualTo("ACCEPTED");
        var revision=tree(call(a,"GET","/api/strategies/"+target,null),200);
        assertThat(revision.get("revision").asInt()).isEqualTo(2);assertThat(revision.get("status").asString()).isEqualTo("VALIDATED");
        assertThat(revision.get("hash").asString()).isEqualTo(started.get("dslHash").asString());
        assertThat(tree(call(a,"POST",generationPath(target)+"/"+request+"/accept",Map.of()),200).get("acceptedRevision").asInt()).isEqualTo(2);
        assertThat(probe.calls.get()).isEqualTo(1);assertThat(assistants(source)).isZero();
        tree(call(a,"GET","/api/conversations/"+decoy+"/messages",null),200);
    }
    @Test void clarificationRejectAndInvalidProviderDslNeverMutateStrategy()throws Exception {
        UUID target=strategy(a),source=conversation(a,"Synthetic ambiguous strategy" );
        probe.mode.set("clarification");UUID first=UUID.randomUUID();var clarification=tree(call(a,"POST",generationPath(target),intent(source,first,1,2,1)),200);
        assertThat(clarification.get("state").asString()).isEqualTo("CLARIFICATION");assertThat(clarification.get("proposal").get("questions").size()).isEqualTo(1);
        assertThat(tree(call(a,"POST",generationPath(target)+"/"+first+"/reject",Map.of()),200).get("state").asString()).isEqualTo("REJECTED");
        tree(call(a,"POST",generationPath(target)+"/"+first+"/accept",Map.of()),409);
        probe.mode.set("invalid-proposal");UUID second=UUID.randomUUID();var invalid=tree(call(a,"POST",generationPath(target),intent(source,second,1,2,1)),200);
        assertThat(invalid.get("state").asString()).isEqualTo("FAILED");assertThat(invalid.get("errorCode").asString()).isEqualTo("AI_INVALID_RESPONSE");
        probe.mode.set("rate");UUID third=UUID.randomUUID();var rate=tree(call(a,"POST",generationPath(target),intent(source,third,1,2,1)),200);
        assertThat(rate.get("errorCode").asString()).isEqualTo("AI_RATE_LIMITED");
        assertThat(tree(call(a,"GET","/api/strategies/"+target,null),200).get("revision").asInt()).isEqualTo(1);
    }
    @Test void inputOwnershipCsrfBindingAndVersionsFailBeforeProvider()throws Exception {
        UUID target=strategy(a),other=strategy(b),source=conversation(a,"Synthetic protected source"),request=UUID.randomUUID();var valid=intent(source,request,1,2,1);
        for(String key:List.of("ownerId","provider","model","endpoint","tools","dslJson","prompt")){var bad=new LinkedHashMap<>(valid);bad.put(key,"forged");tree(call(a,"POST",generationPath(target),bad),400);}
        var wrongVersion=new LinkedHashMap<>(valid);wrongVersion.put("expectedConversationVersion",3);tree(call(a,"POST",generationPath(target),wrongVersion),409);
        tree(call(b,"POST",generationPath(other),valid),404);
        assertThat(send(a,"POST",generationPath(target),json.writeValueAsString(valid),null,Map.of()).statusCode()).isEqualTo(403);
        assertThat(send(a,"POST",generationPath(target),json.writeValueAsString(valid),a.csrf(),Map.of("X-Workspace-User",b.id().toString())).statusCode()).isEqualTo(401);
        assertThat(probe.calls.get()).isZero();
    }
    @Test void cancellationAndConcurrentSourceOrStrategyChangeDiscardLateOutput()throws Exception {
        for(String change:List.of("cancel","source","strategy")) {
            UUID target=strategy(a),source=conversation(a,"Synthetic race "+change),request=UUID.randomUUID();probe.block(1);
            try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
                Future<HttpResponse<String>> pending=pool.submit(()->call(a,"POST",generationPath(target),intent(source,request,1,2,1)));probe.await();
                if(change.equals("cancel"))tree(call(a,"POST",generationPath(target)+"/"+request+"/cancel",Map.of()),200);
                else if(change.equals("source"))conversations.append(user(a),source,UUID.randomUUID(),"Synthetic changed source");
                else call(a,"POST","/api/strategies/"+target+"/versions",Map.of("requestId",UUID.randomUUID(),"expectedRevision",1,"title","changed","draftText","","mode","DRAFT"));
                probe.gate.get().countDown();var result=tree(pending.get(10,TimeUnit.SECONDS),200);
                assertThat(result.get("state").asString()).isEqualTo(change.equals("cancel")?"CANCELLED":"FAILED");
                if(!change.equals("cancel"))assertThat(result.get("errorCode").asString()).isEqualTo("AI_STALE_CONTEXT");
            }
            probe.reset();
        }
    }
    @Test void duplicateIntentAndDatabaseConstraintsPreserveProvenance()throws Exception {
        UUID target=strategy(a),source=conversation(a,"Synthetic replay"),request=UUID.randomUUID();var body=intent(source,request,1,2,1);
        var first=tree(call(a,"POST",generationPath(target),body),200);assertThat(tree(call(a,"POST",generationPath(target),body),200)).isEqualTo(first);assertThat(probe.calls.get()).isEqualTo(1);
        var conflict=new LinkedHashMap<>(body);conflict.put("sourceSequence",2);tree(call(a,"POST",generationPath(target),conflict),409);
        assertThatThrownBy(()->jdbc.update("UPDATE trading.strategy_generation SET provider='arbitrary' WHERE strategy_id=?",target)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT context_count FROM trading.strategy_generation WHERE strategy_id=?",Integer.class,target)).isEqualTo(1);
    }
}
