package com.aitrading.notification;

import com.aitrading.auth.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/backtests/notifications")
public class NotificationController {
    private final NotificationService notices;
    public record Empty() { }
    public NotificationController(NotificationService notices){this.notices=notices;}
    @GetMapping public NotificationService.Page list(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue="25")int limit,@RequestParam(required=false)String before) {
        return notices.list(user,limit,before);
    }
    @PostMapping("/{id}/read") public NotificationService.Notice read(@AuthenticationPrincipal UserPrincipal user,
            @PathVariable String id,@RequestBody Empty body){return notices.read(user,id);}
}
