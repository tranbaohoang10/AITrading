package com.aitrading.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    public record Health(String status) { }

    public HealthController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/api/health")
    public ResponseEntity<?> health(HttpServletRequest request) {
        try {
            Integer value = jdbc.queryForObject("SELECT 1", Integer.class);
            if (Integer.valueOf(1).equals(value)) return ResponseEntity.ok(new Health("UP"));
        } catch (DataAccessException ignored) {
            // Do not log database exceptions: messages can expose hostnames or credentials.
        }
        return ResponseEntity.status(503).body(
                new ApiErrors.ErrorBody(ApiErrors.Code.UNAVAILABLE.name(), ApiErrors.requestId(request)));
    }
}
