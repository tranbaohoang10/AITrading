package com.aitrading.pine;

import com.aitrading.dsl.DslValidator;
import com.aitrading.strategy.StrategyService.Revision;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/** Compiles only revalidated canonical DSL. Never evaluates user-supplied code. */
@Service
public final class PineGenerator {
    public static final String VERSION = "pine-research-1.0.0";
    public static final int MAX_CODE = 128 * 1024;
    public static final List<String> LIMITATIONS = List.of(
        "Research indicator with its own simulator; not native Strategy Tester or live orders.",
        "Official Pine compiler/runtime verification is pending; generated source is experimental.",
        "Pine binary floats differ from Decimal34; near-threshold rules can diverge.",
        "Use identical standard-chart data and an exact contiguous UTC window, up to 5000 bars.",
        "No broker lots/ticks, funding or liquidation. Historical results do not guarantee profit.");
    private static final JsonMapper JSON = JsonMapper.builder().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).build();
    private final DslValidator validator;
    private final String runtime;
    public record Generated(String code, String codeHash) { }
    public PineGenerator(DslValidator validator) {
        this.validator = validator;
        try (var in = getClass().getResourceAsStream("/pine/research-v1.pine")) {
            if (in == null) throw new IllegalStateException("Bundled Pine runtime missing");
            runtime = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
        } catch (IOException failure) { throw new IllegalStateException("Cannot load Pine runtime", failure); }
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    public Generated generate(Revision revision) {
        if (!"VALIDATED".equals(revision.status())) throw new PineFailure("VALIDATED_REVISION_REQUIRED");
        DslValidator.Validation check;
        try { check = validator.validate(revision.canonicalJson().getBytes(StandardCharsets.UTF_8)); }
        catch (RuntimeException invalid) { throw new PineFailure("SOURCE_INVALID"); }
        if (!check.valid()) throw new PineFailure("SOURCE_INVALID");
        var source = check.document();
        if (!source.hash().equals(revision.hash()) || !source.canonicalJson().equals(revision.canonicalJson())
                || !source.schemaVersion().equals(revision.schemaVersion()) || !source.validatorVersion().equals(revision.validatorVersion())
                || !Objects.equals(source.minimumBars(), revision.minimumBars())) throw new PineFailure("SOURCE_PROVENANCE_MISMATCH");
        var root = JSON.readTree(source.canonicalJson());
        if (!root.get("market").get("symbol").asString().equals(revision.symbol())
                || !root.get("market").get("timeframe").asString().equals(revision.timeframe())) throw new PineFailure("SOURCE_PROVENANCE_MISMATCH");
        if (root.get("indicators").size() > 16 || source.minimumBars() > 4500) throw new PineFailure("TARGET_RESOURCE_LIMIT");
        targetBounds(root);
        String code = new Emitter(root, revision, runtime).emit();
        if (code.getBytes(StandardCharsets.UTF_8).length > MAX_CODE) throw new PineFailure("TARGET_OUTPUT_LIMIT");
        return new Generated(code, hash(code));
    }
    private static void targetBounds(JsonNode node) {
        if (node.isObject()) {
            if (node.has("period") && node.get("period").asInt() > 200) throw new PineFailure("TARGET_PERIOD_LIMIT");
            if (node.has("lag") && node.get("lag").asInt() > 200) throw new PineFailure("TARGET_LAG_LIMIT");
        }
        for (var child : node) targetBounds(child);
    }
    private static String number(JsonNode n) {
        // Float suffix avoids integer overflow/coercion in Pine for large constants.
        String value = n.decimalValue().stripTrailingZeros().toPlainString();
        return value.contains(".") ? value : value + ".0";
    }
    private static final class Emitter {
        final JsonNode root;
        final Revision revision;
        final String runtime;
        final Map<String, JsonNode> definitions = new LinkedHashMap<>();
        final Map<String, String> ids = new LinkedHashMap<>();
        final Set<String> emitted = new HashSet<>();
        final StringBuilder out = new StringBuilder();
        Emitter(JsonNode root, Revision revision, String runtime) {
            this.root = root; this.revision = revision; this.runtime = runtime;
            int index = 0;
            for (var node : root.get("indicators")) {
                String id = node.get("id").asString(); definitions.put(id, node); ids.put(id, "i" + index++);
            }
        }
        void line(String value) { out.append(value).append('\n'); }
        String operand(JsonNode n, int before) {
            String kind = n.get("kind").asString();
            if (kind.equals("constant")) return before == 0 ? number(n.get("value")) : "(count > 1 ? " + number(n.get("value")) + " : na)";
            String array = kind.equals("series") ? "s_" + n.get("field").asString() : ids.get(n.get("id").asString());
            return "f_at(" + array + ", " + (n.get("lag").asInt() + before) + ")";
        }
        String condition(JsonNode n) {
            if (n.isNull()) return "-1";
            String kind = n.get("kind").asString();
            if (kind.equals("not")) return "f_not(" + condition(n.get("child")) + ")";
            if (kind.equals("all") || kind.equals("any")) {
                String result = condition(n.get("children").get(0));
                for (int i = 1; i < n.get("children").size(); i++) result = "f_" + kind + "(" + result + ", " + condition(n.get("children").get(i)) + ")";
                return result;
            }
            String a = operand(n.get("left"), 0), b = operand(n.get("right"), 0);
            if (kind.equals("compare")) return "f_compare(" + a + ", " + b + ", " + List.of("gt","gte","lt","lte","eq","neq").indexOf(n.get("op").asString()) + ")";
            return "f_cross(" + a + ", " + b + ", " + operand(n.get("left"), 1) + ", " + operand(n.get("right"), 1) + ", " + n.get("direction").asString().equals("above") + ")";
        }
        void indicator(String key) {
            if (!emitted.add(key)) return;
            var n = definitions.get(key); String id = ids.get(key), type = n.get("type").asString();
            if (type.equals("TRENDLINE")) {
                String parent = n.get("pivotRef").asString(); indicator(parent); String p = ids.get(parent);
                line("    array.push(" + id + ", na(" + p + "_x1) ? na : " + p + "_y2 + (" + p + "_y2 - " + p + "_y1) * (count - 1 - " + p + "_x2) / (" + p + "_x2 - " + p + "_x1))");
            } else if (type.startsWith("PIVOT_")) {
                line("    float " + id + "_point = f_pivot(s_" + (type.equals("PIVOT_HIGH") ? "high" : "low") + ", " + n.get("left").asInt() + ", " + n.get("right").asInt() + ", " + type.equals("PIVOT_HIGH") + ")");
                line("    if not na(" + id + "_point)");
                for (String field : List.of("x", "y")) line("        " + id + "_" + field + "1 := " + id + "_" + field + "2");
                line("        " + id + "_x2 := count - 1 - " + n.get("right").asInt());
                line("        " + id + "_y2 := " + id + "_point");
                line("    array.push(" + id + ", " + id + "_y2)");
            } else {
                if (!type.equals("ATR") && n.get("source").get("kind").asString().equals("indicator")) indicator(n.get("source").get("id").asString());
                int period = n.get("period").asInt();
                String value = type.equals("ATR") ? "(count < 2 ? na : math.max(high - low, math.abs(high - f_at(s_close, 1)), math.abs(low - f_at(s_close, 1))))" : operand(n.get("source"), 0);
                line("    array.push(" + id + "_source, " + value + ")");
                if (type.equals("RSI")) {
                    line("    float " + id + "_delta = f_at(" + id + "_source, 0) - f_at(" + id + "_source, 1)");
                    line("    array.push(" + id + "_gains, math.max(" + id + "_delta, 0.0))");
                    line("    array.push(" + id + "_losses, math.max(-" + id + "_delta, 0.0))");
                    line("    " + id + "_gain := f_smooth(" + id + "_gains, " + period + ", 2, " + id + "_gain)");
                    line("    " + id + "_loss := f_smooth(" + id + "_losses, " + period + ", 2, " + id + "_loss)");
                    line("    array.push(" + id + ", na(" + id + "_gain) or na(" + id + "_loss) ? na : " + id + "_gain == 0 and " + id + "_loss == 0 ? 50.0 : " + id + "_loss == 0 ? 100.0 : " + id + "_gain == 0 ? 0.0 : 100.0 - 100.0 / (1.0 + " + id + "_gain / " + id + "_loss))");
                } else {
                    int mode = switch (type) { case "SMA" -> 0; case "EMA" -> 1; case "ATR" -> 2; case "HIGHEST" -> 3; case "LOWEST" -> 4; default -> throw new PineFailure("TARGET_UNSUPPORTED_INDICATOR"); };
                    line("    array.push(" + id + ", f_smooth(" + id + "_source, " + period + ", " + mode + ", f_at(" + id + ", 0)))");
                }
            }
        }
        String emit() {
            line("//@version=6");
            line("// AITrading " + VERSION + " | schema " + revision.schemaVersion() + " | validator " + revision.validatorVersion());
            line("// Strategy " + revision.strategyId() + " revision " + revision.revision() + " | DSL SHA256 " + revision.hash());
            line("// EXPERIMENTAL: official target validation pending. Inspect all limits before use.");
            line("// DSL policy: bar_close -> next_bar_open; stop_first; missingCandles=reject; maxPositions=1.");
            line("indicator(\"AITrading DSL research simulator\", overlay = false, precision = 8)");
            line(runtime);
            int seconds = switch (revision.timeframe()) { case "1m" -> 60; case "5m" -> 300; case "15m" -> 900; case "30m" -> 1800; case "1h" -> 3600; case "4h" -> 14400; case "1d" -> 86400; default -> throw new PineFailure("TARGET_TIMEFRAME"); };
            line("const int intervalMs = " + seconds * 1000);
            // Symbol has a schema-enforced ASCII alphabet; JSON quoting adds defense in depth.
            line("string chartTicker = input.string(" + JSON.writeValueAsString(revision.symbol()) + ", \"Confirm chart ticker mapping for DSL symbol\")");
            line("int startTime = input.time(timestamp(\"01 Jan 2024 00:00 +0000\"), \"UTC start (exact candle open)\")");
            line("int endTime = input.time(timestamp(\"02 Jan 2024 00:00 +0000\"), \"UTC end exclusive\")");
            line("bool trace = input.bool(false, \"Synthetic fixture trace to Pine Logs\")");
            line("if not chart.is_standard or syminfo.ticker != chartTicker or timeframe.in_seconds() * 1000 != intervalMs");
            line("    runtime.error(\"Use a standard chart with confirmed symbol mapping and the DSL timeframe.\")");
            line("if startTime < 0 or endTime > 4133980800000 or startTime % intervalMs != 0 or endTime <= startTime or (endTime - startTime) % intervalMs != 0 or (endTime - startTime) / intervalMs > 5000");
            line("    runtime.error(\"Choose an exact UTC window of 1 to 5000 candles.\")");
            line("var int count = 0"); line("var int lastTime = na");
            for (String field : List.of("open","high","low","close","volume")) line("var array<float> s_" + field + " = array.new<float>()");
            for (var entry : definitions.entrySet()) {
                String id = ids.get(entry.getKey()), type = entry.getValue().get("type").asString();
                line("var array<float> " + id + " = array.new<float>()");
                if (type.startsWith("PIVOT_")) {
                    for (String field : List.of("x1","x2")) line("var int " + id + "_" + field + " = na");
                    for (String field : List.of("y1","y2")) line("var float " + id + "_" + field + " = na");
                } else if (!type.equals("TRENDLINE")) {
                    line("var array<float> " + id + "_source = array.new<float>()");
                    if (type.equals("RSI")) {
                        for (String field : List.of("gains","losses")) line("var array<float> " + id + "_" + field + " = array.new<float>()");
                        for (String field : List.of("gain","loss")) line("var float " + id + "_" + field + " = na");
                    }
                }
            }
            var risk = root.get("risk"); var execution = root.get("execution");
            line("var Simulation sim = Simulation.new(" + number(risk.get("initialCapital")) + ", " + number(risk.get("initialCapital")) + ")");
            for (String rule : List.of("longEntry","shortEntry","longExit","shortExit")) line("int " + rule + " = -1");
            line("bool included = barstate.isconfirmed and time >= startTime and time < endTime");
            line("if included");
            line("    if time != startTime + count * intervalMs or time_close != time + intervalMs or count >= 5000");
            line("        runtime.error(\"Missing start, gap, duplicate candle or incompatible candle boundaries.\")");
            line("    if na(open) or na(high) or na(low) or na(close) or na(volume) or low < 0.00000001 or volume < 0 or high < math.max(open, close) or low > math.min(open, close) or high < low or high > 1000000000000.0 or volume > 1000000000000.0");
            line("        runtime.error(\"Invalid OHLCV research data.\")");
            line("    count += 1"); line("    lastTime := time");
            for (String field : List.of("open","high","low","close","volume")) line("    array.push(s_" + field + ", " + field + ")");
            for (String key : definitions.keySet()) indicator(key);
            for (String rule : List.of("longEntry","shortEntry","longExit","shortExit")) line("    " + rule + " := " + condition(root.get("rules").get(rule)));
            line("    sim.openBar(open, high, low, close, " + number(risk.get("allocationPct")) + ", " + number(risk.get("leverage")) + ", " + number(risk.get("stopLossPct")) + ", " + number(risk.get("takeProfitPct")) + ", (" + number(execution.get("spreadBps")) + " / 2.0 + " + number(execution.get("slippageBps")) + ") / 10000.0, " + number(execution.get("commissionBps")) + " / 10000.0)");
            line("    sim.closeBar(count - 1, longEntry, shortEntry, longExit, shortExit)");
            line("    if trace");
            line("        log.info(\"bar={0},openMs={1},closeMs={2},signal={3},entry={4},entrySignalBar={5},entryFill={6},entryFee={7},quantity={8},skipOpen={9},skipClose={10}\", f_text(count - 1), f_text(time), f_text(time_close), f_text(sim.signal), f_text(sim.entrySide), f_text(sim.entrySignalBar), f_text(sim.entryFill), f_text(sim.entryCost), f_text(sim.quantity), f_text(sim.skipOpen), f_text(sim.skip))");
            line("        log.info(\"exit={0},exitReason={1},exitSignalBar={2},exitFill={3},exitFee={4},closedNet={5},balance={6},equity={7}\", f_text(sim.exitSide), f_text(sim.exitReason), f_text(sim.exitSignalBar), f_text(sim.exitFill), f_text(sim.exitCost), f_text(sim.closedNet), f_text(sim.balance), f_text(sim.equity))");
            line("    if time_close == endTime");
            line("        if trace");
            line("            log.info(\"DATASET_END: cancelledPending={0}; openSide={1}\", sim.pending, sim.side)");
            line("        sim.pending := 0");
            line("if barstate.islastconfirmedhistory and (na(lastTime) or lastTime + intervalMs != endTime)");
            line("    runtime.error(\"Full closed UTC window not available. Load matching history or change window.\")");
            line("plot(included ? sim.equity : na, \"Research equity (float, not Strategy Tester)\", color = color.silver)");
            line("plot(included ? sim.balance : na, \"Balance\", display = display.data_window)");
            for (String rule : List.of("longEntry","shortEntry","longExit","shortExit")) line("plot(included ? " + rule + " : na, \"Rule " + rule + " (-1 undefined)\", display = display.data_window)");
            for (String key : definitions.keySet()) line("plot(included ? f_at(" + ids.get(key) + ", 0) : na, \"Indicator " + ids.get(key) + "\", display = display.data_window)");
            for (String field : List.of("side","signal","entrySide","exitSide","exitReason","entryFill","exitFill","entryCost","exitCost","quantity","closedNet","skipOpen","skip")) line("plot(included ? sim." + field + " : na, \"Trace " + field + "\", display = display.data_window)");
            line("var table notice = table.new(position.top_right, 1, 1)");
            line("if barstate.islast");
            line("    table.cell(notice, 0, 0, \"EXPERIMENTAL research simulator\\nNot Strategy Tester / no orders\\nFloat thresholds may diverge; target verification pending\", text_color = color.silver)");
            return out.toString();
        }
    }
}
