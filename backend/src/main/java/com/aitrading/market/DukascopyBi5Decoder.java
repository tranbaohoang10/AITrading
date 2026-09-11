package com.aitrading.market;

import java.io.*;
import java.math.BigDecimal;
import java.nio.*;
import java.time.*;
import java.util.*;
import org.tukaani.xz.LZMAInputStream;

final class DukascopyBi5Decoder {
    private static final int RECORD_SIZE=24,MAX_EXPANDED=1440*RECORD_SIZE;
    private DukascopyBi5Decoder() {}
    static List<MarketDataProvider.Candle> decode(byte[] compressed, LocalDate day, int priceScale) throws IOException {
        if(compressed==null||compressed.length==0||compressed.length>2_000_000||priceScale<0||priceScale>12)throw new IOException("Invalid BI5 input");
        byte[] raw;
        try(var input=new LZMAInputStream(new ByteArrayInputStream(compressed));var output=new ByteArrayOutputStream()) {
            input.transferTo(new BoundedOutputStream(output,MAX_EXPANDED));raw=output.toByteArray();
        }
        if(raw.length%RECORD_SIZE!=0)throw new IOException("Invalid BI5 record size");
        var result=new ArrayList<MarketDataProvider.Candle>();var buffer=ByteBuffer.wrap(raw).order(ByteOrder.BIG_ENDIAN);
        BigDecimal divisor=BigDecimal.TEN.pow(priceScale);Instant start=day.atStartOfDay(ZoneOffset.UTC).toInstant();
        while(buffer.remaining()>=RECORD_SIZE) {
            long second=Integer.toUnsignedLong(buffer.getInt());long open=Integer.toUnsignedLong(buffer.getInt());
            long close=Integer.toUnsignedLong(buffer.getInt());long low=Integer.toUnsignedLong(buffer.getInt());long high=Integer.toUnsignedLong(buffer.getInt());
            float volume=buffer.getFloat();
            if(second>=86400||second%60!=0||!Float.isFinite(volume)||volume<0)throw new IOException("Invalid BI5 candle");
            var candle=new MarketDataProvider.Candle(start.plusSeconds(second),BigDecimal.valueOf(open).divide(divisor),
                    BigDecimal.valueOf(high).divide(divisor),BigDecimal.valueOf(low).divide(divisor),
                    BigDecimal.valueOf(close).divide(divisor),new BigDecimal(Float.toString(volume)));
            if(!result.isEmpty()&&!candle.time().isAfter(result.getLast().time()))throw new IOException("Unordered BI5 candles");
            result.add(candle);
        }
        return List.copyOf(result);
    }
    private static final class BoundedOutputStream extends FilterOutputStream {
        private final int limit;private int written;
        BoundedOutputStream(OutputStream output,int limit){super(output);this.limit=limit;}
        public void write(int value)throws IOException{check(1);out.write(value);}
        public void write(byte[] value,int offset,int length)throws IOException{check(length);out.write(value,offset,length);}
        private void check(int length)throws IOException{if(length<0||written+length>limit)throw new IOException("Expanded BI5 too large");written+=length;}
    }
}
