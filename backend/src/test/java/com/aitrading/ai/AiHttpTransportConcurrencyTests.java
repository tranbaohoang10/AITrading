package com.aitrading.ai;

import static org.assertj.core.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;

class AiHttpTransportConcurrencyTests {
    @Test void oneSharedFourCallLimitCoversAllProviderOperations()throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var executor=Executors.newVirtualThreadPerTaskExecutor();server.setExecutor(executor);
        var entered=new CountDownLatch(4);var release=new CountDownLatch(1);
        server.createContext("/provider",exchange->{entered.countDown();try{release.await(5,TimeUnit.SECONDS);byte[] b="{}".getBytes();exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,b.length);exchange.getResponseBody().write(b);}catch(Exception ignored){}finally{exchange.close();}});server.start();
        List<AiHttpTransport> transports=new ArrayList<>();
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/provider")).POST(HttpRequest.BodyPublishers.noBody()).build();
            List<Future<byte[]>> results=new ArrayList<>();
            for(int i=0;i<5;i++){var transport=new AiHttpTransport();transports.add(transport);results.add(pool.submit(()->transport.send(request,Duration.ofSeconds(4))));}
            assertThat(entered.await(2,TimeUnit.SECONDS)).isTrue();
            long deadline=System.nanoTime()+Duration.ofSeconds(2).toNanos();
            while(results.stream().noneMatch(Future::isDone) && System.nanoTime()<deadline)Thread.onSpinWait();
            assertThat(results.stream().filter(Future::isDone).count()).isEqualTo(1);
            var early=results.stream().filter(Future::isDone).findFirst().orElseThrow();
            assertThatThrownBy(early::get).isInstanceOfSatisfying(ExecutionException.class,e->assertThat(e.getCause()).isInstanceOfSatisfying(AiFailure.class,f->assertThat(f.code()).isEqualTo(AiFailure.Code.AI_BUSY)));
            release.countDown();
            assertThat(results.stream().filter(f->f!=early).map(f->{try{return new String(f.get(3,TimeUnit.SECONDS));}catch(Exception e){throw new RuntimeException(e);}})).containsOnly("{}");
        }finally{release.countDown();transports.forEach(AiHttpTransport::close);server.stop(0);executor.shutdownNow();}
    }
}
