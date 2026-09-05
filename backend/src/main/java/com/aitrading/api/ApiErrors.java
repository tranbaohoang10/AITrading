package com.aitrading.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;

/** Fixed public codes only: never echo exception messages, URLs, headers or credentials. */
public final class ApiErrors {
    private ApiErrors() { }

    public enum Code {
        UNAUTHORIZED, FORBIDDEN, ORIGIN_FORBIDDEN, CSRF_INVALID, INVALID_REQUEST,
        UNAVAILABLE, RATE_LIMITED, NOT_FOUND, CONFLICT
    }
    public record ErrorBody(String code, String requestId) { }

    public static String requestId(HttpServletRequest request) {
        Object id = request.getAttribute(RequestIdFilter.ATTRIBUTE);
        return id instanceof String value ? value : UUID.randomUUID().toString();
    }

    public static void write(HttpServletRequest request, HttpServletResponse response,
                             int status, Code code) throws IOException {
        String id = requestId(request);
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("X-Request-ID", id);
        response.getWriter().write("{\"code\":\"" + code.name() + "\",\"requestId\":\"" + id + "\"}");
    }
}
