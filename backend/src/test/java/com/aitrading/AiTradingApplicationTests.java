package com.aitrading;

import static org.assertj.core.api.Assertions.assertThat;

import com.aitrading.api.HealthController;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AiTradingApplicationTests {
    @LocalServerPort int port;
    @Autowired Flyway flyway;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserDetailsService users;
    final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    @BeforeAll
    static void isolatedClusterRequired() {
        String cluster = System.getenv("AITRADING_TEST_CLUSTER");
        assertThat(cluster).as("Run scripts/test_backend.py, never test against a user database").isNotBlank();
        Path expectedRoot = Path.of("..").toAbsolutePath().normalize().resolve("tmp");
        assertThat(Path.of(cluster).toAbsolutePath().normalize().startsWith(expectedRoot)).isTrue();
    }

    HttpResponse<String> request(String method, String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(10)).method(method, HttpRequest.BodyPublishers.noBody()).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    @Test @Order(1)
    void databaseMigrationAndRepeatValidationAreRealAndIdempotent() {
        assertThat(jdbc.queryForObject("SELECT version()", String.class)).startsWith("PostgreSQL");
        assertThat(jdbc.queryForObject("SHOW timezone", String.class)).isEqualTo("UTC");
        // PB-006 adds V4; historical V1–V3 remain untouched and must still validate.
        assertThat(flyway.info().current().getVersion().toString()).isEqualTo("4");
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.flyway_schema_history WHERE success", Integer.class)).isGreaterThanOrEqualTo(1);
    }

    @Test @Order(2)
    void healthHasMinimalJsonAndSecurityHeaders() throws Exception {
        var response = request("GET", "/api/health");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo("{\"status\":\"UP\"}");
        UUID.fromString(response.headers().firstValue("X-Request-ID").orElseThrow());
        assertThat(response.headers().firstValue("X-Content-Type-Options")).contains("nosniff");
        assertThat(response.headers().firstValue("X-Frame-Options")).contains("DENY");
        assertThat(response.headers().firstValue("Content-Security-Policy").orElseThrow()).contains("default-src 'none'");
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
        assertThat(response.headers().firstValue("Set-Cookie")).isEmpty();
    }

    @Test @Order(3)
    void allPrivateRoutesAndGeneratedLoginAreDeniedWithoutHtmlOrRequestEcho() throws Exception {
        for (String path : new String[]{"/api/private", "/login", "/actuator/env", "/not-found", "/api/users/1"}) {
            var response = request("GET", path);
            assertThat(response.statusCode()).as(path).isEqualTo(401);
            assertThat(response.headers().firstValue("Content-Type").orElseThrow()).contains("application/json");
            assertThat(response.body()).contains("UNAUTHORIZED").doesNotContain(path, "password", "<html", "Exception");
            assertThat(response.headers().firstValue("Location")).isEmpty();
        }
        assertThatThrownBy(() -> users.loadUserByUsername("user")).isInstanceOf(UsernameNotFoundException.class);
    }

    @Test @Order(4)
    void unsafeMethodsRemainCsrfProtectedAndUnsupportedMethodsDoNotBypassSecurity() throws Exception {
        for (String method : new String[]{"POST", "PUT", "PATCH", "DELETE"}) {
            var response = request(method, "/api/health");
            assertThat(response.statusCode()).as(method).isEqualTo(403);
            assertThat(response.body()).contains("FORBIDDEN");
        }
        assertThat(request("OPTIONS", "/api/private").statusCode()).isEqualTo(401);
        assertThat(request("HEAD", "/api/private").statusCode()).isEqualTo(401);
    }

    @Test @Order(5)
    void forgedIdentityRequestIdAndCorsOriginAreNotTrusted() throws Exception {
        var response = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/private"))
                .header("Authorization", "Bearer forged.synthetic.token")
                .header("X-Request-ID", "attacker-controlled-value")
                .header("Origin", "https://untrusted.invalid").GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(401);
        String id = response.headers().firstValue("X-Request-ID").orElseThrow();
        UUID.fromString(id);
        assertThat(response.body()).contains(id).doesNotContain("attacker", "forged", "untrusted");
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(request("GET", "/api/health").headers().firstValue("X-Request-ID").orElseThrow()).isNotEqualTo(id);
    }

    @Test @Order(6)
    void maliciousPathIsRejectedAndIgnoredQueryCannotExecuteSql() throws Exception {
        for (String path : new String[]{"/api//health", "/api/health;secret=value"}) {
            var response = request("GET", path);
            assertThat(response.statusCode()).isEqualTo(400);
            assertThat(response.body()).contains("INVALID_REQUEST").doesNotContain("secret", "Exception");
        }
        assertThat(request("GET", "/api/health?query=%27%3BDROP%20SCHEMA%20trading%3B--").body())
                .isEqualTo("{\"status\":\"UP\"}");
        flyway.validate();
    }

    @Test @Order(7)
    void databaseExceptionDetailsAreNeverInHealthResponse() {
        JdbcTemplate failing = mock(JdbcTemplate.class);
        when(failing.queryForObject("SELECT 1", Integer.class)).thenThrow(
                new DataAccessResourceFailureException("sensitive-internal-database-detail"));
        var response = new HealthController(failing).health(mock(HttpServletRequest.class));
        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody().toString()).contains("UNAVAILABLE").doesNotContain("sensitive", "database-detail");
    }

    @Test @Order(100)
    void actualDatabaseOutageReturns503AndRestartRestoresReadinessWithoutRemigration() throws Exception {
        Path data = Path.of(System.getenv("AITRADING_TEST_CLUSTER")).toAbsolutePath().normalize();
        Path log = data.getParent().resolve("postgres-restart.log");
        Path controlLog = data.getParent().resolve("postgres-control.log");
        String ctl = System.getenv("AITRADING_TEST_PG_CTL");
        int stopped = new ProcessBuilder(ctl, "-D", data.toString(), "-m", "fast", "-w", "stop")
                .redirectErrorStream(true).redirectOutput(controlLog.toFile()).start().waitFor();
        assertThat(stopped).isZero();
        try {
            var down = request("GET", "/api/health");
            assertThat(down.statusCode()).isEqualTo(503);
            assertThat(down.body()).contains("UNAVAILABLE").doesNotContain("jdbc", "password", "Exception");
        } finally {
            int started = new ProcessBuilder(ctl, "-D", data.toString(), "-l", log.toString(), "-o",
                    "-h 127.0.0.1 -p " + System.getenv("AITRADING_TEST_DB_PORT"), "-w", "start")
                    .redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.appendTo(controlLog.toFile())).start().waitFor();
            assertThat(started).isZero();
        }
        assertThat(request("GET", "/api/health").statusCode()).isEqualTo(200);
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }
}
