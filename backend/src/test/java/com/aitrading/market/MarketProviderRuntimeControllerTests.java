package com.aitrading.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class MarketProviderRuntimeControllerTests {
    @Test void existingRealtimeCandleDoesNotSuppressHistoricalSync(){var registry=mock(MarketSymbolRegistry.class);var store=mock(MarketProviderCandleStore.class);var sync=mock(MarketHistoricalSyncService.class);var route=new MarketSymbolRegistry.Route(UUID.randomUUID(),"XAU/USD","XAU/USD","COMMODITY","CAPITAL","GOLD","XAU","USD",Instant.parse("2024-01-03T00:00:00Z"),true);var from=Instant.parse("2026-09-01T00:00:00Z");var to=Instant.parse("2026-09-11T00:00:00Z");var history=List.of(c("2026-09-01T00:00:00Z"),c("2026-09-01T01:00:00Z"),c("2026-09-01T02:00:00Z"));when(registry.resolve("GOLD")).thenReturn(route);when(sync.sync("GOLD",from,to)).thenReturn(new MarketHistoricalSyncService.Result("XAU/USD","CAPITAL","GOLD",from,from,to,1000,1000,"READY",null,1));when(store.read(route,"1h",from,to,300)).thenReturn(history);var controller=new MarketProviderRuntimeController(registry,store,sync,mock(ProviderDatasetMaterializer.class),mock(MarketLiveStateStore.class));assertThat(controller.history("GOLD","1h",from,to,300)).containsExactlyElementsOf(history);verify(sync).sync("GOLD",from,to);verify(store).read(route,"1h",from,to,300);}
    private static MarketDataProvider.Candle c(String time){return new MarketDataProvider.Candle(Instant.parse(time),BigDecimal.ONE,BigDecimal.ONE,BigDecimal.ONE,BigDecimal.ONE,BigDecimal.ZERO);}
}
