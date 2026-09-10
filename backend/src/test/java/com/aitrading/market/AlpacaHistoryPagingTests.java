package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class AlpacaHistoryPagingTests {
    private final Instant from=Instant.parse("2025-01-01T00:00:00Z"),to=from.plusSeconds(180);
    private String bar(int minute,int close) {
        return "{\"t\":\""+from.plusSeconds(minute*60)+"\",\"o\":100,\"h\":110,\"l\":90,\"c\":"+close+",\"v\":1}";
    }
    @SuppressWarnings("unchecked")
    private AlpacaMarketDataClient client(List<String> pages,List<HttpRequest> requests) throws Exception {
        var http=mock(HttpClient.class);var iterator=pages.iterator();
        when(http.<String>send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenAnswer(call->{
            requests.add(call.getArgument(0));
            HttpResponse<String> response=mock(HttpResponse.class);
            when(response.statusCode()).thenReturn(200);when(response.body()).thenReturn(iterator.next());return response;
        });
        var client=new AlpacaMarketDataClient("synthetic-key","synthetic-secret");
        ReflectionTestUtils.setField(client,"http",http);return client;
    }
    @Test void followsEncodedTokensWithExplicitIexRangeAndDeduplicatesPageBoundary() throws Exception {
        var requests=new ArrayList<HttpRequest>();
        var client=client(List.of("{\"bars\":["+bar(0,101)+"],\"next_page_token\":\"token+/=\"}",
                "{\"bars\":["+bar(0,101)+","+bar(2,102)+","+bar(3,103)+"],\"next_page_token\":null}"),requests);
        var result=client.history("AAPL","1m",from,to);
        assertEquals(List.of(from,from.plusSeconds(120)),result.stream().map(AlpacaMarketDataMapper.Bar::openTime).toList());
        assertEquals(2,requests.size());
        for(var request:requests) {
            assertEquals("/v2/stocks/AAPL/bars",request.uri().getPath());
            assertTrue(request.uri().getRawQuery().contains("feed=iex&adjustment=raw"));
            assertTrue(request.uri().getRawQuery().contains("start=2025-01-01T00%3A00%3A00Z"));
        }
        assertTrue(requests.getLast().uri().getRawQuery().contains("page_token=token%2B%2F%3D"));
    }
    @Test void latestCandlesUseBoundedRangeAndDescendingRawIexBars() throws Exception {
        var requests=new ArrayList<HttpRequest>();var client=client(List.of("{\"bars\":["+bar(0,101)+"],\"next_page_token\":null}"),requests);
        var now=Instant.parse("2025-01-08T00:00:00Z");var result=client.candles("AAPL","1m",300,null,now);
        assertEquals(1,result.size());var query=requests.getFirst().uri().getRawQuery();assertTrue(query.contains("feed=iex&adjustment=raw&sort=desc"));assertTrue(query.contains("start=2025-01-01T00%3A00%3A00Z"));assertTrue(query.contains("end=2025-01-08T00%3A00%3A00Z"));
    }
    @Test void rejectsTokenCyclesAndConflictingHistoricalBoundaries() throws Exception {
        for(var pages:List.of(
                List.of("{\"bars\":[],\"next_page_token\":\"cycle\"}","{\"bars\":[],\"next_page_token\":\"cycle\"}"),
                List.of("{\"bars\":["+bar(0,101)+"],\"next_page_token\":\"next\"}","{\"bars\":["+bar(0,102)+"],\"next_page_token\":null}"))) {
            var requests=new ArrayList<HttpRequest>();var client=client(pages,requests);
            assertThrows(AlpacaDataFailure.class,()->client.history("AAPL","1m",from,to));assertEquals(2,requests.size());
        }
    }
    @Test void rejectsMalformedContinuationAndDisabledCredentials() throws Exception {
        for(String token:List.of("123","true","\"\"")) {
            var client=client(List.of("{\"bars\":[],\"next_page_token\":"+token+"}"),new ArrayList<>());
            assertThrows(AlpacaDataFailure.class,()->client.history("AAPL","1m",from,to));
        }
        assertThrows(AlpacaDataFailure.class,()->new AlpacaMarketDataClient("","").history("AAPL","1m",from,to));
    }
    @Test void paperCatalogUsesPaperTradingHostAndMapsRejectedCredentials() throws Exception {
        var requests=new ArrayList<HttpRequest>();
        var client=client(List.of("[{\"symbol\":\"AAPL\",\"name\":\"Apple Inc.\",\"exchange\":\"NASDAQ\"}]"),requests);
        assertEquals("AAPL",client.searchAssets("AAPL").getFirst().get("symbol"));
        assertEquals("paper-api.alpaca.markets",requests.getFirst().uri().getHost());

        var http=mock(HttpClient.class);var response=mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(401);when(response.body()).thenReturn("{}");
        when(http.<String>send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var rejected=new AlpacaMarketDataClient("synthetic-key","synthetic-secret");
        ReflectionTestUtils.setField(rejected,"http",http);
        var failure=assertThrows(AlpacaDataFailure.class,()->rejected.searchAssets("AAPL"));
        assertEquals("ALPACA_AUTH_FAILED",failure.code());
    }
}
