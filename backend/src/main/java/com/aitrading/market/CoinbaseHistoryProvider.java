package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class CoinbaseHistoryProvider implements MarketDataProvider {
    private static final List<String> TF=List.of("1m","5m","15m","1h","1d");
    private final CoinbaseMarketDataClient client;
    public CoinbaseHistoryProvider(CoinbaseMarketDataClient client) { this.client=client; }
    public Capabilities capabilities() {
        return new Capabilities("COINBASE","Coinbase Public",List.of("CRYPTO"),TF,
                true,true,false,false,false,false,true,true,false,false,true,
                "ACCEPTED","REST_PAGED",300,"UTC",true,
                List.of("Public Exchange WebSocket; no-tick intervals can be absent", "Earliest history is not globally guaranteed"));
    }
    public List<Instrument> search(String query) {
        if(query==null || query.length()>64) throw new IllegalArgumentException("Invalid search");
        List<Instrument> result=new ArrayList<>();
        var root=JsonMapper.builder().build().readTree(client.products());
        for(var item:root) {
            String symbol=item.path("id").asString();
            if(!symbol.matches("[A-Z][A-Z0-9]{0,14}-USD") || !(symbol+" Coinbase PUBLIC "+item.path("display_name").asString()).toUpperCase(Locale.ROOT).contains(query.toUpperCase(Locale.ROOT))) continue;
            BigDecimal price=new BigDecimal(item.path("quote_increment").asString());
            BigDecimal qty=new BigDecimal(item.path("base_increment").asString());
            if(price.signum()<=0||qty.signum()<=0||price.scale()>12||qty.scale()>12)continue;
            result.add(new Instrument("COINBASE:"+symbol,symbol.replace('-', '/'),symbol,"COINBASE",
                    "CRYPTO",symbol.substring(0,symbol.length()-4),"USD","Coinbase","USD","SPOT","UTC",
                    price,qty,qty.scale(),null,null,"BASE_QUANTITY",null,BigDecimal.ONE,null,
                    "INCREMENTS_VERIFIED",List.of("HISTORICAL","REALTIME"),TF,"UNKNOWN",item.path("display_name").asString().isBlank()?symbol:item.path("display_name").asString()));

        }
        return List.copyOf(result);
    }
    public Instrument instrument(String symbol) {
        if(symbol==null||!symbol.matches("[A-Z][A-Z0-9]{0,14}-USD"))throw new IllegalArgumentException("Invalid instrument");
        return search(symbol).stream().filter(i->i.providerSymbol().equals(symbol)).findFirst()
                .orElseThrow(()->new IllegalArgumentException("Unsupported instrument"));
    }
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to) {
        MarketDataProvider.range(timeframe,from,to);
        if(!TF.contains(timeframe))throw new IllegalArgumentException("Unsupported timeframe");
        int step=MarketDataProvider.seconds(timeframe);
        TreeMap<Instant,Candle> rows=new TreeMap<>();
        for(Instant start=from;start.isBefore(to);) {
            Instant end=start.plusSeconds((long)step*299); if(end.isAfter(to))end=to;
            var root=JsonMapper.builder().build().readTree(client.series(symbol,step,start.toEpochMilli(),end.toEpochMilli()));
            if(root.size()>300)throw new IllegalArgumentException("Invalid provider response");
            for(var row:root) {
                if(!row.isArray()||row.size()!=6)throw new IllegalArgumentException("Invalid provider response");
                Instant time=Instant.ofEpochSecond(row.get(0).asLong());
                if(time.isBefore(from)||!time.isBefore(to))continue;
                if(time.getEpochSecond()%step!=0)throw new IllegalArgumentException("Invalid provider time");
                Candle candle=new Candle(time,new BigDecimal(row.get(3).asString()),new BigDecimal(row.get(2).asString()),
                        new BigDecimal(row.get(1).asString()),new BigDecimal(row.get(4).asString()),new BigDecimal(row.get(5).asString()));
                Candle previous=rows.putIfAbsent(time,candle);
                if(previous!=null&&!previous.equals(candle))throw new IllegalArgumentException("Conflicting provider candles");
            }
            start=end;
        }
        return List.copyOf(rows.values());
    }
}
