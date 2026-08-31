package com.aitrading.backtest;

import com.aitrading.api.ApiErrors;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.strategy.StrategyService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/backtests")
public final class BacktestController {
    private final BacktestStore store;private final PythonWorker worker;
    public record Empty(){} public record Retry(String requestId){}
    public BacktestController(BacktestStore store,PythonWorker worker){this.store=store;this.worker=worker;}
    @GetMapping("/capabilities") public Map<String,Object> capabilities(){return worker.capabilities();}
    @PostMapping public BacktestStore.Job create(@AuthenticationPrincipal UserPrincipal user,@RequestBody BacktestStore.Create body){return store.create(user,body,worker.configured());}
    @GetMapping public BacktestStore.Page list(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false)String limit,@RequestParam(required=false)String cursor){return store.list(user,StrategyService.integer(limit,20,50),cursor);}
    @GetMapping("/{id}") public BacktestStore.Job get(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id){return store.get(user,StrategyService.id(id));}
    @GetMapping(value="/{id}/result",produces=MediaType.APPLICATION_JSON_VALUE) public String result(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id){return store.result(user,StrategyService.id(id));}
    @GetMapping("/{id}/candles") public BacktestStore.FrozenPage candles(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,
            @RequestParam(required=false)String start,@RequestParam(required=false)String limit){
        return store.candles(user,StrategyService.id(id),start,StrategyService.integer(limit,100,500));
    }
    @PostMapping("/{id}/cancel") public BacktestStore.Job cancel(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody Empty body){return store.cancel(user,StrategyService.id(id));}
    @PostMapping("/{id}/retry") public BacktestStore.Job retry(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody Retry body){return store.retry(user,StrategyService.id(id),StrategyService.id(body.requestId()),worker.configured());}
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody Empty body){store.delete(user,StrategyService.id(id));return ResponseEntity.noContent().build();}
    @ExceptionHandler(BacktestFailure.class) public ResponseEntity<?> failure(HttpServletRequest request,BacktestFailure failure){return ResponseEntity.status(failure.code()==BacktestFailure.Code.SNAPSHOT_INVALID?422:503).body(Map.of("code",failure.code().name(),"requestId",ApiErrors.requestId(request)));}
}
