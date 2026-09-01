package com.aitrading.mql5;

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
public final class Mql5Generator {
    public static final String VERSION = "mql5-research-1.0.0";
    public static final int MAX_CODE = 128 * 1024;
    public static final List<String> LIMITATIONS = List.of(
        "Research CSV script only; no broker orders, native Strategy Tester or live trading.",
        "Official target verification is recorded separately; inspect the published evidence before use.",
        "MQL5 binary doubles differ from Decimal34; near-threshold rules can diverge.",
        "Use explicit symbol/timeframe mapping and contiguous UTC CSV, up to 5000 closed bars.",
        "No broker lots/ticks, funding or liquidation. Historical returns do not guarantee profit.");
    private static final JsonMapper JSON = JsonMapper.builder().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).build();
    private final DslValidator validator;
    private final String runtime;
    public record Generated(String code, String codeHash) { }
    public Mql5Generator(DslValidator validator) {
        this.validator = validator;
        try (var in = getClass().getResourceAsStream("/mql5/research-v1.mq5")) {
            if (in == null) throw new IllegalStateException("Bundled Mql5 runtime missing");
            runtime = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
        } catch (IOException failure) { throw new IllegalStateException("Cannot load Mql5 runtime", failure); }
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    public Generated generate(Revision revision) {
        if (!"VALIDATED".equals(revision.status())) throw new Mql5Failure("VALIDATED_REVISION_REQUIRED");
        DslValidator.Validation check;
        try { check = validator.validate(revision.canonicalJson().getBytes(StandardCharsets.UTF_8)); }
        catch (RuntimeException invalid) { throw new Mql5Failure("SOURCE_INVALID"); }
        if (!check.valid()) throw new Mql5Failure("SOURCE_INVALID");
        var source = check.document();
        if (!source.hash().equals(revision.hash()) || !source.canonicalJson().equals(revision.canonicalJson())
                || !source.schemaVersion().equals(revision.schemaVersion()) || !source.validatorVersion().equals(revision.validatorVersion())
                || !Objects.equals(source.minimumBars(), revision.minimumBars())) throw new Mql5Failure("SOURCE_PROVENANCE_MISMATCH");
        var root = JSON.readTree(source.canonicalJson());
        if (!root.get("market").get("symbol").asString().equals(revision.symbol())
                || !root.get("market").get("timeframe").asString().equals(revision.timeframe())) throw new Mql5Failure("SOURCE_PROVENANCE_MISMATCH");
        if (root.get("indicators").size() > 16 || source.minimumBars() > 4500) throw new Mql5Failure("TARGET_RESOURCE_LIMIT");
        targetBounds(root);
        String code = new Emitter(root, revision, runtime).emit();
        if (code.getBytes(StandardCharsets.UTF_8).length > MAX_CODE) throw new Mql5Failure("TARGET_OUTPUT_LIMIT");
        return new Generated(code, hash(code));
    }
    private static void targetBounds(JsonNode node) {
        if (node.isObject()) {
            if (node.has("period") && node.get("period").asInt() > 200) throw new Mql5Failure("TARGET_PERIOD_LIMIT");
            if (node.has("lag") && node.get("lag").asInt() > 200) throw new Mql5Failure("TARGET_LAG_LIMIT");
        }
        for (var child : node) targetBounds(child);
    }
    private static String number(JsonNode n) {
        // Float suffix avoids integer overflow/coercion in Mql5 for large constants.
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
            this.root=root; this.revision=revision; this.runtime=runtime;
            int index=0;
            for(var n:root.get("indicators")) { String key=n.get("id").asString(); definitions.put(key,n); ids.put(key,"i"+index++); }
        }
        void line(String s) { out.append(s).append('\n'); }
        String operand(JsonNode n,int before) {
            String kind=n.get("kind").asString();
            if(kind.equals("constant")) return before==0 ? number(n.get("value")) : "(count>1 ? "+number(n.get("value"))+" : UNDEFINED)";
            String series=kind.equals("series") ? "s_"+n.get("field").asString() : ids.get(n.get("id").asString());
            return "At("+series+","+(n.get("lag").asInt()+before)+")";
        }
        String condition(JsonNode n) {
            if(n.isNull()) return "-1";
            String kind=n.get("kind").asString();
            if(kind.equals("not")) return "RuleNot("+condition(n.get("child"))+")";
            if(kind.equals("all")||kind.equals("any")) {
                String result=condition(n.get("children").get(0));
                for(int i=1;i<n.get("children").size();i++) result=(kind.equals("all")?"RuleAll(":"RuleAny(")+result+","+condition(n.get("children").get(i))+")";
                return result;
            }
            String a=operand(n.get("left"),0),b=operand(n.get("right"),0);
            if(kind.equals("compare")) return "Compare("+a+","+b+","+List.of("gt","gte","lt","lte","eq","neq").indexOf(n.get("op").asString())+")";
            return "Cross("+a+","+b+","+operand(n.get("left"),1)+","+operand(n.get("right"),1)+","+n.get("direction").asString().equals("above")+")";
        }
        void indicator(String key) {
            if(!emitted.add(key)) return;
            var n=definitions.get(key); String id=ids.get(key),type=n.get("type").asString();
            if(type.equals("TRENDLINE")) {
                String parent=n.get("pivotRef").asString(); indicator(parent); String p=ids.get(parent);
                line("   "+id+".Add("+p+"_x1<0 ? UNDEFINED : "+p+"_y2+("+p+"_y2-"+p+"_y1)*(count-1-"+p+"_x2)/("+p+"_x2-"+p+"_x1));");
            } else if(type.startsWith("PIVOT_")) {
                line("   double "+id+"_point=Pivot(s_"+(type.equals("PIVOT_HIGH")?"high":"low")+","+n.get("left").asInt()+","+n.get("right").asInt()+","+type.equals("PIVOT_HIGH")+");");
                line("   if(Defined("+id+"_point)) {");
                for(String f:List.of("x","y")) line("      "+id+"_"+f+"1="+id+"_"+f+"2;");
                line("      "+id+"_x2=count-1-"+n.get("right").asInt()+"; "+id+"_y2="+id+"_point; }");
                line("   "+id+".Add("+id+"_y2);");
            } else {
                if(!type.equals("ATR")&&n.get("source").get("kind").asString().equals("indicator")) indicator(n.get("source").get("id").asString());
                int period=n.get("period").asInt();
                String value=type.equals("ATR") ? "(count<2 ? UNDEFINED : MathMax(c.high-c.low,MathMax(MathAbs(c.high-At(s_close,1)),MathAbs(c.low-At(s_close,1)))))" : operand(n.get("source"),0);
                line("   "+id+"_source.Add("+value+");");
                if(type.equals("RSI")) {
                    line("   bool "+id+"_defined=Defined(At("+id+"_source,0))&&Defined(At("+id+"_source,1));");
                    line("   double "+id+"_delta="+id+"_defined ? At("+id+"_source,0)-At("+id+"_source,1) : UNDEFINED;");
                    line("   "+id+"_gains.Add("+id+"_defined ? MathMax("+id+"_delta,0) : UNDEFINED);");
                    line("   "+id+"_losses.Add("+id+"_defined ? MathMax(-"+id+"_delta,0) : UNDEFINED);");
                    for(String f:List.of("gain","loss")) line("   "+id+"_"+f+"=Smooth("+id+"_"+(f.equals("gain")?"gains":"losses")+","+period+",2,"+id+"_"+f+");");
                    line("   "+id+".Add(!Defined("+id+"_gain)||!Defined("+id+"_loss) ? UNDEFINED : "+id+"_gain==0&&"+id+"_loss==0 ? 50.0 : "+id+"_loss==0 ? 100.0 : "+id+"_gain==0 ? 0.0 : 100.0-100.0/(1.0+"+id+"_gain/"+id+"_loss));");
                } else {
                    int mode=switch(type) { case "SMA"->0; case "EMA"->1; case "ATR"->2; case "HIGHEST"->3; case "LOWEST"->4; default->throw new Mql5Failure("TARGET_UNSUPPORTED_INDICATOR"); };
                    line("   "+id+".Add(Smooth("+id+"_source,"+period+","+mode+",At("+id+",0)));");
                }
            }
        }
        String emit() {
            line("#property strict");
            line("#property script_show_inputs");
            line("// AITrading "+VERSION+" | schema "+revision.schemaVersion()+" | validator "+revision.validatorVersion());
            line("// Strategy "+revision.strategyId()+" revision "+revision.revision()+" | DSL SHA256 "+revision.hash());
            line("// RESEARCH ONLY: CSV simulation, not native Strategy Tester or live trading.");
            line("// Binary doubles differ from Decimal34; inspect official target evidence. No profit guarantee.");
            line(runtime);
            int seconds=switch(revision.timeframe()) { case "1m"->60; case "5m"->300; case "15m"->900; case "30m"->1800; case "1h"->3600; case "4h"->14400; case "1d"->86400; default->throw new Mql5Failure("TARGET_TIMEFRAME"); };
            line("const int IntervalSeconds="+seconds+";");
            line("input string CsvFilename=\"research.csv\";");
            line("input string ConfirmCsvSymbol=\"\"; // Explicitly confirm the CSV provenance, not the chart/broker symbol.");
            line("input string ConfirmCsvTimeframe=\"\";");
            line("input bool EmitTrace=true;");
            line("int count=0;");
            for(String f:List.of("open","high","low","close","volume")) line("Series s_"+f+";");
            for(var e:definitions.entrySet()) {
                String id=ids.get(e.getKey()),type=e.getValue().get("type").asString(); line("Series "+id+";");
                if(type.startsWith("PIVOT_")) { line("int "+id+"_x1=-1,"+id+"_x2=-1;"); line("double "+id+"_y1=UNDEFINED,"+id+"_y2=UNDEFINED;"); }
                else if(!type.equals("TRENDLINE")) {
                    line("Series "+id+"_source;");
                    if(type.equals("RSI")) { line("Series "+id+"_gains,"+id+"_losses;"); line("double "+id+"_gain=UNDEFINED,"+id+"_loss=UNDEFINED;"); }
                }
            }
            line("Simulation sim;");
            line("bool Process(Candle &c) {"); line("   count++;");
            for(String f:List.of("open","high","low","close","volume")) line("   s_"+f+".Add(c."+f+");");
            for(String key:definitions.keySet()) indicator(key);
            for(String rule:List.of("longEntry","shortEntry","longExit","shortExit")) line("   int "+rule+"="+condition(root.get("rules").get(rule))+";");
            var risk=root.get("risk"); var execution=root.get("execution");
            line("   sim.OpenBar(c,"+number(risk.get("allocationPct"))+","+number(risk.get("leverage"))+","+number(risk.get("stopLossPct"))+","+number(risk.get("takeProfitPct"))+",("+number(execution.get("spreadBps"))+"/2.0+"+number(execution.get("slippageBps"))+")/10000.0,"+number(execution.get("commissionBps"))+"/10000.0);");
            line("   sim.CloseBar(count-1,longEntry,shortEntry,longExit,shortExit);");
            line("   bool valid=Defined(sim.balance)&&Defined(sim.equity)&&Defined(sim.quantity)&&sim.quantity>=0;");
            line("   if(sim.entrySide!=0) valid=valid&&Defined(sim.entryFill)&&Defined(sim.entryCost);");
            line("   if(sim.exitSide!=0) valid=valid&&Defined(sim.exitFill)&&Defined(sim.exitCost)&&Defined(sim.closedNet);");
            line("   if(!valid) { Print(\"ERROR: NUMERIC_RANGE; no completed research result.\"); return false; }");
            line("   if(EmitTrace) {");
            line("      string trace=\"AITRADING_BAR|\"+IntegerToString(count-1)+\"|time=\"+IntegerToString((long)c.time);");
            for(String rule:List.of("longEntry","shortEntry","longExit","shortExit")) line("      trace+=\"|"+rule+"=\"+IntegerToString("+rule+");");
            for(String key:definitions.keySet()) {
                String id=ids.get(key); line("      trace+=\"|"+id+"=\"+Text(At("+id+",0));");
                if(definitions.get(key).get("type").asString().startsWith("PIVOT_")) line("      trace+=\"|"+id+"_x2=\"+IntegerToString("+id+"_x2);");
            }
            for(String f:List.of("balance","equity","quantity","entryFill","entryCost","exitFill","exitCost","closedNet")) line("      trace+=\"|"+f+"=\"+Text(sim."+f+");");
            for(String f:List.of("side","signal","entrySide","entrySignalBar","exitSide","exitSignalBar","exitReason","skip","skipOpen")) line("      trace+=\"|"+f+"=\"+IntegerToString(sim."+f+");");
            line("      Print(trace);"); line("   }"); line("   return true;"); line("}");
            line("int OnStart() {");
            line("   if(ConfirmCsvSymbol!="+JSON.writeValueAsString(revision.symbol())+" || ConfirmCsvTimeframe!="+JSON.writeValueAsString(revision.timeframe())+") { Print(\"ERROR: Confirm CSV symbol/timeframe provenance explicitly.\"); return 1; }");
            line("   Candle rows[]; if(!Csv(CsvFilename,rows,IntervalSeconds)) return 1;");
            line("   sim.Init("+number(risk.get("initialCapital"))+");");
            line("   Print(\"AITRADING_START|"+VERSION+"|dslHash="+revision.hash()+"|bars=\",ArraySize(rows));");
            line("   for(int i=0;i<ArraySize(rows);i++) { if(IsStopped()) { Print(\"ERROR: INTERRUPTED\"); return 1; } if(!Process(rows[i])) return 1; }");
            line("   Print(\"AITRADING_END|cancelledPending=\",sim.pending,\"|openSide=\",sim.side,\"|balance=\",Text(sim.balance),\"|equity=\",Text(sim.equity));");
            line("   sim.pending=0; return 0;"); line("}");
            return out.toString();
        }
    }
}
