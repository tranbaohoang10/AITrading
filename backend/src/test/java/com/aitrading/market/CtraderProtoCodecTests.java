package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class CtraderProtoCodecTests {
    @Test void roundTripsEnvelopeAndMapsOfficialSpotFields(){
        assertEquals(CtraderProtoCodec.APP_AUTH_REQ,CtraderProtoCodec.envelope(CtraderProtoCodec.applicationAuth("client","secret")).type());
        long at=Instant.parse("2026-09-09T12:00:00Z").toEpochMilli();byte[] payload=CtraderProtoCodec.message(CtraderProtoCodec.field(2,7),CtraderProtoCodec.field(3,42),CtraderProtoCodec.field(4,110000),CtraderProtoCodec.field(5,110020),CtraderProtoCodec.field(8,at));
        var spot=CtraderProtoCodec.spot(payload,42,Instant.parse("2026-09-09T12:00:01Z")).orElseThrow();assertEquals("1.1001",spot.price().toPlainString());assertTrue(CtraderProtoCodec.spot(payload,43,Instant.parse("2026-09-09T12:00:01Z")).isEmpty());
    }
    @Test void mapsLightSymbolsDetailsAndDeltaTrendbars(){
        byte[] light=CtraderProtoCodec.message(CtraderProtoCodec.field(1,42),CtraderProtoCodec.field(2,"EUR/USD"),CtraderProtoCodec.field(3,1),CtraderProtoCodec.field(7,"Euro vs Dollar"));
        byte[] list=CtraderProtoCodec.message(CtraderProtoCodec.field(2,7),CtraderProtoCodec.field(3,light));assertEquals(List.of(42L),CtraderProtoCodec.lightSymbolIds(list));
        byte[] detail=CtraderProtoCodec.message(CtraderProtoCodec.field(1,42),CtraderProtoCodec.field(2,5),CtraderProtoCodec.field(3,4),CtraderProtoCodec.field(26,"UTC"));
        assertEquals("EUR/USD",CtraderProtoCodec.symbols(list,CtraderProtoCodec.message(CtraderProtoCodec.field(3,detail))).getFirst().name());
        long minute=Instant.parse("2026-09-09T12:00:00Z").getEpochSecond()/60;byte[] bar=CtraderProtoCodec.message(CtraderProtoCodec.field(3,9),CtraderProtoCodec.field(5,100000),CtraderProtoCodec.field(6,10),CtraderProtoCodec.field(7,20),CtraderProtoCodec.field(8,30),CtraderProtoCodec.field(9,minute));
        var mapped=CtraderProtoCodec.trendbars(CtraderProtoCodec.message(CtraderProtoCodec.field(5,bar)),Instant.parse("2026-09-09T12:00:00Z"),Instant.parse("2026-09-09T12:01:00Z")).getFirst();assertEquals("1.0001",mapped.open().toPlainString());assertEquals("1.0003",mapped.high().toPlainString());
    }
    @Test void rejectsTruncatedOrInvalidProviderFrames(){assertThrows(CtraderDataFailure.class,()->CtraderProtoCodec.envelope(new byte[]{10,5,1}));assertThrows(CtraderDataFailure.class,()->CtraderProtoCodec.spot(CtraderProtoCodec.message(CtraderProtoCodec.field(3,42)),42,Instant.now()));}
    @Test void classifiesOnlySupportedForexAndCommoditySymbols(){assertEquals("FOREX",CtraderMarketDataClient.assetClass("EURUSD"));assertEquals("COMMODITY",CtraderMarketDataClient.assetClass("XAUUSD"));assertEquals("COMMODITY",CtraderMarketDataClient.assetClass("USOIL"));assertEquals("",CtraderMarketDataClient.assetClass("BTCUSD"));assertEquals("",CtraderMarketDataClient.assetClass("US500"));}
}
