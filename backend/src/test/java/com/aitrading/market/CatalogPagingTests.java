package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class CatalogPagingTests {
    @Test void rejectsDuplicateAndHostileBinanceMetadataWithoutInventingLots() {
        String row="""
                {"symbol":"1INCHUSDT","baseAsset":"1INCH","quoteAsset":"USDT","status":"TRADING","isSpotTradingAllowed":true,
                 "filters":[{"filterType":"PRICE_FILTER","tickSize":"0.0001"}]}
                """;
        var instrument=BinanceSpotCatalog.parse("{\"symbols\":["+row+"]}").getFirst();
        assertEquals("1INCHUSDT",instrument.providerSymbol());
        assertNull(instrument.lotSize()); assertNull(instrument.contractSize());
        assertEquals("QUANTITY_ONLY",instrument.sizingStatus());
        assertThrows(IllegalArgumentException.class,()->BinanceSpotCatalog.parse("{\"symbols\":["+row+","+row+"]}"));
        assertTrue(BinanceSpotCatalog.parse("{\"symbols\":["+row.replace("1INCHUSDT","../secret")+"]}").isEmpty());
    }
    @Test void pagesVerifiedProductsWithoutTruncationAndBindsCursorToQuery() {
        var client=mock(CoinbaseMarketDataClient.class);
        var products=new ArrayList<String>();
        for(int i=0;i<121;i++)products.add("{\"id\":\"ASSET"+i+"-USD\",\"quote_increment\":\"0.01\",\"base_increment\":\"0.001\"}");
        when(client.products()).thenReturn("["+String.join(",",products)+"]");
        var service=new MarketHistoryService(List.of(new CoinbaseHistoryProvider(client)),new MarketCache(mock(org.springframework.data.redis.core.StringRedisTemplate.class),false));
        var first=service.catalog("COINBASE","","",null);
        assertEquals(50,first.items().size()); assertNotNull(first.nextCursor());
        var second=service.catalog("COINBASE","","",first.nextCursor());
        var third=service.catalog("COINBASE","","",second.nextCursor());
        assertEquals(21,third.items().size()); assertNull(third.nextCursor());
        var ids=new HashSet<String>();
        for(var page:List.of(first,second,third))for(var item:page.items())assertTrue(ids.add(item.instrumentId()));
        assertThrows(IllegalArgumentException.class,()->service.catalog("COINBASE","BTC","",first.nextCursor()));
        assertThrows(IllegalArgumentException.class,()->service.catalog("COINBASE","","","../../secret"));
        assertThrows(IllegalArgumentException.class,()->service.catalog("https://localhost","","",null));
    }
}
