package com.aitrading.auth;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository implements UserDetailsService {
    private final JdbcTemplate jdbc;
    public record Profile(UUID id, String email, String displayName) { }
    public record Credentials(String hash, long version) { }

    public UserRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public static String normalizeEmail(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        return jdbc.query("SELECT id,email,password_hash,credential_version FROM trading.app_user WHERE email=?",
                (rs, row) -> new UserPrincipal(rs.getObject("id", UUID.class), rs.getString("email"),
                        rs.getString("password_hash"), rs.getLong("credential_version")), normalizeEmail(email))
                .stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }

    public void register(String email, String name, String hash) {
        jdbc.update("INSERT INTO trading.app_user(id,email,display_name,password_hash) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING",
                UUID.randomUUID(), email, name, hash);
    }

    public Optional<Profile> profile(UUID id) {
        return jdbc.query("SELECT id,email,display_name FROM trading.app_user WHERE id=?",
                (rs, row) -> new Profile(rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("display_name")), id)
                .stream().findFirst();
    }

    public Optional<Credentials> credentials(UUID id) {
        return jdbc.query("SELECT password_hash,credential_version FROM trading.app_user WHERE id=?",
                (rs, row) -> new Credentials(rs.getString("password_hash"), rs.getLong("credential_version")), id)
                .stream().findFirst();
    }

    public boolean current(UserPrincipal principal) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM trading.app_user WHERE id=? AND credential_version=?)",
                Boolean.class, principal.id(), principal.credentialVersion()));
    }

    public boolean rename(UserPrincipal principal, String name) {
        return jdbc.update("UPDATE trading.app_user SET display_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND credential_version=?",
                name, principal.id(), principal.credentialVersion()) == 1;
    }

    public boolean changePassword(UserPrincipal principal, String hash) {
        return jdbc.update("UPDATE trading.app_user SET password_hash=?,credential_version=credential_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND credential_version=?",
                hash, principal.id(), principal.credentialVersion()) == 1;
    }
}
