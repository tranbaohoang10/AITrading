package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Flow;
import org.junit.jupiter.api.Test;

class BoundedBodySubscriberTests {
    @Test void stalledBodyAfterHeadersCannotOutliveTheOverallDeadline() throws Exception {
        var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
        var received=new java.util.concurrent.CountDownLatch(1);
        var release=new java.util.concurrent.CountDownLatch(1);
        server.createContext("/archive",exchange->{
            try {
                exchange.sendResponseHeaders(200,0);
                exchange.getResponseBody().write(1);
                exchange.getResponseBody().flush();
                received.countDown();
                release.await(5,java.util.concurrent.TimeUnit.SECONDS);
            } catch(InterruptedException interrupted) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try(var client=java.net.http.HttpClient.newHttpClient()) {
            long start=System.nanoTime();
            var failure=assertThrows(Exception.class,()->BinanceArchiveProvider.fetch(client,
                    java.net.URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/archive"),1024,
                    start+java.time.Duration.ofSeconds(1).toNanos()));
            assertEquals(0,received.getCount(),"Headers and an initial body byte were received");
            Throwable cause=failure instanceof java.util.concurrent.ExecutionException ? failure.getCause() : failure;
            assertTrue(cause instanceof java.util.concurrent.TimeoutException || cause instanceof java.net.http.HttpTimeoutException);
            assertTrue(System.nanoTime()-start<java.time.Duration.ofSeconds(3).toNanos());
            release.countDown();
        } finally { release.countDown(); server.stop(0); }
    }
    @Test void acceptsExactLimitAcrossFragments() {
        var subscriber=new BoundedBodySubscriber(3);
        var subscription=mock(Flow.Subscription.class);
        subscriber.onSubscribe(subscription);
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[]{1})));
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[]{2,3})));
        assertFalse(subscriber.getBody().toCompletableFuture().isDone());
        subscriber.onComplete();
        assertArrayEquals(new byte[]{1,2,3},subscriber.getBody().toCompletableFuture().join());
        verify(subscription,never()).cancel();
    }
    @Test void oversizedFragmentCancelsBeforeAccumulationAndIgnoresLateSignals() {
        var subscriber=new BoundedBodySubscriber(3);
        var subscription=mock(Flow.Subscription.class);
        subscriber.onSubscribe(subscription);
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[]{1,2}),ByteBuffer.wrap(new byte[]{3,4})));
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[]{5})));
        subscriber.onComplete();
        verify(subscription,times(1)).cancel();
        var failure=assertThrows(CompletionException.class,()->subscriber.getBody().toCompletableFuture().join());
        assertInstanceOf(java.io.IOException.class,failure.getCause());
    }
}
