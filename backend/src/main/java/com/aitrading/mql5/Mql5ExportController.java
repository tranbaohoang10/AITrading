package com.aitrading.mql5;

import com.aitrading.auth.UserPrincipal;
import com.aitrading.strategy.StrategyService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/strategies/{id}/versions/{revision}/mql5")
public class Mql5ExportController {
    private final Mql5ExportService service;
    public Mql5ExportController(Mql5ExportService service) { this.service = service; }
    @GetMapping
    public Mql5ExportService.Artifact get(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id, @PathVariable String revision) {
        return service.get(user, StrategyService.id(id), StrategyService.integer(revision, 0, 100));
    }
    @PostMapping(consumes = "application/json")
    public Mql5ExportService.Artifact create(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id, @PathVariable String revision, @RequestBody Map<String,Object> body) {
        if (!body.isEmpty()) throw new IllegalArgumentException("Unexpected fields");
        return service.create(user, StrategyService.id(id), StrategyService.integer(revision, 0, 100));
    }
    @ExceptionHandler(Mql5Failure.class)
    public ResponseEntity<Map<String,String>> invalid(Mql5Failure failure) {
        return ResponseEntity.unprocessableContent().body(Map.of("code", failure.code()));
    }
}
