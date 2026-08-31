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

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String id = UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, id);
        response.setHeader("X-Request-ID", id);
        try {
            chain.doFilter(request, response);
        } catch (DataAccessException | TransactionException unavailable) {
            // Includes session-store access before the security filter chain.
            LoggerFactory.getLogger(RequestIdFilter.class).warn("database_unavailable requestId={}", id);
            if (response.isCommitted()) throw unavailable;
            response.resetBuffer();
            ApiErrors.write(request, response, 503, ApiErrors.Code.UNAVAILABLE);
        }
    }
}
