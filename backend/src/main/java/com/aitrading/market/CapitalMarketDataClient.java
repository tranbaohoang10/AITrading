package com.aitrading.market;

import java.math.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public final class CapitalMarketDataClient implements MarketDataProvider,HistoricalAvailabilityProvider,HistoricalSourceTimeframeProvider {
    static final Instant VERIFIED_FROM=Instant.parse("2024-01-03T00:00:00Z");
    static final List<String> TIMEFRAMES=List.of("1m","5m","15m","30m","1h","4h","1d");
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private static final DateTimeFormatter CAPITAL_TIME=DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss").withZone(ZoneOffset.UTC);
    private static final Map<String,Spec> SPECS=specs();
    private final HttpClient http;private final String apiKey,identifier,password,environment;private volatile Session session;

    record Spec(String canonical,String display,String epic,String asset,String base,String quote,String name) {}
    static final class Session {
        private final String cst,securityToken;private final Instant expiresAt;
        Session(String cst,String securityToken,Instant expiresAt){this.cst=cst;this.securityToken=securityToken;this.expiresAt=expiresAt;}
        String cst(){return cst;}String securityToken(){return securityToken;}boolean active(){return expiresAt.isAfter(Instant.now().plusSeconds(30));}
        public String toString(){return "CapitalSession[redacted]";}
    }

    @Autowired
    public CapitalMarketDataClient(@Value("${aitrading.market.capital.api-key:}")String apiKey,
            @Value("${aitrading.market.capital.identifier:}")String identifier,
            @Value("${aitrading.market.capital.password:}")String password,
            @Value("${aitrading.market.capital.environment:demo}")String environment){
        this(apiKey,identifier,password,environment,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());
    }
    CapitalMarketDataClient(String apiKey,String identifier,String password,String environment,HttpClient http){this.apiKey=clean(apiKey,256);this.identifier=clean(identifier,256);this.password=clean(password,512);this.environment=environment==null?"demo":environment.strip().toLowerCase(Locale.ROOT);this.http=http;}
    public boolean configured(){return !apiKey.isEmpty()&&!identifier.isEmpty()&&!password.isEmpty()&&Set.of("demo","live").contains(environment);}
    URI streamingUri(){return URI.create("wss://api-streaming-capital.backend-capital.com/connect");}
    synchronized Session session(){requireConfigured();if(session!=null&&session.active())return session;session=authenticate();return session;}
    synchronized void invalidate(Session value){if(session==value)session=null;}

    public Capabilities capabilities(){return new Capabilities("CAPITAL","Capital.com · "+environment.toUpperCase(Locale.ROOT),List.of("FOREX","COMMODITY"),TIMEFRAMES,true,true,false,false,false,false,true,true,true,true,true,"CONDITIONAL","REST_BOUNDED",1000,"UTC",configured(),List.of("Capital.com CFD instruments; not spot, ETF or futures","Historical M1 verified from 2024-01-03; older archive is not asserted","MID price basis derived from provider bid and ask","Volume is provider last-traded volume, not centralized exchange volume"));}
    public List<Instrument> search(String query){if(query==null||query.length()>64)throw new IllegalArgumentException("Invalid search");String normalized=normalize(query);return SPECS.values().stream().distinct().filter(spec->normalized.isEmpty()||normalize(spec.canonical()+spec.display()+spec.epic()+spec.name()).contains(normalized)).map(this::instrument).toList();}
    public Instrument instrument(String symbol){return instrument(spec(symbol));}
    private Instrument instrument(Spec spec){return new Instrument("CAPITAL:"+spec.epic(),spec.display(),spec.epic(),"CAPITAL",spec.asset(),spec.base(),spec.quote(),"Capital.com",spec.quote(),"CFD","UTC",null,null,null,null,null,"PROVIDER_CONTRACT",null,null,null,"RESEARCH_ONLY",List.of("HISTORICAL","REALTIME"),TIMEFRAMES,"VERIFIED_FROM_2024_01_03",spec.name());}
    public Instant historicalAvailableFrom(String symbol){spec(symbol);return VERIFIED_FROM;}
    public String historicalSourceTimeframe(){return "1m";}

    public List<Candle> history(String symbol,String timeframe,Instant from,Instant to){
        Spec spec=spec(symbol);MarketDataProvider.range(timeframe,from,to);if(!"1m".equals(timeframe))throw new IllegalArgumentException("Capital source timeframe is M1");
        Instant effective=from.isBefore(VERIFIED_FROM)?VERIFIED_FROM:from;if(!to.isAfter(effective))return List.of();var rows=new TreeMap<Instant,Candle>();Instant cursor=effective;
        for(int page=0;cursor.isBefore(to)&&page<32;page++){Instant end=min(to,cursor.plusSeconds(999L*60));for(var candle:prices(spec.epic(),cursor,end)){if(candle.time().isBefore(effective)||!candle.time().isBefore(to))continue;var previous=rows.putIfAbsent(candle.time(),candle);if(previous!=null&&!previous.equals(candle)||rows.size()>20_000)throw failure("CAPITAL_INVALID_RESPONSE",502);}cursor=end;}
        if(cursor.isBefore(to))throw failure("CAPITAL_HISTORY_LIMIT",502);return List.copyOf(rows.values());
    }
    List<Candle> prices(String epic,Instant from,Instant to){String query="resolution=MINUTE&max=1000&from="+encode(CAPITAL_TIME.format(from))+"&to="+encode(CAPITAL_TIME.format(to));String raw;try{raw=request("/api/v1/prices/"+epic+"?"+query,true);}catch(CapitalDataFailure unavailable){if(unavailable.status()==404&&unavailable.code().equals("CAPITAL_HISTORY_UNAVAILABLE"))return List.of();throw unavailable;}try{JsonNode root=JSON.readTree(raw),values=root==null?null:root.get("prices");if(values==null||!values.isArray()||values.size()>1000)throw failure("CAPITAL_INVALID_RESPONSE",502);var result=new ArrayList<Candle>();Instant previous=null;for(var value:values){Instant time=time(value.get("snapshotTimeUTC"));if(previous!=null&&!time.isAfter(previous))throw failure("CAPITAL_INVALID_RESPONSE",502);previous=time;result.add(new Candle(time,mid(value.get("openPrice")),mid(value.get("highPrice")),mid(value.get("lowPrice")),mid(value.get("closePrice")),decimal(value.get("lastTradedVolume"),true)));}return List.copyOf(result);}catch(CapitalDataFailure failure){throw failure;}catch(Exception invalid){throw failure("CAPITAL_INVALID_RESPONSE",502);}}
    static BigDecimal mid(JsonNode value){if(value==null||!value.isObject())throw failure("CAPITAL_INVALID_RESPONSE",502);return decimal(value.get("bid"),false).add(decimal(value.get("ask"),false)).divide(BigDecimal.valueOf(2),12,RoundingMode.HALF_EVEN).stripTrailingZeros();}
    static Spec spec(String symbol){if(symbol==null||symbol.length()>80)throw new IllegalArgumentException("Invalid Capital instrument");Spec result=SPECS.get(normalize(symbol));if(result==null)throw new IllegalArgumentException("Unsupported Capital instrument");return result;}

    private Session authenticate(){String body=JSON.writeValueAsString(Map.of("identifier",identifier,"password",password,"encryptedPassword",false));var request=HttpRequest.newBuilder(rest("/api/v1/session")).timeout(Duration.ofSeconds(15)).header("X-CAP-API-KEY",apiKey).header("Accept","application/json").header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body,StandardCharsets.UTF_8)).build();try{var response=send(request,64_000);if(response.statusCode()!=200)throw status(response.statusCode(),response.body());String cst=header(response,"CST"),token=header(response,"X-SECURITY-TOKEN");if(cst.length()>2048||token.length()>4096)throw failure("CAPITAL_INVALID_RESPONSE",502);return new Session(cst,token,Instant.now().plus(Duration.ofMinutes(8)));}catch(CapitalDataFailure failure){throw failure;}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw failure("CAPITAL_INTERRUPTED",503);}catch(Exception unavailable){throw failure("CAPITAL_AUTH_UNAVAILABLE",502);}}
    private String request(String path,boolean retry){Session current=session();var request=HttpRequest.newBuilder(rest(path)).timeout(Duration.ofSeconds(20)).header("X-CAP-API-KEY",apiKey).header("CST",current.cst()).header("X-SECURITY-TOKEN",current.securityToken()).header("Accept","application/json").GET().build();try{var response=send(request,8_000_000);if(response.statusCode()==200)return new String(response.body(),StandardCharsets.UTF_8);if(retry&&(response.statusCode()==401||response.statusCode()==403||contains(response.body(),"error.invalid.session.token"))){invalidate(current);return request(path,false);}throw status(response.statusCode(),response.body());}catch(CapitalDataFailure failure){throw failure;}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw failure("CAPITAL_INTERRUPTED",503);}catch(Exception unavailable){throw failure("CAPITAL_HISTORY_UNAVAILABLE",502);}}
    private HttpResponse<byte[]> send(HttpRequest request,int maximum)throws Exception{return http.send(request,response->new BoundedBodySubscriber(maximum));}
    private URI rest(String path){return URI.create((environment.equals("live")?"https://api-capital.backend-capital.com":"https://demo-api-capital.backend-capital.com")+path);}
    private void requireConfigured(){if(!configured())throw failure("CAPITAL_NOT_CONFIGURED",503);}
    private static String header(HttpResponse<?> response,String name){return response.headers().firstValue(name).filter(value->!value.isBlank()).orElseThrow(()->failure("CAPITAL_INVALID_RESPONSE",502));}
    private static CapitalDataFailure status(int status,byte[] body){if(status==401||status==403)return failure("CAPITAL_AUTH_REJECTED",401);if(status==429)return failure("CAPITAL_RATE_LIMIT",429);if(status==404)return failure("CAPITAL_HISTORY_UNAVAILABLE",404);return failure("CAPITAL_PROVIDER_UNAVAILABLE",502);}
    private static boolean contains(byte[] raw,String value){return raw!=null&&raw.length<64_000&&new String(raw,StandardCharsets.UTF_8).contains(value);}
    private static Instant time(JsonNode value){if(value==null||!value.isString()||value.asString().length()>64)throw failure("CAPITAL_INVALID_RESPONSE",502);String text=value.asString();try{return text.endsWith("Z")?Instant.parse(text):LocalDateTime.parse(text).toInstant(ZoneOffset.UTC);}catch(Exception invalid){throw failure("CAPITAL_INVALID_RESPONSE",502);}}
    private static BigDecimal decimal(JsonNode value,boolean zero){if(value==null||value.isNull())return zero?BigDecimal.ZERO:invalidDecimal();if(!value.isNumber()&&!value.isString())return invalidDecimal();String text=value.asString();if(!text.matches("(?:0|[1-9][0-9]{0,18})(?:\\.[0-9]{1,12})?"))return invalidDecimal();BigDecimal number=new BigDecimal(text);if(number.scale()>12||number.precision()>28||number.signum()<0||!zero&&number.signum()==0)return invalidDecimal();return number.stripTrailingZeros();}
    private static BigDecimal invalidDecimal(){throw failure("CAPITAL_INVALID_RESPONSE",502);}
    private static CapitalDataFailure failure(String code,int status){return new CapitalDataFailure(code,status);}
    private static String clean(String value,int maximum){if(value==null)return "";String result=value.strip();return result.length()<=maximum?result:"";}
    private static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
    private static String normalize(String value){return value.strip().toUpperCase(Locale.ROOT).replace("CAPITAL:","").replace("/","").replace("-","").replace("_","").replace(" ","");}
    private static Instant min(Instant left,Instant right){return left.isBefore(right)?left:right;}
    private static Map<String,Spec> specs(){var rows=List.of(new Spec("EUR/USD","EUR/USD","EURUSD","FOREX","EUR","USD","Euro / US Dollar CFD"),new Spec("GBP/USD","GBP/USD","GBPUSD","FOREX","GBP","USD","British Pound / US Dollar CFD"),new Spec("USD/JPY","USD/JPY","USDJPY","FOREX","USD","JPY","US Dollar / Japanese Yen CFD"),new Spec("AUD/USD","AUD/USD","AUDUSD","FOREX","AUD","USD","Australian Dollar / US Dollar CFD"),new Spec("USD/CAD","USD/CAD","USDCAD","FOREX","USD","CAD","US Dollar / Canadian Dollar CFD"),new Spec("USD/CHF","USD/CHF","USDCHF","FOREX","USD","CHF","US Dollar / Swiss Franc CFD"),new Spec("NZD/USD","NZD/USD","NZDUSD","FOREX","NZD","USD","New Zealand Dollar / US Dollar CFD"),new Spec("XAU/USD","Gold","GOLD","COMMODITY","XAU","USD","Gold CFD"),new Spec("XAG/USD","Silver","SILVER","COMMODITY","XAG","USD","Silver CFD"),new Spec("XPT/USD","Platinum","PLATINUM","COMMODITY","XPT","USD","Platinum CFD"),new Spec("XPD/USD","Palladium","PALLADIUM","COMMODITY","XPD","USD","Palladium CFD"));var result=new LinkedHashMap<String,Spec>();for(var row:rows)for(var alias:List.of(row.canonical(),row.display(),row.epic(),"CAPITAL:"+row.epic(),row.name()))result.put(normalize(alias),row);return Map.copyOf(result);}
}
