package com.aitrading.market;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class TwelveDataCatalogProvider implements InstrumentCatalogProvider {
    private static final URI BASE=URI.create("https://api.twelvedata.com");
    private final String apiKey;private final HttpClient http;
    @Autowired
    public TwelveDataCatalogProvider(@Value("${aitrading.market.twelve-data.api-key:}")String apiKey){this(apiKey,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());}
    TwelveDataCatalogProvider(String apiKey,HttpClient http){this.apiKey=apiKey==null?"":apiKey.strip();this.http=http;}
    public List<Descriptor> descriptors(){return List.of(new Descriptor("TWELVE_DATA",List.of("STOCK","ETF","FOREX","COMMODITY"),10,!apiKey.isEmpty()&&apiKey.length()<=512,true,"24h"));}
    public List<Candidate> fetch(String providerId){if(!"TWELVE_DATA".equals(providerId)||apiKey.isEmpty())throw new IllegalArgumentException("Unsupported catalog provider");var result=new ArrayList<Candidate>();result.addAll(fetch("/stocks","STOCK"));result.addAll(fetch("/etfs","ETF"));result.addAll(fetch("/forex_pairs","FOREX"));result.addAll(fetch("/commodities","COMMODITY"));if(result.isEmpty())throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);return result.stream().distinct().limit(100000).toList();}
    private List<Candidate> fetch(String path,String assetClass){try{URI uri=BASE.resolve(path);var request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20)).header("Accept","application/json").header("Authorization","apikey "+apiKey).GET().build();var pending=http.sendAsync(request,info->new BoundedBodySubscriber(8_000_000));var response=pending.get(25,TimeUnit.SECONDS);if(response.statusCode()==401||response.statusCode()==403)throw new CatalogProviderFailure("CATALOG_AUTH_FAILED",false);if(response.statusCode()==429)throw new CatalogProviderFailure("CATALOG_RATE_LIMIT",true);if(response.statusCode()!=200)throw new CatalogProviderFailure("CATALOG_PROVIDER_UNAVAILABLE",response.statusCode()>=500);return parse(new String(response.body(),StandardCharsets.UTF_8),assetClass);}catch(CatalogProviderFailure failure){throw failure;}catch(Exception failure){throw new CatalogProviderFailure("CATALOG_PROVIDER_UNAVAILABLE",true);}}
    static List<Candidate> parse(String raw,String assetClass){try{JsonNode root=JsonMapper.builder().build().readTree(raw);JsonNode data=root;if(root!=null&&root.isObject()){data=root.get("data");if(data==null)data=root.get("result");if(data!=null&&data.isObject())data=data.get("list");}if(data==null||!data.isArray()||data.size()>100000)throw new IllegalArgumentException();var result=new ArrayList<Candidate>();for(JsonNode item:data){String symbol=text(item,"symbol"),name=first(item,"name","currency_group","description"),exchange=first(item,"exchange","mic_code","country"),mic=text(item,"mic_code"),country=text(item,"country"),currency=text(item,"currency");String base=first(item,"currency_base","base_currency"),quote=first(item,"currency_quote","quote_currency");if((base==null||quote==null)&&symbol!=null&&symbol.contains("/")){String[] pair=symbol.split("/");if(pair.length==2){base=pair[0];quote=pair[1];}}if(symbol==null||name==null)continue;String normalized=assetClass.equals("FOREX")||assetClass.equals("COMMODITY")?symbol.replace('/','-'):symbol;String key=base!=null&&quote!=null?InstrumentCatalogProvider.pairKey(assetClass,base,quote,"SPOT"):InstrumentCatalogProvider.listingKey(assetClass,exchange,normalized);result.add(new Candidate(key,assetClass,normalized,normalized.replace('-','/'),symbol,name,exchange,mic,country,null,currency,base,quote,assetClass,null,null,"TWELVE_DATA",10,List.of(),List.of(),null,null,List.of(symbol.replaceAll("[^A-Za-z0-9]",""))));}return List.copyOf(result);}catch(RuntimeException malformed){throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);}}
    private static String first(JsonNode item,String...fields){for(String field:fields){String value=text(item,field);if(value!=null)return value;}return null;}
    private static String text(JsonNode item,String field){JsonNode value=item.get(field);return value!=null&&value.isTextual()&&!value.asString().isBlank()?value.asString().strip():null;}
}
