package com.aitrading.market;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;

public interface InstrumentCatalogProvider {
    record Descriptor(String providerId,List<String> assetClasses,int priority,boolean available,
            boolean requiresApiKey,String refreshPolicy) {
        public Descriptor {
            if(providerId==null||!providerId.matches("[A-Z][A-Z0-9_]{1,31}")||assetClasses==null
                    ||priority<0||priority>1000||refreshPolicy==null||refreshPolicy.length()>80)
                throw new IllegalArgumentException("Invalid catalog provider descriptor");
            assetClasses=List.copyOf(assetClasses);
        }
    }

    record Candidate(String canonicalKey,String assetClass,String canonicalSymbol,String displaySymbol,
            String providerSymbol,String name,String exchange,String micCode,String country,String countryCode,
            String currency,String baseCurrency,String quoteCurrency,String instrumentType,String isin,String figi,
            String provider,int priority,List<String> supportedModes,List<String> supportedTimeframes,
            String timezone,BigDecimal priceIncrement,List<String> aliases) {
        public Candidate {
            assetClass=normalizeAssetClass(assetClass);
            canonicalKey=required(canonicalKey,240);
            canonicalSymbol=required(canonicalSymbol,64).toUpperCase(Locale.ROOT);
            displaySymbol=required(displaySymbol,80);
            providerSymbol=required(providerSymbol,64);
            name=required(name,200);
            exchange=optional(exchange,80);
            micCode=code(micCode,12);
            country=optional(country,80);
            countryCode=code(countryCode,2);
            currency=code(currency,12);
            baseCurrency=code(baseCurrency,12);
            quoteCurrency=code(quoteCurrency,12);
            instrumentType=optional(instrumentType,40);
            isin=code(isin,16);
            figi=code(figi,20);
            provider=required(provider,32).toUpperCase(Locale.ROOT);
            if(!provider.matches("[A-Z][A-Z0-9_]{1,31}")||priority<0||priority>1000)
                throw new IllegalArgumentException("Invalid catalog candidate");
            supportedModes=list(supportedModes,16,24);
            supportedTimeframes=list(supportedTimeframes,16,12);
            timezone=optional(timezone,64);
            if(priceIncrement!=null&&(priceIncrement.signum()<=0||priceIncrement.scale()>12||priceIncrement.precision()>28))
                throw new IllegalArgumentException("Invalid catalog increment");
            var allAliases=new LinkedHashSet<String>();
            if(aliases!=null)for(String alias:aliases)allAliases.add(required(alias,160));
            allAliases.add(displaySymbol);allAliases.add(canonicalSymbol);allAliases.add(providerSymbol);
            if(baseCurrency!=null&&quoteCurrency!=null){allAliases.add(baseCurrency+quoteCurrency);allAliases.add(baseCurrency+"/"+quoteCurrency);}
            aliases=allAliases.stream().filter(alias->!normalizeAlias(alias).isEmpty()).toList();
        }
        public UUID id(){return UUID.nameUUIDFromBytes(("instrument:"+canonicalKey).getBytes(StandardCharsets.UTF_8));}
    }

    List<Descriptor> descriptors();
    List<Candidate> fetch(String providerId);

    static String normalizeAssetClass(String value){return switch(value==null?"":value){case "US_EQUITY"->"STOCK";case "FX_REFERENCE"->"FOREX";case "CRYPTO","STOCK","ETF","FOREX","COMMODITY","FUTURES","CFD"->value;default->throw new IllegalArgumentException("Invalid asset class");};}
    static String normalizeExchange(String value){String exchange=value==null?"":value.strip().toUpperCase(Locale.ROOT);return switch(exchange){case "ARCA","NYSEARCA"->"NYSE ARCA";case "NASDAQ GLOBAL SELECT","NASDAQGS"->"NASDAQ";default->exchange;};}
    static String listingKey(String assetClass,String exchange,String symbol){return "LISTING:"+normalizeAssetClass(assetClass)+":"+normalizeExchange(exchange)+":"+symbol.toUpperCase(Locale.ROOT);}
    static String pairKey(String assetClass,String base,String quote,String kind){return "PAIR:"+normalizeAssetClass(assetClass)+":"+base.toUpperCase(Locale.ROOT)+":"+quote.toUpperCase(Locale.ROOT)+":"+kind.toUpperCase(Locale.ROOT);}
    static String normalizeAlias(String value){return value==null?"":value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]","");}
    private static String required(String value,int max){if(value==null||value.isBlank()||value.length()>max||value.chars().anyMatch(Character::isISOControl))throw new IllegalArgumentException("Invalid catalog text");return value.strip();}
    private static String optional(String value,int max){if(value==null||value.isBlank())return null;return required(value,max);}
    private static String code(String value,int max){String clean=optional(value,max);if(clean!=null&&!clean.matches("[A-Za-z0-9._-]+"))throw new IllegalArgumentException("Invalid catalog code");return clean==null?null:clean.toUpperCase(Locale.ROOT);}
    private static List<String> list(List<String> values,int maxItems,int maxLength){if(values==null||values.size()>maxItems)throw new IllegalArgumentException("Invalid catalog list");return values.stream().map(value->required(value,maxLength)).distinct().toList();}
}
