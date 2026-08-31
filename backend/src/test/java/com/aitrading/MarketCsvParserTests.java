package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.market.*;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class MarketCsvParserTests {
    final MarketCsvParser parser=new MarketCsvParser();
    final Instant now=Instant.parse("2026-01-01T00:00:00Z");
    static final String HEADER="timestamp,open,high,low,close,volume\n";
    static final String ONE="2024-01-01T00:00:00Z,100.12345678,102,99,101,0\n";
    MarketCsvParser.Parsed parse(String csv){return parser.parse(csv,"TEST_USD","1h",now);}
    void rejects(String csv,String code) {
        assertThatThrownBy(()->parse(csv)).isInstanceOfSatisfying(MarketDataFailure.class,error->{
            assertThat(error.code()).isEqualTo(code);assertThat(error.line()).isBetween(0,5002);
            assertThat(error.getMessage()).doesNotContain(csv);
        });
    }
    @Test void preciseValuesAndFormattingVariantsShareCanonicalHashButNotRawHash() {
        var plain=parse(HEADER+ONE);
        // Independent Python hashlib over the documented UTF-8 formats, not parser output.
        assertThat(plain.rawHash()).isEqualTo("1406bf9a37eaf5688af52fbe2556ae162ee90490e2cdeb27cfe6cde02ebf9b38");
        assertThat(plain.dataHash()).isEqualTo("bc335f1445da4379646442822952a0855b77cc13a3a1e2847e3853f0278d35f8");
        String quoted="\ufeff"+HEADER.replace("\n","\r\n")+" \"2024-01-01T00:00:00Z\", \"100.12345678\",\"102.000\",\"99.0\",\"101.00\",\"0.00000000\"\r\n";
        var variant=parse(quoted);
        assertThat(variant.candles()).containsExactlyElementsOf(plain.candles().stream().map(c->
                new MarketCsvParser.Candle(c.time(),c.open(),new BigDecimal("102.000"),new BigDecimal("99.0"),new BigDecimal("101.00"),new BigDecimal("0.00000000"))).toList());
        assertThat(variant.dataHash()).isEqualTo(plain.dataHash());assertThat(variant.rawHash()).isNotEqualTo(plain.rawHash());
        assertThat(plain.candles().getFirst().open().toPlainString()).isEqualTo("100.12345678");
        assertThat(plain.gapCount()).isZero();
        assertThatThrownBy(()->plain.candles().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(parse(HEADER+ONE.stripTrailing()).dataHash()).isEqualTo(plain.dataHash());
        assertThat(parser.parse(HEADER+ONE,"OTHER","1h",now).dataHash()).isNotEqualTo(plain.dataHash());
    }
    @Test void rejectsHeadersColumnsBlankRecordsQuotesAndUntrustedFormulaOrUrl() {
        for(String csv:new String[]{"wrong\n"+ONE,HEADER.toUpperCase()+ONE})rejects(csv,"CSV_HEADER");
        rejects(HEADER,"CSV_ROWS_REQUIRED");rejects(HEADER+"\n"+ONE,"CSV_COLUMNS");
        rejects(HEADER+ONE.replace(",0",",0,extra"),"CSV_COLUMNS");
        rejects(HEADER+ONE.replace("102","\"102"),"CSV_CELL");
        for(String data:new String[]{"=SUM(1)","+100","-1","1e2","NaN","Infinity","https://127.0.0.1","../../file","1;DROP TABLE x"})
            rejects(HEADER+ONE.replace("100.12345678",data),"CSV_NUMBER_FORMAT");
        rejects(HEADER+ONE.replace("102", ""),"CSV_CELL");
    }
    @Test void enforcesNumberPrecisionMagnitudePositivityAndOhlcRelations() {
        rejects(HEADER+ONE.replace("100.12345678","100.123456789"),"CSV_NUMBER_FORMAT");
        rejects(HEADER+ONE.replace("100.12345678","1000000000001"),"CSV_NUMBER_RANGE");
        rejects(HEADER+ONE.replace("100.12345678","0"),"CSV_NUMBER_RANGE");
        for(String row:new String[]{ONE.replace(",102,",",98,"),ONE.replace(",99,",",103,"),ONE.replace(",101,",",103,")})
            rejects(HEADER+row,"CSV_OHLC_RANGE");
        assertThat(parse(HEADER+"2024-01-01T00:00:00Z,0.00000001,1000000000000,0.00000001,1000000000000,1000000000000\n").candles()).hasSize(1);
    }
    @Test void strictUtcCalendarAlignmentAndClosedCandleBoundary() {
        for(String time:new String[]{"2024-02-30T00:00:00Z","2023-02-29T00:00:00Z","2024-01-01T24:00:00Z","2024-01-01T00:00:60Z",
                "2024-01-01T00:00:00+00:00","2024-01-01T00:00:00.000Z","1969-01-01T00:00:00Z","2101-01-01T00:00:00Z"})
            rejects(HEADER+ONE.replace("2024-01-01T00:00:00Z",time),"CSV_TIMESTAMP");
        rejects(HEADER+ONE.replace("T00:00:00Z","T00:01:00Z"),"CSV_TIME_ALIGNMENT");
        rejects(HEADER+ONE.replace("2024-01-01","2026-01-01"),"CSV_OPEN_OR_FUTURE_CANDLE");
        String edge=HEADER+ONE.replace("2024-01-01T00:00:00Z","2025-12-31T23:00:00Z");
        assertThat(parse(edge).candles()).hasSize(1);
        assertThatThrownBy(()->parser.parse(edge,"TEST_USD","1h",now.minusSeconds(1))).isInstanceOfSatisfying(MarketDataFailure.class,e->assertThat(e.code()).isEqualTo("CSV_OPEN_OR_FUTURE_CANDLE"));
        assertThat(parse(HEADER+ONE.replace("2024-01-01","2024-02-29")).candles()).hasSize(1);
        for(String timeframe:new String[]{"1m","5m","15m","30m","1h","4h","1d"})assertThat(parser.parse(HEADER+ONE,"X",timeframe,now).candles()).hasSize(1);
    }
    @Test void orderingAndGapsAreExplicitWithoutSortingDroppingOrFilling() {
        rejects(HEADER+ONE+ONE,"CSV_TIME_ORDER");
        rejects(HEADER+ONE+ONE.replace("2024-01-01","2023-12-31"),"CSV_TIME_ORDER");
        var result=parse(HEADER+ONE+ONE.replace("T00:00:00Z","T03:00:00Z")+ONE.replace("T00:00:00Z","T05:00:00Z"));
        assertThat(result.candles()).hasSize(3);assertThat(result.gapCount()).isEqualTo(3);
        assertThat(result.candles().get(1).time()).isEqualTo(Instant.parse("2024-01-01T03:00:00Z"));
    }
    @Test void exactRowLimitsAndUtf8ByteBoundsAreEnforced() {
        StringBuilder csv=new StringBuilder(HEADER);Instant first=Instant.parse("2020-01-01T00:00:00Z");
        for(int i=0;i<5000;i++)csv.append(first.plusSeconds(i*3600L)).append(",1,2,1,2,0\n");
        assertThat(parse(csv.toString()).candles()).hasSize(5000);
        rejects(csv+"2021-01-01T00:00:00Z,1,2,1,2,0\n","CSV_ROW_LIMIT");
        rejects("x".repeat(MarketCsvParser.MAX_CSV_BYTES+1),"CSV_SIZE_LIMIT");
        rejects("🧪".repeat(300000),"CSV_SIZE_LIMIT");
        // Pad bounded individual cells, retaining valid values, to exactly1MiB.
        String[] lines=csv.toString().split("\n");int padding=MarketCsvParser.MAX_CSV_BYTES-csv.length();
        StringBuilder exact=new StringBuilder(HEADER);
        for(int i=1;i<lines.length;i++) {int add=Math.min(1800,padding);padding-=add;exact.append(lines[i]).append(" ".repeat(add)).append('\n');}
        assertThat(padding).isZero();assertThat(exact.length()).isEqualTo(MarketCsvParser.MAX_CSV_BYTES);
        assertThat(parse(exact.toString()).candles()).hasSize(5000);
        rejects(exact+" ","CSV_SIZE_LIMIT");
    }
    @Test void rejectsUnpairedUnicodeControlsAndUnsupportedLineEndings() {
        for(String data:new String[]{"\u0000","\ud800","\udc00","\u001b"})rejects(HEADER+ONE+data,"CSV_ENCODING");
        rejects((HEADER+ONE).replace("\n","\r"),"CSV_LINE_ENDING");
        assertThatThrownBy(()->parser.parse(HEADER+ONE,"../X","1h",now)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->parser.parse(HEADER+ONE,"X","2h",now)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->parse(null)).isInstanceOfSatisfying(MarketDataFailure.class,e->assertThat(e.code()).isEqualTo("CSV_REQUIRED"));
        assertThatThrownBy(()->parse("")).isInstanceOfSatisfying(MarketDataFailure.class,e->assertThat(e.code()).isEqualTo("CSV_REQUIRED"));
    }
}
