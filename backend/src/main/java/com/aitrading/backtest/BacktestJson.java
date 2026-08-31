package com.aitrading.backtest;

import com.aitrading.market.MarketCsvParser;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;
import tools.jackson.core.*;
import tools.jackson.core.json.JsonFactory;
import tools.jackson.databind.*;
import tools.jackson.databind.json.JsonMapper;

/** Closed worker envelope and independently recomputed immutable provenance. */
public final class BacktestJson {
    public static final int MAX_INPUT=2*1024*1024,MAX_OUTPUT=32*1024*1024;
    static final JsonMapper JSON=JsonMapper.builder(JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .streamReadConstraints(StreamReadConstraints.builder().maxNestingDepth(32).maxStringLength(65536).maxNumberLength(64).build()).build())
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS,DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).build();
    private BacktestJson(){}
    static BacktestFailure invalid(){return new BacktestFailure(BacktestFailure.Code.WORKER_INVALID_RESULT);}
    static JsonNode parse(byte[] raw,int maximum) {
        if(raw.length>maximum)throw invalid();
        try {
            var text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(raw)).toString();
            var root=JSON.readTree(text);if(root==null)throw invalid();
            var stack=new ArrayDeque<JsonNode>();stack.add(root);int count=0;
            while(!stack.isEmpty()){var node=stack.removeLast();if(++count>1_000_000)throw invalid();for(var child:node)stack.addLast(child);}
            return root;
        }catch(Exception rejected){throw invalid();}
    }
    static String canonical(JsonNode node) {
        if(node.isObject()) {
            var keys=new ArrayList<>(node.propertyNames());Collections.sort(keys);var fields=new ArrayList<String>();
            for(var key:keys)fields.add(JSON.writeValueAsString(key)+":"+canonical(node.get(key)));
            return "{"+String.join(",",fields)+"}";
        }
        if(node.isArray()){var items=new ArrayList<String>();for(var value:node)items.add(canonical(value));return "["+String.join(",",items)+"]";}
        if(node.isNumber())return node.decimalValue().stripTrailingZeros().toPlainString();
        return JSON.writeValueAsString(node);
    }
    static String hash(String value){return MarketCsvParser.hash(value);}
    static void fields(JsonNode node,String... expected) {
        if(!node.isObject()||!new HashSet<>(node.propertyNames()).equals(Set.of(expected)))throw invalid();
    }
    static void equal(String expected,JsonNode actual){if(!actual.isString()||!expected.equals(actual.asString()))throw invalid();}
    static void integer(JsonNode node,int value){if(!node.isIntegralNumber()||!node.canConvertToInt()||node.asInt()!=value)throw invalid();}
    public record Result(String json,String hash){}
    static Result result(byte[] raw,int exit,String input,String inputHash,String dslHash,String dataHash,int count) {
        var root=parse(raw,MAX_OUTPUT+1);
        if(!root.path("ok").isBoolean())throw invalid();
        if(!root.get("ok").asBoolean()) {
            fields(root,"ok","error");fields(root.path("error"),"code");
            if(exit!=2&&exit!=3)throw invalid();
            if(!root.path("error").path("code").isString()||!root.path("error").path("code").asString().matches("[A-Z_]{1,48}"))throw invalid();
            throw new BacktestFailure("WORKER_RESOURCE_UNAVAILABLE".equals(root.path("error").path("code").asString())
                    ?BacktestFailure.Code.WORKER_RESOURCE_UNAVAILABLE:BacktestFailure.Code.ENGINE_REJECTED);
        }
        if(exit!=0)throw invalid();fields(root,"ok","result");
        var result=root.path("result");fields(result,"bars","events","trades","openPosition","termination","metrics","runCard","resultHash");
        var card=result.path("runCard");fields(card,"engineVersion","protocolVersion","schemaVersion","validatorVersion","canonicalization","dataFormat",
                "decimalPolicy","dslHash","canonicalDsl","minimumBars","dataset","inputHash","policy","limitations");
        for(var name:List.of("engineVersion","protocolVersion","schemaVersion","validatorVersion"))equal("1.0.0",card.path(name));
        equal("aitrading-canonical-1",card.path("canonicalization"));equal("ohlcv-v1",card.path("dataFormat"));equal("decimal34-half-even-v1",card.path("decimalPolicy"));
        equal(inputHash,card.path("inputHash"));equal(dslHash,card.path("dslHash"));
        var request=parse(input.getBytes(StandardCharsets.UTF_8),MAX_INPUT);
        equal(canonical(request.path("dsl")),card.path("canonicalDsl"));
        var validated=new com.aitrading.dsl.DslValidator().validate(card.path("canonicalDsl").asString().getBytes(StandardCharsets.UTF_8));
        if(!validated.valid())throw invalid();integer(card.path("minimumBars"),validated.document().minimumBars());
        var policy=request.path("dsl").path("execution");
        fields(card.path("policy"),policy.propertyNames().toArray(String[]::new));
        for(String key:policy.propertyNames())equal(policy.get(key).isNumber()?canonical(policy.get(key)):policy.get(key).asString(),card.path("policy").path(key));
        var dataset=card.path("dataset");fields(dataset,"symbol","timeframe","timezone","sourceType","closedThrough","dataHash","count","start","end","sourceVerified");
        for(var key:List.of("symbol","timeframe","timezone","sourceType","closedThrough"))
            equal(request.path("dataset").path(key).asString(),dataset.path(key));
        equal(dataHash,dataset.path("dataHash"));integer(dataset.path("count"),count);
        if(!dataset.path("sourceVerified").isBoolean()||dataset.path("sourceVerified").asBoolean())throw invalid();
        var candles=request.path("dataset").path("candles");
        equal(candles.get(0).path("timestamp").asString(),dataset.path("start"));equal(candles.get(count-1).path("timestamp").asString(),dataset.path("end"));
        var bars=result.path("bars");if(!bars.isArray()||bars.size()!=count)throw invalid();
        for(int i=0;i<count;i++) {
            var bar=bars.get(i);fields(bar,"index","openTime","closeTime","indicators","pivotConfirmations","rules","balance","unrealizedGross","equity","drawdownPct","positionSide");
            integer(bar.path("index"),i);equal(candles.get(i).path("timestamp").asString(),bar.path("openTime"));
            equal(java.time.Instant.parse(candles.get(i).path("timestamp").asString()).plusSeconds(MarketCsvParser.timeframeSeconds(dataset.path("timeframe").asString())).toString(),bar.path("closeTime"));
            for(var key:List.of("balance","unrealizedGross","equity","drawdownPct"))decimal(bar.path(key));
            fields(bar.path("rules"),"longEntry","longExit","shortEntry","shortExit");
            for(var value:bar.path("rules"))if(!value.isNull()&&!value.isBoolean())throw invalid();
            if(!bar.path("indicators").isObject()||!bar.path("pivotConfirmations").isObject())throw invalid();
            for(var value:bar.path("indicators"))if(!value.isNull())decimal(value);
        }
        var trades=result.path("trades");var events=result.path("events");
        if(!trades.isArray()||trades.size()>count||!events.isArray()||events.size()>count*4)throw invalid();
        for(int i=0;i<events.size();i++){integer(events.get(i).path("id"),i+1);var index=events.get(i).path("barIndex");if(!index.isIntegralNumber()||index.asLong()<0||index.asLong()>=count)throw invalid();}
        var metrics=result.path("metrics");fields(metrics,"initialCapital","finalBalance","finalEquity","netProfit","returnPct","closedNetPnl","totalFees","maxDrawdownPct",
                "closedTrades","winningTrades","losingTrades","breakevenTrades","winRatePct","profitFactor");
        integer(metrics.path("closedTrades"),trades.size());
        int classified=0;for(var key:List.of("winningTrades","losingTrades","breakevenTrades")){var value=metrics.path(key);if(!value.isIntegralNumber()||value.asLong()<0||value.asLong()>count)throw invalid();classified+=value.asInt();}
        if(classified!=trades.size())throw invalid();
        for(var key:List.of("initialCapital","finalBalance","finalEquity","netProfit","returnPct","closedNetPnl","totalFees","maxDrawdownPct"))decimal(metrics.path(key));
        for(var key:List.of("winRatePct","profitFactor"))if(!metrics.path(key).isNull())decimal(metrics.path(key));
        fields(result.path("termination"),"reason","cancelledOrder");equal("DATASET_END",result.path("termination").path("reason"));
        var copy=result.deepCopy();String claimed=result.path("resultHash").asString();
        ((tools.jackson.databind.node.ObjectNode)copy).remove("resultHash");String computed=hash(canonical(copy));
        if(!computed.equals(claimed))throw invalid();String output=JSON.writeValueAsString(result);
        if(output.getBytes(StandardCharsets.UTF_8).length>MAX_OUTPUT)throw invalid();
        return new Result(output,computed);
    }
    private static void decimal(JsonNode value){if(!value.isString()||value.asString().length()>1024||!value.asString().matches("-?(0|[1-9][0-9]*)(\\.[0-9]+)?"))throw invalid();}
}
