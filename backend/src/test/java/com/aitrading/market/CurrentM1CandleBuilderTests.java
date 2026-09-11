package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class CurrentM1CandleBuilderTests {
    @Test void buildsFinalizesDeduplicatesAndRejectsOutOfOrderEvents(){var builder=new CurrentM1CandleBuilder();var first=builder.accept("1",Instant.parse("2026-09-11T10:35:01Z"),new BigDecimal("10"),new BigDecimal("2"));assertThat(first.current().open()).isEqualByComparingTo("10");var next=builder.accept("2",Instant.parse("2026-09-11T10:35:40Z"),new BigDecimal("12"),new BigDecimal("3"));assertThat(next.current().high()).isEqualByComparingTo("12");assertThat(next.current().volume()).isEqualByComparingTo("5");assertThat(builder.accept("2",Instant.parse("2026-09-11T10:35:41Z"),new BigDecimal("99"),BigDecimal.ONE).accepted()).isFalse();var rollover=builder.accept("3",Instant.parse("2026-09-11T10:36:00Z"),new BigDecimal("11"),BigDecimal.ONE);assertThat(rollover.finalized()).isEqualTo(next.current());assertThat(builder.accept("4",Instant.parse("2026-09-11T10:35:59Z"),new BigDecimal("8"),BigDecimal.ONE).accepted()).isFalse();}
}
