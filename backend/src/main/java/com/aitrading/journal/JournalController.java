package com.aitrading.journal;

import com.aitrading.auth.UserPrincipal;
import com.aitrading.strategy.StrategyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/journal")
public class JournalController {
    private final JournalService service;
    public JournalController(JournalService service){this.service=service;}
    public record Delete(Integer expectedVersion) { }
    @GetMapping
    public JournalService.Page list(@AuthenticationPrincipal UserPrincipal user,@RequestParam String from,@RequestParam String to,
            @RequestParam String zone,@RequestParam String currency,@RequestParam(required=false)String limit,@RequestParam(required=false)String cursor) {
        return service.list(user,JournalService.range(from,to,zone,currency),StrategyService.integer(limit,20,50),cursor);
    }
    @GetMapping("/summary")
    public JournalService.Summary summary(@AuthenticationPrincipal UserPrincipal user,@RequestParam String from,@RequestParam String to,
            @RequestParam String zone,@RequestParam String currency) {return service.summary(user,JournalService.range(from,to,zone,currency));}
    @GetMapping("/{id}")
    public JournalService.Entry get(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id) {return service.get(user,StrategyService.id(id));}
    @PostMapping(consumes="application/json")
    public JournalService.Saved create(@AuthenticationPrincipal UserPrincipal user,@RequestBody JournalService.Write body) {return service.write(user,null,body);}
    @PostMapping(value="/{id}",consumes="application/json")
    public JournalService.Saved save(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody JournalService.Write body) {return service.write(user,StrategyService.id(id),body);}
    @DeleteMapping(value="/{id}",consumes="application/json")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody Delete body) {
        service.delete(user,StrategyService.id(id),body.expectedVersion());return ResponseEntity.noContent().build();
    }
}
