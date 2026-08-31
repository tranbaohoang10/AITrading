package com.aitrading.market;

import com.aitrading.auth.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/datasets")
public class MarketController {
    private final MarketService market;
    public record Delete(String expectedDataHash) { }
    public record CsvError(String code,int line,String message) { }
    public MarketController(MarketService market) {this.market=market;}
    @PostMapping(value="/import",consumes="application/json")
    public MarketService.Dataset create(@AuthenticationPrincipal UserPrincipal user,@RequestBody MarketService.Import body) {return market.create(user,body);}
    @GetMapping
    public MarketService.Page list(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) String limit,@RequestParam(required=false) String cursor) {
        return market.list(user,MarketService.integer(limit,20,1,50),cursor);
    }
    @GetMapping("/{id}")
    public MarketService.Dataset get(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id) {return market.get(user,MarketService.id(id));}
    @GetMapping("/{id}/candles")
    public MarketService.Candles candles(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,
            @RequestParam(required=false) String start,@RequestParam(required=false) String limit) {
        return market.candles(user,MarketService.id(id),start,MarketService.integer(limit,200,1,500));
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal user,@PathVariable String id,@RequestBody Delete body) {
        market.delete(user,MarketService.id(id),body.expectedDataHash());return ResponseEntity.noContent().build();
    }
    @ExceptionHandler(MarketDataFailure.class)
    public ResponseEntity<CsvError> invalidCsv(MarketDataFailure failure) {
        return ResponseEntity.unprocessableContent().body(new CsvError(failure.code(),failure.line(),failure.getMessage()));
    }
}
