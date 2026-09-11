package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.io.*;
import java.nio.*;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.tukaani.xz.*;

class DukascopyProviderTests {
    @Test void exposesValidatedRequiredMappingsAndTruthfulAvailability(){var provider=new DukascopyHistoryProvider();assertThat(provider.instrument("EUR/USD").providerSymbol()).isEqualTo("EURUSD");assertThat(provider.instrument("XPT/USD").providerSymbol()).isEqualTo("XPTCMDUSD");assertThat(provider.historicalAvailableFrom("XPDUSD")).isEqualTo(Instant.parse("2021-07-04T22:00:00Z"));assertThat(provider.capabilities().realtime()).isFalse();}
    @Test void decodesBigEndianDailyM1Bi5WithPriceScale() throws Exception {var raw=ByteBuffer.allocate(48).order(ByteOrder.BIG_ENDIAN).putInt(60).putInt(110000).putInt(110100).putInt(109900).putInt(110200).putFloat(2.5f).putInt(120).putInt(110100).putInt(110050).putInt(110000).putInt(110150).putFloat(3.5f).array();var encoded=new ByteArrayOutputStream();try(var output=new LZMAOutputStream(encoded,new LZMA2Options(),raw.length)){output.write(raw);}var rows=DukascopyBi5Decoder.decode(encoded.toByteArray(),LocalDate.of(2026,9,11),5);assertThat(rows).hasSize(2);assertThat(rows.getFirst().time()).isEqualTo(Instant.parse("2026-09-11T00:01:00Z"));assertThat(rows.getFirst().open()).isEqualByComparingTo("1.1");assertThat(rows.getFirst().high()).isEqualByComparingTo("1.102");}
}
