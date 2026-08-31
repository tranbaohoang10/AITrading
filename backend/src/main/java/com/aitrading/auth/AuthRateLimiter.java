package com.aitrading.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class AuthRateLimiter {
    public static final long WINDOW_SECONDS = 900;
    private final JdbcTemplate jdbc;
    public AuthRateLimiter(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public boolean allow(String purpose, String key, int limit) {
        Long window = jdbc.queryForObject("SELECT floor(extract(epoch FROM CURRENT_TIMESTAMP)/900)::bigint", Long.class);
        jdbc.update("DELETE FROM trading.auth_rate_bucket WHERE window_start < ?", window - 96);
        Integer count = jdbc.queryForObject("""
                INSERT INTO trading.auth_rate_bucket(bucket_key,window_start,attempts) VALUES (?,?,1)
                ON CONFLICT(bucket_key,window_start) DO UPDATE SET attempts=LEAST(trading.auth_rate_bucket.attempts+1,1000000)
                RETURNING attempts
                """, Integer.class, bucketKey(purpose, key), window);
        return count != null && count <= limit;
    }

    public static String bucketKey(String purpose, String key) {
        try {
            return purpose + ":" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(key.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
