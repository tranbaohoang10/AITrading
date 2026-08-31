package com.aitrading.ai;

import java.util.List;

public record AiAnswer(String kind, String answer, List<String> assumptions) {
    public AiAnswer {
        if (kind==null || !List.of("answer","clarification").contains(kind) || !safe(answer,3000) || assumptions==null
                || assumptions.size()>5 || assumptions.stream().anyMatch(value->!safe(value,160)))
            throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
        answer=answer.strip(); assumptions=assumptions.stream().map(String::strip).toList();
    }
    private static boolean safe(String value,int max) {
        return value!=null && !value.isBlank() && value.length()<=max && value.codePoints().noneMatch(c->
                (c>=0xD800&&c<=0xDFFF)||(Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t'));
    }
    public String content() {
        return answer+(assumptions.isEmpty()?"":"\n\nAssumptions:\n- "+String.join("\n- ",assumptions));
    }
}
