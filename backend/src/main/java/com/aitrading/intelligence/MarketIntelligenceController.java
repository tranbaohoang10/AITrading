package com.aitrading.intelligence;

import com.aitrading.api.ApiErrors;
import com.aitrading.auth.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market-intelligence")
public final class MarketIntelligenceController {
    private final MarketIntelligenceService service;
    public MarketIntelligenceController(MarketIntelligenceService service) { this.service = service; }

    @GetMapping("/status")
    public MarketIntelligenceService.Status status(@AuthenticationPrincipal UserPrincipal user) { return service.status(user); }

    @GetMapping("/news")
    public MarketIntelligenceService.NewsResponse news(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) String query, @RequestParam(defaultValue = "UTC") String timezone) {
        return service.news(user, query, timezone);
    }

    @GetMapping("/calendar")
    public MarketIntelligenceService.CalendarResponse calendar(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam String from, @RequestParam String to, @RequestParam(defaultValue = "UTC") String timezone) {
        return service.calendar(user, from, to, timezone);
    }

    @ExceptionHandler(MarketIntelligenceFailure.class)
    ResponseEntity<?> unavailable(HttpServletRequest request, MarketIntelligenceFailure failure) {
        return ResponseEntity.status(failure.status()).body(Map.of("code", failure.code(), "requestId", ApiErrors.requestId(request)));
    }
}
