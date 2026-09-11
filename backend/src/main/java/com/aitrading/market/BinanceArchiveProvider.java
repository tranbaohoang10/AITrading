package com.aitrading.market;

import java.io.*;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.security.*;
import java.time.*;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.springframework.stereotype.Service;

/** Official daily archives only. No broker API, scraping or cross-source fallback. */
@Service
public class BinanceArchiveProvider implements MarketDataProvider,HistoricalAvailabilityProvider {
    private final BinanceSpotCatalog catalog = new BinanceSpotCatalog();
    private static final List<String> TF=List.of("1m","5m","15m","30m","1h","4h","1d");
    private static final Set<String> SYMBOLS=Set.of("BTCUSDT","ETHUSDT","SOLUSDT");
    private static final int MAX_ZIP=8_000_000, MAX_EXPANDED=16_000_000;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    public Capabilities capabilities() {
        return new Capabilities("BINANCE","Binance Public Data",List.of("CRYPTO"),TF,
                true,true,false,false,false,true,true,true,false,false,true,"ACCEPTED",
                "REST_PAGED_AND_ARCHIVE",1000,"UTC",true,List.of("Public Spot REST klines and daily archives",
                "Futures archives not enabled without verified contract sizing", "Historical quantity only; exchange increments not asserted"));
    }
    public List<Instrument> search(String query) {
        if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");
        return catalog.instruments().stream().filter(i->(i.providerSymbol()+" "+i.displaySymbol()+" Binance "+i.base()+" "+i.quote()).toUpperCase(Locale.ROOT).contains(query.toUpperCase(Locale.ROOT))).toList();
    }
    public Instrument instrument(String symbol) {
        if(symbol==null||!symbol.matches("[A-Z0-9]{2,32}"))throw new IllegalArgumentException("Invalid Binance instrument");
        if(!SYMBOLS.contains(symbol))return catalog.instruments().stream().filter(i->i.providerSymbol().equals(symbol)).findFirst().orElseThrow(()->new IllegalArgumentException("Unsupported Binance instrument"));
        return new Instrument("BINANCE:"+symbol,symbol.replace("USDT","/USDT"),symbol,"BINANCE","CRYPTO",
                symbol.substring(0,symbol.length()-4),"USDT","Binance","USDT","SPOT","UTC",null,null,null,
                null,null,"BASE_QUANTITY",null,BigDecimal.ONE,null,"QUANTITY_ONLY",
                List.of("HISTORICAL","REALTIME"),TF,"UNKNOWN",symbol.replace("USDT","/USDT"));
    }
    public Instant historicalAvailableFrom(String symbol) {
        instrument(symbol);
        try {
            URI uri=URI.create("https://data-api.binance.vision/api/v3/klines?symbol="+symbol+"&interval=1m&startTime=0&limit=1");
            byte[] raw=fetch(http,uri,64_000,System.nanoTime()+Duration.ofSeconds(15).toNanos());
            var rows=tools.jackson.databind.json.JsonMapper.builder().build().readTree(new String(raw,StandardCharsets.UTF_8));
            if(!rows.isArray()||rows.size()!=1||!rows.get(0).isArray()||!rows.get(0).get(0).isIntegralNumber())throw new IOException("Invalid earliest kline");
            return Instant.ofEpochMilli(rows.get(0).get(0).asLong());
        }catch(Exception failure){if(failure instanceof InterruptedException)Thread.currentThread().interrupt();throw new CoinbaseDataFailure("BINANCE_HISTORY_UNAVAILABLE",502);}
    }
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to) {
        instrument(symbol); MarketDataProvider.range(timeframe,from,to);
        int step=MarketDataProvider.seconds(timeframe);if(step!=60)throw new IllegalArgumentException("Binance source timeframe is M1");
        TreeMap<Instant,Candle> result=new TreeMap<>();
        long cursor=from.toEpochMilli(),end=to.toEpochMilli();
        try {for(int page=0;page<20&&cursor<end;page++) {
            URI uri=URI.create("https://data-api.binance.vision/api/v3/klines?symbol="+symbol+"&interval=1m&startTime="+cursor+"&endTime="+(end-1)+"&limit=1000");
            byte[] raw=fetch(http,uri,1_000_000,System.nanoTime()+Duration.ofSeconds(20).toNanos());
            var rows=tools.jackson.databind.json.JsonMapper.builder().build().readTree(new String(raw,StandardCharsets.UTF_8));
            if(!rows.isArray()||rows.size()>1000)throw new IOException("Invalid klines");
            if(rows.isEmpty())break;
            long previous=cursor-1;
            for(var row:rows){if(!row.isArray()||row.size()<6||!row.get(0).isIntegralNumber())throw new IOException("Invalid kline");long opened=row.get(0).asLong();if(opened<=previous||opened%60000!=0)throw new IOException("Unordered kline");previous=opened;var candle=new Candle(Instant.ofEpochMilli(opened),new BigDecimal(row.get(1).asString()),new BigDecimal(row.get(2).asString()),new BigDecimal(row.get(3).asString()),new BigDecimal(row.get(4).asString()),new BigDecimal(row.get(5).asString()));if(result.putIfAbsent(candle.time(),candle)!=null)throw new IOException("Duplicate candle");}
            cursor=previous+60000;if(rows.size()<1000)break;
        }}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new CoinbaseDataFailure("BINANCE_HISTORY_UNAVAILABLE",502);}catch(Exception failure){throw new CoinbaseDataFailure("BINANCE_HISTORY_UNAVAILABLE",502);}
        if(cursor<end&&result.size()>=20_000)throw new CoinbaseDataFailure("BINANCE_HISTORY_LIMIT",502);
        return List.copyOf(result.values());
    }
    static byte[] fetch(HttpClient http,URI uri,int maximum,long deadline)throws Exception {
        long remaining=Math.min(Duration.ofSeconds(20).toNanos(),deadline-System.nanoTime());
        if(remaining<=0)throw new IOException("Archive request deadline exceeded");
        var request=HttpRequest.newBuilder(uri).timeout(Duration.ofNanos(remaining)).GET().build();
        var pending=http.sendAsync(request,info->new BoundedBodySubscriber(maximum));
        try {
            var response=pending.get(remaining,TimeUnit.NANOSECONDS);
            if(response.statusCode()!=200)throw new IOException("Archive unavailable");
            return response.body();
        } finally {
            if(!pending.isDone())pending.cancel(true);
        }
    }
    static List<Candle> parse(InputStream input,int step)throws IOException {
        List<Candle> result=new ArrayList<>();
        try(var zip=new ZipInputStream(input,StandardCharsets.UTF_8)) {
            var entry=zip.getNextEntry();
            if(entry==null||entry.isDirectory()||!entry.getName().endsWith(".csv"))throw new IOException("Invalid archive");
            // Read bounded lines directly: BufferedReader.readLine could allocate an unbounded line.
            ByteArrayOutputStream line=new ByteArrayOutputStream();int c,total=0;
            while((c=zip.read())!=-1) {
                if(++total>MAX_EXPANDED)throw new IOException("Expanded archive too large");
                if(c=='\n') { addLine(line,result,step);line.reset(); }
                else if(c!='\r') { if(line.size()>=2048)throw new IOException("CSV line too large");line.write(c); }
            }
            if(line.size()>0)addLine(line,result,step);
            if(zip.getNextEntry()!=null)throw new IOException("Multiple archive entries");
        }
        return List.copyOf(result);
    }
    private static void addLine(ByteArrayOutputStream line,List<Candle> rows,int step)throws IOException {
        if(rows.size()>=1440)throw new IOException("Too many daily candles");
        String[] fields=line.toString(StandardCharsets.US_ASCII).split(",",-1);
        if(fields.length!=12)throw new IOException("Invalid CSV columns");
        try {
            long raw=Long.parseLong(fields[0]);
            long millis=raw>=100_000_000_000_000L?raw/1000:raw;
            if(millis%((long)step*1000)!=0)throw new IOException("Invalid candle bucket");
            Instant time=Instant.ofEpochMilli(millis);
            if(!rows.isEmpty()&&!time.isAfter(rows.getLast().time()))throw new IOException("Unordered candles");
            rows.add(new Candle(time,new BigDecimal(fields[1]),new BigDecimal(fields[2]),new BigDecimal(fields[3]),
                    new BigDecimal(fields[4]),new BigDecimal(fields[5])));
        }catch(IllegalArgumentException invalid){throw new IOException("Invalid CSV value");}
    }
}
