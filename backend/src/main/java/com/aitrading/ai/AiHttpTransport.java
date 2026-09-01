package com.aitrading.ai;

import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;

/** Fixed bounds, no redirect or automatic application retry, no raw provider errors. */
final class AiHttpTransport implements AutoCloseable {
    private static final Semaphore ACTIVE=new Semaphore(4);
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    byte[] send(HttpRequest request,Duration timeout) {
        if(!ACTIVE.tryAcquire())throw new AiFailure(AiFailure.Code.AI_BUSY);
        try{return exchange(request,timeout);}finally{ACTIVE.release();}
    }
    private byte[] exchange(HttpRequest request,Duration timeout) {
        CompletableFuture<HttpResponse<byte[]>> pending;
        try{pending=client.sendAsync(request,ignored->new BoundedBodySubscriber(AiProviderProtocol.MAX_RESPONSE));}
        catch(RuntimeException failure){throw new AiFailure(AiFailure.Code.AI_PROVIDER_UNAVAILABLE);}
        try {
            var response=pending.get(timeout.toMillis(),TimeUnit.MILLISECONDS);
            int status=response.statusCode();
            if(status==401 || status==403)throw new AiFailure(AiFailure.Code.AI_PROVIDER_AUTH);
            if(status==429)throw new AiFailure(AiFailure.Code.AI_RATE_LIMITED);
            if(status==408 || status==504)throw new AiFailure(AiFailure.Code.AI_TIMEOUT);
            if(status>=500)throw new AiFailure(AiFailure.Code.AI_PROVIDER_UNAVAILABLE);
            if(status!=200)throw new AiFailure(AiFailure.Code.AI_PROVIDER_REJECTED);
            String type=response.headers().firstValue("Content-Type").orElse("").split(";",2)[0].strip();
            if(!type.equalsIgnoreCase("application/json"))throw new AiFailure(AiFailure.Code.AI_INVALID_RESPONSE);
            return response.body();
        }catch(TimeoutException expired){
            pending.cancel(true);throw new AiFailure(AiFailure.Code.AI_TIMEOUT);
        }catch(InterruptedException interrupted){
            pending.cancel(true);Thread.currentThread().interrupt();throw new AiFailure(AiFailure.Code.AI_CANCELLED);
        }catch(ExecutionException failed){
            Throwable cause=failed.getCause();
            for(int i=0;cause!=null&&i<8;i++,cause=cause.getCause()) {
                if(cause instanceof AiFailure safe)throw safe;
                if(cause instanceof HttpTimeoutException)throw new AiFailure(AiFailure.Code.AI_TIMEOUT);
            }
            throw new AiFailure(AiFailure.Code.AI_PROVIDER_UNAVAILABLE);
        }
    }
    @Override public void close(){client.shutdownNow();}
}
