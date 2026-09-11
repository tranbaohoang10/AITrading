package com.aitrading.market;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class MarketHistoryService {
    private static final Map<String,Integer> ALPACA_FEATURED_RANK=featuredRank(List.of("AAPL","NVDA","MSFT","TSLA","AMZN","META","GOOGL","GOOG","AMD","SPY","QQQ","IWM","DIA"));
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
        },()->JSON.writeValueAsString(p.search(query).stream().limit(50).toList()));
        return List.of(JSON.readValue(raw,MarketDataProvider.Instrument[].class));
    }
    private record CatalogSnapshot(List<MarketDataProvider.Instrument> rows,long expires) {}
    private final Map<String,CatalogSnapshot> catalogs=new java.util.concurrent.ConcurrentHashMap<>();
    private synchronized List<MarketDataProvider.Instrument> catalogSnapshot(String id,MarketDataProvider p) {
        var cached=catalogs.get(id);
        if(cached!=null&&System.nanoTime()<cached.expires())return cached.rows();
        var rows=p.search("");
        if(rows.size()>20000||rows.stream().anyMatch(i->i==null||!id.equals(i.provider())||!i.instrumentId().equals(id+":"+i.providerSymbol()))||rows.stream().map(MarketDataProvider.Instrument::instrumentId).distinct().count()!=rows.size())throw new IllegalArgumentException("Invalid catalog");
        catalogs.put(id,new CatalogSnapshot(List.copyOf(rows),System.nanoTime()+Duration.ofMinutes(5).toNanos()));return rows;
    }
    public record CatalogPage(List<MarketDataProvider.Instrument> items,String nextCursor) {}
    public CatalogPage catalog(String id,String query,String assetClass,String cursor) {
        var p=provider(id);
        if(query==null||query.length()>64||assetClass==null||!Set.of("","CRYPTO","FOREX","STOCK","ETF","FUTURES","COMMODITY","CFD").contains(assetClass))throw new IllegalArgumentException("Invalid catalog query");
        String binding=MarketCache.key("catalog",id,query.toUpperCase(Locale.ROOT)+"|"+assetClass).substring("aitrading:v1:market:catalog:".length()+id.length()+1);
        int offset=0;
        if(cursor!=null&&!cursor.isEmpty()) {
            if(cursor.length()>160)throw new IllegalArgumentException("Invalid cursor");
            try { String[] parts=new String(Base64.getUrlDecoder().decode(cursor),java.nio.charset.StandardCharsets.UTF_8).split(":");
                if(parts.length!=2||!binding.equals(parts[0]))throw new IllegalArgumentException("Invalid cursor");
                offset=Integer.parseInt(parts[1]);
            } catch(RuntimeException bad){throw new IllegalArgumentException("Invalid cursor");}
            if(offset<0||offset>20000||offset%50!=0)throw new IllegalArgumentException("Invalid cursor");
        }
        var rows=catalogSnapshot(id,p).stream().filter(i->(i.providerSymbol()+" "+i.displaySymbol()+" "+i.name()+" "+i.base()+" "+i.quote()+" "+i.exchange()+" "+i.provider()).toUpperCase(Locale.ROOT).contains(query.toUpperCase(Locale.ROOT))).filter(i->assetClass.isEmpty()||assetClass.equals(i.assetClass())||assetClass.equals("FOREX")&&i.assetClass().equals("FX_REFERENCE")||assetClass.equals("STOCK")&&i.assetClass().equals("US_EQUITY"))
                .sorted(catalogOrder(id)).toList();
        if(rows.size()>20000||rows.stream().map(MarketDataProvider.Instrument::instrumentId).distinct().count()!=rows.size())throw new IllegalArgumentException("Invalid catalog");
        int end=Math.min(rows.size(),offset+50);
        String next=end<rows.size()?Base64.getUrlEncoder().withoutPadding().encodeToString((binding+":"+end).getBytes(java.nio.charset.StandardCharsets.UTF_8)):null;
        return new CatalogPage(rows.subList(Math.min(offset,rows.size()),end),next);
    }
    public MarketDataProvider.Instrument instrument(String provider,String symbol){
        if(symbol==null||!symbol.matches("[A-Z0-9][A-Z0-9.\\-]{0,31}"))throw new IllegalArgumentException("Invalid symbol");
        return search(provider,symbol).stream().filter(i->i.providerSymbol().equals(symbol)).findFirst().orElseThrow(()->new IllegalArgumentException("Unsupported instrument"));
    }
    public List<MarketDataProvider.Candle> history(String provider,String symbol,String timeframe,Instant from,Instant to) {
        MarketDataProvider.range(timeframe,from,to);
        var p=provider(provider);
        String key=MarketCache.key("history",provider,symbol+"|"+timeframe+"|"+from+"|"+to);
        String value=cache.load(key,Duration.ofMinutes(30),raw->valid(raw,from,to),()->{
            HistoricalSourceTimeframeProvider sourceProvider=p instanceof HistoricalSourceTimeframeProvider historicalProvider?historicalProvider:null;
            String source=sourceProvider==null?timeframe:sourceProvider.historicalSourceTimeframe();
            MarketDataProvider.seconds(source);
            Instant sourceFrom=sourceProvider==null?from:max(from,to.minusSeconds((long)MarketDataProvider.seconds(source)*sourceProvider.maximumHistoricalSourceCandles()));
            var rows=source.equals(timeframe)?p.history(symbol,timeframe,sourceFrom,to):
                    source.equals("1m")?MarketTimeframeAggregator.aggregate(p.history(symbol,source,sourceFrom,to),timeframe):null;
            if(rows==null)throw new IllegalArgumentException("Unsupported timeframe");return JSON.writeValueAsString(rows);
        });
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
    private static Map<String,Integer> featuredRank(List<String> symbols) {
        var ranks=new HashMap<String,Integer>();for(int index=0;index<symbols.size();index++)ranks.put(symbols.get(index),index);return Map.copyOf(ranks);
    }
    private static Instant max(Instant left,Instant right){return left.isAfter(right)?left:right;}
    private static Comparator<MarketDataProvider.Instrument> catalogOrder(String provider) {
        return Comparator.comparingInt((MarketDataProvider.Instrument item)->"ALPACA".equals(provider)?ALPACA_FEATURED_RANK.getOrDefault(item.providerSymbol(),Integer.MAX_VALUE):0)
                .thenComparing(MarketDataProvider.Instrument::instrumentId);
    }
}
