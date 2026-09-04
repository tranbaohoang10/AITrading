package com.aitrading.market;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Strict mapper for Alpaca's documented stock-bars response. It never invents missing bars. */
public final class AlpacaMarketDataMapper {
    public static final int MAX_BARS=20_000;
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private AlpacaMarketDataMapper() { }
    public record Bar(Instant openTime, Instant closeTime, String open, String high, String low, String close, String volume, boolean closed) { }

    public static List<Bar> bars(String raw,String timeframe,Instant now) {
        if(raw==null||raw.length()>8_000_000||timeframe==null||now==null)throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
        long interval=MarketCsvParser.timeframeSeconds(timeframe);
        final JsonNode root;
        try { root=JSON.readTree(raw); } catch(Exception invalid) { throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502); }
        JsonNode values=root==null?null:root.get("bars");
        if(values==null||!values.isArray()||values.size()>MAX_BARS)throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
        Map<Instant,Bar> unique=new TreeMap<>();
        for(JsonNode value:values) {
            if(!value.isObject())throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
            String timestamp=text(value.get("t"));
            Instant openTime;
            try { openTime=Instant.parse(timestamp); } catch(DateTimeException invalid) { throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502); }
            String open=decimal(value.get("o"),false), high=decimal(value.get("h"),false), low=decimal(value.get("l"),false), close=decimal(value.get("c"),false), volume=decimal(value.get("v"),true);
            if(new BigDecimal(high).compareTo(max(open,close,low))<0||new BigDecimal(low).compareTo(min(open,close,high))>0)throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
            Instant closeTime=openTime.plusSeconds(interval).minusMillis(1);
            unique.put(openTime,new Bar(openTime,closeTime,open,high,low,close,volume,closeTime.isBefore(now)));
        }
        return List.copyOf(unique.values());
    }
    private static String text(JsonNode value) { if(value==null||!value.isString()||value.asString().length()>64)throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502); return value.asString(); }
    private static String decimal(JsonNode value,boolean zeroAllowed) {
        if(value==null||(!value.isNumber()&&!value.isString()))throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
        String text=value.asString(); if(!text.matches("(?:0|[1-9][0-9]{0,18})(?:\\.[0-9]{1,12})?"))throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
        BigDecimal number=new BigDecimal(text); if(number.signum()<0||(!zeroAllowed&&number.signum()==0))throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
        return number.stripTrailingZeros().toPlainString();
    }
    private static BigDecimal max(String... values) { return Arrays.stream(values).map(BigDecimal::new).max(Comparator.naturalOrder()).orElseThrow(); }
    private static BigDecimal min(String... values) { return Arrays.stream(values).map(BigDecimal::new).min(Comparator.naturalOrder()).orElseThrow(); }
}
