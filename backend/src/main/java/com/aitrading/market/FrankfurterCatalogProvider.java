package com.aitrading.market;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class FrankfurterCatalogProvider implements InstrumentCatalogProvider {
    static final URI SOURCE=URI.create("https://api.frankfurter.dev/v2/currencies");
    private static final Set<String> QUOTES=Set.of("USD","EUR","GBP","JPY"),METALS=Set.of("XAU","XAG","XPT","XPD");
    private final URI source;private final HttpClient http;
    @Autowired
    public FrankfurterCatalogProvider(){this(SOURCE,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());}
    FrankfurterCatalogProvider(URI source,HttpClient http){this.source=source;this.http=http;}
    public List<Descriptor> descriptors(){return List.of(new Descriptor("FRANKFURTER_REFERENCE",List.of("FOREX","COMMODITY"),40,true,false,"24h"));}
    public List<Candidate> fetch(String providerId){if(!"FRANKFURTER_REFERENCE".equals(providerId))throw new IllegalArgumentException("Unsupported catalog provider");try{var pending=http.sendAsync(HttpRequest.newBuilder(source).timeout(Duration.ofSeconds(15)).header("Accept","application/json").GET().build(),info->new BoundedBodySubscriber(1_000_000));var response=pending.get(20,TimeUnit.SECONDS);if(response.statusCode()==429)throw new CatalogProviderFailure("CATALOG_RATE_LIMIT",true);if(response.statusCode()!=200)throw new CatalogProviderFailure("CATALOG_PROVIDER_UNAVAILABLE",response.statusCode()>=500);return parse(new String(response.body(),StandardCharsets.UTF_8),LocalDate.now(ZoneOffset.UTC));}catch(CatalogProviderFailure failure){throw failure;}catch(Exception failure){throw new CatalogProviderFailure("CATALOG_PROVIDER_UNAVAILABLE",true);}}
    static List<Candidate> parse(String raw,LocalDate today){try{var root=JsonMapper.builder().build().readTree(raw);if(root==null||!root.isArray()||root.size()>500)throw new IllegalArgumentException();var names=new TreeMap<String,String>();LocalDate freshnessCutoff=today.minusDays(7);for(var item:root){String code=item.path("iso_code").asString(),name=item.path("name").asString(),end=item.path("end_date").asString();if(code.matches("[A-Z]{3}")&&!name.isBlank()&&name.length()<=120&&!LocalDate.parse(end).isBefore(freshnessCutoff))names.put(code,name);}if(names.size()<50)throw new IllegalArgumentException();var result=new ArrayList<Candidate>();for(var entry:names.entrySet())for(String quote:QUOTES){String base=entry.getKey();if(base.equals(quote)||!names.containsKey(quote))continue;boolean metal=METALS.contains(base);if(!metal&&METALS.contains(quote))continue;String asset=metal?"COMMODITY":"FOREX",symbol=base+"-"+quote,name=entry.getValue()+" / "+names.get(quote);result.add(new Candidate(InstrumentCatalogProvider.pairKey(asset,base,quote,"SPOT"),asset,symbol,symbol.replace('-','/'),symbol,name,metal?"Frankfurter metals reference":"Frankfurter currency reference",null,null,null,quote,base,quote,metal?"Spot metal reference":"Currency pair reference",null,null,"FRANKFURTER_REFERENCE",40,List.of(),List.of(),"UTC",null,List.of(base+quote)));}if(result.size()<100)throw new IllegalArgumentException();return List.copyOf(result);}catch(RuntimeException malformed){throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);}}
}
