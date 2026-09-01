package com.aitrading.journal;

import com.aitrading.ai.*;
import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.market.MarketCsvParser;
import com.aitrading.strategy.StrategyService;
import java.sql.*;import java.time.*;import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service public class JournalEvaluationStore {
  private static final JsonMapper JSON=JsonMapper.builder().build(); private final JdbcTemplate jdbc;
  public JournalEvaluationStore(JdbcTemplate jdbc){this.jdbc=jdbc;}
  public record Start(String requestId,Integer expectedVersion){}
  public record Evaluation(UUID journalId,UUID requestId,int expectedVersion,String snapshotHash,String provider,String model,String state,String errorCode,AiJournalEvaluation result,Integer score,Instant createdAt,Instant expiresAt,Instant updatedAt){}
  public record Reservation(Evaluation evaluation,List<AiProvider.ContextMessage> context,String reason,boolean execute){}
  private void user(UserPrincipal u){if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,u.id(),u.credentialVersion()).isEmpty())throw new BadCredentialsException("Invalid session");}
  private Map<String,Object> journal(UserPrincipal u,UUID id){return jdbc.queryForList("SELECT id,version,symbol,timeframe,side,state,entry_time,exit_time,entry_reason,notes FROM trading.journal_entry WHERE id=? AND owner_id=? FOR UPDATE",id,u.id()).stream().findFirst().orElseThrow(ResourceFailure::missing);}
  private Evaluation row(ResultSet r,int i)throws SQLException{String json=r.getString("result_json");return new Evaluation(r.getObject("journal_id",UUID.class),r.getObject("request_id",UUID.class),r.getInt("expected_version"),r.getString("snapshot_hash"),r.getString("provider"),r.getString("model"),r.getString("state"),r.getString("error_code"),json==null?null:JSON.readValue(json,AiJournalEvaluation.class),r.getObject("score",Integer.class),r.getObject("created_at",OffsetDateTime.class).toInstant(),r.getObject("expires_at",OffsetDateTime.class).toInstant(),r.getObject("updated_at",OffsetDateTime.class).toInstant());}
  private Evaluation required(UserPrincipal u,UUID id,UUID req){return jdbc.query("SELECT * FROM trading.journal_evaluation WHERE journal_id=? AND request_id=? AND owner_id=?",this::row,id,req,u.id()).stream().findFirst().orElseThrow(ResourceFailure::missing);}
  private void expire(UUID id){jdbc.update("UPDATE trading.journal_evaluation SET state='FAILED',error_code='AI_EXPIRED',updated_at=clock_timestamp() WHERE journal_id=? AND state='PENDING' AND expires_at<=clock_timestamp()",id);}
  @Transactional public Reservation reserve(UserPrincipal u,UUID id,Start in,AiProvider.Configuration config){
    if(in==null||in.expectedVersion()==null||in.expectedVersion()<1||in.expectedVersion()>100)throw new IllegalArgumentException("Invalid journal evaluation");UUID req=StrategyService.id(in.requestId());user(u);var j=journal(u,id);expire(id);
    var old=jdbc.query("SELECT * FROM trading.journal_evaluation WHERE journal_id=? AND request_id=? AND owner_id=?",this::row,id,req,u.id());if(!old.isEmpty()){if(old.getFirst().expectedVersion()!=in.expectedVersion())throw ResourceFailure.conflict();return new Reservation(old.getFirst(),List.of(),"",false);}
    if(((Integer)j.get("version"))!=in.expectedVersion())throw ResourceFailure.conflict();if(!config.configured())throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);
    if(jdbc.queryForObject("SELECT count(*) FROM trading.journal_evaluation WHERE journal_id=?",Long.class,id)>=100||jdbc.queryForObject("SELECT count(*) FROM trading.journal_evaluation WHERE journal_id=? AND state='PENDING'",Long.class,id)>0)throw ResourceFailure.conflict();
    var snapshot=new LinkedHashMap<String,Object>();for(String k:List.of("version","symbol","timeframe","side","state","entry_time","exit_time","entry_reason"))snapshot.put(k,j.get(k));String encoded=JSON.writeValueAsString(snapshot);String hash=MarketCsvParser.hash(encoded);
    jdbc.update("INSERT INTO trading.journal_evaluation(journal_id,request_id,owner_id,expected_version,snapshot_hash,provider,model,state) VALUES(?,?,?,?,?,?,?,'PENDING')",id,req,u.id(),in.expectedVersion(),hash,config.provider(),config.model());
    return new Reservation(required(u,id,req),List.of(new AiProvider.ContextMessage("user",encoded)),String.valueOf(j.get("entry_reason")),true);
  }
  @Transactional public Evaluation finish(UserPrincipal u,UUID id,UUID req,AiJournalEvaluation result,AiFailure.Code failure,String reason){user(u);var j=journal(u,id);expire(id);var e=required(u,id,req);if(!e.state().equals("PENDING"))return e;
    if(((Integer)j.get("version"))!=e.expectedVersion())failure=AiFailure.Code.AI_STALE_CONTEXT;
    if(failure==null&&result!=null&&result.kind().equals("evaluation"))for(var item:result.rubric())if(!reason.contains(item.evidence())){failure=AiFailure.Code.AI_INVALID_RESPONSE;break;}
    if(result==null&&failure==null)failure=AiFailure.Code.AI_INVALID_RESPONSE;
    if(failure!=null)jdbc.update("UPDATE trading.journal_evaluation SET state='FAILED',error_code=?,updated_at=clock_timestamp() WHERE journal_id=? AND request_id=?",failure.name(),id,req);
    else jdbc.update("UPDATE trading.journal_evaluation SET state=?,result_json=?,score=?,updated_at=clock_timestamp() WHERE journal_id=? AND request_id=?",result.kind().equals("evaluation")?"READY":"INSUFFICIENT",JSON.writeValueAsString(result),result.kind().equals("evaluation")?result.score():null,id,req);
    return required(u,id,req);
  }
  @Transactional public Evaluation latest(UserPrincipal u,UUID id){user(u);journal(u,id);expire(id);return jdbc.query("SELECT * FROM trading.journal_evaluation WHERE journal_id=? AND owner_id=? ORDER BY created_at DESC,request_id DESC LIMIT 1",this::row,id,u.id()).stream().findFirst().orElse(null);}
  @Transactional public Evaluation get(UserPrincipal u,UUID id,UUID req){user(u);journal(u,id);expire(id);return required(u,id,req);}
  @Transactional public Evaluation cancel(UserPrincipal u,UUID id,UUID req){user(u);journal(u,id);expire(id);var e=required(u,id,req);if(e.state().equals("PENDING"))jdbc.update("UPDATE trading.journal_evaluation SET state='CANCELLED',error_code='AI_CANCELLED',updated_at=clock_timestamp() WHERE journal_id=? AND request_id=?",id,req);return required(u,id,req);}
}
