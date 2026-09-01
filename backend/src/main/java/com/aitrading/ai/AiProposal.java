package com.aitrading.ai;

import java.nio.charset.StandardCharsets;
import java.util.*;

/** Typed untrusted proposal; READY still requires the trusted semantic DSL validator. */
public record AiProposal(String kind,String explanation,List<String> assumptions,List<String> questions,String dslJson) {
    public AiProposal {
        if(!Set.of("proposal","clarification").contains(kind==null?"":kind) || !safe(explanation,1500)
                || assumptions==null || questions==null || assumptions.size()>5 || questions.size()>5
                || assumptions.stream().anyMatch(v->!safe(v,160)) || questions.stream().anyMatch(v->!safe(v,160)))throw invalid();
        if(kind.equals("proposal")) {
            if(dslJson==null || dslJson.isBlank() || dslJson.getBytes(StandardCharsets.UTF_8).length>65536 || !questions.isEmpty())throw invalid();
        }else if(dslJson!=null || questions.isEmpty())throw invalid();
        assumptions=List.copyOf(assumptions);questions=List.copyOf(questions);
    }
    private static boolean safe(String value,int max) {
        return value!=null && !value.isBlank() && value.length()<=max && value.codePoints().noneMatch(c->
                (c>=0xD800&&c<=0xDFFF)||(Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t'));
    }
    static AiProposal decode(String text,String key) {
        var root=AiProviderProtocol.parse(text);
        if(!root.isObject() || !Set.of("result").equals(new HashSet<>(root.propertyNames())))throw invalid();
        var value=root.path("result");
        if(!value.isObject() || !Set.of("kind","explanation","assumptions","questions","dslJson").equals(new HashSet<>(value.propertyNames()))
                || !value.path("kind").isString() || !value.path("explanation").isString()
                || !(value.path("dslJson").isNull() || value.path("dslJson").isString()))throw invalid();
        List<List<String>> lists=new ArrayList<>();
        for(String field:List.of("assumptions","questions")) {
            var input=value.path(field);if(!input.isArray() || input.size()>5)throw invalid();
            List<String> items=new ArrayList<>();for(var item:input){if(!item.isString())throw invalid();items.add(item.asString());}lists.add(items);
        }
        var proposal=new AiProposal(value.get("kind").asString(),value.get("explanation").asString(),lists.get(0),lists.get(1),
                value.get("dslJson").isNull()?null:value.get("dslJson").asString());
        if(root.toString().contains(key) || (proposal.dslJson()!=null && AiProviderProtocol.parse(proposal.dslJson()).toString().contains(key)))throw invalid();
        return proposal;
    }
    private static AiFailure invalid(){return new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);}
}
