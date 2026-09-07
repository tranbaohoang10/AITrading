package com.aitrading.replay;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import com.aitrading.market.MarketDataProvider.Candle;
import org.junit.jupiter.api.Test;

class ReplayExecutionTests {
    private BigDecimal n(String s){return new BigDecimal(s);}
    @Test void longRiskPercentAmountAndManualAgree() {
        for(String mode:new String[]{"RISK_PERCENT","RISK_AMOUNT","QUANTITY"}) {
            var value=n(mode.equals("RISK_PERCENT")?"1":mode.equals("RISK_AMOUNT")?"100":"10");
            var result=ReplayExecution.size("LONG",n("10000"),n("100"),n("90"),n("120"),mode,value,n("0.01"));
            assertEquals(0,n("10").compareTo(result.quantity()));
            assertEquals(0,n("100").compareTo(result.riskAmount()));
            assertEquals(0,n("2").compareTo(result.rewardRisk()));
        }
    }
    @Test void shortAndInvalidLevels() {
        var result=ReplayExecution.size("SHORT",n("10000"),n("100"),n("110"),n("80"),"RISK_AMOUNT",n("100"),null);
        assertEquals(0,n("200").compareTo(result.rewardAmount()));
        assertThrows(IllegalArgumentException.class,()->ReplayExecution.levels("LONG",n("100"),n("100"),n("120")));
        assertThrows(IllegalArgumentException.class,()->ReplayExecution.levels("SHORT",n("100"),n("90"),n("80")));
        assertThrows(IllegalArgumentException.class,()->ReplayExecution.size("LONG",n("100"),n("100"),n("99"),n("102"),"LOT",n("1"),null));
    }
    @Test void bothTouchedAndGapAreConservative() {
        var candle=new Candle(Instant.EPOCH,n("100"),n("125"),n("85"),n("110"),n("1"));
        var exit=ReplayExecution.trigger("LONG",n("90"),n("120"),candle,n("0"));
        assertEquals("BOTH_TOUCHED_STOP_FIRST",exit.ambiguity());assertEquals("SL",exit.reason());
        assertEquals(0,n("90").compareTo(exit.price()));
        var gap=new Candle(Instant.EPOCH,n("80"),n("85"),n("70"),n("75"),n("1"));
        assertEquals(0,n("79.92").compareTo(ReplayExecution.trigger("LONG",n("90"),n("120"),gap,n("10")).price()));
    }
}
