package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class CapitalMarketDataClientTests {
    @Test void mapsOnlyExplicitValidatedCapitalInstruments(){
        assertThat(CapitalMarketDataClient.spec("EUR/USD").epic()).isEqualTo("EURUSD");
        assertThat(CapitalMarketDataClient.spec("Capital:GBPUSD").epic()).isEqualTo("GBPUSD");
        assertThat(CapitalMarketDataClient.spec("Gold").epic()).isEqualTo("GOLD");
        assertThat(CapitalMarketDataClient.spec("Silver").epic()).isEqualTo("SILVER");
        assertThat(CapitalMarketDataClient.spec("Platinum").epic()).isEqualTo("PLATINUM");
        assertThat(CapitalMarketDataClient.spec("Palladium").epic()).isEqualTo("PALLADIUM");
        assertThatThrownBy(()->CapitalMarketDataClient.spec("EUR/USD_W")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->CapitalMarketDataClient.spec("ETH/USD")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void convertsHistoricalBidAskToMidWithoutMixingPriceBasis(){var node=JsonMapper.builder().build().readTree("{\"bid\":1.1000,\"ask\":1.1002}");assertThat(CapitalMarketDataClient.mid(node)).isEqualByComparingTo(new BigDecimal("1.1001"));}
    @Test void exposesDemoSafeCapabilitiesWithoutCredentials(){var client=new CapitalMarketDataClient("key","identifier","password","demo",java.net.http.HttpClient.newHttpClient());assertThat(client.capabilities().providerId()).isEqualTo("CAPITAL");assertThat(client.capabilities().limitations()).allMatch(value->!value.contains("key")&&!value.contains("password"));assertThat(client.instrument("XAU/USD")).extracting(MarketDataProvider.Instrument::providerSymbol,MarketDataProvider.Instrument::market).containsExactly("GOLD","CFD");}
    @Test void capitalCatalogUsesTheBoundedSharedCacheNamespace(){var client=new CapitalMarketDataClient("key","identifier","password","demo",java.net.http.HttpClient.newHttpClient());var service=new MarketHistoryService(java.util.List.of(client),new MarketCache(org.mockito.Mockito.mock(org.springframework.data.redis.core.StringRedisTemplate.class),false));assertThat(service.catalog("CAPITAL","EURUSD","FOREX",null).items()).singleElement().extracting(MarketDataProvider.Instrument::providerSymbol).isEqualTo("EURUSD");}
    @SuppressWarnings("unchecked") @Test void treatsA404PriceWindowAsAnEmptyMarketGapWithoutFabricatingCandles() throws Exception {var http=org.mockito.Mockito.mock(HttpClient.class);HttpResponse<byte[]> auth=org.mockito.Mockito.mock(HttpResponse.class),empty=org.mockito.Mockito.mock(HttpResponse.class);org.mockito.Mockito.when(auth.statusCode()).thenReturn(200);org.mockito.Mockito.when(auth.body()).thenReturn("{}".getBytes());org.mockito.Mockito.when(auth.headers()).thenReturn(HttpHeaders.of(Map.of("CST",List.of("cst"),"X-SECURITY-TOKEN",List.of("token")),(left,right)->true));org.mockito.Mockito.when(empty.statusCode()).thenReturn(404);org.mockito.Mockito.when(empty.body()).thenReturn("{}".getBytes());org.mockito.Mockito.when(http.<byte[]>send(org.mockito.ArgumentMatchers.any(HttpRequest.class),org.mockito.ArgumentMatchers.any(HttpResponse.BodyHandler.class))).thenReturn(auth,empty);var client=new CapitalMarketDataClient("key","identifier","password","demo",http);assertThat(client.prices("GOLD",Instant.parse("2024-01-06T00:00:00Z"),Instant.parse("2024-01-06T16:39:00Z"))).isEmpty();}
}
