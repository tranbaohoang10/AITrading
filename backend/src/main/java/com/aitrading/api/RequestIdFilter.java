package com.aitrading.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {
    public static final String ATTRIBUTE = RequestIdFilter.class.getName() + ".id";
    private final com.aitrading.audit.AuditService audit;
    public RequestIdFilter(com.aitrading.audit.AuditService audit) { this.audit=audit; }

    public static UUID currentId() {
        var attributes=org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if(attributes instanceof org.springframework.web.context.request.ServletRequestAttributes servlet
                && servlet.getRequest().getAttribute(ATTRIBUTE) instanceof String id)return UUID.fromString(id);
        return UUID.randomUUID();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String id = UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, id);
        response.setHeader("X-Request-ID", id);
        boolean completed=false;
        try {
            chain.doFilter(request, response);
            completed=true;
        } catch (DataAccessException | TransactionException unavailable) {
            // Includes session-store access before the security filter chain.
            LoggerFactory.getLogger(RequestIdFilter.class).warn("database_unavailable requestId={}", id);
            if (response.isCommitted()) throw unavailable;
            response.resetBuffer();
            ApiErrors.write(request, response, 503, ApiErrors.Code.UNAVAILABLE);
            completed=true;
        } finally {
            audit.http(request,completed?response.getStatus():500);
        }
    }
}
