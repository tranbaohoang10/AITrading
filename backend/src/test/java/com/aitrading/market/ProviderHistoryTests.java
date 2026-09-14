package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.zip.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ProviderHistoryTests {
    @Test void resolvesAnyCatalogedBinanceSymbolForLocalHistoryAndRealtime() {
        var provider=mock(MarketDataProvider.class);
        when(provider.capabilities()).thenReturn(new MarketDataProvider.Capabilities("BINANCE","Binance",List.of("CRYPTO"),List.of("1m"),true,true,false,false,false,false,true,true,false,false,true,"ACCEPTED","CATALOG",1000,"UTC",true,List.of()));
        when(provider.instrument("SOLUSDT")).thenReturn(new MarketDataProvider.Instrument("BINANCE:SOLUSDT","SOL/USDT","SOLUSDT","BINANCE","CRYPTO","SOL","USDT","Binance","USDT","SPOT","UTC",new BigDecimal("0.01"),null,null,null,null,"BASE_QUANTITY",null,null,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),List.of("1m"),"UNKNOWN","SOL/USDT"));
        var jdbc=mock(JdbcTemplate.class);var instrumentId=UUID.randomUUID();
        when(jdbc.queryForList(anyString(),eq(UUID.class),eq("BINANCE"),eq("SOLUSDT"))).thenReturn(List.of(instrumentId));
        var registry=new MarketSymbolRegistry(jdbc,List.of(provider),mock(CtraderMarketDataClient.class));
        var route=registry.resolve("BINANCE:SOLUSDT");
        assertEquals(instrumentId,route.instrumentId());assertEquals("BINANCE",route.provider());assertEquals("SOLUSDT",route.providerSymbol());
    }

    @Test void frankfurterIsDailyReferenceAndCannotAdvertiseTradingReplay() {
        var provider=new FrankfurterHistoryProvider(mock(FrankfurterMarketDataClient.class));
        assertFalse(provider.capabilities().historicalReplaySupported());
        assertFalse(provider.capabilities().realtime());
        assertEquals("NOT_TRADABLE",provider.instrument("EUR-USD").sizeUnit());
        assertNull(provider.instrument("EUR-USD").lotSize());
        assertEquals("COMMODITY",provider.instrument("XAU-USD").assetClass());
        assertEquals(new java.math.BigDecimal("0.01"),provider.instrument("XAU-USD").priceIncrement());
        assertEquals(java.util.List.of("HISTORICAL","DELAYED"),provider.instrument("XAU-USD").supportedModes());
        assertThrows(IllegalArgumentException.class,()->provider.history("EUR-USD","1h",Instant.parse("2025-01-01T00:00:00Z"),Instant.parse("2025-01-02T00:00:00Z")));
        var registry=new MarketHistoryService(java.util.List.of(provider),new MarketCache(mock(org.springframework.data.redis.core.StringRedisTemplate.class),false));
        assertFalse(registry.replaySupported("FRANKFURTER"));
    }
    private byte[] zip(String csv)throws IOException {
        var output=new ByteArrayOutputStream();
        try(var zip=new ZipOutputStream(output)) {
            zip.putNextEntry(new ZipEntry("candles.csv"));zip.write(csv.getBytes(StandardCharsets.UTF_8));zip.closeEntry();
        }
        return output.toByteArray();
    }
    @Test void binanceMicrosecondsAndProviderIsolation()throws Exception {
        var rows=BinanceArchiveProvider.parse(new ByteArrayInputStream(zip("1735689600000000,100,110,90,105,12,0,0,0,0,0,0\n")),60);
        assertEquals(Instant.parse("2025-01-01T00:00:00Z"),rows.getFirst().time());
        var provider=new BinanceArchiveProvider();
        assertEquals("BINANCE:BTCUSDT",provider.instrument("BTCUSDT").instrumentId());
        assertEquals("USDT",provider.instrument("BTCUSDT").currency());
        assertNull(provider.instrument("BTCUSDT").lotSize());
        assertTrue(provider.capabilities().realtime());
        assertThrows(IllegalArgumentException.class,()->provider.instrument("BTC-USD"));
    }
    @Test void rejectsMalformedUnboundedAndDuplicateArchive()throws Exception {
        for(String input:new String[]{"<script>alert(1)</script>","x".repeat(2049),
                "1735689600000000,100,99,90,105,12,0,0,0,0,0,0\n",
                "1735689600000000,100,110,90,105,12,0,0,0,0,0,0\n".repeat(2)}) {
            byte[] data=zip(input);
            assertThrows(IOException.class,()->BinanceArchiveProvider.parse(new ByteArrayInputStream(data),60));
        }
    }
    @Test void coinbasePagesWithoutDuplicateBoundaryAndExcludesOutsideWindow() {
        var client=mock(CoinbaseMarketDataClient.class);
        var from=Instant.parse("2025-01-01T00:00:00Z");var to=from.plusSeconds(600*60);
        when(client.series(eq("BTC-USD"),eq(60),anyLong(),anyLong())).thenReturn("[[1735689600,90,110,100,105,12]]");
        var provider=new CoinbaseHistoryProvider(client);
        assertEquals(1,provider.history("BTC-USD","1m",from,to).size());
        verify(client,times(3)).series(eq("BTC-USD"),eq(60),anyLong(),anyLong());
        assertThrows(IllegalArgumentException.class,()->provider.history("BTC-USD","1m",from,Instant.now().plusSeconds(60)));
        assertThrows(IllegalArgumentException.class,()->provider.history("BTC-USD","4h",from,to));
    }
}
