package com.aitrading.market;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Fixed-host adapter for daily official FX reference rates. It never represents a reference fix as an intraday range. */
@Component
public class FrankfurterMarketDataClient {
    private static final URI BASE = URI.create("https://api.frankfurter.dev");
    private static final int MAX_RESPONSE_BYTES = 1_000_000, MAX_CANDLES = 600;
    private static final Map<String, Pair> PAIRS = Map.of(
            "EUR-USD", new Pair("EUR", "USD"), "GBP-USD", new Pair("GBP", "USD"),
            "USD-JPY", new Pair("USD", "JPY"), "USD-CHF", new Pair("USD", "CHF"),
            "AUD-USD", new Pair("AUD", "USD"), "USD-CAD", new Pair("USD", "CAD"),
            "NZD-USD", new Pair("NZD", "USD"));
    private final URI base;
    private final HttpClient http;

    public record Candle(long openTime, long closeTime, String open, String high, String low, String close, String volume, boolean closed) { }
    private record Pair(String base, String quote) { }

    public FrankfurterMarketDataClient() { this(BASE, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build()); }
    FrankfurterMarketDataClient(URI base, HttpClient http) { this.base = base; this.http = http; }

    public List<Candle> candles(String symbol, int limit, Long before) {
        Pair pair = PAIRS.get(symbol);
        if (pair == null || limit < 1 || limit > MAX_CANDLES || before != null && (before < 0 || before > 4_102_444_800_000L)) throw new IllegalArgumentException("Invalid Forex reference request");
        LocalDate end = (before == null ? Instant.now() : Instant.ofEpochMilli(before)).atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate start = end.minusDays(Math.max(14, Math.min(1_800, limit * 4)));
        String query = "from=" + start + "&to=" + end + "&base=" + pair.base + "&quotes=" + pair.quote + "&providers=ECB";
        URI request = base.resolve("/v2/rates?" + query);
        try {
            HttpResponse<String> response = http.send(HttpRequest.newBuilder(request).timeout(Duration.ofSeconds(8)).header("Accept", "application/json").GET().build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 429) throw new FrankfurterDataFailure("FRANKFURTER_RATE_LIMIT", 429);
            if (response.statusCode() < 200 || response.statusCode() > 299) throw new FrankfurterDataFailure("FRANKFURTER_PROVIDER_UNAVAILABLE", 502);
            if (response.body() == null || response.body().getBytes(StandardCharsets.UTF_8).length > MAX_RESPONSE_BYTES) throw new FrankfurterDataFailure("FRANKFURTER_INVALID_RESPONSE", 502);
            List<Candle> parsed = parse(response.body(), pair).stream().sorted(Comparator.comparingLong(Candle::openTime)).toList();
            return parsed.subList(Math.max(0, parsed.size() - limit), parsed.size());
        } catch (FrankfurterDataFailure failure) { throw failure; }
        catch (Exception failure) { throw new FrankfurterDataFailure("FRANKFURTER_PROVIDER_UNAVAILABLE", 502); }
    }

    private List<Candle> parse(String raw, Pair pair) {
        try {
            JsonNode root = JsonMapper.builder().build().readTree(raw);
            if (root == null || !root.isArray() || root.size() > MAX_CANDLES * 4) throw invalid();
            Set<LocalDate> dates = new HashSet<>(); List<Candle> result = new ArrayList<>();
            for (JsonNode item : root) {
                if (!item.isObject() || !pair.base.equals(text(item, "base")) || !pair.quote.equals(text(item, "quote"))) throw invalid();
                LocalDate date = LocalDate.parse(text(item, "date"));
                if (!dates.add(date)) throw invalid();
                BigDecimal rate = decimal(item.get("rate"));
                long openTime = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
                // A daily reference rate has no exchange-session OHLC range. Equal values retain the one published observation without fabricating one.
                String value = rate.stripTrailingZeros().toPlainString();
                result.add(new Candle(openTime, openTime + 86_399_999L, value, value, value, value, "0", true));
            }
            if (result.isEmpty()) throw invalid();
            return result;
        } catch (FrankfurterDataFailure failure) { throw failure; }
        catch (Exception failure) { throw invalid(); }
    }

    private static String text(JsonNode item, String field) {
        JsonNode value = item.get(field);
        if (value == null || !value.isTextual() || value.asText().length() > 16) throw invalid();
        return value.asText();
    }
    private static BigDecimal decimal(JsonNode value) {
        if (value == null || (!value.isNumber() && !value.isTextual())) throw invalid();
        String raw = value.asText();
        if (!raw.matches("(?:0|[1-9][0-9]{0,12})(?:\\.[0-9]{1,12})?")) throw invalid();
        BigDecimal result = new BigDecimal(raw);
        if (result.signum() <= 0) throw invalid();
        return result;
    }
    private static FrankfurterDataFailure invalid() { return new FrankfurterDataFailure("FRANKFURTER_INVALID_RESPONSE", 502); }
}
