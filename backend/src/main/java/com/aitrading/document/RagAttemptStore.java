package com.aitrading.document;

import com.aitrading.ai.AiFailure;
import org.springframework.security.authentication.BadCredentialsException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Repository public class RagAttemptStore{
 private static final JsonMapper JSON=JsonMapper.builder().build();private final JdbcTemplate jdbc;public RagAttemptStore(JdbcTemplate jdbc){this.jdbc=jdbc;}
 @Transactional public void saveCurrent(UUID owner,long credentialVersion,String question,String kind,String answer,List<String> assumptions,List<DocumentService.Citation> citations,String provider,String model){if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,owner,credentialVersion).isEmpty())throw new BadCredentialsException("Invalid session");for(var key:citations.stream().map(c->List.of(c.documentId(),c.version())).distinct().toList())if(jdbc.queryForList("SELECT id FROM trading.private_document WHERE id=? AND owner_id=? AND current_version=? FOR UPDATE",UUID.class,key.get(0),owner,key.get(1)).isEmpty())throw new AiFailure(AiFailure.Code.AI_STALE_CONTEXT);UUID attempt=UUID.randomUUID();jdbc.update("INSERT INTO trading.private_document_rag_attempt(id,owner_id,question_hash,result_kind,answer,assumptions_json,provider,model) VALUES(?,?,?,?,?,?,?,?)",attempt,owner,hash(question),kind,answer,encode(assumptions),provider,model);citations(attempt,citations);}
 @Transactional public void failed(UUID owner,String question,List<DocumentService.Citation> citations,AiFailure.Code code){UUID attempt=UUID.randomUUID();jdbc.update("INSERT INTO trading.private_document_rag_attempt(id,owner_id,question_hash,result_kind,assumptions_json,error_code) VALUES(?,?,?,?,?,?)",attempt,owner,hash(question),"failed","[]",code.name());citations(attempt,citations);}
 private void citations(UUID attempt,List<DocumentService.Citation> citations){for(int i=0;i<citations.size();i++){var c=citations.get(i);jdbc.update("INSERT INTO trading.private_document_rag_citation(attempt_id,ordinal,document_id,version,chunk_index,page_number,title,excerpt,content_hash) VALUES(?,?,?,?,?,?,?,?,?)",attempt,i+1,c.documentId(),c.version(),c.chunkIndex(),c.pageNumber(),c.title(),c.excerpt(),c.hash());}}
 private String encode(List<String> value){return JSON.writeValueAsString(value);}
 private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
}
