package com.aitrading.audit;

import com.aitrading.auth.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class AuditController {
    private final AuditService audit;
    public AuditController(AuditService audit){this.audit=audit;}
    @GetMapping("/api/audit")
    public AuditService.Page list(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue="25") int limit,@RequestParam(required=false) String before) {
        return audit.list(user,limit,before);
    }
}
