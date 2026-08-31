package com.aitrading.market;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public final class MarketCsvParser {
    public static final int MAX_CSV_BYTES=1024*1024, MAX_IMPORT_BYTES=2*1024*1024, MAX_ROWS=5000;
    public static final String FORMAT="ohlcv-v1";
    private static final String HEADER="timestamp,open,high,low,close,volume";
    private static final BigDecimal MAX_NUMBER=new BigDecimal("1000000000000");
    private static final Instant MAX_TIME=Instant.parse("2101-01-01T00:00:00Z");
    private static final Map<String,Integer> TIMEFRAMES=Map.of("1m",60,"5m",300,"15m",900,"30m",1800,"1h",3600,"4h",14400,"1d",86400);
    public record Candle(Instant time, BigDecimal open, BigDecimal high, BigDecimal low, BigDecimal close, BigDecimal volume) { }
    public record Parsed(List<Candle> candles, long gapCount, String rawHash, String dataHash) {
        public Parsed { candles=List.copyOf(candles); }
    }
    public static int timeframeSeconds(String timeframe) {
        Integer seconds=timeframe==null?null:TIMEFRAMES.get(timeframe);
        if(seconds==null)throw new IllegalArgumentException("Unsupported timeframe");
        return seconds;
    }
    public static String symbol(String value) {
        if(value==null || !value.matches("[A-Za-z0-9][A-Za-z0-9_.-]{0,31}"))throw new IllegalArgumentException("Invalid symbol");
        return value;
    }
    public static String hash(String text) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException impossible){throw new IllegalStateException("SHA256 unavailable",impossible);}
    }
    public static String decimal(BigDecimal value) {return value.stripTrailingZeros().toPlainString();}

    public Parsed parse(String csv,String symbol,String timeframe,Instant now) {
        symbol(symbol);int interval=timeframeSeconds(timeframe);
        if(csv==null || csv.isEmpty())throw new MarketDataFailure("CSV_REQUIRED",0);
        if(csv.length()>MAX_CSV_BYTES || csv.getBytes(StandardCharsets.UTF_8).length>MAX_CSV_BYTES)
            throw new MarketDataFailure("CSV_SIZE_LIMIT",0);
        if(csv.codePoints().anyMatch(c->(c>=0xD800&&c<=0xDFFF)||(Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t')))
            throw new MarketDataFailure("CSV_ENCODING",0);
        String rawHash=hash(csv);
        String normalized=csv.replace("\r\n","\n");
        if(normalized.startsWith("\ufeff"))normalized=normalized.substring(1);
        if(normalized.indexOf('\r')>=0)throw new MarketDataFailure("CSV_LINE_ENDING",0);
        String[] lines=normalized.split("\n",-1);
        int count=lines.length;
        if(count>0&&lines[count-1].isEmpty())count--;
        if(count==0 || !lines[0].equals(HEADER))throw new MarketDataFailure("CSV_HEADER",1);
        if(count<2)throw new MarketDataFailure("CSV_ROWS_REQUIRED",1);
        if(count-1>MAX_ROWS)throw new MarketDataFailure("CSV_ROW_LIMIT",MAX_ROWS+2);
        List<Candle> candles=new ArrayList<>(count-1);
        StringBuilder canonical=new StringBuilder(FORMAT+"\n"+symbol+"\n"+timeframe+"\nUTC\n");
        Instant previous=null;long gaps=0;
        for(int index=1;index<count;index++) {
            int line=index+1;
            if(lines[index].length()>2048)throw new MarketDataFailure("CSV_RECORD_SIZE",line);
            String[] fields=lines[index].split(",",-1);
            if(fields.length!=6)throw new MarketDataFailure("CSV_COLUMNS",line);
            for(int i=0;i<fields.length;i++)fields[i]=cell(fields[i],line);
            Instant time=time(fields[0],interval,now,line);
            if(previous!=null) {
                long delta=time.getEpochSecond()-previous.getEpochSecond();
                if(delta<=0)throw new MarketDataFailure("CSV_TIME_ORDER",line);
                gaps+=delta/interval-1;
            }
            BigDecimal open=number(fields[1],false,line), high=number(fields[2],false,line), low=number(fields[3],false,line),
                    close=number(fields[4],false,line),volume=number(fields[5],true,line);
            if(high.compareTo(low)<0 || open.compareTo(low)<0 || open.compareTo(high)>0 || close.compareTo(low)<0 || close.compareTo(high)>0)
                throw new MarketDataFailure("CSV_OHLC_RANGE",line);
            candles.add(new Candle(time,open,high,low,close,volume));previous=time;
            canonical.append(time).append(',').append(decimal(open)).append(',').append(decimal(high)).append(',')
                    .append(decimal(low)).append(',').append(decimal(close)).append(',').append(decimal(volume)).append('\n');
        }
        return new Parsed(candles,gaps,rawHash,hash(canonical.toString()));
    }
    private String cell(String value,int line) {
        value=value.replaceAll("^[ \\t]+|[ \\t]+$","");
        if(value.startsWith("\"")&&value.endsWith("\"")&&value.length()>=2)value=value.substring(1,value.length()-1);
        if(value.isEmpty() || value.indexOf('"')>=0)throw new MarketDataFailure("CSV_CELL",line);
        return value;
    }
    private BigDecimal number(String value,boolean zeroAllowed,int line) {
        if(!value.matches("[0-9]{1,13}(\\.[0-9]{1,8})?"))throw new MarketDataFailure("CSV_NUMBER_FORMAT",line);
        BigDecimal number=new BigDecimal(value);
        if(number.compareTo(MAX_NUMBER)>0 || (!zeroAllowed&&number.signum()==0))throw new MarketDataFailure("CSV_NUMBER_RANGE",line);
        return number;
    }
    private Instant time(String text,int interval,Instant now,int line) {
        Instant time;
        try {
            if(!text.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z"))throw new DateTimeParseException("Unsupported timestamp", "",0);
            time=Instant.parse(text);
            if(!time.toString().equals(text) || time.isBefore(Instant.EPOCH)||!time.isBefore(MAX_TIME))throw new DateTimeParseException("Unsupported timestamp","",0);
        } catch(DateTimeParseException invalid) {throw new MarketDataFailure("CSV_TIMESTAMP",line);}
        if(time.getEpochSecond()%interval!=0)throw new MarketDataFailure("CSV_TIME_ALIGNMENT",line);
        if(time.plusSeconds(interval).isAfter(now))throw new MarketDataFailure("CSV_OPEN_OR_FUTURE_CANDLE",line);
        return time;
    }
}
