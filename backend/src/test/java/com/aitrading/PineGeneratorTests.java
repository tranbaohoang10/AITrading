package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.dsl.DslValidator;
import com.aitrading.pine.*;
import com.aitrading.strategy.StrategyService.Revision;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.json.JsonMapper;

class PineGeneratorTests {
    final DslValidator validator = new DslValidator();
    final PineGenerator generator = new PineGenerator(validator);
    final JsonMapper json = JsonMapper.builder().build();
    String fixture(String name) throws Exception { return Files.readString(Path.of("src/test/resources/dsl/" + name + ".json")); }
    Revision revision(String raw) {
        var result = validator.validate(raw.getBytes(StandardCharsets.UTF_8));
        assertThat(result.valid()).as(result.errors().toString()).isTrue();
        var d = result.document(); var market = json.readTree(d.canonicalJson()).get("market");
        return new Revision(UUID.fromString("11111111-1111-1111-1111-111111111111"),2,"Synthetic fixture",raw,"VALIDATED",d.canonicalJson(),d.hash(),d.schemaVersion(),d.validatorVersion(),d.minimumBars(),market.get("symbol").asString(),market.get("timeframe").asString(),Instant.parse("2024-01-01T00:00:00Z"));
    }
    @Test void deterministicArtifactContainsOnlyBoundedResearchRuntimeAndExactProvenance() throws Exception {
        var source = revision(fixture("price-action")); var a = generator.generate(source); var b = generator.generate(source);
        assertThat(a).isEqualTo(b); assertThat(a.codeHash()).isEqualTo(PineGenerator.hash(a.code()));
        assertThat(a.code()).startsWith("//@version=6\n").contains(source.hash(),"revision 2",PineGenerator.VERSION,"EXPERIMENTAL", "barstate.isconfirmed", "sim.pending := 0", "stop_first");
        assertThat(a.code()).doesNotContain("strategy(", "strategy.entry", "alert(", "request.security", "request.seed", "Neutral price research");
        assertThat(a.code()).contains("startTime % intervalMs != 0", "time != startTime + count * intervalMs", "time_close != time + intervalMs", "count >= 5000", "low < 0.00000001");
        assertThat(a.code().getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(PineGenerator.MAX_CODE);
        Path output = Path.of("build/reports/pine/price-action.pine"); Files.createDirectories(output.getParent()); Files.writeString(output,a.code());
    }
    @Test void methodLabelsNamesAndIndicatorIdentifiersNeverBecomeCode() throws Exception {
        var original = (ObjectNode)json.readTree(fixture("price-action"));
        String[] labels = {"Dow", "Wyckoff", "ICT", "SMC", "Custom\"\\ // </script>"};
        String referenceBody = generator.generate(revision(original.toString())).code().split("\n",4)[3];
        for (String label : labels) {
            original.put("name",label);original.putArray("labels").add(label);
            String code = generator.generate(revision(original.toString())).code();
            assertThat(code.split("\n",4)[3]).isEqualTo(referenceBody);
            assertThat(code).doesNotContain(label);
        }
    }
    @Test void savedHashSchemaAndValidationAreRecheckedRatherThanTrustingStatus() throws Exception {
        var r = revision(fixture("price-action"));
        for (String status : List.of("DRAFT","OTHER")) {
            var bad = new Revision(r.strategyId(),2,r.title(),r.draftText(),status,r.canonicalJson(),r.hash(),r.schemaVersion(),r.validatorVersion(),r.minimumBars(),r.symbol(),r.timeframe(),r.createdAt());
            assertThatThrownBy(()->generator.generate(bad)).isInstanceOf(PineFailure.class).extracting("code").isEqualTo("VALIDATED_REVISION_REQUIRED");
        }
        var bad = new Revision(r.strategyId(),2,r.title(),r.draftText(),r.status(),r.canonicalJson(),"0".repeat(64),r.schemaVersion(),r.validatorVersion(),r.minimumBars(),r.symbol(),r.timeframe(),r.createdAt());
        assertThatThrownBy(()->generator.generate(bad)).isInstanceOf(PineFailure.class).extracting("code").isEqualTo("SOURCE_PROVENANCE_MISMATCH");
        var unsupported = new Revision(r.strategyId(),2,r.title(),r.draftText(),r.status(),"{}",r.hash(),r.schemaVersion(),r.validatorVersion(),r.minimumBars(),r.symbol(),r.timeframe(),r.createdAt());
        assertThatThrownBy(()->generator.generate(unsupported)).isInstanceOf(PineFailure.class).extracting("code").isEqualTo("SOURCE_INVALID");
    }
    @Test void targetBoundsAcceptEndpointsButRejectOutsideWithoutChangingDslSchema() throws Exception {
        var raw = (ObjectNode)json.readTree(fixture("price-action"));
        var defs = raw.putArray("indicators");
        for(int i=0;i<16;i++) defs.addObject().put("id","s"+i).put("type","SMA").put("period",200).set("source",json.readTree("{\"kind\":\"series\",\"field\":\"close\",\"lag\":200}"));
        generator.generate(revision(raw.toString()));
        ((ObjectNode)defs.get(0)).put("period",201);
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(PineFailure.class).extracting("code").isEqualTo("TARGET_PERIOD_LIMIT");
        ((ObjectNode)defs.get(0)).put("period",200);((ObjectNode)defs.get(0).get("source")).put("lag",201);
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(PineFailure.class).extracting("code").isEqualTo("TARGET_LAG_LIMIT");
        ((ObjectNode)defs.get(0).get("source")).put("lag",200);defs.addObject().put("id","extra").put("type","ATR").put("period",2);
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(PineFailure.class).extracting("code").isEqualTo("TARGET_RESOURCE_LIMIT");
        defs.removeAll();
        for(int i=0;i<12;i++) {
            var n=defs.addObject().put("id","chain"+i).put("type","SMA").put("period",200);
            n.set("source",json.readTree(i==0?"{\"kind\":\"series\",\"field\":\"close\",\"lag\":200}":"{\"kind\":\"indicator\",\"id\":\"chain"+(i-1)+"\",\"lag\":200}"));
        }
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(PineFailure.class).extracting("code").isEqualTo("TARGET_RESOURCE_LIMIT");
    }
    @Test void everyValidatedIndicatorAndRuleVariantEmitsCausalReferences() throws Exception {
        var raw = (ObjectNode)json.readTree(fixture("price-action")); var defs=raw.putArray("indicators");
        defs.addObject().put("id","trend").put("type","TRENDLINE").put("pivotRef","pivot");
        defs.addObject().put("id","pivot").put("type","PIVOT_HIGH").put("left",2).put("right",2);
        defs.addObject().put("id","low").put("type","PIVOT_LOW").put("left",1).put("right",1);
        defs.addObject().put("id","atr").put("type","ATR").put("period",3);
        for(String type:List.of("SMA","EMA","RSI","HIGHEST","LOWEST")) defs.addObject().put("id",type.toLowerCase()).put("type",type).put("period",3).set("source",json.readTree("{\"kind\":\"series\",\"field\":\"close\",\"lag\":1}"));
        var leaf = json.readTree("{\"kind\":\"cross\",\"direction\":\"above\",\"left\":{\"kind\":\"indicator\",\"id\":\"ema\",\"lag\":0},\"right\":{\"kind\":\"constant\",\"value\":100}}");
        var rules=(ObjectNode)raw.get("rules"); var group=json.createObjectNode().put("kind","all"); group.putArray("children").add(leaf).add(json.createObjectNode().put("kind","not").set("child",rules.get("longEntry")));rules.set("longEntry",group);
        String code=generator.generate(revision(raw.toString())).code();
        assertThat(code.indexOf("    float i1_point")).isLessThan(code.indexOf("    array.push(i0,"));
        assertThat(code).contains("f_pivot(s_high, 2, 2, true)","f_pivot(s_low, 1, 1, false)","count - 1 - 2","f_all(f_cross(","count > 1 ? 100.0 : na","f_not(","_gains","_losses");
        Path output=Path.of("build/reports/pine/all-components.pine");Files.createDirectories(output.getParent());Files.writeString(output,code);
    }
    @Test void sharedPythonFixturesBindGeneratedCodeToExactCanonicalSourceWithoutClaimingTargetExecution() throws Exception {
        try(var files=Files.list(Path.of("src/test/resources/pine"))) {
            var fixtures=files.filter(p->p.toString().endsWith(".json")).sorted().toList();
            assertThat(fixtures).hasSize(8);
            for(var fixture:fixtures) {
                var value=json.readTree(Files.readString(fixture));
                var source=revision(value.get("request").get("dsl").toString());
                assertThat(source.hash()).isEqualTo(value.get("reference").get("runCard").get("dslHash").asString());
                var generated=generator.generate(source);
                Path golden=Path.of("../specs/PB-015/test-evidence/target-fixtures/"+fixture.getFileName().toString().replace(".json","-export.pine"));
                assertThat(generated.code()).as("Reviewed source snapshot for " + fixture.getFileName()).isEqualTo(Files.readString(golden).replace("\r\n", "\n"));
                Path out=Path.of("build/reports/pine/"+fixture.getFileName().toString().replace(".json",".pine"));
                Files.createDirectories(out.getParent());Files.writeString(out,generated.code());
                // A source-bound artifact is preparation for target validation, not runtime evidence.
                assertThat(value.get("targetStatus").asString()).startsWith("NOT_RUN");
            }
        }
    }
}
