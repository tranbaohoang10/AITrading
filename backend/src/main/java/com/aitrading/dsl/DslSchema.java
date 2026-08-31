package com.aitrading.dsl;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/** Evaluates only our bundled, trusted schema subset. Never accepts a caller schema. */
final class DslSchema {
    private final JsonNode root;
    private static final Set<String> KEYWORDS = Set.of("$schema", "$id", "title", "$defs", "$ref",
            "type", "const", "enum", "oneOf", "properties", "required", "additionalProperties",
            "items", "minItems", "maxItems", "minLength", "maxLength", "pattern", "minimum", "maximum", "multipleOf");

    DslSchema(JsonNode root) { this.root = root; inspect(root); }

    private void inspect(JsonNode schema) {
        if (!schema.isObject()) throw new IllegalStateException("Bundled schema must contain objects");
        for (String key : schema.propertyNames())
            if (!KEYWORDS.contains(key)) throw new IllegalStateException("Unsupported bundled schema keyword");
        if (schema.has("properties") && (!schema.has("additionalProperties") || !schema.get("additionalProperties").isBoolean()
                || schema.get("additionalProperties").asBoolean()))
            throw new IllegalStateException("Bundled object schemas must remain closed");
        if (schema.has("$ref")) resolve(schema.get("$ref").asString());
        if (schema.has("pattern")) Pattern.compile(schema.get("pattern").asString());
        for (String map : List.of("properties", "$defs"))
            if (schema.has(map)) for (JsonNode child : schema.get(map)) inspect(child);
        if (schema.has("items")) inspect(schema.get("items"));
        if (schema.has("oneOf")) for (JsonNode child : schema.get("oneOf")) inspect(child);
    }

    private JsonNode resolve(String ref) {
        if (!ref.matches("#/[\\$]defs/[A-Za-z]+")) throw new IllegalStateException("Only bundled local definitions allowed");
        JsonNode found = root.get("$defs").get(ref.substring(8));
        if (found == null) throw new IllegalStateException("Missing bundled definition");
        return found;
    }

    DslValidator.Diagnostic validate(JsonNode node) { return check(node, root, ""); }

    private DslValidator.Diagnostic check(JsonNode n, JsonNode s, String path) {
        if (s.has("$ref")) return check(n, resolve(s.get("$ref").asString()), path);
        if (s.has("oneOf")) {
            int matches = 0;
            DslValidator.Diagnostic specific = null;
            for (JsonNode variant : s.get("oneOf")) {
                var failure = check(n, variant, path);
                if (failure == null) matches++;
                else if (variant.has("$ref")) specific = failure;
                else if (n.isObject() && variant.has("properties")) {
                    for (String tag : List.of("kind", "type"))
                        if (n.has(tag) && variant.get("properties").has(tag)
                                && check(n.get(tag), variant.get("properties").get(tag), path) == null) specific = failure;
                }
            }
            if (matches == 1) return null;
            return matches == 0 && specific != null ? specific : error(path, "UNSUPPORTED_SHAPE");
        }
        if (s.has("type")) {
            boolean type = switch (s.get("type").asString()) {
                case "object" -> n.isObject(); case "array" -> n.isArray();
                case "string" -> n.isString(); case "null" -> n.isNull();
                case "number" -> n.isNumber();
                case "integer" -> n.isNumber() && n.decimalValue().stripTrailingZeros().scale() <= 0;
                default -> throw new IllegalStateException("Unsupported schema type");
            };
            if (!type) return error(path, "TYPE");
        }
        if (s.has("const") && !equal(n, s.get("const"))) return error(path, "UNSUPPORTED_VALUE");
        if (s.has("enum")) {
            boolean match = false;
            for (JsonNode option : s.get("enum")) if (equal(n, option)) match = true;
            if (!match) return error(path, "UNSUPPORTED_VALUE");
        }
        if (n.isObject() && s.has("properties")) {
            JsonNode props = s.get("properties");
            for (String key : n.propertyNames()) if (!props.has(key)) return error(path, "UNKNOWN_FIELD");
            for (JsonNode required : s.get("required"))
                if (!n.has(required.asString())) return error(path + "/" + required.asString(), "REQUIRED");
            // Paths are from trusted schema property names, never attacker keys.
            for (var prop : props.properties()) if (n.has(prop.getKey())) {
                var failure = check(n.get(prop.getKey()), prop.getValue(), path + "/" + prop.getKey());
                if (failure != null) return failure;
            }
        }
        if (n.isArray() && s.has("items")) {
            if (n.size() < s.get("minItems").asInt() || n.size() > s.get("maxItems").asInt()) return error(path, "ITEM_LIMIT");
            for (int i = 0; i < n.size(); i++) {
                var failure = check(n.get(i), s.get("items"), path + "/" + i);
                if (failure != null) return failure;
            }
        }
        if (n.isString() && s.has("minLength")) {
            String value = n.asString(); int length = value.codePointCount(0, value.length());
            if (length < s.get("minLength").asInt() || length > s.get("maxLength").asInt()) return error(path, "TEXT_LENGTH");
            if (s.has("pattern") && !Pattern.compile(s.get("pattern").asString()).matcher(value).find()) return error(path, "FORMAT");
        }
        if (n.isNumber() && s.has("minimum")) {
            BigDecimal value = n.decimalValue();
            if (value.compareTo(s.get("minimum").decimalValue()) < 0 || value.compareTo(s.get("maximum").decimalValue()) > 0)
                return error(path, "NUMBER_RANGE");
            if (s.has("multipleOf") && value.remainder(s.get("multipleOf").decimalValue()).signum() != 0)
                return error(path, "NUMBER_PRECISION");
        }
        return null;
    }

    private boolean equal(JsonNode a, JsonNode b) {
        return a.isNumber() && b.isNumber() ? a.decimalValue().compareTo(b.decimalValue()) == 0 : a.equals(b);
    }
    private DslValidator.Diagnostic error(String path, String code) {
        return new DslValidator.Diagnostic(path, code, "Document does not satisfy the supported schema.");
    }
}
