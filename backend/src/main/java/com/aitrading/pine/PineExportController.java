package com.aitrading.pine;

import com.aitrading.auth.UserPrincipal;
import com.aitrading.strategy.StrategyService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/strategies/{id}/versions/{revision}/pine")
public class PineExportController {
    private final PineExportService service;
    public PineExportController(PineExportService service) { this.service = service; }
    @GetMapping
    public PineExportService.Artifact get(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id, @PathVariable String revision) {
        return service.get(user, StrategyService.id(id), StrategyService.integer(revision, 0, 100));
    }
    @PostMapping(consumes = "application/json")
    public PineExportService.Artifact create(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id, @PathVariable String revision, @RequestBody Map<String,Object> body) {
        if (!body.isEmpty()) throw new IllegalArgumentException("Unexpected fields");
        return service.create(user, StrategyService.id(id), StrategyService.integer(revision, 0, 100));
    }
    @ExceptionHandler(PineFailure.class)
    public ResponseEntity<Map<String,String>> invalid(PineFailure failure) {
        return ResponseEntity.unprocessableContent().body(Map.of("code", failure.code()));
    }
}
