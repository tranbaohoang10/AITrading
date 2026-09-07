package com.aitrading.replay;

import com.aitrading.auth.UserPrincipal;
import com.aitrading.market.CoinbaseDataFailure;
import com.aitrading.strategy.StrategyService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/replay")
public class ReplayController {
    private final ReplayService service;
    public ReplayController(ReplayService service){this.service=service;}
    @GetMapping public Object list(@AuthenticationPrincipal UserPrincipal user){return service.list(user);}
    @PostMapping public Object create(@AuthenticationPrincipal UserPrincipal user,@RequestBody ReplayService.Create input){return service.create(user,input);}
    @GetMapping("/{id}") public Object view(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id){return service.view(user,StrategyService.id(id));}
    public record CandleWindow(ReplayService.View state,int candleStart) {}
    @PostMapping("/{id}/commands") public Object execute(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,
            @RequestBody ReplayService.Command input,@RequestHeader(value="X-Replay-Known-Cursor",required=false) Integer knownCursor){
        if(knownCursor!=null&&(knownCursor<0||knownCursor>=20000))throw new IllegalArgumentException("Invalid known cursor");
        var state=service.execute(user,StrategyService.id(id),input);
        if(knownCursor==null)return state;
        int start=Math.min(knownCursor+1,state.candles().size());
        return new CandleWindow(state.withCandles(state.candles().subList(start,state.candles().size())),start);
    }
    @ExceptionHandler(CoinbaseDataFailure.class) ResponseEntity<Map<String,String>> failure(CoinbaseDataFailure error){return ResponseEntity.status(error.status()).body(Map.of("code",error.code()));}
}
