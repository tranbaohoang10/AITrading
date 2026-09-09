package com.aitrading.market;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class OandaMarketDataClient {
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final String token,account,environment;private volatile List<OandaMarketDataMapper.Listed> instruments;private volatile Instant instrumentsExpire=Instant.EPOCH;
    public OandaMarketDataClient(@Value("${aitrading.market.oanda.token:}")String token,@Value("${aitrading.market.oanda.account-id:}")String account,@Value("${aitrading.market.oanda.environment:practice}")String environment){this.token=clean(token,512);this.account=clean(account,128);this.environment=environment==null?"":environment.strip().toLowerCase(Locale.ROOT);}
    public boolean configured(){return !token.isEmpty()&&!account.isEmpty()&&Set.of("practice","live").contains(environment);}
    public List<OandaMarketDataMapper.Listed> instruments(){requireConfigured();var current=instruments;if(current!=null&&Instant.now().isBefore(instrumentsExpire))return current;var parsed=OandaMarketDataMapper.instruments(request(rest("/v3/accounts/"+encode(account)+"/instruments")));instruments=List.copyOf(parsed);instrumentsExpire=Instant.now().plus(Duration.ofMinutes(5));return instruments;}
    public List<MarketDataProvider.Candle> history(String symbol,String timeframe,Instant from,Instant to){requireConfigured();MarketDataProvider.range(timeframe,from,to);if(instruments().stream().noneMatch(item->item.providerSymbol().equals(symbol)))throw new IllegalArgumentException("Unsupported OANDA instrument");
        String granularity=switch(timeframe){case "1m"->"M1";case "5m"->"M5";case "15m"->"M15";case "30m"->"M30";case "1h"->"H1";case "4h"->"H4";case "1d"->"D";default->throw new IllegalArgumentException("Unsupported OANDA timeframe");};
        int seconds=MarketDataProvider.seconds(timeframe);var rows=new TreeMap<Instant,MarketDataProvider.Candle>();Instant cursor=from;
        for(int page=0;cursor.isBefore(to)&&page<25;page++){Instant end=cursor.plusSeconds((long)seconds*5000).isBefore(to)?cursor.plusSeconds((long)seconds*5000):to;String query="price=M&smooth=false&granularity="+granularity+"&from="+encode(cursor.toString())+"&to="+encode(end.toString());for(var candle:OandaMarketDataMapper.candles(request(rest("/v3/instruments/"+encode(symbol)+"/candles?"+query)),cursor,end)){var previous=rows.putIfAbsent(candle.time(),candle);if(previous!=null&&!previous.equals(candle))throw new OandaDataFailure("OANDA_INVALID_RESPONSE",502);}if(rows.size()>20000)throw new OandaDataFailure("OANDA_HISTORY_LIMIT",502);cursor=end;}
        if(cursor.isBefore(to))throw new OandaDataFailure("OANDA_HISTORY_LIMIT",502);return List.copyOf(rows.values());
    }
    URI pricing(String symbol){requireConfigured();if(instruments().stream().noneMatch(item->item.providerSymbol().equals(symbol)))throw new IllegalArgumentException("Unsupported OANDA instrument");return stream("/v3/accounts/"+encode(account)+"/pricing/stream?instruments="+encode(symbol)+"&snapshot=true");}
    HttpRequest streamRequest(String symbol){return HttpRequest.newBuilder(pricing(symbol)).timeout(Duration.ofHours(12)).header("Authorization","Bearer "+token).header("Accept-Datetime-Format","RFC3339").GET().build();}
    HttpClient http(){return http;}
    private URI rest(String path){return URI.create((environment.equals("live")?"https://api-fxtrade.oanda.com":"https://api-fxpractice.oanda.com")+path);}
    private URI stream(String path){return URI.create((environment.equals("live")?"https://stream-fxtrade.oanda.com":"https://stream-fxpractice.oanda.com")+path);}
    private String request(URI uri){try{var response=http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15)).header("Authorization","Bearer "+token).header("Accept-Datetime-Format","RFC3339").GET().build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));if(response.statusCode()==429)throw new OandaDataFailure("OANDA_RATE_LIMIT",429);if(response.statusCode()==401||response.statusCode()==403)throw new OandaDataFailure("OANDA_AUTH_FAILED",503);if(response.statusCode()<200||response.statusCode()>299||response.body().length()>8_000_000)throw new OandaDataFailure("OANDA_PROVIDER_UNAVAILABLE",502);return response.body();}catch(OandaDataFailure failure){throw failure;}catch(Exception failure){throw new OandaDataFailure("OANDA_PROVIDER_UNAVAILABLE",502);}}
    private void requireConfigured(){if(!configured())throw new OandaDataFailure("OANDA_UNCONFIGURED",503);}
    private static String clean(String value,int max){value=value==null?"":value.strip();return value.length()<=max?value:"";}
    private static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
}
