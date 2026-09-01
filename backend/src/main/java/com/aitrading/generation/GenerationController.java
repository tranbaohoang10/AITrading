package com.aitrading.generation;

import com.aitrading.ai.AiFailure;
import com.aitrading.api.ApiErrors;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.strategy.StrategyService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/strategies/{id}/generations")
public class GenerationController {
    private final GenerationStore store;private final GenerationService service;
    public record Decision() { }
    public GenerationController(GenerationStore store,GenerationService service){this.store=store;this.service=service;}
    @PostMapping public GenerationStore.Attempt start(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody GenerationStore.Start body){return service.start(user,StrategyService.id(id),body);}
    @GetMapping public ResponseEntity<?> latest(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id){var value=store.latest(user,StrategyService.id(id));return value==null?ResponseEntity.noContent().build():ResponseEntity.ok(value);}
    @GetMapping("/{requestId}") public GenerationStore.Attempt get(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@PathVariable String requestId){return store.get(user,StrategyService.id(id),StrategyService.id(requestId));}
    @PostMapping("/{requestId}/{action:accept|reject|cancel}") public GenerationStore.Attempt decide(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@PathVariable String requestId,@PathVariable String action,@RequestBody Decision body){return store.decide(user,StrategyService.id(id),StrategyService.id(requestId),action);}
    @ExceptionHandler(AiFailure.class) public ResponseEntity<?> unavailable(HttpServletRequest request,AiFailure failure){return ResponseEntity.status(503).body(Map.of("code",failure.code().name(),"requestId",ApiErrors.requestId(request)));}
}
