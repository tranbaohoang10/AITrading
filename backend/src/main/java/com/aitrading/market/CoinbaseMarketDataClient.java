package com.aitrading.market;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class CoinbaseMarketDataClient {
    private static final URI BASE=URI.create("https://api.exchange.coinbase.com");
    private static final Set<Integer> STEPS=Set.of(60,300,900,3600,86400);
    private static final int MAX_RESPONSE_BYTES=4_000_000;
    private static final long MAX_EPOCH_MS=32_503_680_000_000L;
    private final URI base;
    private final HttpClient http;
    public CoinbaseMarketDataClient() { this(BASE,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build()); }
    CoinbaseMarketDataClient(URI base,HttpClient http) { this.base=base; this.http=http; }

    public String products() { return request(base.resolve("/products")); }
    public String series(String symbol,int step,Long from,Long to) {
        if(symbol==null||!symbol.matches("[A-Z][A-Z0-9]{0,14}-USD")||!STEPS.contains(step))throw new IllegalArgumentException("Invalid Coinbase series request");
        if((from==null)!=(to==null)||from!=null&&(from<0||to<=from||to>MAX_EPOCH_MS||to-from>(long)step*300_000))throw new IllegalArgumentException("Invalid Coinbase series range");
        StringBuilder path=new StringBuilder("/products/").append(URLEncoder.encode(symbol,StandardCharsets.UTF_8)).append("/candles?granularity=").append(step);
        if(from!=null)path.append("&start=").append(URLEncoder.encode(java.time.Instant.ofEpochMilli(from).toString(),StandardCharsets.UTF_8)).append("&end=").append(URLEncoder.encode(java.time.Instant.ofEpochMilli(to).toString(),StandardCharsets.UTF_8));
        return request(base.resolve(path.toString()));
    }
    private String request(URI uri) {
        try {
            HttpRequest request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8)).header("Accept","application/json").GET().build();
            HttpResponse<String> response=http.send(request,HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if(response.statusCode()==429)throw new CoinbaseDataFailure("COINBASE_RATE_LIMIT",429);
            if(response.statusCode()<200||response.statusCode()>299)throw new CoinbaseDataFailure("COINBASE_PROVIDER_UNAVAILABLE",502);
            String body=response.body();
            if(body==null||body.getBytes(StandardCharsets.UTF_8).length>MAX_RESPONSE_BYTES)throw new CoinbaseDataFailure("COINBASE_INVALID_RESPONSE",502);
            var root=JsonMapper.builder().build().readTree(body);
            if(root==null||!root.isArray()||root.size()>10_000)throw new CoinbaseDataFailure("COINBASE_INVALID_RESPONSE",502);
            return body;
        } catch(CoinbaseDataFailure failure) { throw failure; }
        catch(Exception failure) { throw new CoinbaseDataFailure("COINBASE_PROVIDER_UNAVAILABLE",502); }
    }
}
