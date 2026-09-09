package com.aitrading.market;

import java.math.*;
import java.time.Instant;
import java.util.Optional;
import tools.jackson.databind.json.JsonMapper;

final class OandaPricingMessage {
    record Price(String instrument,Instant time,BigDecimal midpoint){}
    static Optional<Price> parse(String raw,String expected,Instant now){
        try{var node=JsonMapper.builder().build().readTree(raw);if(node==null||!node.isObject())throw invalid();if("HEARTBEAT".equals(node.path("type").asString()))return Optional.empty();
            if(!"PRICE".equals(node.path("type").asString())||!expected.equals(node.path("instrument").asString())||!node.path("tradeable").asBoolean(false))throw invalid();
            Instant time=Instant.parse(node.path("time").asString());if(time.isAfter(now.plusSeconds(5)))throw invalid();BigDecimal bid=decimal(node.path("closeoutBid").asString()),ask=decimal(node.path("closeoutAsk").asString());
            return Optional.of(new Price(expected,time,bid.add(ask).divide(BigDecimal.valueOf(2),12,RoundingMode.HALF_UP).stripTrailingZeros()));
        }catch(OandaDataFailure failure){throw failure;}catch(Exception failure){throw invalid();}
    }
    private static BigDecimal decimal(String raw){if(raw==null||!raw.matches("(?:0|[1-9][0-9]{0,14})(?:\\.[0-9]{1,12})?"))throw invalid();var value=new BigDecimal(raw);if(value.signum()<=0)throw invalid();return value;}
    private static OandaDataFailure invalid(){return new OandaDataFailure("OANDA_INVALID_STREAM_EVENT",502);}
}
