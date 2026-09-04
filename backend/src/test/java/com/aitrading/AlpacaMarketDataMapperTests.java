package com.aitrading;

import com.aitrading.market.AlpacaDataFailure;
import com.aitrading.market.AlpacaMarketDataMapper;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AlpacaMarketDataMapperTests {
    @Test void mapsDocumentedBarsInOrderAndReplacesDuplicateOpenTime() {
        String json="""
                {"bars":[
                  {"t":"2026-01-01T00:01:00Z","o":101,"h":105,"l":99,"c":104,"v":7},
                  {"t":"2026-01-01T00:00:00Z","o":100,"h":102,"l":98,"c":101,"v":5},
                  {"t":"2026-01-01T00:01:00Z","o":101,"h":106,"l":99,"c":105,"v":8}
                ]}
                """;
        var bars=AlpacaMarketDataMapper.bars(json,"1m",Instant.parse("2026-01-01T00:03:00Z"));
        assertThat(bars).hasSize(2).extracting(AlpacaMarketDataMapper.Bar::open).containsExactly("100","101");
        assertThat(bars.getLast()).extracting(AlpacaMarketDataMapper.Bar::high,AlpacaMarketDataMapper.Bar::volume).containsExactly("106","8");
        assertThat(bars).allMatch(AlpacaMarketDataMapper.Bar::closed);
    }

    @Test void rejectsInvalidOhlcAndNonObjectProviderPayloads() {
        assertThatThrownBy(() -> AlpacaMarketDataMapper.bars("{\"bars\":[{\"t\":\"2026-01-01T00:00:00Z\",\"o\":10,\"h\":8,\"l\":9,\"c\":10,\"v\":1}]}","1m",Instant.now()))
                .isInstanceOfSatisfying(AlpacaDataFailure.class, failure -> assertThat(failure.code()).isEqualTo("ALPACA_INVALID_RESPONSE"));
        assertThatThrownBy(() -> AlpacaMarketDataMapper.bars("{\"bars\":null}","1m",Instant.now())).isInstanceOf(AlpacaDataFailure.class);
    }
}
