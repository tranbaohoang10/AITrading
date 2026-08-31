package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** Upgrade an owned, separate V12 database with historical data; never touch an operator DB. */
class AiProviderMigrationTests {
    @Test void upgradeKeepsHistoricalOpenAiRowsAndAddsOnlyKnownGeminiProvider()throws Exception {
        String cluster=System.getenv("AITRADING_TEST_CLUSTER");
        assertThat(cluster).isNotBlank();
        assertThat(Path.of(cluster).toAbsolutePath().normalize()).startsWith(Path.of("../tmp").toAbsolutePath().normalize());
        String port=System.getenv("AITRADING_TEST_DB_PORT"),user=System.getenv("AITRADING_DB_USER"),password=System.getenv("AITRADING_DB_PASSWORD");
        assertThat(port).matches("[0-9]{1,5}");
        String base="jdbc:postgresql://127.0.0.1:"+port+"/", database="pb008_upgrade_"+UUID.randomUUID().toString().replace("-","");
        // The harness owns this whole disposable cluster; retain the DB until its normal shutdown.
        try(var connection=DriverManager.getConnection(base+"postgres",user,password);var statement=connection.createStatement()) {
            statement.execute("CREATE DATABASE "+database);
        }
        String url=base+database;
        var previous=Flyway.configure().dataSource(url,user,password).schemas("trading").target("12").load();
        previous.migrate();
        var jdbc=new JdbcTemplate(new DriverManagerDataSource(url,user,password));
        UUID owner=UUID.randomUUID(),conversation=UUID.randomUUID(),request=UUID.randomUUID();
        jdbc.update("INSERT INTO trading.app_user(id,email,display_name,password_hash) VALUES (?,?,'Synthetic migration','disabled-no-login')",owner,"migration@example.test");
        jdbc.update("INSERT INTO trading.conversation(id,owner_id,request_id,title,version,last_sequence) VALUES (?,?,?,'Synthetic upgrade',2,1)",conversation,owner,UUID.randomUUID());
        jdbc.update("INSERT INTO trading.conversation_message(conversation_id,sequence,request_id,role,content) VALUES (?,1,?,'user','Synthetic historical prompt')",conversation,UUID.randomUUID());
        jdbc.update("""
            INSERT INTO trading.ai_turn(conversation_id,request_id,expected_version,source_sequence,context_start,context_end,context_count,context_hash,state,provider,model)
            VALUES (?,?,2,1,1,1,1,?,'PENDING','openai','historical-test-model')
            """,conversation,request,"a".repeat(64));
        var before=jdbc.queryForMap("SELECT * FROM trading.ai_turn WHERE request_id=?",request);
        assertThatThrownBy(()->jdbc.update("UPDATE trading.ai_turn SET provider='gemini' WHERE request_id=?",request))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        var current=Flyway.configure().dataSource(url,user,password).schemas("trading").load();
        assertThat(current.migrate().migrationsExecuted).isEqualTo(1);
        current.validate();
        assertThat(current.info().current().getVersion().toString()).isEqualTo("13");
        assertThat(jdbc.queryForMap("SELECT * FROM trading.ai_turn WHERE request_id=?",request)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT content FROM trading.conversation_message WHERE conversation_id=?",String.class,conversation)).isEqualTo("Synthetic historical prompt");
        assertThat(jdbc.update("UPDATE trading.ai_turn SET provider='gemini' WHERE request_id=?",request)).isEqualTo(1);
        assertThatThrownBy(()->jdbc.update("UPDATE trading.ai_turn SET provider='arbitrary' WHERE request_id=?",request))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT provider FROM trading.ai_turn WHERE request_id=?",String.class,request)).isEqualTo("gemini");
    }
}
