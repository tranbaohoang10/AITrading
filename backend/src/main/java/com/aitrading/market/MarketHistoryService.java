package com.aitrading.market;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class MarketHistoryService {
    private final Map<String,MarketDataProvider> providers;
    private final MarketCache cache;
    private static final JsonMapper JSON=JsonMapper.builder().build();
    public MarketHistoryService(List<MarketDataProvider> providers,MarketCache cache) {
        var map=new TreeMap<String,MarketDataProvider>();
        for(var provider:providers)map.put(provider.capabilities().providerId(),provider);
        this.providers=Map.copyOf(map);this.cache=cache;
    }
    public List<MarketDataProvider.Capabilities> capabilities(){return providers.values().stream().map(MarketDataProvider::capabilities).toList();}
    public boolean replaySupported(String id){return provider(id).capabilities().historicalReplaySupported();}
    private MarketDataProvider provider(String id) {
        var p=providers.get(id);
        if(p==null||!p.capabilities().configured()||!p.capabilities().displayAllowed()
                ||!Set.of("ACCEPTED","CONDITIONAL").contains(p.capabilities().licenseStatus()))
            throw new IllegalArgumentException("Unsupported provider");
        return p;
    }
    public List<MarketDataProvider.Instrument> search(String provider,String query){
        var p=provider(provider);
        if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");
        String key=MarketCache.key("catalog",provider,query.toUpperCase(Locale.ROOT));
        String raw=cache.load(key,Duration.ofMinutes(5),value->{
            try {
                var rows=JSON.readValue(value,MarketDataProvider.Instrument[].class);
                return rows.length<=50&&Arrays.stream(rows).allMatch(i->i!=null&&provider.equals(i.provider())&&i.providerSymbol()!=null&&i.providerSymbol().length()<=32);
            }catch(RuntimeException malformed){return false;}
        },()->JSON.writeValueAsString(p.search(query)));
        return List.of(JSON.readValue(raw,MarketDataProvider.Instrument[].class));
    }
    public MarketDataProvider.Instrument instrument(String provider,String symbol){
        if(symbol==null||!symbol.matches("[A-Z][A-Z0-9.\\-]{0,31}"))throw new IllegalArgumentException("Invalid symbol");
        return search(provider,symbol).stream().filter(i->i.providerSymbol().equals(symbol)).findFirst().orElseThrow(()->new IllegalArgumentException("Unsupported instrument"));
    }
    public List<MarketDataProvider.Candle> history(String provider,String symbol,String timeframe,Instant from,Instant to) {
        MarketDataProvider.range(timeframe,from,to);
        var p=provider(provider);
        String key=MarketCache.key("history",provider,symbol+"|"+timeframe+"|"+from+"|"+to);
        String value=cache.load(key,Duration.ofMinutes(30),raw->valid(raw,from,to),
                ()->JSON.writeValueAsString(p.history(symbol,timeframe,from,to)));
        return List.of(JSON.readValue(value,MarketDataProvider.Candle[].class));
    }
    private boolean valid(String raw,Instant from,Instant to) {
        try {
            var rows=JSON.readValue(raw,MarketDataProvider.Candle[].class);
            if(rows.length>20000)return false;
            Instant previous=null;
            for(var row:rows) {
                if(row==null||row.time().isBefore(from)||!row.time().isBefore(to)
                        ||previous!=null&&!row.time().isAfter(previous))return false;
                previous=row.time();
            }
            return true;
        }catch(RuntimeException invalid){return false;}
    }
    public MarketDataProvider.Coverage coverage(String provider,String symbol,String timeframe,Instant from,Instant to) {
        MarketDataProvider.range(timeframe,from,to);
        var p=provider(provider);
        String key=MarketCache.key("coverage",provider,symbol+"|"+timeframe+"|"+from+"|"+to);
        String value=cache.load(key,Duration.ofMinutes(5),raw->{
            try {
                var c=JSON.readValue(raw,MarketDataProvider.Coverage.class);
                return provider.equals(c.provider())&&symbol.equals(c.instrument())&&timeframe.equals(c.timeframe())
                        &&Set.of("PARTIAL","UNKNOWN").contains(c.status())&&c.checkedAt()!=null
                        &&(c.verifiedFromUtc()==null||!c.verifiedFromUtc().isBefore(from)&&c.verifiedFromUtc().isBefore(to))
                        &&(c.verifiedThroughUtc()==null||!c.verifiedThroughUtc().isBefore(from)&&c.verifiedThroughUtc().isBefore(to));
            }catch(RuntimeException malformed){return false;}
        },()->JSON.writeValueAsString(probe(p,provider,symbol,timeframe,from,to)));
        return JSON.readValue(value,MarketDataProvider.Coverage.class);
    }
    private MarketDataProvider.Coverage probe(MarketDataProvider p,String provider,String symbol,String timeframe,Instant from,Instant to) {
        var rows=history(provider,symbol,timeframe,from,to);
        return new MarketDataProvider.Coverage(provider,symbol,timeframe,rows.isEmpty()?"UNKNOWN":"PARTIAL",
                null,null,rows.isEmpty()?null:rows.getFirst().time(),rows.isEmpty()?null:rows.getLast().time(),
                Instant.now(),p.capabilities().maxCandlesPerRequest(),p.capabilities().bulkHistorical(),
                List.of("Only requested range probed; no global earliest date asserted", "Missing buckets remain gaps"));
    }
    public String cacheStatus(){return cache.status();}
}
