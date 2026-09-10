package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

/** Daily FX and precious-metal reference observations, unsuitable for execution or intraday Replay. */
@Service
public class FrankfurterHistoryProvider implements MarketDataProvider {
    private static final List<String> FOREX=List.of("EUR-USD","GBP-USD","USD-JPY","USD-CHF","AUD-USD","USD-CAD","NZD-USD");
    private static final List<String> METALS=List.of("XAU-USD","XAG-USD","XPT-USD","XPD-USD");
    private static final List<String> SYMBOLS=java.util.stream.Stream.concat(FOREX.stream(),METALS.stream()).toList();
    private final FrankfurterMarketDataClient client;
    public FrankfurterHistoryProvider(FrankfurterMarketDataClient client){this.client=client;}
    public Capabilities capabilities() {
        return new Capabilities("FRANKFURTER","Frankfurter · daily reference",List.of("FX_REFERENCE","COMMODITY"),List.of("1d"),
                true,false,true,false,true,false,false,true,false,false,true,"ACCEPTED","REQUEST_RANGE",600,"UTC",true,
                List.of("One daily reference observation; equal OHLC and zero volume are not traded market prices", "FX uses ECB reference rates; precious metals use Frankfurter reference providers", "No intraday candles, live feed, lot sizing or trading Replay"));
    }
    public List<Instrument> search(String query) {
        if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");
        return SYMBOLS.stream().filter(s->s.contains(query.toUpperCase(Locale.ROOT))).map(this::instrument).toList();
    }
    public Instrument instrument(String symbol) {
        if(!SYMBOLS.contains(symbol))throw new IllegalArgumentException("Unsupported reference pair");
        boolean metal=METALS.contains(symbol);String base=symbol.substring(0,3),quote=symbol.substring(4);
        return new Instrument("FRANKFURTER:"+symbol,symbol.replace('-','/'),symbol,"FRANKFURTER",metal?"COMMODITY":"FX_REFERENCE",
                base,quote,metal?"Frankfurter metals reference":"ECB reference",quote,"REFERENCE","UTC",
                metal?new BigDecimal("0.01"):base.equals("JPY")||quote.equals("JPY")?new BigDecimal("0.01"):new BigDecimal("0.0001"),null,null,null,null,"NOT_TRADABLE",null,null,null,"UNSUPPORTED",List.of("HISTORICAL","DELAYED"),List.of("1d"),"UNKNOWN",name(symbol));
    }
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to) {
        MarketDataProvider.range(timeframe,from,to);instrument(symbol);
        if(!"1d".equals(timeframe))throw new IllegalArgumentException("Reference data is daily only");
        return client.candles(symbol,600,to.toEpochMilli()).stream()
                .filter(c->c.openTime()>=from.toEpochMilli()&&c.openTime()<to.toEpochMilli())
                .map(c->new Candle(Instant.ofEpochMilli(c.openTime()),new BigDecimal(c.open()),new BigDecimal(c.high()),new BigDecimal(c.low()),new BigDecimal(c.close()),BigDecimal.ZERO)).toList();
    }
    private static String name(String symbol){return switch(symbol){case "EUR-USD"->"Euro / U.S. Dollar · ECB reference";case "GBP-USD"->"British Pound / U.S. Dollar · ECB reference";case "USD-JPY"->"U.S. Dollar / Japanese Yen · ECB reference";case "USD-CHF"->"U.S. Dollar / Swiss Franc · ECB reference";case "AUD-USD"->"Australian Dollar / U.S. Dollar · ECB reference";case "USD-CAD"->"U.S. Dollar / Canadian Dollar · ECB reference";case "NZD-USD"->"New Zealand Dollar / U.S. Dollar · ECB reference";case "XAU-USD"->"Gold / U.S. Dollar · daily reference";case "XAG-USD"->"Silver / U.S. Dollar · daily reference";case "XPT-USD"->"Platinum / U.S. Dollar · daily reference";case "XPD-USD"->"Palladium / U.S. Dollar · daily reference";default->throw new IllegalArgumentException("Unsupported reference pair");};}
}
