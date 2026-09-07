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
public class BinanceArchiveProvider implements MarketDataProvider {
    private static final List<String> TF=List.of("1m","5m","15m","30m","1h","4h","1d");
    private static final Set<String> SYMBOLS=Set.of("BTCUSDT","ETHUSDT","SOLUSDT");
    private static final int MAX_ZIP=8_000_000, MAX_EXPANDED=16_000_000;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    public Capabilities capabilities() {
        return new Capabilities("BINANCE","Binance Public Data",List.of("CRYPTO"),TF,
                true,false,false,false,false,true,true,true,false,false,true,"ACCEPTED",
                "BULK_ARCHIVE",1440,"UTC",true,List.of("Selected Spot daily archives; no realtime feed",
                "Futures archives not enabled without verified contract sizing", "Historical quantity only; exchange increments not asserted"));
    }
    public List<Instrument> search(String query) {
        if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");
        return SYMBOLS.stream().sorted().filter(s->s.contains(query.toUpperCase(Locale.ROOT))).map(this::instrument).toList();
    }
    public Instrument instrument(String symbol) {
        if(!SYMBOLS.contains(symbol))throw new IllegalArgumentException("Unsupported Binance instrument");
        return new Instrument("BINANCE:"+symbol,symbol.replace("USDT","/USDT"),symbol,"BINANCE","CRYPTO",
                symbol.substring(0,symbol.length()-4),"USDT","Binance","USDT","SPOT","UTC",null,null,null,
                null,null,"BASE_QUANTITY",null,BigDecimal.ONE,null,"QUANTITY_ONLY",
                List.of("HISTORICAL"),TF,"UNKNOWN");
    }
    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to) {
        instrument(symbol); MarketDataProvider.range(timeframe,from,to);
        int step=MarketDataProvider.seconds(timeframe);
        TreeMap<Instant,Candle> result=new TreeMap<>();
        LocalDate day=from.atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate last=to.minusNanos(1).atZone(ZoneOffset.UTC).toLocalDate();
        if(java.time.temporal.ChronoUnit.DAYS.between(day,last)>31)
            throw new IllegalArgumentException("Archive request exceeds 32 days; request another window");
        long deadline=System.nanoTime()+Duration.ofSeconds(40).toNanos();
        for(;!day.isAfter(last);day=day.plusDays(1)) {
            String file=symbol+"-"+timeframe+"-"+day+".zip";
            URI uri=URI.create("https://data.binance.vision/data/spot/daily/klines/"+symbol+"/"+timeframe+"/"+file);
            try {
                byte[] check=fetch(http,URI.create(uri+".CHECKSUM"),1024,deadline);
                String checksum=new String(check,StandardCharsets.US_ASCII).strip();
                if(!checksum.matches("[a-fA-F0-9]{64}\\s+\\*?"+java.util.regex.Pattern.quote(file)))
                    throw new IOException("Invalid checksum");
                byte[] archive=fetch(http,uri,MAX_ZIP,deadline);
                byte[] digest=MessageDigest.getInstance("SHA-256").digest(archive);
                if(!HexFormat.of().formatHex(digest).equalsIgnoreCase(checksum.substring(0,64)))
                    throw new IOException("Checksum mismatch");
                try(var input=new ByteArrayInputStream(archive)) {
                    for(Candle candle:parse(input,step)) {
                        if(candle.time().isBefore(from)||!candle.time().isBefore(to))continue;
                        if(result.putIfAbsent(candle.time(),candle)!=null)throw new IOException("Duplicate candle");
                    }
                }
            } catch(InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new CoinbaseDataFailure("BINANCE_HISTORY_UNAVAILABLE",502);
            } catch(Exception failure) { throw new CoinbaseDataFailure("BINANCE_HISTORY_UNAVAILABLE",502); }
        }
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
