package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class AuthenticationTests {
    private static final String PASSWORD = "Synthetic-only password 123!";
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired UserRepository users;
    @Autowired AuthService auth;
    @Autowired AuthRateLimiter limits;
    @Autowired JdbcIndexedSessionRepository sessions;
    @Autowired org.springframework.session.web.http.SessionRepositoryFilter<?> sessionFilter;
    final JsonMapper json = JsonMapper.builder().build();

    @BeforeAll static void requireIsolatedDatabase() {
        String cluster = System.getenv("AITRADING_TEST_CLUSTER");
        assertThat(cluster).isNotBlank();
        assertThat(Path.of(cluster).toAbsolutePath().normalize().startsWith(
                Path.of("..").toAbsolutePath().normalize().resolve("tmp"))).isTrue();
    }

    @BeforeEach void clearOwnedFixtures() {
        jdbc.update("DELETE FROM trading.spring_session");
        jdbc.update("DELETE FROM trading.auth_rate_bucket");
        jdbc.update("DELETE FROM trading.app_user");
    }

    HttpClient actor() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .connectTimeout(Duration.ofSeconds(3)).build();
    }

    HttpResponse<String> send(HttpClient actor, String method, String path, String body, String token,
                               String type, Map<String, String> headers) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(20)).header("Content-Type", type);
        if (token != null) request.header("X-CSRF-TOKEN", token);
        headers.forEach(request::header);
        return actor.send(request.method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> get(HttpClient actor, String path) throws Exception {
        return send(actor, "GET", path, "", null, "application/json", Map.of());
    }

    String csrf(HttpClient actor) throws Exception {
        var result = get(actor, "/api/auth/csrf");
        assertThat(result.statusCode()).isEqualTo(200);
        return json.readTree(result.body()).get("token").asString();
    }

    HttpResponse<String> postJson(HttpClient actor, String path, Map<String, ?> fields) throws Exception {
        return send(actor, "POST", path, json.writeValueAsString(fields), csrf(actor), "application/json", Map.of());
    }

    void register(String email) throws Exception {
        assertThat(postJson(actor(), "/api/auth/register", Map.of("email", email, "displayName", "Researcher", "password", PASSWORD)).statusCode()).isEqualTo(202);
    }

    HttpResponse<String> login(HttpClient actor, String email, String password, String token) throws Exception {
        return send(actor, "POST", "/api/auth/login", "email=" + URLEncoder.encode(email, StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(password, StandardCharsets.UTF_8), token,
                "application/x-www-form-urlencoded", Map.of());
    }

    HttpClient signedIn(String email) throws Exception {
        HttpClient actor = actor();
        assertThat(login(actor, email, PASSWORD, csrf(actor)).statusCode()).isEqualTo(204);
        return actor;
    }

    JsonNode profile(HttpClient actor) throws Exception {
        var result = get(actor, "/api/auth/me");
        assertThat(result.statusCode()).isEqualTo(200);
        assertThat(result.body()).doesNotContain("password", "credentialVersion", "$argon2");
        return json.readTree(result.body());
    }

    @Test void registrationUsesDistinctArgon2idSaltsAndGenericDuplicateAcknowledgement() throws Exception {
        var client = actor();
        var fields = Map.of("email", " Mixed@Example.TEST ", "displayName", "Trader Việt", "password", PASSWORD);
        var first = postJson(client, "/api/auth/register", fields);
        var duplicate = postJson(client, "/api/auth/register", fields);
        assertThat(first.statusCode()).isEqualTo(202);
        assertThat(duplicate.statusCode()).isEqualTo(first.statusCode());
        assertThat(duplicate.body()).isEqualTo(first.body()).doesNotContain("Mixed", PASSWORD);
        register("other@example.test");
        var hashes = jdbc.queryForList("SELECT password_hash FROM trading.app_user ORDER BY email", String.class);
        assertThat(hashes).hasSize(2);
        assertThat(hashes.get(0)).startsWith("$argon2id$v=19$m=19456,t=2,p=1$").isNotEqualTo(hashes.get(1));
        assertThat(encoder.matches(PASSWORD, hashes.get(0))).isTrue();
        assertThat(profile(signedIn("MIXED@example.test")).get("email").asString()).isEqualTo("mixed@example.test");
    }

    @Test void registrationRejectsInvalidNullBoundaryAndMassAssignmentFields() throws Exception {
        List<Map<String, Object>> invalid = new ArrayList<>();
        for (Object email : Arrays.asList(null, "", "bad", "a@", "a@bad_domain.test", "x".repeat(250) + "@e.test",
                ".start@example.test", "a..b@example.test", "a.@example.test", "x".repeat(65) + "@e.test", "a@" + "x".repeat(64) + ".test")) {
            Map<String, Object> input = new HashMap<>(Map.of("email", "valid@example.test", "displayName", "Valid", "password", PASSWORD));
            input.put("email", email); invalid.add(input);
        }
        for (Object password : Arrays.asList(null, "", "x".repeat(11), "x".repeat(129))) {
            Map<String, Object> input = new HashMap<>(Map.of("email", "valid@example.test", "displayName", "Valid"));
            input.put("password", password); invalid.add(input);
        }
        for (Object name : Arrays.asList(null, "", "  ", "x".repeat(81), "a\nb", 123)) {
            Map<String, Object> input = new HashMap<>(Map.of("email", "valid@example.test", "password", PASSWORD));
            input.put("displayName", name); invalid.add(input);
        }
        invalid.add(new HashMap<>(Map.of("email", "valid@example.test", "displayName", "Valid", "password", PASSWORD, "roles", List.of("ADMIN"))));
        for (var input : invalid) {
            jdbc.update("DELETE FROM trading.auth_rate_bucket"); // isolate validation from independently tested throttle
            var response = postJson(actor(), "/api/auth/register", input);
            assertThat(response.statusCode()).as(input.keySet().toString()).isEqualTo(400);
            assertThat(response.body()).doesNotContain(PASSWORD, "Exception", "$argon2");
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.app_user", Integer.class)).isZero();
        for (int length : new int[]{12, 128}) {
            var input = Map.of("email", "boundary" + length + "@example.test", "displayName", "x".repeat(length == 12 ? 1 : 80), "password", " ".repeat(length));
            assertThat(postJson(actor(), "/api/auth/register", input).statusCode()).isEqualTo(202);
            var client = actor();
            assertThat(login(client, input.get("email"), input.get("password"), csrf(client)).statusCode()).isEqualTo(204);
        }
    }

    @Test void loginRotatesSessionAndCsrfAndDoesNotSerializePasswords() throws Exception {
        register("a@example.test");
        var client = actor();
        String oldCsrf = csrf(client);
        var jar = (CookieManager) client.cookieHandler().orElseThrow();
        String oldCookie = jar.getCookieStore().getCookies().stream().filter(c -> c.getName().equals("SESSION")).findFirst().orElseThrow().getValue();
        assertThat(login(client, "a@example.test", PASSWORD, oldCsrf).statusCode()).isEqualTo(204);
        String newCookie = jar.getCookieStore().getCookies().stream().filter(c -> c.getName().equals("SESSION")).findFirst().orElseThrow().getValue();
        assertThat(newCookie).isNotEqualTo(oldCookie);
        assertThat(send(client, "PATCH", "/api/auth/profile", "{\"displayName\":\"Changed\"}", oldCsrf, "application/json", Map.of()).statusCode()).isEqualTo(403);
        assertThat(profile(client).get("email").asString()).isEqualTo("a@example.test");
        var attributes = jdbc.queryForList("SELECT attribute_bytes FROM trading.spring_session_attributes", byte[].class);
        for (byte[] value : attributes) assertThat(new String(value, StandardCharsets.ISO_8859_1)).doesNotContain(PASSWORD, "$argon2");
        var header = get(actor(), "/api/auth/csrf").headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(header).contains("HttpOnly", "SameSite=Lax").doesNotContain("Domain=");
        var forged = send(actor(), "GET", "/api/auth/me", "", null, "application/json", Map.of("Cookie", "SESSION=" + oldCookie));
        assertThat(forged.statusCode()).isEqualTo(401);
    }

    @Test void invalidCredentialsAndCsrfNeverAuthenticate() throws Exception {
        register("a@example.test");
        var client = actor();
        String csrf = csrf(client);
        var wrong = login(client, "a@example.test", "wrong", csrf);
        var unknown = login(client, "unknown@example.test", "wrong", csrf);
        assertThat(wrong.statusCode()).isEqualTo(401);
        assertThat(unknown.statusCode()).isEqualTo(401);
        assertThat(json.readTree(wrong.body()).get("code")).isEqualTo(json.readTree(unknown.body()).get("code"));
        for (String token : Arrays.asList(null, "forged", csrf(actor()))) {
            assertThat(login(client, "a@example.test", PASSWORD, token).statusCode()).isEqualTo(403);
            assertThat(send(client, "POST", "/api/auth/register", "{}", token, "application/json", Map.of()).statusCode()).isEqualTo(403);
            assertThat(send(client, "POST", "/api/auth/logout", "", token, "application/json", Map.of()).statusCode()).isEqualTo(403);
        }
        assertThat(get(client, "/api/auth/me").statusCode()).isEqualTo(401);
    }

    @Test void profileCannotSelectOrChangeAnotherUserAndUnknownFieldsAreRejected() throws Exception {
        register("a@example.test"); register("b@example.test");
        var a = signedIn("a@example.test"); var b = signedIn("b@example.test");
        String bId = profile(b).get("id").asString();
        assertThat(send(a, "PATCH", "/api/auth/profile", "{\"displayName\":\"Hacked\",\"id\":\"" + bId + "\"}", csrf(a), "application/json", Map.of()).statusCode()).isEqualTo(400);
        assertThat(get(a, "/api/users/" + bId).statusCode()).isEqualTo(403);
        var saved = send(a, "PATCH", "/api/auth/profile", "{\"displayName\":\"<script>alert(1)</script>\"}", csrf(a), "application/json", Map.of());
        assertThat(saved.statusCode()).isEqualTo(200); // JSON data; React must render this as text, not markup.
        assertThat(profile(b).get("displayName").asString()).isEqualTo("Researcher");
        assertThat(profile(a).get("id").asString()).isNotEqualTo(bId);
    }

    @Test void passwordChangeRequiresCurrentPasswordAndRevokesAllSessions() throws Exception {
        register("a@example.test"); var one = signedIn("a@example.test"); var two = signedIn("a@example.test");
        assertThat(postJson(one, "/api/auth/password", Map.of("currentPassword", "wrong", "newPassword", "New synthetic password 456!")).statusCode()).isEqualTo(401);
        assertThat(postJson(one, "/api/auth/password", Map.of("currentPassword", PASSWORD, "newPassword", "New synthetic password 456!")).statusCode()).isEqualTo(204);
        assertThat(get(one, "/api/auth/me").statusCode()).isEqualTo(401);
        assertThat(get(two, "/api/auth/me").statusCode()).isEqualTo(401);
        var next = actor();
        assertThat(login(next, "a@example.test", PASSWORD, csrf(next)).statusCode()).isEqualTo(401);
        assertThat(login(next, "a@example.test", "New synthetic password 456!", csrf(next)).statusCode()).isEqualTo(204);
    }

    @Test void staleCredentialSnapshotCannotOverwritePasswordOrAuthorizeRacedLogin() throws Exception {
        register("a@example.test");
        var stale = (UserPrincipal) users.loadUserByUsername("a@example.test");
        auth.changePassword(stale, PASSWORD, "New synthetic password 456!");
        assertThat(users.current(stale)).isFalse();
        assertThat(users.rename(stale, "Stale mutation")).isFalse();
        assertThatThrownBy(() -> auth.changePassword(stale, PASSWORD, "Another synthetic password!"))
                .isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);
        // Simulate a login that finished hashing just after revocation and saved its old principal.
        stale.eraseCredentials();
        var context = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
        context.setAuthentication(org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(stale, null, stale.getAuthorities()));
        var session = sessions.createSession();
        ((org.springframework.session.Session) session).setAttribute("SPRING_SECURITY_CONTEXT", context);
        sessions.save(session);
        String cookie = Base64.getEncoder().encodeToString(((org.springframework.session.Session) session).getId().getBytes(StandardCharsets.UTF_8));
        assertThat(send(actor(), "GET", "/api/auth/me", "", null, "application/json", Map.of("Cookie", "SESSION=" + cookie)).statusCode()).isEqualTo(401);
    }

    @Test void logoutExpiryAndForgedCookieAreDenied() throws Exception {
        register("a@example.test"); var a = signedIn("a@example.test");
        assertThat(send(a, "POST", "/api/auth/logout", "", csrf(a), "application/json", Map.of()).statusCode()).isEqualTo(204);
        assertThat(get(a, "/api/auth/me").statusCode()).isEqualTo(401);
        var expiring = signedIn("a@example.test");
        jdbc.update("UPDATE trading.spring_session SET expiry_time=0,last_access_time=0 WHERE principal_name=?", "a@example.test");
        assertThat(get(expiring, "/api/auth/me").statusCode()).isEqualTo(401);
        assertThat(send(actor(), "GET", "/api/auth/me", "", null, "application/json", Map.of("Cookie", "SESSION=forged.synthetic")).statusCode()).isEqualTo(401);
    }

    @Test void concurrentRegistrationCreatesExactlyOneUser() throws Exception {
        try (var pool = Executors.newFixedThreadPool(4)) {
            var tasks = new ArrayList<Callable<Integer>>();
            for (int i = 0; i < 4; i++) tasks.add(() -> postJson(actor(), "/api/auth/register", Map.of(
                    "email", "duplicate@example.test", "displayName", "Parallel", "password", PASSWORD)).statusCode());
            for (var future : pool.invokeAll(tasks)) assertThat(future.get()).isEqualTo(202);
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.app_user WHERE email=?", Integer.class, "duplicate@example.test")).isEqualTo(1);
    }

    @Test void atomicThrottleAllowsOnlyLimitAndDoesNotTrustForwardedIp() throws Exception {
        try (var pool = Executors.newFixedThreadPool(8)) {
            var tasks = new ArrayList<Callable<Boolean>>();
            for (int i = 0; i < 24; i++) tasks.add(() -> limits.allow("test", "same", 10));
            int allowed = 0;
            for (var future : pool.invokeAll(tasks)) if (future.get()) allowed++;
            assertThat(allowed).isEqualTo(10);
        }
        var client = actor(); String token = csrf(client);
        for (int i = 0; i < 10; i++) assertThat(login(client, "unknown@example.test", "wrong", token).statusCode()).isEqualTo(401);
        var denied = send(client, "POST", "/api/auth/login", "email=unknown%40example.test&password=wrong", token,
                "application/x-www-form-urlencoded", Map.of("X-Forwarded-For", "198.51.100.8"));
        assertThat(denied.statusCode()).isEqualTo(429);
        assertThat(denied.headers().firstValue("Retry-After")).contains("900");
        jdbc.update("UPDATE trading.auth_rate_bucket SET window_start=window_start-1");
        assertThat(login(client, "unknown@example.test", "wrong", token).statusCode()).isEqualTo(401);
    }

    @Test void oversizedMalformedAmbiguousAndForeignOriginRequestsFailSafely() throws Exception {
        var client = actor(); String token = csrf(client);
        assertThat(send(client, "POST", "/api/auth/register", "x".repeat(16385), token, "application/json", Map.of()).statusCode()).isEqualTo(413);
        assertThat(send(client, "POST", "/api/auth/register", "{bad", token, "application/json", Map.of()).statusCode()).isEqualTo(400);
        assertThat(send(client, "POST", "/api/auth/register", "{\"email\":\"a@example.test\",\"email\":\"b@example.test\"}", token, "application/json", Map.of()).statusCode()).isEqualTo(400);
        assertThat(send(client, "POST", "/api/auth/register", "{}{}", token, "application/json", Map.of()).statusCode()).isEqualTo(400);
        assertThat(send(client, "POST", "/api/auth/login", "email=a&email=b&password=x", token, "application/x-www-form-urlencoded", Map.of()).statusCode()).isEqualTo(400);
        assertThat(send(client, "POST", "/api/auth/register", "{}", token, "application/json", Map.of("Origin", "https://evil.invalid")).statusCode()).isEqualTo(403);
        assertThat(send(client, "POST", "/api/auth/login?email=leak", "password=x", token, "application/x-www-form-urlencoded", Map.of()).statusCode()).isEqualTo(400);
        assertThat(send(client, "GET", "/api/auth/me", "", null, "application/json", Map.of("Authorization", "Bearer attacker")).statusCode()).isEqualTo(401);
    }

    @Test void httpsSessionCookieUsesSecureHttpOnlyAndSameSiteWithoutDomain() throws Exception {
        var request = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/auth/csrf");
        request.setSecure(true);
        request.setScheme("https");
        var response = new org.springframework.mock.web.MockHttpServletResponse();
        sessionFilter.doFilter(request, response, (req, res) -> ((jakarta.servlet.http.HttpServletRequest) req).getSession());
        assertThat(response.getHeader("Set-Cookie")).contains("Secure", "HttpOnly", "SameSite=Lax").doesNotContain("Domain=");
    }

    @Test void csrfSessionCreationIsAlsoIpLimited() throws Exception {
        var seed = actor();
        csrf(seed);
        jdbc.update("UPDATE trading.auth_rate_bucket SET attempts=120 WHERE bucket_key=?", AuthRateLimiter.bucketKey("csrf-ip", "127.0.0.1"));
        var denied = send(actor(), "GET", "/api/auth/csrf", "", null, "application/json", Map.of("X-Forwarded-For", "198.51.100.9"));
        assertThat(denied.statusCode()).isEqualTo(429);
        assertThat(denied.headers().firstValue("Set-Cookie")).isEmpty();
    }

    @Test void authenticatedRequestFailsClosedDuringActualDatabaseOutageAndRecovers() throws Exception {
        register("a@example.test");
        var signedIn = signedIn("a@example.test");
        Path data = Path.of(System.getenv("AITRADING_TEST_CLUSTER"));
        Path serverLog = data.getParent().resolve("auth-postgres-restart.log");
        Path controlLog = data.getParent().resolve("auth-postgres-control.log");
        String ctl = System.getenv("AITRADING_TEST_PG_CTL");
        int stopped = new ProcessBuilder(ctl, "-D", data.toString(), "-m", "fast", "-t", "30", "-w", "stop")
                .redirectErrorStream(true).redirectOutput(controlLog.toFile()).start().waitFor();
        assertThat(stopped).isZero();
        try {
            var unavailable = get(signedIn, "/api/auth/me");
            assertThat(unavailable.statusCode()).isEqualTo(503);
            assertThat(unavailable.body()).contains("UNAVAILABLE").doesNotContain(PASSWORD, "jdbc", "Exception", "$argon2");
        } finally {
            int started = new ProcessBuilder(ctl, "-D", data.toString(), "-l", serverLog.toString(), "-o",
                    "-h 127.0.0.1 -p " + System.getenv("AITRADING_TEST_DB_PORT"), "-t", "30", "-w", "start")
                    .redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.appendTo(controlLog.toFile())).start().waitFor();
            assertThat(started).isZero();
        }
        assertThat(profile(signedIn).get("email").asString()).isEqualTo("a@example.test");
    }
}
