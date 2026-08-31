package com.aitrading.auth;

import com.aitrading.api.ApiErrors;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bounded buffering before CSRF/form parsing prevents oversized or ambiguous credentials. */
public class AuthInputFilter extends OncePerRequestFilter {
    private static final int MAX_BODY = 16 * 1024;
    private final Set<String> origins;
    public AuthInputFilter(Set<String> origins) { this.origins = Set.copyOf(origins); }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod())) {
            chain.doFilter(request, response); return;
        }
        String origin = request.getHeader("Origin");
        if (origin != null && !origins.contains(origin)) {
            ApiErrors.write(request, response, 403, ApiErrors.Code.FORBIDDEN); return;
        }
        int maxBody = request.getMethod().equals("POST") && request.getRequestURI().equals("/api/dsl/validate")
                ? com.aitrading.dsl.DslValidator.MAX_BYTES : MAX_BODY;
        if (request.getMethod().equals("POST") && request.getRequestURI().equals("/api/datasets/import"))
            maxBody = com.aitrading.market.MarketCsvParser.MAX_IMPORT_BYTES;
        if (request.getContentLengthLong() > maxBody) {
            ApiErrors.write(request, response, 413, ApiErrors.Code.INVALID_REQUEST); return;
        }
        byte[] body = request.getInputStream().readNBytes(maxBody + 1);
        if (body.length > maxBody) {
            ApiErrors.write(request, response, 413, ApiErrors.Code.INVALID_REQUEST); return;
        }
        Map<String, String[]> parameters = new LinkedHashMap<>();
        if (request.getContentType() != null && request.getContentType().split(";")[0].equalsIgnoreCase("application/x-www-form-urlencoded")) {
            try {
                for (String entry : new String(body, StandardCharsets.UTF_8).split("&")) {
                    if (entry.isEmpty()) continue;
                    String[] pair = entry.split("=", 2);
                    String key = URLDecoder.decode(pair[0], StandardCharsets.UTF_8);
                    String value = URLDecoder.decode(pair.length == 2 ? pair[1] : "", StandardCharsets.UTF_8);
                    if (!Set.of("email", "password", "_csrf").contains(key) || parameters.putIfAbsent(key, new String[]{value}) != null)
                        throw new IllegalArgumentException("Ambiguous form");
                }
            } catch (IllegalArgumentException invalid) {
                ApiErrors.write(request, response, 400, ApiErrors.Code.INVALID_REQUEST); return;
            }
        }
        if (request.getQueryString() != null && request.getRequestURI().startsWith("/api/auth/")) {
            ApiErrors.write(request, response, 400, ApiErrors.Code.INVALID_REQUEST); return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public ServletInputStream getInputStream() {
                ByteArrayInputStream bytes = new ByteArrayInputStream(body);
                return new ServletInputStream() {
                    public int read() { return bytes.read(); }
                    public boolean isFinished() { return bytes.available() == 0; }
                    public boolean isReady() { return true; }
                    public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException("Synchronous API only"); }
                };
            }
            @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8)); }
            @Override public String getParameter(String name) { return parameters.containsKey(name) ? parameters.get(name)[0] : null; }
            @Override public Map<String, String[]> getParameterMap() { return Collections.unmodifiableMap(parameters); }
            @Override public Enumeration<String> getParameterNames() { return Collections.enumeration(parameters.keySet()); }
            @Override public String[] getParameterValues(String name) { return parameters.get(name); }
        }, response);
    }
}
