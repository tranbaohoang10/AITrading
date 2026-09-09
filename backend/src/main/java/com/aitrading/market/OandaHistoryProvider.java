package com.aitrading.market;

import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class OandaHistoryProvider implements MarketDataProvider {
    private static final List<String> TIMEFRAMES=List.of("1m","5m","15m","30m","1h","4h","1d");private final OandaMarketDataClient client;
    public OandaHistoryProvider(OandaMarketDataClient client){this.client=client;}
    public Capabilities capabilities(){return new Capabilities("OANDA","OANDA v20",List.of("FOREX","COMMODITY"),TIMEFRAMES,true,true,false,true,false,false,true,true,true,true,true,"CONDITIONAL","ACCOUNT_CATALOG",5000,"UTC",client.configured(),List.of("Availability is limited to the configured account catalog","Pricing stream may suppress intermediate prices and is not tick-complete","CFD display entitlement must be verified for the configured account"));}
    public List<Instrument> search(String query){if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");String needle=query.replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT);return client.instruments().stream().filter(item->(item.providerSymbol()+item.displaySymbol()+item.name()).replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT).contains(needle)).map(this::instrument).toList();}
    private Instrument instrument(OandaMarketDataMapper.Listed item){return new Instrument("OANDA:"+item.providerSymbol(),item.displaySymbol(),item.providerSymbol(),"OANDA",item.assetClass(),item.base(),item.quote(),"OANDA account",item.quote(),"ACCOUNT","UTC",item.increment(),null,null,null,null,"UNITS",null,null,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),TIMEFRAMES,"UNKNOWN",item.name());}
    public Instrument instrument(String symbol){return client.instruments().stream().filter(item->item.providerSymbol().equals(symbol)).findFirst().map(this::instrument).orElseThrow(()->new IllegalArgumentException("Unsupported OANDA instrument"));}
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to){return client.history(symbol,timeframe,from,to);}
}
