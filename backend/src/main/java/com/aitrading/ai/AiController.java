package com.aitrading.ai;

import com.aitrading.api.ApiErrors;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.chat.ConversationService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public final class AiController {
    private final AiService ai;
    public record Start(String requestId,Long expectedVersion,Long sourceSequence) { }
    public record Cancel() { }
    public AiController(AiService ai){this.ai=ai;}
    @GetMapping("/ai/capabilities")
    public AiProvider.Configuration capabilities(){return ai.configuration();}
    @PostMapping("/conversations/{id}/ai-turns")
    public AiTurnStore.Turn start(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody Start body) {
        return ai.start(user,ConversationService.id(id),ConversationService.id(body.requestId()),body.expectedVersion(),body.sourceSequence());
    }
    @GetMapping("/conversations/{id}/ai-turns/{requestId}")
    public AiTurnStore.Turn get(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@PathVariable String requestId) {
        return ai.get(user,ConversationService.id(id),ConversationService.id(requestId));
    }
    @GetMapping("/conversations/{id}/ai-turns")
    public ResponseEntity<?> latest(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id) {
        var turn=ai.latest(user,ConversationService.id(id));
        return turn==null?ResponseEntity.noContent().build():ResponseEntity.ok(turn);
    }
    @PostMapping("/conversations/{id}/ai-turns/{requestId}/cancel")
    public AiTurnStore.Turn cancel(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@PathVariable String requestId,@RequestBody Cancel body) {
        return ai.cancel(user,ConversationService.id(id),ConversationService.id(requestId));
    }
    @ExceptionHandler(AiFailure.class)
    public ResponseEntity<?> unavailable(HttpServletRequest request,AiFailure failure) {
        return ResponseEntity.status(503).body(Map.of("code",failure.code().name(),"requestId",ApiErrors.requestId(request)));
    }
}
