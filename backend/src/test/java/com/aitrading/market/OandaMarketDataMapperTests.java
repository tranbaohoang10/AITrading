package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class OandaMarketDataMapperTests {
    @Test void mapsAccountCatalogWithoutInventingUnavailableInstruments(){
        var rows=OandaMarketDataMapper.instruments("""
                {"instruments":[
                  {"name":"EUR_USD","displayName":"EUR/USD","type":"CURRENCY","displayPrecision":5},
                  {"name":"XAU_USD","displayName":"Gold","type":"CFD","displayPrecision":3},
                  {"name":"WTICO_USD","displayName":"West Texas Oil","type":"CFD","displayPrecision":3},
                  {"name":"SPX500_USD","displayName":"US 500","type":"CFD","displayPrecision":1}
                ]}
                """);
        assertEquals(3,rows.size());assertEquals("EUR/USD",rows.getFirst().displaySymbol());assertEquals("FOREX",rows.getFirst().assetClass());assertEquals("USOIL",rows.getLast().displaySymbol());assertEquals("COMMODITY",rows.getLast().assetClass());
    }
    @Test void mapsOnlyCompleteOrderedMidCandles(){
        var from=Instant.parse("2026-09-09T12:00:00Z");var to=from.plusSeconds(120);
        var rows=OandaMarketDataMapper.candles("""
                {"candles":[
                  {"complete":true,"volume":7,"time":"2026-09-09T12:00:00Z","mid":{"o":"1.1000","h":"1.2000","l":"1.0000","c":"1.1500"}},
                  {"complete":false,"volume":1,"time":"2026-09-09T12:01:00Z","mid":{"o":"1.1500","h":"1.1600","l":"1.1400","c":"1.1501"}}
                ]}
                """,from,to);
        assertEquals(1,rows.size());assertEquals("1.15",rows.getFirst().close().stripTrailingZeros().toPlainString());assertEquals("7",rows.getFirst().volume().toPlainString());
    }
    @Test void mapsPricingMidpointAndRejectsWrongInstrumentOrMalformedPrices(){
        var now=Instant.parse("2026-09-09T12:00:01Z");
        var price=OandaPricingMessage.parse("""
                {"type":"PRICE","instrument":"EUR_USD","time":"2026-09-09T12:00:00Z","tradeable":true,"closeoutBid":"1.1000","closeoutAsk":"1.1002"}
                ""","EUR_USD",now).orElseThrow();
        assertEquals("1.1001",price.midpoint().toPlainString());assertTrue(OandaPricingMessage.parse("""
                {"type":"HEARTBEAT","time":"2026-09-09T12:00:00Z"}
                ""","EUR_USD",now).isEmpty());
        assertThrows(OandaDataFailure.class,()->OandaPricingMessage.parse("""
                {"type":"PRICE","instrument":"GBP_USD","time":"2026-09-09T12:00:00Z","tradeable":true,"closeoutBid":"1","closeoutAsk":"1"}
                ""","EUR_USD",now));
    }
}
