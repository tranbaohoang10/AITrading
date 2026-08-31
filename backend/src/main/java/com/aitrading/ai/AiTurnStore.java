package com.aitrading.ai;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.market.MarketCsvParser;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class AiTurnStore {
    private final JdbcTemplate jdbc;
    private static final JsonMapper JSON=JsonMapper.builder().build();
    public record Turn(UUID conversationId,UUID requestId,long expectedVersion,long sourceSequence,long contextStart,
            long contextEnd,int contextCount,String contextHash,String state,String errorCode,String provider,String model,
            Long assistantSequence,Instant createdAt,Instant expiresAt,Instant updatedAt) { }
    public record Reservation(Turn turn,List<AiProvider.ContextMessage> context,boolean execute) {
        public Reservation{context=List.copyOf(context);}
    }
    private record Conversation(long version,long sequence) { }
    private record Saved(long sequence,String role,String content) { }
    public AiTurnStore(JdbcTemplate jdbc){this.jdbc=jdbc;}
    private Conversation lock(UserPrincipal user,UUID conversation) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())
            throw new BadCredentialsException("Invalid session");
        return jdbc.query("SELECT version,last_sequence FROM trading.conversation WHERE id=? AND owner_id=? FOR UPDATE",
                (rs,i)->new Conversation(rs.getLong(1),rs.getLong(2)),conversation,user.id()).stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    private Turn row(ResultSet rs,int unused) throws SQLException {
        return new Turn(rs.getObject("conversation_id",UUID.class),rs.getObject("request_id",UUID.class),rs.getLong("expected_version"),
                rs.getLong("source_sequence"),rs.getLong("context_start"),rs.getLong("context_end"),rs.getInt("context_count"),rs.getString("context_hash"),
                rs.getString("state"),rs.getString("error_code"),rs.getString("provider"),rs.getString("model"),rs.getObject("assistant_sequence",Long.class),
                rs.getObject("created_at",OffsetDateTime.class).toInstant(),rs.getObject("expires_at",OffsetDateTime.class).toInstant(),rs.getObject("updated_at",OffsetDateTime.class).toInstant());
    }
    private List<Turn> find(UserPrincipal user,UUID conversation,UUID request) {
        return jdbc.query("SELECT t.* FROM trading.ai_turn t JOIN trading.conversation c ON c.id=t.conversation_id WHERE c.owner_id=? AND t.conversation_id=? AND t.request_id=?",
                this::row,user.id(),conversation,request);
    }
    private Turn required(UserPrincipal user,UUID conversation,UUID request){return find(user,conversation,request).stream().findFirst().orElseThrow(ResourceFailure::missing);}
    private void expire(UserPrincipal user,UUID conversation) {
        jdbc.update("""
                UPDATE trading.ai_turn t SET state='FAILED',error_code='AI_EXPIRED',updated_at=clock_timestamp()
                FROM trading.conversation c WHERE c.id=t.conversation_id AND c.owner_id=? AND c.id=?
                AND t.state='PENDING' AND t.expires_at<=clock_timestamp()
                """,user.id(),conversation);
    }
    @Transactional
    public Reservation reserve(UserPrincipal user,UUID conversation,UUID request,Long expected,Long source,AiProvider.Configuration configuration) {
        if(expected==null || expected<1 || source==null || source<1 || source>1999)throw new IllegalArgumentException("Invalid AI request");
        Conversation current=lock(user,conversation);expire(user,conversation);
        var existing=find(user,conversation,request);
        if(!existing.isEmpty()) {
            Turn turn=existing.getFirst();
            if(turn.expectedVersion()!=expected || turn.sourceSequence()!=source)throw ResourceFailure.conflict();
            return new Reservation(turn,List.of(),false);
        }
        if(current.version()!=expected || current.sequence()!=source)throw ResourceFailure.conflict();
        if(!configuration.configured())throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED);
        if(jdbc.queryForObject("SELECT count(*) FROM trading.ai_turn WHERE conversation_id=?",Long.class,conversation)>=100
                || jdbc.queryForObject("SELECT count(*) FROM trading.ai_turn WHERE conversation_id=? AND state='PENDING'",Long.class,conversation)>0)
            throw ResourceFailure.conflict();
        List<Saved> rows=jdbc.query("""
                SELECT m.sequence,m.role,m.content FROM trading.conversation_message m JOIN trading.conversation c ON c.id=m.conversation_id
                WHERE c.id=? AND c.owner_id=? ORDER BY m.sequence DESC LIMIT 20
                """,(rs,i)->new Saved(rs.getLong(1),rs.getString(2),rs.getString(3)),conversation,user.id());
        if(rows.isEmpty() || !rows.getFirst().role().equals("user") || rows.getFirst().sequence()!=source)throw ResourceFailure.conflict();
        List<Saved> selected=new ArrayList<>();int characters=0;
        for(Saved row:rows) {
            if(characters+row.content().length()>16000)break;
            selected.add(row);characters+=row.content().length();
        }
        Collections.reverse(selected);
        String hash=MarketCsvParser.hash(JSON.writeValueAsString(selected.stream().map(v->List.of(v.sequence(),v.role(),v.content())).toList()));
        jdbc.update("""
                INSERT INTO trading.ai_turn(conversation_id,request_id,expected_version,source_sequence,context_start,context_end,context_count,context_hash,state,provider,model)
                VALUES (?,?,?,?,?,?,?,?,'PENDING',?,?)
                """,conversation,request,expected,source,selected.getFirst().sequence(),source,selected.size(),hash,configuration.provider(),configuration.model());
        return new Reservation(required(user,conversation,request),selected.stream().map(v->new AiProvider.ContextMessage(v.role(),v.content())).toList(),true);
    }
    @Transactional
    public Turn latest(UserPrincipal user,UUID conversation) {
        lock(user,conversation);expire(user,conversation);
        return jdbc.query("""
                SELECT t.* FROM trading.ai_turn t JOIN trading.conversation c ON c.id=t.conversation_id
                WHERE c.owner_id=? AND c.id=? ORDER BY t.created_at DESC,t.request_id DESC LIMIT 1
                """,this::row,user.id(),conversation).stream().findFirst().orElse(null);
    }
    @Transactional
    public Turn get(UserPrincipal user,UUID conversation,UUID request) {
        lock(user,conversation);expire(user,conversation);return required(user,conversation,request);
    }
    @Transactional
    public Turn cancel(UserPrincipal user,UUID conversation,UUID request) {
        lock(user,conversation);expire(user,conversation);Turn turn=required(user,conversation,request);
        if(turn.state().equals("PENDING"))terminal(conversation,request,"CANCELLED",AiFailure.Code.AI_CANCELLED);
        return required(user,conversation,request);
    }
    private void terminal(UUID conversation,UUID request,String state,AiFailure.Code code) {
        // Caller already holds the current user's owned conversation lock.
        jdbc.update("UPDATE trading.ai_turn SET state=?,error_code=?,updated_at=clock_timestamp() WHERE conversation_id=? AND request_id=? AND state='PENDING'",
                state,code.name(),conversation,request);
    }
    @Transactional
    public Turn finish(UserPrincipal user,UUID conversation,UUID request,AiAnswer answer,AiFailure.Code failure) {
        Conversation current=lock(user,conversation);expire(user,conversation);Turn turn=required(user,conversation,request);
        if(!turn.state().equals("PENDING"))return turn;
        if(current.version()!=turn.expectedVersion() || current.sequence()!=turn.sourceSequence())failure=AiFailure.Code.AI_STALE_CONTEXT;
        if(failure!=null) {
            terminal(conversation,request,"FAILED",failure);return required(user,conversation,request);
        }
        if(answer==null || answer.content().length()>4000)throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
        long sequence=current.sequence()+1;
        jdbc.update("INSERT INTO trading.conversation_message(conversation_id,sequence,request_id,role,content) VALUES (?,?,?,'assistant',?)",
                conversation,sequence,UUID.randomUUID(),answer.content());
        jdbc.update("UPDATE trading.conversation SET last_sequence=?,version=version+1,updated_at=clock_timestamp() WHERE id=? AND owner_id=?",
                sequence,conversation,user.id());
        jdbc.update("UPDATE trading.ai_turn SET state='SUCCEEDED',assistant_sequence=?,response_json=?,updated_at=clock_timestamp() WHERE conversation_id=? AND request_id=? AND state='PENDING'",
                sequence,JSON.writeValueAsString(answer),conversation,request);
        return required(user,conversation,request);
    }
}
