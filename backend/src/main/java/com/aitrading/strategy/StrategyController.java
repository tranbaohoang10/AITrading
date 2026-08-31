package com.aitrading.strategy;

import com.aitrading.auth.UserPrincipal;
import com.aitrading.dsl.DslValidator;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/strategies")
public class StrategyController {
    private final StrategyService service;
    public StrategyController(StrategyService service){this.service=service;}
    public record Delete(Integer expectedRevision) { }
    @PostMapping(consumes="application/json")
    public StrategyService.Revision create(@AuthenticationPrincipal UserPrincipal user,@RequestBody StrategyService.Create body){return service.create(user,body);}
    @GetMapping
    public StrategyService.Page list(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false)String limit,@RequestParam(required=false)String cursor){return service.list(user,StrategyService.integer(limit,20,50),cursor);}
    @GetMapping("/{id}")
    public StrategyService.Revision get(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id){return service.get(user,StrategyService.id(id),null);}
    @GetMapping("/{id}/versions")
    public StrategyService.History history(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestParam(required=false)String limit,@RequestParam(required=false)String before){return service.history(user,StrategyService.id(id),StrategyService.integer(limit,20,50),StrategyService.integer(before,101,101));}
    @GetMapping("/{id}/versions/{revision}")
    public StrategyService.Revision revision(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@PathVariable String revision){return service.get(user,StrategyService.id(id),StrategyService.integer(revision,0,100));}
    @PostMapping(value="/{id}/versions",consumes="application/json")
    public StrategyService.Revision save(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody StrategyService.Save body){return service.save(user,StrategyService.id(id),body);}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody Delete body){service.delete(user,StrategyService.id(id),body.expectedRevision());return ResponseEntity.noContent().build();}
    @ExceptionHandler(StrategyValidationFailure.class)
    public ResponseEntity<DslValidator.Validation> invalid(StrategyValidationFailure failure){return ResponseEntity.unprocessableContent().body(failure.validation());}
}
