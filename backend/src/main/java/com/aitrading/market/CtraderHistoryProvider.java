package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class CtraderHistoryProvider implements MarketDataProvider {
    private static final List<String> TIMEFRAMES=List.of("1m","5m","15m","30m","1h","4h","1d");private final CtraderMarketDataClient client;
    public CtraderHistoryProvider(CtraderMarketDataClient client){this.client=client;}
    public Capabilities capabilities(){return new Capabilities("CTRADER","cTrader Open API",List.of("FOREX","COMMODITY"),TIMEFRAMES,true,true,false,true,false,false,true,true,true,true,true,"CONDITIONAL","ACCOUNT_CATALOG",1000,"UTC",client.configured(),List.of("OAuth access token and authorized cTrader account required","Symbols are discovered from the configured broker account","Spot event timestamps and broker-specific CFD availability are authoritative"));}
    public List<Instrument> search(String query){if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");String needle=query.replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT);return client.catalog().stream().filter(item->(item.name()+item.description()).replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT).contains(needle)).map(this::instrument).toList();}
    private Instrument instrument(CtraderMarketDataClient.Listed item){String canonical=item.name().replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT);String shown=canonical.contains("OIL")?"USOIL":canonical.length()==6?canonical.substring(0,3)+"/"+canonical.substring(3):item.name();BigDecimal increment=BigDecimal.ONE.movePointLeft(item.digits());return new Instrument("CTRADER:"+item.id(),shown,Long.toString(item.id()),"CTRADER",item.assetClass(),item.base(),item.quote(),"cTrader account",item.quote(),"ACCOUNT",validTimezone(item.timezone()),increment,null,null,null,null,"UNITS",null,null,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),TIMEFRAMES,"UNKNOWN",item.description().isBlank()?item.name():item.description());}
    public Instrument instrument(String symbol){long id=parse(symbol);return client.catalog().stream().filter(item->item.id()==id).findFirst().map(this::instrument).orElseThrow(()->new IllegalArgumentException("Unsupported cTrader instrument"));}
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to){int period=switch(timeframe){case "1m"->1;case "5m"->5;case "15m"->7;case "30m"->8;case "1h"->9;case "4h"->10;case "1d"->12;default->throw new IllegalArgumentException("Unsupported cTrader timeframe");};return client.history(parse(symbol),period,from,to).stream().map(bar->new Candle(bar.time(),bar.open(),bar.high(),bar.low(),bar.close(),bar.volume())).toList();}
    private static long parse(String symbol){try{long value=Long.parseLong(symbol);if(value<=0)throw new IllegalArgumentException();return value;}catch(RuntimeException invalid){throw new IllegalArgumentException("Invalid cTrader symbol");}}
    private static String validTimezone(String value){try{java.time.ZoneId.of(value);return value;}catch(RuntimeException invalid){return "UTC";}}
}
