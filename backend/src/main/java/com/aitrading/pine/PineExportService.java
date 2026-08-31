package com.aitrading.pine;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.strategy.StrategyService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PineExportService {
    private final JdbcTemplate jdbc;
    private final StrategyService strategies;
    private final PineGenerator generator;
    public record Artifact(UUID strategyId, int revision, String dslHash, String schemaVersion,
            String validatorVersion, String generatorVersion, String codeHash, String code,
            Instant createdAt, List<String> limitations) { }
    public PineExportService(JdbcTemplate jdbc, StrategyService strategies, PineGenerator generator) {
        this.jdbc = jdbc; this.strategies = strategies; this.generator = generator;
    }
    private Artifact row(ResultSet r, int unused) throws SQLException {
        return new Artifact(r.getObject("strategy_id", UUID.class), r.getInt("revision"), r.getString("dsl_hash"),
                r.getString("schema_version"), r.getString("validator_version"), r.getString("generator_version"),
                r.getString("code_hash"), r.getString("code"), r.getObject("created_at", OffsetDateTime.class).toInstant(), PineGenerator.LIMITATIONS);
    }
    private List<Artifact> find(UserPrincipal user, UUID id, int revision) {
        return jdbc.query("""
                SELECT e.* FROM trading.pine_export e JOIN trading.strategy s ON s.id=e.strategy_id
                WHERE s.owner_id=? AND e.strategy_id=? AND e.revision=? AND e.generator_version=?
                """, this::row, user.id(), id, revision, PineGenerator.VERSION);
    }
    private Artifact checked(Artifact artifact, StrategyService.Revision source) {
        if (!artifact.dslHash().equals(source.hash()) || !artifact.schemaVersion().equals(source.schemaVersion())
                || !artifact.validatorVersion().equals(source.validatorVersion()) || !artifact.codeHash().equals(PineGenerator.hash(artifact.code())))
            throw new PineFailure("ARTIFACT_PROVENANCE_MISMATCH");
        return artifact;
    }
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Artifact get(UserPrincipal user, UUID id, int revision) {
        var source = strategies.get(user, id, revision);
        return checked(find(user, id, revision).stream().findFirst().orElseThrow(ResourceFailure::missing), source);
    }
    @Transactional
    public Artifact create(UserPrincipal user, UUID id, int revision) {
        if (jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE", UUID.class, user.id(), user.credentialVersion()).isEmpty())
            throw new BadCredentialsException("Invalid session");
        if (jdbc.queryForList("SELECT id FROM trading.strategy WHERE id=? AND owner_id=? FOR UPDATE", UUID.class, id, user.id()).isEmpty())
            throw ResourceFailure.missing();
        var source = strategies.get(user, id, revision);
        var prior = find(user, id, revision);
        if (!prior.isEmpty()) return checked(prior.getFirst(), source);
        if (jdbc.queryForObject("SELECT count(*) FROM trading.pine_export e JOIN trading.strategy s ON s.id=e.strategy_id WHERE s.owner_id=?", Long.class, user.id()) >= 100)
            throw ResourceFailure.conflict();
        var generated = generator.generate(source);
        jdbc.update("""
                INSERT INTO trading.pine_export(strategy_id,revision,generator_version,dsl_hash,schema_version,validator_version,code_hash,code)
                VALUES (?,?,?,?,?,?,?,?)
                """, id, revision, PineGenerator.VERSION, source.hash(), source.schemaVersion(), source.validatorVersion(), generated.codeHash(), generated.code());
        return get(user, id, revision);
    }
}
