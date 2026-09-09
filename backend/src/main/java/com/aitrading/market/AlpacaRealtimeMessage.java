package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class AlpacaRealtimeMessage {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    record Trade(String symbol,long id,Instant time,BigDecimal price,BigDecimal size) {}
    static List<Trade> trades(String raw,String expectedSymbol,Instant now) {
        try {
            JsonNode root=JSON.readTree(raw);if(root==null||!root.isArray()||root.size()>1000)throw invalid();
            var result=new ArrayList<Trade>();
            for(var event:root) {
                if(!"t".equals(event.path("T").asString()))continue;
                String symbol=event.path("S").asString();long id=event.path("i").asLong(-1);Instant time=Instant.parse(event.path("t").asString());
                BigDecimal price=decimal(event.get("p"),false),size=decimal(event.get("s"),false);
                if(!expectedSymbol.equals(symbol)||id<0||time.isAfter(now.plusSeconds(5)))throw invalid();
                result.add(new Trade(symbol,id,time,price,size));
            }
            return result;
        } catch(AlpacaDataFailure failure){throw failure;}catch(Exception failure){throw invalid();}
    }
    private static BigDecimal decimal(JsonNode value,boolean zero){
        if(value==null||!value.isNumber())throw invalid();var number=value.decimalValue();
        if(number.scale()>12||number.precision()>28||(zero?number.signum()<0:number.signum()<=0))throw invalid();return number;
    }
    private static AlpacaDataFailure invalid(){return new AlpacaDataFailure("ALPACA_INVALID_STREAM_EVENT",502);}
}
