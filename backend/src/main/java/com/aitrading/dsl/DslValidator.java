package com.aitrading.dsl;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.security.*;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.core.StreamReadConstraints;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.core.json.JsonFactory;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public final class DslValidator {
    public static final String VERSION = "1.0.0";
    public static final int MAX_BYTES = 65536;
    private static final JsonMapper JSON = JsonMapper.builder(JsonFactory.builder()
            .streamReadConstraints(StreamReadConstraints.builder().maxNestingDepth(24).maxNumberLength(64).maxStringLength(4096).build())
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build())
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS, DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).build();
    private final String schemaJson;
    private final DslSchema schema;

    public record Diagnostic(String path, String code, String message) { }
    public record ValidatedDsl(String canonicalJson, String hash, String schemaVersion, String validatorVersion, int minimumBars) { }
    public record Validation(boolean valid, ValidatedDsl document, List<Diagnostic> errors) {
        public Validation { errors = List.copyOf(errors); }
    }
    enum Unit { PRICE, VOLUME, OSCILLATOR, CONSTANT }
    record SeriesInfo(Unit unit, int bars) { }

    public DslValidator() {
        try (var input = DslValidator.class.getResourceAsStream("/dsl/strategy-1.0.0.schema.json")) {
            if (input == null) throw new IllegalStateException("Bundled DSL schema missing");
            schemaJson = new String(input.readAllBytes(), StandardCharsets.UTF_8);
            schema = new DslSchema(JSON.readTree(schemaJson));
        } catch (IOException failure) { throw new IllegalStateException("Cannot load bundled DSL schema", failure); }
    }
    public String schemaJson() { return schemaJson; }
    public Map<String, Object> capabilities() {
        return Map.of("schemaVersion", VERSION, "validatorVersion", VERSION, "operation", "validation_only",
                "runtimeStatus", Map.of("python", "offline_engine_implemented", "pine", "not_implemented", "mql5", "not_implemented"),
                "maxBytes", MAX_BYTES, "maxIndicators", 32, "maxConditions", 128, "maxConditionDepth", 8,
                "maxMinimumBars", 10000, "canonicalization", "aitrading-canonical-1");
    }

    public Validation validate(byte[] bytes) {
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("DSL body limit");
        JsonNode root;
        try {
            // Do not allow BOM/UTF16 detection or replacement of malformed UTF-8.
            String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
            root = JSON.readTree(text);
        } catch (Exception malformed) { throw new IllegalArgumentException("Malformed DSL JSON"); }
        if (root == null || root.isMissingNode()) throw new IllegalArgumentException("Empty DSL JSON");
        var state = new State();
        state.bounded(root, 0);
        if (state.errors.isEmpty()) {
            var failure = schema.validate(root);
            if (failure != null) state.errors.add(failure);
        }
        if (state.errors.isEmpty()) state.semantics(root);
        if (!state.errors.isEmpty()) return new Validation(false, null, state.errors);
        String canonical = canonical(root);
        try {
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));
            return new Validation(true, new ValidatedDsl(canonical, hash, VERSION, VERSION, state.minimumBars), List.of());
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException("SHA256 unavailable", impossible); }
    }

    private static String canonical(JsonNode node) {
        if (node.isObject()) {
            List<String> keys = new ArrayList<>(node.propertyNames()); Collections.sort(keys);
            List<String> fields = new ArrayList<>();
            for (String key : keys) fields.add(quote(key) + ":" + canonical(node.get(key)));
            return "{" + String.join(",", fields) + "}";
        }
        if (node.isArray()) {
            List<String> values = new ArrayList<>(); for (JsonNode value : node) values.add(canonical(value));
            return "[" + String.join(",", values) + "]";
        }
        if (node.isString()) return quote(node.asString());
        if (node.isNumber()) return node.decimalValue().stripTrailingZeros().toPlainString();
        return node.isNull() ? "null" : node.toString();
    }
    private static String quote(String text) { return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

    private static final class State {
        final List<Diagnostic> errors = new ArrayList<>();
        final Map<String, JsonNode> indicators = new LinkedHashMap<>();
        final Map<String, Integer> indexes = new HashMap<>();
        final Map<String, SeriesInfo> computed = new HashMap<>();
        final Set<String> visiting = new HashSet<>();
        int values, conditions, minimumBars = 1;

        void error(String path, String code) {
            if (errors.size() < 20) errors.add(new Diagnostic(path, code, "Document violates the supported strategy contract."));
        }
        void bounded(JsonNode node, int depth) {
            if (!errors.isEmpty()) return;
            if (++values > 2048 || depth > 24) { error("", "RESOURCE_LIMIT"); return; }
            if (node.isString() && !safeText(node.asString())) { error("", "INVALID_UNICODE_OR_CONTROL"); return; }
            if (node.isObject()) for (String key : node.propertyNames())
                if (!safeText(key)) { error("", "INVALID_UNICODE_OR_CONTROL"); return; }
            if (node.isNumber()) {
                BigDecimal n = node.decimalValue().stripTrailingZeros();
                if (n.scale() > 8 || n.abs().compareTo(new BigDecimal("1000000000000")) > 0) { error("", "NUMBER_LIMIT"); return; }
            }
            for (JsonNode child : node) bounded(child, depth + 1);
        }
        boolean safeText(String text) {
            for (int i = 0; i < text.length(); i++) {
                char c = text.charAt(i);
                if (Character.isISOControl(c)) return false;
                if (Character.isHighSurrogate(c)) {
                    if (++i >= text.length() || !Character.isLowSurrogate(text.charAt(i))) return false;
                } else if (Character.isLowSurrogate(c)) return false;
            }
            return true;
        }
        void semantics(JsonNode root) {
            int index = 0;
            for (JsonNode indicator : root.get("indicators")) {
                String id = indicator.get("id").asString();
                if (indicators.putIfAbsent(id, indicator) != null) error("/indicators/" + index + "/id", "DUPLICATE_ID");
                else indexes.put(id, index);
                index++;
            }
            for (String id : indicators.keySet()) minimumBars = Math.max(minimumBars, indicator(id, "/indicators/" + indexes.get(id)).bars());
            JsonNode rules = root.get("rules");
            if (rules.get("longEntry").isNull() && rules.get("shortEntry").isNull()) error("/rules", "ENTRY_REQUIRED");
            for (String side : List.of("long", "short"))
                if (rules.get(side + "Entry").isNull() && !rules.get(side + "Exit").isNull()) error("/rules/" + side + "Exit", "DISABLED_SIDE_EXIT");
            for (String key : List.of("longEntry", "shortEntry", "longExit", "shortExit"))
                if (!rules.get(key).isNull()) minimumBars = Math.max(minimumBars, condition(rules.get(key), "/rules/" + key, 1));
            JsonNode risk = root.get("risk");
            if (risk.get("leverage").decimalValue().multiply(risk.get("stopLossPct").decimalValue()).compareTo(new BigDecimal("100")) > 0)
                error("/risk/stopLossPct", "LEVERAGED_STOP_LIMIT");
            if (minimumBars > 10000) error("/indicators", "WARMUP_LIMIT");
        }
        SeriesInfo indicator(String id, String path) {
            if (computed.containsKey(id)) return computed.get(id);
            JsonNode node = indicators.get(id);
            if (node == null) { error(path, "MISSING_REFERENCE"); return new SeriesInfo(Unit.PRICE, 1); }
            if (!visiting.add(id)) { error(path, "REFERENCE_CYCLE"); return new SeriesInfo(Unit.PRICE, 1); }
            String type = node.get("type").asString();
            String ownPath = "/indicators/" + indexes.get(id);
            SeriesInfo result;
            if (Set.of("PIVOT_HIGH", "PIVOT_LOW").contains(type)) {
                result = new SeriesInfo(Unit.PRICE, node.get("left").asInt() + node.get("right").asInt() + 1);
            } else if (type.equals("TRENDLINE")) {
                String pivot = node.get("pivotRef").asString();
                var target = indicators.get(pivot);
                if (target != null && !Set.of("PIVOT_HIGH", "PIVOT_LOW").contains(target.get("type").asString()))
                    error(ownPath + "/pivotRef", "PIVOT_REFERENCE_REQUIRED");
                result = new SeriesInfo(Unit.PRICE, indicator(pivot, ownPath + "/pivotRef").bars() + 1);
            } else if (type.equals("ATR")) {
                result = new SeriesInfo(Unit.PRICE, node.get("period").asInt() + 1);
            } else {
                SeriesInfo source = operand(node.get("source"), ownPath + "/source");
                if (source.unit() == Unit.CONSTANT) error(ownPath + "/source", "SERIES_SOURCE_REQUIRED");
                if (type.equals("RSI") && source.unit() != Unit.PRICE) error(ownPath + "/source", "PRICE_SOURCE_REQUIRED");
                result = new SeriesInfo(type.equals("RSI") ? Unit.OSCILLATOR : source.unit(), source.bars() + node.get("period").asInt() - (type.equals("RSI") ? 0 : 1));
            }
            visiting.remove(id); computed.put(id, result); return result;
        }
        SeriesInfo operand(JsonNode node, String path) {
            return switch (node.get("kind").asString()) {
                case "constant" -> new SeriesInfo(Unit.CONSTANT, 1);
                case "series" -> new SeriesInfo(node.get("field").asString().equals("volume") ? Unit.VOLUME : Unit.PRICE, 1 + node.get("lag").asInt());
                case "indicator" -> {
                    SeriesInfo value = indicator(node.get("id").asString(), path + "/id");
                    yield new SeriesInfo(value.unit(), value.bars() + node.get("lag").asInt());
                }
                default -> throw new IllegalStateException("Schema admitted unknown operand");
            };
        }
        int condition(JsonNode node, String path, int depth) {
            if (++conditions > 128 || depth > 8) { error(path, "CONDITION_LIMIT"); return 1; }
            String kind = node.get("kind").asString();
            if (kind.equals("all") || kind.equals("any")) {
                int bars = 1;
                for (int i = 0; i < node.get("children").size(); i++)
                    bars = Math.max(bars, condition(node.get("children").get(i), path + "/children/" + i, depth + 1));
                return bars;
            }
            if (kind.equals("not")) return condition(node.get("child"), path + "/child", depth + 1);
            SeriesInfo left = operand(node.get("left"), path + "/left"), right = operand(node.get("right"), path + "/right");
            if (left.unit() == Unit.CONSTANT && right.unit() == Unit.CONSTANT) error(path, "MEASURABLE_OPERAND_REQUIRED");
            else if (left.unit() != right.unit() && left.unit() != Unit.CONSTANT && right.unit() != Unit.CONSTANT) error(path, "UNIT_MISMATCH");
            return Math.max(left.bars(), right.bars()) + (kind.equals("cross") ? 1 : 0);
        }
    }
}
