package com.aitrading.market;

import com.aitrading.auth.UserPrincipal;
import java.time.*;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market/local")
public final class MarketProviderRuntimeController {
    public record SyncRequest(String symbol,Instant from,Instant to) {}
    public record MaterializeRequest(String requestId,String symbol,String timeframe,Instant from,Instant to) {}
    private final MarketSymbolRegistry registry;private final MarketProviderCandleStore store;private final MarketHistoricalSyncService sync;private final ProviderDatasetMaterializer materializer;private final MarketLiveStateStore live;
    public MarketProviderRuntimeController(MarketSymbolRegistry registry,MarketProviderCandleStore store,MarketHistoricalSyncService sync,ProviderDatasetMaterializer materializer,MarketLiveStateStore live){this.registry=registry;this.store=store;this.sync=sync;this.materializer=materializer;this.live=live;}
    @GetMapping("/routes") public List<MarketSymbolRegistry.Route> routes(){return registry.routes();}
    @GetMapping("/coverage") public MarketProviderCandleStore.Coverage coverage(@RequestParam String symbol){return store.coverage(registry.resolve(symbol));}
    @PostMapping("/sync") public MarketHistoricalSyncService.Result sync(@RequestBody SyncRequest request){range(request.from(),request.to(),3660);return sync.sync(request.symbol(),request.from(),request.to());}
    @GetMapping("/history") public List<MarketDataProvider.Candle> history(@RequestParam String symbol,@RequestParam String timeframe,@RequestParam Instant from,@RequestParam Instant to,@RequestParam(defaultValue="1000")int limit){range(from,to,366);var route=registry.resolve(symbol);sync.sync(symbol,from,to);return store.read(route,timeframe,from,to,limit);}
    @PostMapping("/materialize") public ProviderDatasetMaterializer.Result materialize(@AuthenticationPrincipal UserPrincipal user,@RequestBody MaterializeRequest request){range(request.from(),request.to(),366);return materializer.materialize(user,request.requestId(),request.symbol(),request.timeframe(),request.from(),request.to());}
    @GetMapping("/live-state") public Map<String,Object> liveState(@RequestParam String symbol){var route=registry.resolve(symbol);var keys=live.keys(route.provider(),route.providerSymbol());var frames=new LinkedHashMap<String,Object>();for(String timeframe:RealtimeTimeframeAggregator.TIMEFRAMES){var frameKeys=live.keys(route.provider(),route.providerSymbol(),timeframe);frames.put(timeframe,Map.of("key",frameKeys.current(),"current",Objects.toString(live.read(frameKeys.current()),"")));}return Map.of("provider",route.provider(),"symbol",route.canonicalSymbol(),"redisHealth",live.health(),"keys",keys,"latest",Objects.toString(live.read(keys.latest()),""),"current",Objects.toString(live.read(keys.current()),""),"timeframes",frames,"status",Objects.toString(live.read(keys.status()),""));}
    private static void range(Instant from,Instant to,int days){if(from==null||to==null||!to.isAfter(from)||from.isBefore(Instant.parse("2000-01-01T00:00:00Z"))||to.isAfter(Instant.now().plusSeconds(5))||Duration.between(from,to).toDays()>days)throw new IllegalArgumentException("Invalid market range");}
}
