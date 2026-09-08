package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

/** ECB reference observations: explicitly unsuitable for execution or intraday Replay. */
@Service
public class FrankfurterHistoryProvider implements MarketDataProvider {
    private static final List<String> SYMBOLS=List.of("EUR-USD","GBP-USD","USD-JPY","USD-CHF","AUD-USD","USD-CAD","NZD-USD");
    private final FrankfurterMarketDataClient client;
    public FrankfurterHistoryProvider(FrankfurterMarketDataClient client){this.client=client;}
    public Capabilities capabilities() {
        return new Capabilities("FRANKFURTER","Frankfurter · ECB daily reference",List.of("FX_REFERENCE"),List.of("1d"),
                true,false,true,false,true,false,false,true,false,false,true,"ACCEPTED","REQUEST_RANGE",600,"UTC",true,
                List.of("One daily reference observation; equal OHLC and zero volume are not traded market prices", "No intraday candles, live FX feed, lot sizing or trading Replay"));
    }
    public List<Instrument> search(String query) {
        if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");
        return client.symbols().stream().filter(s->s.contains(query.toUpperCase(Locale.ROOT))).map(this::instrument).toList();
    }
    public Instrument instrument(String symbol) {
        if(!SYMBOLS.contains(symbol)&&!client.symbols().contains(symbol))throw new IllegalArgumentException("Unsupported reference pair");
        return new Instrument("FRANKFURTER:"+symbol,symbol.replace('-','/'),symbol,"FRANKFURTER","FX_REFERENCE",
                symbol.substring(0,3),symbol.substring(4),"ECB reference",symbol.substring(4),"REFERENCE","UTC",
                null,null,null,null,null,"NOT_TRADABLE",null,null,null,"UNSUPPORTED",List.of("EOD_REFERENCE"),List.of("1d"),"UNKNOWN",symbol.replace('-','/')+" · ECB reference");
    }
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to) {
        MarketDataProvider.range(timeframe,from,to);instrument(symbol);
        if(!"1d".equals(timeframe))throw new IllegalArgumentException("Reference data is daily only");
        return client.candles(symbol,600,to.toEpochMilli()).stream()
                .filter(c->c.openTime()>=from.toEpochMilli()&&c.openTime()<to.toEpochMilli())
                .map(c->new Candle(Instant.ofEpochMilli(c.openTime()),new BigDecimal(c.open()),new BigDecimal(c.high()),new BigDecimal(c.low()),new BigDecimal(c.close()),BigDecimal.ZERO)).toList();
    }
}
