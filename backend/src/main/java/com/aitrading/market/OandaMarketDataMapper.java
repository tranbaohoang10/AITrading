package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class OandaMarketDataMapper {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private static final Set<String> COMMODITIES=Set.of("XAU","XAG","XPT","XPD","WTICO","BCO","NATGAS","CORN","SOYBN","WHEAT","SUGAR","COCOA","COFFEE","COTTON");
    record Listed(String providerSymbol,String displaySymbol,String name,String assetClass,String base,String quote,BigDecimal increment){}
    static List<Listed> instruments(String raw){
        try{var root=JSON.readTree(raw);var values=root==null?null:root.get("instruments");if(values==null||!values.isArray()||values.size()>20000)throw invalid();var result=new ArrayList<Listed>();var ids=new HashSet<String>();
            for(var item:values){String symbol=text(item,"name",32),display=text(item,"displayName",160),type=text(item,"type",32);int precision=item.path("displayPrecision").asInt(-1);if(!symbol.matches("[A-Z0-9_]{3,31}")||precision<0||precision>12||!ids.add(symbol))throw invalid();
                String[] pair=symbol.split("_");String base=pair.length==2?pair[0]:symbol,quote=pair.length==2?pair[1]:"USD";String shown=symbol.equals("WTICO_USD")?"USOIL":pair.length==2?base+"/"+quote:symbol;
                String asset;if("CURRENCY".equals(type)&&pair.length==2)asset="FOREX";else if("CFD".equals(type)&&COMMODITIES.contains(base))asset="COMMODITY";else continue;
                result.add(new Listed(symbol,shown,display,asset,base,quote,BigDecimal.ONE.movePointLeft(precision)));
            }return result;
        }catch(OandaDataFailure failure){throw failure;}catch(Exception failure){throw invalid();}
    }
    static List<MarketDataProvider.Candle> candles(String raw,Instant from,Instant to){
        try{var root=JSON.readTree(raw);var values=root==null?null:root.get("candles");if(values==null||!values.isArray()||values.size()>5000)throw invalid();var result=new ArrayList<MarketDataProvider.Candle>();Instant previous=null;
            for(var item:values){if(!item.path("complete").asBoolean(false))continue;Instant time=Instant.parse(text(item,"time",64));var mid=item.get("mid");if(mid==null||!mid.isObject()||time.isBefore(from)||!time.isBefore(to)||previous!=null&&!time.isAfter(previous))throw invalid();
                var candle=new MarketDataProvider.Candle(time,decimal(mid,"o",false),decimal(mid,"h",false),decimal(mid,"l",false),decimal(mid,"c",false),decimal(item,"volume",true));result.add(candle);previous=time;
            }return result;
        }catch(OandaDataFailure failure){throw failure;}catch(Exception failure){throw invalid();}
    }
    private static String text(JsonNode node,String field,int max){var value=node.get(field);if(value==null||!value.isTextual()||value.asText().isBlank()||value.asText().length()>max)throw invalid();return value.asText();}
    private static BigDecimal decimal(JsonNode node,String field,boolean zero){var value=node.get(field);if(value==null||!value.isValueNode())throw invalid();String raw=value.asText();if(!raw.matches("(?:0|[1-9][0-9]{0,14})(?:\\.[0-9]{1,12})?"))throw invalid();var result=new BigDecimal(raw);if(zero?result.signum()<0:result.signum()<=0)throw invalid();return result;}
    private static OandaDataFailure invalid(){return new OandaDataFailure("OANDA_INVALID_RESPONSE",502);}
}
