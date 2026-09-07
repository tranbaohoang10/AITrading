package com.aitrading.replay;

import com.aitrading.market.MarketDataProvider.Candle;
import java.math.*;

/** Deterministic execution; input contains only the newly revealed candle. */
public final class ReplayExecution {
    private static final BigDecimal HUNDRED=new BigDecimal("100"), TEN_THOUSAND=new BigDecimal("10000");
    private ReplayExecution() {}
    public record Sizing(BigDecimal quantity,BigDecimal riskAmount,BigDecimal riskPercent,
            BigDecimal rewardAmount,BigDecimal rewardPercent,BigDecimal rewardRisk) {}
    public record Exit(BigDecimal price,String reason,String ambiguity) {}
    public static BigDecimal positive(String value) {
        if(value==null||!value.matches("(0|[1-9][0-9]{0,11})(\\.[0-9]{1,8})?"))throw invalid();
        var n=new BigDecimal(value);if(n.signum()<=0)throw invalid();return n;
    }
    private static IllegalArgumentException invalid(){return new IllegalArgumentException("Invalid replay order");}
    public static void levels(String side,BigDecimal entry,BigDecimal stop,BigDecimal target) {
        if(side==null||entry==null||stop==null||target==null||entry.signum()<=0||stop.signum()<=0||target.signum()<=0)throw invalid();
        if(side.equals("LONG")) {if(stop.compareTo(entry)>=0||target.compareTo(entry)<=0)throw invalid();}
        else if(side.equals("SHORT")) {if(target.compareTo(entry)>=0||stop.compareTo(entry)<=0)throw invalid();}
        else throw invalid();
    }
    public static Sizing size(String side,BigDecimal balance,BigDecimal entry,BigDecimal stop,BigDecimal target,
            String mode,BigDecimal value,BigDecimal increment) {
        levels(side,entry,stop,target);
        if(balance==null||balance.signum()<=0||value==null||value.signum()<=0||mode==null)throw invalid();
        BigDecimal distance=entry.subtract(stop).abs();
        BigDecimal quantity=switch(mode) {
            case "RISK_PERCENT"->balance.multiply(value).divide(HUNDRED).divide(distance,8,RoundingMode.DOWN);
            case "RISK_AMOUNT"->value.divide(distance,8,RoundingMode.DOWN);
            case "QUANTITY"->value;
            default->throw invalid();
        };
        if(increment!=null) {
            if(increment.signum()<=0)throw invalid();
            quantity=quantity.divide(increment,0,RoundingMode.DOWN).multiply(increment);
        }
        if(quantity.signum()<=0||quantity.multiply(entry).compareTo(balance)>0)throw invalid();
        BigDecimal risk=quantity.multiply(distance), reward=quantity.multiply(target.subtract(entry).abs());
        return new Sizing(quantity,risk,risk.multiply(HUNDRED).divide(balance,8,RoundingMode.HALF_EVEN),
                reward,reward.multiply(HUNDRED).divide(balance,8,RoundingMode.HALF_EVEN),reward.divide(risk,8,RoundingMode.HALF_EVEN));
    }
    public static BigDecimal slipped(BigDecimal price,String side,boolean entry,BigDecimal bps) {
        if(!java.util.Set.of("LONG","SHORT").contains(side)||bps==null||bps.signum()<0||bps.compareTo(new BigDecimal("1000"))>0)throw invalid();
        boolean buy=side.equals("LONG")==entry;
        return price.multiply(BigDecimal.ONE.add(bps.divide(TEN_THOUSAND).multiply(BigDecimal.valueOf(buy?1:-1))))
                .setScale(8,RoundingMode.HALF_EVEN);
    }
    public static Exit trigger(String side,BigDecimal stop,BigDecimal target,Candle candle,BigDecimal slippageBps) {
        boolean isLong=side.equals("LONG");
        boolean hitStop=isLong?candle.low().compareTo(stop)<=0:candle.high().compareTo(stop)>=0;
        boolean hitTarget=isLong?candle.high().compareTo(target)>=0:candle.low().compareTo(target)<=0;
        if(hitStop) {
            BigDecimal price=isLong?stop.min(candle.open()):stop.max(candle.open());
            return new Exit(slipped(price,side,false,slippageBps),"SL",hitTarget?"BOTH_TOUCHED_STOP_FIRST":null);
        }
        if(hitTarget)return new Exit(slipped(target,side,false,slippageBps),"TP",null);
        return null;
    }
    public static BigDecimal pnl(String side,BigDecimal quantity,BigDecimal entry,BigDecimal exit,BigDecimal fees) {
        return exit.subtract(entry).multiply(quantity).multiply(BigDecimal.valueOf(side.equals("LONG")?1:-1)).subtract(fees);
    }
}
