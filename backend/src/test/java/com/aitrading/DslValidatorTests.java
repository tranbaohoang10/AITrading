package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.dsl.DslValidator;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class DslValidatorTests {
    final DslValidator validator = new DslValidator();
    final JsonMapper json = JsonMapper.builder().build();
    ObjectNode fixture(String name) throws Exception {
        try (var stream = getClass().getResourceAsStream("/dsl/" + name + ".json")) {
            return (ObjectNode) json.readTree(stream);
        }
    }
    ObjectNode base() throws Exception { return fixture("price-action"); }
    DslValidator.Validation validate(JsonNode value) { return validator.validate(json.writeValueAsBytes(value)); }
    DslValidator.Validation raw(String value) { return validator.validate(value.getBytes(StandardCharsets.UTF_8)); }
    ObjectNode object(JsonNode n, String field) { return (ObjectNode)n.get(field); }
    ObjectNode parse(String s) { return (ObjectNode)json.readTree(s); }
    void invalid(JsonNode n, String code) {
        var result = validate(n);
        assertThat(result.valid()).isFalse(); assertThat(result.document()).isNull();
        assertThat(result.errors()).extracting(DslValidator.Diagnostic::code).contains(code);
        assertThat(result.errors()).hasSizeLessThanOrEqualTo(20);
    }

    @Test void neutralFamiliesMatchIndependentGoldenBytesHashAndWarmup() throws Exception {
        var goldens=fixture("goldens");
        assertThat(goldens.size()).isEqualTo(6);
        for(var golden:goldens.properties()) {
            var result=validate(fixture(golden.getKey()));
            assertThat(result.errors()).as(golden.getKey()).isEmpty();
            assertThat(result.valid()).isTrue();
            assertThat(result.document().hash()).isEqualTo(golden.getValue().get("hash").asString());
            assertThat(result.document().canonicalJson()).isEqualTo(golden.getValue().get("canonicalJson").asString());
            assertThat(result.document().minimumBars()).isEqualTo(golden.getValue().get("minimumBars").asInt());
            assertThat(result.document().schemaVersion()).isEqualTo("1.0.0");
            assertThat(result.document().validatorVersion()).isEqualTo("1.0.0");
        }
        assertThat(validator.capabilities().get("operation")).isEqualTo("validation_only");
        assertThat(validator.capabilities().get("runtimeStatus")).isEqualTo(Map.of("python","not_implemented","pine","not_implemented","mql5","not_implemented"));
    }

    @Test void canonicalPreservesExactDecimalsUnicodeAndEquivalentNumericForms() throws Exception {
        var value=base(); object(value,"risk").put("allocationPct",12.34567891);
        value.put("name","Unicode 🧪 tiếng Việt / \\\"quote");
        String document=json.writeValueAsString(value);
        var first=raw(document);
        assertThat(first.valid()).isTrue();
        assertThat(first.document().canonicalJson()).contains("12.34567891","Unicode 🧪 tiếng Việt");
        String alternate=document.replace("10000","1.0000e4").replace("12.34567891","1234567891e-8").replace("\"lag\":0","\"lag\":-0.000");
        assertThat(raw(" \n"+alternate+" \t").document()).isEqualTo(first.document());
        ObjectNode reversed=json.createObjectNode();
        List<String> keys=new ArrayList<>(value.propertyNames()); Collections.reverse(keys);
        for(String key:keys) reversed.set(key,value.get(key));
        assertThat(validate(reversed).document()).isEqualTo(first.document());
        var before=first.document(); value.put("name","Changed");
        assertThat(before.canonicalJson()).contains("Unicode");
        assertThat(validate(value).document().hash()).isNotEqualTo(before.hash());
        assertThatThrownBy(()->first.errors().add(new DslValidator.Diagnostic("","",""))).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test void metadataLabelsHaveNoHiddenTradingSemantics() throws Exception {
        var value=base(); var original=validate(value).document();
        for(String label:List.of("Dow Theory","Wyckoff","ICT","SMC","RSI","custom")) {
            value.putArray("labels").add(label);
            var document=validate(value).document();
            assertThat(document.minimumBars()).isEqualTo(original.minimumBars());
            assertThat(document.hash()).isNotEqualTo(original.hash());
            assertThat(json.readTree(document.canonicalJson()).get("rules")).isEqualTo(json.readTree(original.canonicalJson()).get("rules"));
        }
    }

    @Test void missingUnknownRootTypeAndVersionFailWithoutEcho() throws Exception {
        for(String text:List.of("null","{}","[]","\"script\"","123","true")) assertThat(raw(text).valid()).isFalse();
        var missing=base();missing.remove("execution");invalid(missing,"REQUIRED");
        var unknown=base();unknown.put("PRIVATE_SECRET_NAME","payload");invalid(unknown,"UNKNOWN_FIELD");
        assertThat(json.writeValueAsString(validate(unknown))).doesNotContain("PRIVATE_SECRET_NAME","payload");
        var version=base();version.put("schemaVersion","strategy-dsl.mock.v1");invalid(version,"UNSUPPORTED_VALUE");
        version=base();version.put("name",123);invalid(version,"TYPE");
        var coercion=base();object(coercion,"risk").put("leverage","1");invalid(coercion,"TYPE");
    }

    @Test void rejectsOpaqueFutureOrUnsupportedObjectsAndRetainsInertMetadata() throws Exception {
        for(String field:List.of("$ref","$type","script","sql","url","ownerId","multiTimeframe","trailingStop")) {
            var value=base();value.put(field,"https://127.0.0.1/../../secret; DROP TABLE");invalid(value,"UNKNOWN_FIELD");
        }
        var value=base();value.put("name","<script>localFixture()</script> '); DROP TABLE X;--");
        assertThat(validate(value).valid()).isTrue();
        var rule=object(value.get("rules"),"longEntry");rule.put("kind","order_block");invalid(value,"UNSUPPORTED_SHAPE");
        value=base();object(object(value.get("rules"),"longEntry"),"left").put("lag",-1);invalid(value,"NUMBER_RANGE");
        assertThat(validate(value).errors().getFirst().path()).isEqualTo("/rules/longEntry/left/lag");
        value=base();object(value,"market").put("symbol","../../secret");invalid(value,"FORMAT");
        value=base();object(value,"market").put("timeframe","1s");invalid(value,"UNSUPPORTED_VALUE");
        value=base();object(value,"market").put("timezone","Asia/Ho_Chi_Minh");invalid(value,"UNSUPPORTED_VALUE");
    }

    @Test void resolvesForwardDagAndRejectsCyclesMissingDuplicateAndWrongPivotRefs() throws Exception {
        var value=fixture("confirmed-structure"); assertThat(validate(value).valid()).isTrue();
        ((ObjectNode)value.get("indicators").get(0)).put("pivotRef","absent");invalid(value,"MISSING_REFERENCE");
        value=base();value.set("indicators",json.readTree("[{\"id\":\"a\",\"type\":\"SMA\",\"source\":{\"kind\":\"indicator\",\"id\":\"b\",\"lag\":0},\"period\":2},{\"id\":\"b\",\"type\":\"EMA\",\"source\":{\"kind\":\"indicator\",\"id\":\"a\",\"lag\":0},\"period\":2}]"));
        invalid(value,"REFERENCE_CYCLE");
        ((ObjectNode)value.get("indicators").get(1)).put("id","a"); invalid(value,"DUPLICATE_ID");
        value=fixture("confirmed-structure");value.withArray("indicators").set(1,parse("{\"id\":\"peaks\",\"type\":\"ATR\",\"period\":2}"));invalid(value,"PIVOT_REFERENCE_REQUIRED");
    }

    @Test void enforcesDimensionalTypesAndMeasurableSources() throws Exception {
        var value=base();object(object(value.get("rules"),"longEntry"),"right").put("field","volume");invalid(value,"UNIT_MISMATCH");
        value=fixture("indicator-trend");object(object(value.get("rules"),"longExit"),"right").put("id","momentum");invalid(value,"UNIT_MISMATCH");
        value=base();object(value,"rules").set("longEntry",parse("{\"kind\":\"compare\",\"op\":\"gt\",\"left\":{\"kind\":\"constant\",\"value\":2},\"right\":{\"kind\":\"constant\",\"value\":1}}"));invalid(value,"MEASURABLE_OPERAND_REQUIRED");
        value=fixture("indicator-trend");object(value.get("indicators").get(2),"source").put("field","volume");invalid(value,"PRICE_SOURCE_REQUIRED");
        value=fixture("indicator-trend");((ObjectNode)value.get("indicators").get(0)).set("source",parse("{\"kind\":\"constant\",\"value\":10}"));invalid(value,"SERIES_SOURCE_REQUIRED");
    }

    @Test void preciseWarmupIncludesSourceLagCrossPivotAndEvenUnusedDefinitions() throws Exception {
        var value=base();var definitions=value.putArray("indicators");
        definitions.add(parse("{\"id\":\"smooth\",\"type\":\"EMA\",\"source\":{\"kind\":\"series\",\"field\":\"close\",\"lag\":3},\"period\":5}"));
        assertThat(validate(value).document().minimumBars()).isEqualTo(8);
        definitions.add(parse("{\"id\":\"rsi\",\"type\":\"RSI\",\"source\":{\"kind\":\"indicator\",\"id\":\"smooth\",\"lag\":2},\"period\":14}"));
        assertThat(validate(value).document().minimumBars()).isEqualTo(24);
        definitions.add(parse("{\"id\":\"pivot\",\"type\":\"PIVOT_LOW\",\"left\":100,\"right\":100}"));
        assertThat(validate(value).document().minimumBars()).isEqualTo(201);
        object(value,"rules").set("longEntry",parse("{\"kind\":\"cross\",\"direction\":\"below\",\"left\":{\"kind\":\"indicator\",\"id\":\"pivot\",\"lag\":2000},\"right\":{\"kind\":\"series\",\"field\":\"low\",\"lag\":0}}"));
        assertThat(validate(value).document().minimumBars()).isEqualTo(2202);
        definitions.add(parse("{\"id\":\"atr\",\"type\":\"ATR\",\"period\":2000}"));
        assertThat(validate(value).valid()).isTrue();
        ((ObjectNode)definitions.get(3)).put("period",2001);invalid(value,"NUMBER_RANGE");
    }

    @Test void maxDepthAndConditionCountAreAcceptedButNextLevelRejected() throws Exception {
        var value=base(); JsonNode rule=value.get("rules").get("longEntry");
        for(int i=0;i<7;i++) {var parent=json.createObjectNode().put("kind","not");parent.set("child",rule);rule=parent;}
        object(value,"rules").set("longEntry",rule);assertThat(validate(value).valid()).isTrue();
        var extra=json.createObjectNode().put("kind","not");extra.set("child",rule);object(value,"rules").set("longEntry",extra);invalid(value,"CONDITION_LIMIT");
        value=base();var leaf=value.get("rules").get("longEntry");var root=json.createObjectNode().put("kind","all");var children=root.putArray("children");
        for(int i=0;i<8;i++){var group=json.createObjectNode().put("kind","any");var leaves=group.putArray("children");for(int j=0;j<8;j++)leaves.add(leaf);children.add(group);}
        object(value,"rules").set("longEntry",root);assertThat(validate(value).valid()).isTrue(); //73 conditions
        object(value,"rules").set("longExit",root);invalid(value,"CONDITION_LIMIT");
    }

    @Test void indicatorListAndWarmupBudgetsAreBounded() throws Exception {
        var value=base();var definitions=value.putArray("indicators");
        for(int i=0;i<32;i++)definitions.add(parse("{\"id\":\"a"+i+"\",\"type\":\"ATR\",\"period\":2}"));
        assertThat(validate(value).valid()).isTrue();definitions.add(definitions.get(0));invalid(value,"ITEM_LIMIT");
        value=base();definitions=value.putArray("indicators");
        for(int i=0;i<6;i++)definitions.add(parse("{\"id\":\"a"+i+"\",\"type\":\"SMA\",\"source\":"+(i==0?"{\"kind\":\"series\",\"field\":\"close\",\"lag\":0}":"{\"kind\":\"indicator\",\"id\":\"a"+(i-1)+"\",\"lag\":0}")+",\"period\":2000}"));
        invalid(value,"WARMUP_LIMIT");
    }

    @Test void exactGlobalConditionAndWarmupLimitsDoNotHaveOffByOneErrors() throws Exception {
        var value=base();JsonNode rule=value.get("rules").get("longEntry");var leaf=rule;
        for(int i=0;i<6;i++) {var parent=json.createObjectNode().put("kind","all");parent.putArray("children").add(rule).add(rule);rule=parent;}
        // Six full binary levels: 127 conditions; another exit leaf makes128.
        object(value,"rules").set("longEntry",rule);object(value,"rules").set("longExit",leaf);
        assertThat(validate(value).valid()).isTrue();
        object(value,"rules").set("shortEntry",leaf);invalid(value,"CONDITION_LIMIT");
        value=base();var definitions=value.putArray("indicators");
        for(int i=0;i<5;i++)definitions.add(parse("{\"id\":\"a"+i+"\",\"type\":\"SMA\",\"source\":"+(i==0?"{\"kind\":\"series\",\"field\":\"close\",\"lag\":4}":"{\"kind\":\"indicator\",\"id\":\"a"+(i-1)+"\",\"lag\":0}")+",\"period\":2000}"));
        assertThat(validate(value).document().minimumBars()).isEqualTo(10000);
        object(definitions.get(0),"source").put("lag",5);invalid(value,"WARMUP_LIMIT");
    }

    @Test void riskBoundsAndExecutionRulesRejectUnsafeOrImplicitAlternatives() throws Exception {
        for(String field:List.of("initialCapital","allocationPct","leverage","stopLossPct","takeProfitPct")) {
            var value=base();object(value,"risk").put(field,0);invalid(value,"NUMBER_RANGE");
        }
        var value=base();object(value,"risk").put("leverage",10).put("stopLossPct",10);assertThat(validate(value).valid()).isTrue();
        object(value,"risk").put("stopLossPct",10.00000001);invalid(value,"LEVERAGED_STOP_LIMIT");
        value=base();object(value,"execution").put("commissionBps",-1);invalid(value,"NUMBER_RANGE");
        value=base();object(value,"execution").put("maxPositions",2);invalid(value,"UNSUPPORTED_VALUE");
        value=base();object(value,"rules").set("shortExit",value.get("rules").get("longEntry"));invalid(value,"DISABLED_SIDE_EXIT");
        value=base();object(value,"rules").putNull("longEntry");invalid(value,"ENTRY_REQUIRED");
    }

    @Test void textBoundariesUnicodeAndNumberResourceAbuseFailSafely() throws Exception {
        var value=base();value.put("name","🧪".repeat(120));assertThat(validate(value).valid()).isTrue();
        value.put("name","🧪".repeat(121));invalid(value,"TEXT_LENGTH");
        for(String text:List.of("","x".repeat(121))) {value=base();value.put("name",text);invalid(value,"TEXT_LENGTH");}
        for(String text:List.of("\u0000","\n","\ud800","\udc00")) {value=base();value.put("name",text);invalid(value,"INVALID_UNICODE_OR_CONTROL");}
        String raw=json.writeValueAsString(base());
        for(String number:List.of("1e100","1e-100","1000000000001","0.000000001")) assertThat(raw(raw.replace("10000",number)).valid()).isFalse();
        for(String number:List.of("NaN","Infinity","1e9999999999","1".repeat(65)))
            assertThatThrownBy(()->raw(raw.replace("10000",number))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->validator.validate(new byte[]{(byte)0xc3,(byte)0x28})).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void malformedDuplicateTrailingDeepAndOversizedInputsAreRejected() throws Exception {
        String valid=json.writeValueAsString(base());
        for(String text:List.of("", "{",valid+"{}",valid.replace("\"name\":","\"name\":\"first\",\"name\":"),"[".repeat(30)+"0"+"]".repeat(30)))
            assertThatThrownBy(()->raw(text)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->raw(" ".repeat(65537))).isInstanceOf(IllegalArgumentException.class);
        assertThat(raw("["+"0,".repeat(2048)+"0]").errors()).extracting(DslValidator.Diagnostic::code).contains("RESOURCE_LIMIT");
    }

    @Test void parallelValidationCannotMixMutableTraversalStateOrErrors() throws Exception {
        String valid=json.writeValueAsString(fixture("indicator-trend"));var expected=raw(valid);
        try(var pool=Executors.newFixedThreadPool(8)) {
            List<Callable<DslValidator.Validation>> jobs=new ArrayList<>();
            for(int i=0;i<64;i++){final boolean ok=i%2==0;jobs.add(()->raw(ok?valid:"{}"));}
            int index=0;
            for(var result:pool.invokeAll(jobs)) {
                if(index++%2==0)assertThat(result.get()).isEqualTo(expected);
                else assertThat(result.get().valid()).isFalse();
            }
        }
    }

    @Test void diagnosticCapDoesNotReturnUserSuppliedIdsOrUnboundedErrors() throws Exception {
        var value=base();var definitions=value.putArray("indicators");
        for(int i=0;i<32;i++)definitions.add(parse("{\"id\":\"private_fixture\",\"type\":\"ATR\",\"period\":2}"));
        var result=validate(value);
        assertThat(result.valid()).isFalse();assertThat(result.errors()).hasSize(20);
        assertThat(result.errors()).allSatisfy(error->assertThat(error.code()).isEqualTo("DUPLICATE_ID"));
        assertThat(json.writeValueAsString(result)).doesNotContain("private_fixture");
    }
}
