package com.aitrading.market;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class FreeTickerDatabaseCatalogProvider implements InstrumentCatalogProvider {
    static final URI SOURCE=URI.create("https://raw.githubusercontent.com/adanos-software/free-ticker-database/main/data/core_listings.csv");
    private static final int MAX_BYTES=12_000_000,MAX_ROWS=75000;
    private final URI source;private final HttpClient http;
    @Autowired
    public FreeTickerDatabaseCatalogProvider(){this(SOURCE,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());}
    FreeTickerDatabaseCatalogProvider(URI source,HttpClient http){this.source=source;this.http=http;}
    public List<Descriptor> descriptors(){return List.of(new Descriptor("FREE_TICKER_DB",List.of("STOCK","ETF"),30,true,false,"24h"));}
    public List<Candidate> fetch(String providerId){if(!"FREE_TICKER_DB".equals(providerId))throw new IllegalArgumentException("Unsupported catalog provider");try{var request=HttpRequest.newBuilder(source).timeout(Duration.ofSeconds(30)).header("Accept","text/csv").GET().build();var pending=http.sendAsync(request,info->new BoundedBodySubscriber(MAX_BYTES));var response=pending.get(35,TimeUnit.SECONDS);if(response.statusCode()==429)throw new CatalogProviderFailure("CATALOG_RATE_LIMIT",true);if(response.statusCode()!=200)throw new CatalogProviderFailure("CATALOG_PROVIDER_UNAVAILABLE",response.statusCode()>=500);return parse(new String(response.body(),StandardCharsets.UTF_8));}catch(CatalogProviderFailure failure){throw failure;}catch(Exception failure){throw new CatalogProviderFailure("CATALOG_PROVIDER_UNAVAILABLE",true);}}
    static List<Candidate> parse(String csv){if(csv==null||csv.length()>MAX_BYTES)throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);String[] lines=csv.split("\r?\n");if(lines.length<2||lines.length>MAX_ROWS+1)throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);List<String> header=line(lines[0]);List<String> expected=List.of("listing_key","ticker","exchange","name","asset_type","stock_sector","etf_category","country","country_code","isin","aliases","instrument_group_key","scope_reason");if(!header.equals(expected))throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);var result=new ArrayList<Candidate>();var routes=new HashSet<String>();int invalid=0;for(int index=1;index<lines.length;index++){if(lines[index].isBlank())continue;try{List<String> values=line(lines[index]);if(values.size()!=header.size())throw new IllegalArgumentException();String type=values.get(4),asset="Stock".equals(type)?"STOCK":"ETF".equals(type)?"ETF":null;if(asset==null)continue;String ticker=values.get(1).strip().toUpperCase(Locale.ROOT),exchange=values.get(2).strip(),name=values.get(3).strip(),isin=blank(values.get(9));if(ticker.isEmpty()||ticker.length()>64||exchange.isEmpty()||name.isEmpty())throw new IllegalArgumentException();if(!routes.add(InstrumentCatalogProvider.normalizeExchange(exchange)+":"+ticker))throw new IllegalArgumentException();String identity=isin==null?InstrumentCatalogProvider.listingKey(asset,exchange,ticker):"IDENTIFIER:"+asset+":ISIN:"+isin+":EXCHANGE:"+InstrumentCatalogProvider.normalizeExchange(exchange);List<String> aliases=values.get(10).isBlank()?List.of():Arrays.stream(values.get(10).split("[|;]")).map(String::strip).filter(value->!value.isEmpty()).limit(12).toList();result.add(new Candidate(identity,asset,ticker,ticker,ticker,name,exchange,null,blank(values.get(7)),blank(values.get(8)),null,null,null,type,isin,null,"FREE_TICKER_DB",30,List.of(),List.of(),null,null,aliases));}catch(RuntimeException malformed){invalid++;if(invalid>1000)throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);}}if(result.size()<100)throw new CatalogProviderFailure("CATALOG_INVALID_RESPONSE",false);return List.copyOf(result);}
    static List<String> line(String value){var fields=new ArrayList<String>();var field=new StringBuilder();boolean quoted=false;for(int index=0;index<value.length();index++){char current=value.charAt(index);if(current=='"'){if(quoted&&index+1<value.length()&&value.charAt(index+1)=='"'){field.append('"');index++;}else quoted=!quoted;}else if(current==','&&!quoted){fields.add(field.toString());field.setLength(0);}else field.append(current);}if(quoted)throw new IllegalArgumentException("Invalid CSV");fields.add(field.toString());return fields;}
    private static String blank(String value){return value==null||value.isBlank()?null:value.strip();}
}
