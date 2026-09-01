package com.aitrading.ai;
import java.util.*;
public record AiImageAnalysis(List<Evidence> visibleEvidence,List<String> visibleText,List<Inference> inferences,
        List<String> missingData,double confidence,List<String> limitations){
 public record Evidence(String id,String observation,String location){}
 public record Inference(String statement,List<String> evidenceIds){}
 public AiImageAnalysis{
  visibleEvidence=List.copyOf(visibleEvidence==null?List.of():visibleEvidence);visibleText=List.copyOf(visibleText==null?List.of():visibleText);
  inferences=List.copyOf(inferences==null?List.of():inferences);missingData=List.copyOf(missingData==null?List.of():missingData);limitations=List.copyOf(limitations==null?List.of():limitations);
  if(visibleEvidence.size()>12||visibleText.size()>12||inferences.size()>12||missingData.size()>8||limitations.isEmpty()||limitations.size()>8||!Double.isFinite(confidence)||confidence<0||confidence>1)invalid();
  Set<String> ids=new HashSet<>();for(var e:visibleEvidence)if(e==null||!valid(e.id(),24)||!valid(e.observation(),500)||!valid(e.location(),160)||!ids.add(e.id()))invalid();
  for(String s:visibleText)if(!valid(s,300))invalid();for(String s:missingData)if(!valid(s,300))invalid();for(String s:limitations)if(!valid(s,300))invalid();
  for(var i:inferences){if(i==null||!valid(i.statement(),500)||i.evidenceIds()==null||i.evidenceIds().size()>12||!ids.containsAll(i.evidenceIds()))invalid();if(i.evidenceIds().isEmpty()&&missingData.isEmpty())invalid();}
 }
 private static boolean valid(String s,int max){return s!=null&&!s.isBlank()&&s.length()<=max&&s.codePoints().noneMatch(c->c==0||(Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t'));}
 private static void invalid(){throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);}
}
