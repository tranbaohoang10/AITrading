package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class AlpacaHistoryProvider implements MarketDataProvider {
    private static final List<String> TF=List.of("1m","5m","15m","30m","1h","4h","1d");
    private final AlpacaMarketDataClient client;
    public AlpacaHistoryProvider(AlpacaMarketDataClient client){this.client=client;}
    public Capabilities capabilities() {
        return new Capabilities("ALPACA","Alpaca · IEX",List.of("STOCK","ETF"),TF,true,true,false,false,false,false,true,true,true,true,true,
                "CONDITIONAL","REST_PAGED",1000,"America/New_York",client.configured(),
                List.of("Requires configured credentials and applicable display entitlement", "IEX only, not consolidated SIP; raw unadjusted bars", "Quantity-only simulation; no verified lot or contract metadata"));
    }
    public List<Instrument> search(String query) {
        return client.searchAssets(query).stream().filter(m->m.get("symbol").matches("[A-Z][A-Z0-9.]{0,9}")).map(m->new Instrument(
                "ALPACA:"+m.get("symbol"),m.get("symbol"),m.get("symbol"),"ALPACA",assetClass(m.get("symbol")),m.get("symbol"),"USD",m.get("exchange"),"USD","IEX","America/New_York",
                null,null,null,null,null,"SHARES",null,BigDecimal.ONE,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),TF,"UNKNOWN",m.get("name"))).toList();
    }
    private static String assetClass(String symbol){return Set.of("SPY","QQQ","IWM","DIA").contains(symbol)?"ETF":"US_EQUITY";}
    public Instrument instrument(String symbol) {
        if(symbol==null||!symbol.matches("[A-Z][A-Z0-9.]{0,9}"))throw new IllegalArgumentException("Invalid symbol");
        return search(symbol).stream().filter(i->i.providerSymbol().equals(symbol)).findFirst().orElseThrow(()->new IllegalArgumentException("Unsupported instrument"));
    }
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to) {
        return client.history(symbol,timeframe,from,to).stream().map(c->new Candle(c.openTime(),new BigDecimal(c.open()),new BigDecimal(c.high()),new BigDecimal(c.low()),new BigDecimal(c.close()),new BigDecimal(c.volume()))).toList();
    }
}
