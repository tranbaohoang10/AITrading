package com.aitrading;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.dsl.DslValidator;
import com.aitrading.mql5.*;
import com.aitrading.strategy.StrategyService.Revision;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.json.JsonMapper;

class Mql5GeneratorTests {
    final DslValidator validator = new DslValidator();
    final Mql5Generator generator = new Mql5Generator(validator);
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
        assertThat(a).isEqualTo(b); assertThat(a.codeHash()).isEqualTo(Mql5Generator.hash(a.code()));
        assertThat(a.code()).startsWith("#property strict\n#property script_show_inputs\n").contains(source.hash(),"revision 2",Mql5Generator.VERSION,"RESEARCH ONLY", "Csv(CsvFilename", "sim.pending=0", "sim.OpenBar");
        assertThat(a.code()).doesNotContain("OrderSend(", "CTrade", "WebRequest(", "#import", "ShellExecute", "Neutral price research");
        assertThat(a.code()).contains("SafeFilename", "CSV_INVALID", "rowCount>=5000", "value>=0.00000001", "ConfirmCsvSymbol");
        assertThat(a.code()).contains("ERROR: NUMERIC_RANGE", "if(!Process(rows[i])) return 1", "Defined(sim.closedNet)");
        assertThat(a.code().getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(Mql5Generator.MAX_CODE);
        Path output = Path.of("build/reports/mql5/price-action.mq5"); Files.createDirectories(output.getParent()); Files.writeString(output,a.code());
    }
    @Test void methodLabelsNamesAndIndicatorIdentifiersNeverBecomeCode() throws Exception {
        var original = (ObjectNode)json.readTree(fixture("price-action"));
        String[] labels = {"Dow", "Wyckoff", "ICT", "SMC", "Custom\"\\ // </script>"};
        var originalRevision = revision(original.toString());
        String referenceBody = generator.generate(originalRevision).code().replace(originalRevision.hash(), "<DSL_HASH>");
        for (String label : labels) {
            original.put("name",label);original.putArray("labels").add(label);
            var changedRevision = revision(original.toString());
            String code = generator.generate(changedRevision).code();
            assertThat(code.replace(changedRevision.hash(), "<DSL_HASH>")).isEqualTo(referenceBody);
            assertThat(code).doesNotContain(label);
        }
    }
    @Test void savedHashSchemaAndValidationAreRecheckedRatherThanTrustingStatus() throws Exception {
        var r = revision(fixture("price-action"));
        for (String status : List.of("DRAFT","OTHER")) {
            var bad = new Revision(r.strategyId(),2,r.title(),r.draftText(),status,r.canonicalJson(),r.hash(),r.schemaVersion(),r.validatorVersion(),r.minimumBars(),r.symbol(),r.timeframe(),r.createdAt());
            assertThatThrownBy(()->generator.generate(bad)).isInstanceOf(Mql5Failure.class).extracting("code").isEqualTo("VALIDATED_REVISION_REQUIRED");
        }
        var bad = new Revision(r.strategyId(),2,r.title(),r.draftText(),r.status(),r.canonicalJson(),"0".repeat(64),r.schemaVersion(),r.validatorVersion(),r.minimumBars(),r.symbol(),r.timeframe(),r.createdAt());
        assertThatThrownBy(()->generator.generate(bad)).isInstanceOf(Mql5Failure.class).extracting("code").isEqualTo("SOURCE_PROVENANCE_MISMATCH");
        var unsupported = new Revision(r.strategyId(),2,r.title(),r.draftText(),r.status(),"{}",r.hash(),r.schemaVersion(),r.validatorVersion(),r.minimumBars(),r.symbol(),r.timeframe(),r.createdAt());
        assertThatThrownBy(()->generator.generate(unsupported)).isInstanceOf(Mql5Failure.class).extracting("code").isEqualTo("SOURCE_INVALID");
    }
    @Test void targetBoundsAcceptEndpointsButRejectOutsideWithoutChangingDslSchema() throws Exception {
        var raw = (ObjectNode)json.readTree(fixture("price-action"));
        var defs = raw.putArray("indicators");
        for(int i=0;i<16;i++) defs.addObject().put("id","s"+i).put("type","SMA").put("period",200).set("source",json.readTree("{\"kind\":\"series\",\"field\":\"close\",\"lag\":200}"));
        generator.generate(revision(raw.toString()));
        ((ObjectNode)defs.get(0)).put("period",201);
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(Mql5Failure.class).extracting("code").isEqualTo("TARGET_PERIOD_LIMIT");
        ((ObjectNode)defs.get(0)).put("period",200);((ObjectNode)defs.get(0).get("source")).put("lag",201);
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(Mql5Failure.class).extracting("code").isEqualTo("TARGET_LAG_LIMIT");
        ((ObjectNode)defs.get(0).get("source")).put("lag",200);defs.addObject().put("id","extra").put("type","ATR").put("period",2);
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(Mql5Failure.class).extracting("code").isEqualTo("TARGET_RESOURCE_LIMIT");
        defs.removeAll();
        for(int i=0;i<12;i++) {
            var n=defs.addObject().put("id","chain"+i).put("type","SMA").put("period",200);
            n.set("source",json.readTree(i==0?"{\"kind\":\"series\",\"field\":\"close\",\"lag\":200}":"{\"kind\":\"indicator\",\"id\":\"chain"+(i-1)+"\",\"lag\":200}"));
        }
        assertThatThrownBy(()->generator.generate(revision(raw.toString()))).isInstanceOf(Mql5Failure.class).extracting("code").isEqualTo("TARGET_RESOURCE_LIMIT");
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
        assertThat(code.indexOf("   double i1_point")).isLessThan(code.indexOf("   i0.Add("));
        assertThat(code).contains("Pivot(s_high,2,2,true)","Pivot(s_low,1,1,false)","count-1-2","RuleAll(Cross(","count>1 ? 100.0 : UNDEFINED","RuleNot(","_gains","_losses");
        Path output=Path.of("build/reports/mql5/all-components.mq5");Files.createDirectories(output.getParent());Files.writeString(output,code);
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
                Path golden=Path.of("../specs/PB-016/test-evidence/target-fixtures/"+fixture.getFileName().toString().replace(".json",".mq5"));
                assertThat(generated.code()).as("Officially compiled source " + fixture.getFileName()).isEqualTo(Files.readString(golden).replace("\r\n", "\n"));
                Path out=Path.of("build/reports/mql5/"+fixture.getFileName().toString().replace(".json",".mq5"));
                Files.createDirectories(out.getParent());Files.writeString(out,generated.code());
                // A source-bound artifact is preparation for target validation, not runtime evidence; official results are recorded separately.
                assertThat(value.get("targetStatus").asString()).startsWith("NOT_RUN");
            }
        }
    }
}
