package com.aitrading.generation;

import com.aitrading.ai.*;
import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.dsl.DslValidator;
import com.aitrading.market.MarketCsvParser;
import com.aitrading.strategy.StrategyService;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class GenerationStore {
    private final JdbcTemplate jdbc;private final DslValidator validator;private final StrategyService strategies;
    private static final JsonMapper JSON=JsonMapper.builder().build();
    public record Start(String requestId,Integer expectedRevision,String conversationId,Long expectedConversationVersion,Long sourceSequence) { }
    public record Attempt(UUID strategyId,UUID requestId,UUID conversationId,int expectedRevision,long expectedConversationVersion,long sourceSequence,
            long contextStart,int contextCount,String contextHash,String provider,String model,String state,String errorCode,AiProposal proposal,
            String dslHash,Integer acceptedRevision,Instant createdAt,Instant expiresAt,Instant updatedAt) { }
    public record Reservation(Attempt attempt,List<AiProvider.ContextMessage> context,boolean execute) { }
    private record Source(long version,long sequence) { }
    private record Saved(long sequence,String role,String content) { }
    public GenerationStore(JdbcTemplate jdbc,DslValidator validator,StrategyService strategies){this.jdbc=jdbc;this.validator=validator;this.strategies=strategies;}
    private void user(UserPrincipal user) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())throw new BadCredentialsException("Invalid session");
    }
    private int strategy(UserPrincipal user,UUID id) {
        return jdbc.queryForList("SELECT current_revision FROM trading.strategy WHERE id=? AND owner_id=? FOR UPDATE",Integer.class,id,user.id()).stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    private Source source(UserPrincipal user,UUID id) {
        return jdbc.query("SELECT version,last_sequence FROM trading.conversation WHERE id=? AND owner_id=? FOR UPDATE",(r,i)->new Source(r.getLong(1),r.getLong(2)),id,user.id()).stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    private Attempt row(ResultSet r,int unused)throws SQLException {
        String proposal=r.getString("proposal_json");
        return new Attempt(r.getObject("strategy_id",UUID.class),r.getObject("request_id",UUID.class),r.getObject("conversation_id",UUID.class),r.getInt("expected_revision"),
                r.getLong("expected_conversation_version"),r.getLong("source_sequence"),r.getLong("context_start"),r.getInt("context_count"),r.getString("context_hash"),r.getString("provider"),r.getString("model"),
                r.getString("state"),r.getString("error_code"),proposal==null?null:JSON.readValue(proposal,AiProposal.class),r.getString("dsl_hash"),r.getObject("accepted_revision",Integer.class),
                r.getObject("created_at",OffsetDateTime.class).toInstant(),r.getObject("expires_at",OffsetDateTime.class).toInstant(),r.getObject("updated_at",OffsetDateTime.class).toInstant());
    }
    private List<Attempt> find(UserPrincipal user,UUID id,UUID request) {
        return jdbc.query("SELECT g.* FROM trading.strategy_generation g JOIN trading.strategy s ON s.id=g.strategy_id JOIN trading.conversation c ON c.id=g.conversation_id WHERE s.owner_id=? AND c.owner_id=? AND g.strategy_id=? AND g.request_id=?",this::row,user.id(),user.id(),id,request);
    }
    private Attempt required(UserPrincipal user,UUID id,UUID request){return find(user,id,request).stream().findFirst().orElseThrow(ResourceFailure::missing);}
    private void expire(UUID id){jdbc.update("UPDATE trading.strategy_generation SET state='FAILED',error_code='AI_EXPIRED',updated_at=clock_timestamp() WHERE strategy_id=? AND state='PENDING' AND expires_at<=clock_timestamp()",id);}
    @Transactional public Reservation reserve(UserPrincipal user,UUID id,Start input,AiProvider.Configuration config) {
        UUID request=StrategyService.id(input.requestId()),conversation=StrategyService.id(input.conversationId());
        if(input.expectedRevision()==null || input.expectedRevision()<1 || input.expectedRevision()>100 || input.expectedConversationVersion()==null || input.expectedConversationVersion()<1
                || input.sourceSequence()==null || input.sourceSequence()<1 || input.sourceSequence()>1999)throw new IllegalArgumentException("Invalid source version");
        user(user);int revision=strategy(user,id);Source current=source(user,conversation);expire(id);
        var previous=find(user,id,request);
        if(!previous.isEmpty()) {
            var old=previous.getFirst();
            if(!old.conversationId().equals(conversation) || old.expectedRevision()!=input.expectedRevision() || old.expectedConversationVersion()!=input.expectedConversationVersion() || old.sourceSequence()!=input.sourceSequence())throw ResourceFailure.conflict();
            return new Reservation(old,List.of(),false);
        }
        if(revision!=input.expectedRevision() || current.version()!=input.expectedConversationVersion() || current.sequence()!=input.sourceSequence())throw ResourceFailure.conflict();
        if(!config.configured())throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);
        if(jdbc.queryForObject("SELECT count(*) FROM trading.strategy_generation WHERE strategy_id=?",Long.class,id)>=100
                || jdbc.queryForObject("SELECT count(*) FROM trading.strategy_generation WHERE strategy_id=? AND state='PENDING'",Long.class,id)>0)throw ResourceFailure.conflict();
        var rows=jdbc.query("SELECT sequence,role,content FROM trading.conversation_message WHERE conversation_id=? ORDER BY sequence DESC LIMIT 20",(r,i)->new Saved(r.getLong(1),r.getString(2),r.getString(3)),conversation);
        if(rows.isEmpty() || !rows.getFirst().role().equals("user") || rows.getFirst().sequence()!=input.sourceSequence())throw ResourceFailure.conflict();
        List<Saved> selected=new ArrayList<>();int chars=0;
        for(var item:rows){if(chars+item.content().length()>16000)break;selected.add(item);chars+=item.content().length();}Collections.reverse(selected);
        String hash=MarketCsvParser.hash(JSON.writeValueAsString(selected.stream().map(m->List.of(m.sequence(),m.role(),m.content())).toList()));
        jdbc.update("""
                INSERT INTO trading.strategy_generation(strategy_id,request_id,conversation_id,expected_revision,expected_conversation_version,source_sequence,context_start,context_count,context_hash,provider,model,state)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,'PENDING')
                """,id,request,conversation,revision,current.version(),current.sequence(),selected.getFirst().sequence(),selected.size(),hash,config.provider(),config.model());
        return new Reservation(required(user,id,request),selected.stream().map(m->new AiProvider.ContextMessage(m.role(),m.content())).toList(),true);
    }
    @Transactional public Attempt finish(UserPrincipal user,UUID id,UUID request,AiProposal proposal,AiFailure.Code failure) {
        user(user);int revision=strategy(user,id);expire(id);Attempt attempt=required(user,id,request);Source current=source(user,attempt.conversationId());
        if(!attempt.state().equals("PENDING"))return attempt;
        if(revision!=attempt.expectedRevision() || current.version()!=attempt.expectedConversationVersion() || current.sequence()!=attempt.sourceSequence())failure=AiFailure.Code.AI_STALE_CONTEXT;
        String hash=null;
        if(failure==null && proposal!=null && proposal.kind().equals("proposal")) {
            try {
                var checked=validator.validate(proposal.dslJson().getBytes(StandardCharsets.UTF_8));
                if(!checked.valid())failure=AiFailure.Code.AI_INVALID_RESPONSE;
                else{hash=checked.document().hash();proposal=new AiProposal(proposal.kind(),proposal.explanation(),proposal.assumptions(),proposal.questions(),checked.document().canonicalJson());}
            }catch(IllegalArgumentException invalid){failure=AiFailure.Code.AI_INVALID_RESPONSE;}
        }
        if(proposal==null && failure==null)failure=AiFailure.Code.AI_INVALID_RESPONSE;
        if(failure!=null)jdbc.update("UPDATE trading.strategy_generation SET state='FAILED',error_code=?,updated_at=clock_timestamp() WHERE strategy_id=? AND request_id=?",failure.name(),id,request);
        else jdbc.update("UPDATE trading.strategy_generation SET state=?,proposal_json=?,dsl_hash=?,updated_at=clock_timestamp() WHERE strategy_id=? AND request_id=?",proposal.kind().equals("proposal")?"READY":"CLARIFICATION",JSON.writeValueAsString(proposal),hash,id,request);
        return required(user,id,request);
    }
    @Transactional public Attempt get(UserPrincipal user,UUID id,UUID request){user(user);strategy(user,id);expire(id);return required(user,id,request);}
    @Transactional public Attempt latest(UserPrincipal user,UUID id) {
        user(user);strategy(user,id);expire(id);
        return jdbc.query("SELECT g.* FROM trading.strategy_generation g JOIN trading.conversation c ON c.id=g.conversation_id WHERE g.strategy_id=? AND c.owner_id=? ORDER BY g.created_at DESC,g.request_id DESC LIMIT 1",this::row,id,user.id()).stream().findFirst().orElse(null);
    }
    @Transactional public Attempt decide(UserPrincipal user,UUID id,UUID request,String action) {
        user(user);int revision=strategy(user,id);expire(id);Attempt attempt=required(user,id,request);source(user,attempt.conversationId());
        if(action.equals("cancel")) {
            if(attempt.state().equals("PENDING"))jdbc.update("UPDATE trading.strategy_generation SET state='CANCELLED',error_code='AI_CANCELLED',updated_at=clock_timestamp() WHERE strategy_id=? AND request_id=?",id,request);
        }else if(action.equals("reject")) {
            if(!Set.of("READY","CLARIFICATION","REJECTED").contains(attempt.state()))throw ResourceFailure.conflict();
            if(!attempt.state().equals("REJECTED"))jdbc.update("UPDATE trading.strategy_generation SET state='REJECTED',updated_at=clock_timestamp() WHERE strategy_id=? AND request_id=?",id,request);
        }else if(action.equals("accept")) {
            if(attempt.state().equals("ACCEPTED"))return attempt;
            if(!attempt.state().equals("READY") || revision!=attempt.expectedRevision())throw ResourceFailure.conflict();
            var current=strategies.get(user,id,null);
            var saved=strategies.save(user,id,new StrategyService.Save(request.toString(),revision,current.title(),attempt.proposal().dslJson(),"VALIDATED"));
            if(!saved.hash().equals(attempt.dslHash()))throw ResourceFailure.conflict();
            jdbc.update("UPDATE trading.strategy_generation SET state='ACCEPTED',accepted_revision=?,updated_at=clock_timestamp() WHERE strategy_id=? AND request_id=?",saved.revision(),id,request);
        }else throw new IllegalArgumentException("Invalid decision");
        return required(user,id,request);
    }
}
