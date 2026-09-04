package com.aitrading.chat;

import com.aitrading.auth.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {
    private final ConversationService conversations;
    public record Create(String requestId) { }
    public record Rename(String title, Long expectedVersion) { }
    public record Delete(Long expectedVersion) { }
    public record Append(String requestId, String content) { }
    public ConversationController(ConversationService conversations) { this.conversations = conversations; }

    @GetMapping
    public ConversationService.Page list(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required=false) String cursor, @RequestParam(required=false) String limit) {
        return conversations.list(user, ConversationService.limit(limit,20,50), cursor);
    }
    @PostMapping
    public ConversationService.Conversation create(@AuthenticationPrincipal UserPrincipal user, @RequestBody Create body) {
        return conversations.create(user, ConversationService.id(body.requestId()));
    }
    @GetMapping("/{id}")
    public ConversationService.Conversation get(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id) {
        return conversations.get(user, ConversationService.id(id));
    }
    @PatchMapping("/{id}")
    public ConversationService.Conversation rename(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id, @RequestBody Rename body) {
        return conversations.rename(user, ConversationService.id(id), body.title(), body.expectedVersion());
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id, @RequestBody Delete body) {
        conversations.delete(user, ConversationService.id(id), body.expectedVersion());
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/{id}/messages")
    public ConversationService.Messages messages(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id,
            @RequestParam(required=false) String before, @RequestParam(required=false) String limit) {
        return conversations.messages(user, ConversationService.id(id), ConversationService.limit(limit,50,100),
                before == null ? null : ConversationService.positive(before));
    }
    @PostMapping("/{id}/messages")
    public ConversationService.Message append(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id, @RequestBody Append body) {
        return conversations.append(user, ConversationService.id(id), ConversationService.id(body.requestId()), body.content());
    }
    @PostMapping(value="/{id}/messages/attachment", consumes="multipart/form-data")
    public ConversationService.Message appendAttachment(@AuthenticationPrincipal UserPrincipal user, @PathVariable String id,
            @RequestParam String requestId, @RequestParam String content, @RequestParam String context,
            @RequestPart("file") MultipartFile file) throws java.io.IOException {
        return conversations.appendAttachment(user, ConversationService.id(id), ConversationService.id(requestId), content, file.getBytes(), context);
    }
}
