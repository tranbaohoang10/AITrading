package com.aitrading.ai;

import java.nio.charset.StandardCharsets;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;

/** Untrusted structured journal feedback. Grounding is checked again by the store. */
public record AiJournalEvaluation(String kind,String summary,List<Item> rubric,List<String> strengths,
        List<String> improvements,List<String> questions,String disclaimer) {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    public static final List<String> CRITERIA=List.of("specificity","evidence","risk","invalidation");
    public record Item(String criterion,int score,String evidence,String feedback) { }
    public AiJournalEvaluation {
        if(!Set.of("evaluation","insufficient").contains(kind)||!safe(summary,1200)||!safe(disclaimer,500)
                ||rubric==null||strengths==null||improvements==null||questions==null
                ||strengths.size()>4||improvements.size()>4||questions.size()>4
                ||strengths.stream().anyMatch(v->!safe(v,240))||improvements.stream().anyMatch(v->!safe(v,240))||questions.stream().anyMatch(v->!safe(v,200)))throw invalid();
        if(kind.equals("evaluation")) {
            if(questions.size()>0||rubric.size()!=4||!rubric.stream().map(Item::criterion).toList().equals(CRITERIA))throw invalid();
            for(var item:rubric)if(item.score()<0||item.score()>25||!safe(item.evidence(),240)||!safe(item.feedback(),300))throw invalid();
        } else if(!rubric.isEmpty()||questions.isEmpty())throw invalid();
        rubric=List.copyOf(rubric);strengths=List.copyOf(strengths);improvements=List.copyOf(improvements);questions=List.copyOf(questions);
    }
    public int score(){return rubric.stream().mapToInt(Item::score).sum();}
    public static AiJournalEvaluation decode(String value,String secret) {
        try {
            if(value==null||value.getBytes(StandardCharsets.UTF_8).length>65536||(secret!=null&&!secret.isEmpty()&&value.contains(secret)))throw invalid();
            var root=JSON.readTree(value);if(!root.isObject()||root.size()!=1||!root.has("result"))throw invalid();
            return JSON.treeToValue(root.get("result"),AiJournalEvaluation.class);
        } catch(AiFailure failure){throw failure;}catch(Exception malformed){throw invalid();}
    }
    private static boolean safe(String value,int max){return value!=null&&!value.isBlank()&&value.length()<=max&&value.codePoints().noneMatch(c->c==0||(Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t'));}
    private static AiFailure invalid(){return new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);}
}
