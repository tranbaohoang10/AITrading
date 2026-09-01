package com.aitrading.auth;

import com.aitrading.api.ApiErrors;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Added only to Spring Security's chain, after CSRF and before logout/login. */
public class AuthGuardFilter extends OncePerRequestFilter {
    private final UserRepository users;
    private final AuthRateLimiter limits;
    public AuthGuardFilter(UserRepository users, AuthRateLimiter limits) { this.users = users; this.limits = limits; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            UserPrincipal user = authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal ? principal : null;
            if (user != null && !users.current(user)) {
                if (request.getSession(false) != null) request.getSession(false).invalidate();
                SecurityContextHolder.clearContext();
                ApiErrors.write(request, response, 401, ApiErrors.Code.UNAUTHORIZED);
                return;
            }
            String path = request.getRequestURI();
            if(user!=null)request.setAttribute(com.aitrading.audit.AuditService.ACTOR,user.id());
            // The header binds the rendered workspace, never selects an owner.
            // A mismatch must not invalidate the replacement account's session.
            boolean bootstrap = java.util.Set.of("/api/health", "/api/auth/csrf",
                    "/api/auth/register", "/api/auth/login").contains(path);
            var expected = java.util.Collections.list(request.getHeaders("X-Workspace-User"));
            boolean discovery = path.equals("/api/auth/me") && expected.isEmpty();
            if (user != null && path.startsWith("/api/") && !bootstrap && !discovery
                    && (expected.size() != 1 || !user.id().toString().equals(expected.getFirst()))) {
                ApiErrors.write(request, response, 401, ApiErrors.Code.UNAUTHORIZED);
                return;
            }
            boolean allowed = true;
            if(user!=null&&path.equals("/api/audit"))allowed=limits.allow("audit-read",user.id().toString(),120);
            if (user != null && path.startsWith("/api/dsl/"))
                allowed = limits.allow("dsl-user", user.id().toString(), 120);
            if (user != null && (path.equals("/api/strategies") || path.startsWith("/api/strategies/"))) {
                boolean read = java.util.Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod());
                allowed = limits.allow(read ? "str-read" : "str-write", user.id().toString(), read ? 300 : 60);
            }
            if (user != null && (path.equals("/api/datasets") || path.startsWith("/api/datasets/"))) {
                if ("POST".equals(request.getMethod())) allowed = limits.allow("data-import", user.id().toString(), 10);
                else if ("DELETE".equals(request.getMethod())) allowed = limits.allow("data-delete", user.id().toString(), 30);
                else allowed = limits.allow("data-read", user.id().toString(), 300);
            }
            if (user != null && (path.equals("/api/conversations") || path.startsWith("/api/conversations/"))
                    && !java.util.Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod()))
                allowed = limits.allow("chat-user", user.id().toString(), 120);
            if (user != null && (path.equals("/api/ai/capabilities") || (path.startsWith("/api/conversations/") && path.contains("/ai-turns"))
                    || (path.startsWith("/api/strategies/") && path.contains("/generations")))) {
                boolean read=java.util.Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
                String purpose=read?"ai-read":path.endsWith("/cancel") || path.endsWith("/accept") || path.endsWith("/reject")?"ai-cancel":"ai-start";
                allowed=allowed && limits.allow(purpose,user.id().toString(),read?300:purpose.equals("ai-cancel")?30:10);
            }
            if (user != null && path.startsWith("/api/journal/") && path.contains("/evaluations")) {
                boolean read=java.util.Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
                String purpose=read?"ai-read":path.endsWith("/cancel")?"ai-cancel":"ai-start";
                allowed=allowed&&limits.allow(purpose,user.id().toString(),read?300:purpose.equals("ai-cancel")?30:10);
            }
            if (user != null && (path.equals("/api/backtests") || path.startsWith("/api/backtests/"))) {
                boolean read=java.util.Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
                boolean start="POST".equals(request.getMethod())&&(path.equals("/api/backtests")||path.endsWith("/retry"));
                allowed=allowed&&limits.allow(read?"job-read":start?"job-start":"job-mutate",user.id().toString(),read?300:start?10:30);
            }
            if (user != null && (path.equals("/api/journal") || path.startsWith("/api/journal/"))) {
                boolean read=java.util.Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
                allowed=allowed&&limits.allow(read?"journal-read":"journal-write",user.id().toString(),read?300:60);
            }
            if (user != null && (path.equals("/api/documents") || path.startsWith("/api/documents/"))) {
                boolean read=java.util.Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
                boolean rag=path.equals("/api/documents/rag");
                allowed=allowed&&limits.allow(read?"doc-read":rag?"ai-start":"doc-write",user.id().toString(),read?300:rag?10:30);
            }
            if(user!=null&&(path.equals("/api/image-analyses")||path.startsWith("/api/image-analyses/"))){boolean read=java.util.Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());allowed=allowed&&limits.allow(read?"ai-read":"ai-start",user.id().toString(),read?300:10);}
            if ("GET".equals(request.getMethod()) && path.equals("/api/auth/csrf"))
                allowed = limits.allow("csrf-ip", request.getRemoteAddr(), 120);
            if ("POST".equals(request.getMethod())) {
                if (path.equals("/api/auth/register")) allowed = limits.allow("register-ip", request.getRemoteAddr(), 10);
                if (path.equals("/api/auth/login")) {
                    String email = UserRepository.normalizeEmail(request.getParameter("email"));
                    String password = request.getParameter("password");
                    if (email.length() > 254 || password == null || password.length() > 128 || password.isEmpty()) {
                        ApiErrors.write(request, response, 401, ApiErrors.Code.UNAUTHORIZED);
                        return;
                    }
                    allowed = limits.allow("login-ip", request.getRemoteAddr(), 30)
                            && limits.allow("login-email", email, 10);
                }
                if (path.equals("/api/auth/password") && user != null)
                    allowed = limits.allow("password-user", user.id().toString(), 10);
            }
            if (!allowed) {
                response.setHeader("Retry-After", Long.toString(AuthRateLimiter.WINDOW_SECONDS));
                ApiErrors.write(request, response, 429, ApiErrors.Code.RATE_LIMITED);
                return;
            }
            chain.doFilter(request, response);
        } catch (DataAccessException | TransactionException unavailable) {
            ApiErrors.write(request, response, 503, ApiErrors.Code.UNAVAILABLE);
        }
    }
}
