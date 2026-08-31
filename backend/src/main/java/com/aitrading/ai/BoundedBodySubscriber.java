package com.aitrading.ai;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

/** Cancels transport before copying bytes beyond the fixed response allowance. */
final class BoundedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final int maximum;
    private final ByteArrayOutputStream bytes=new ByteArrayOutputStream();
    private final CompletableFuture<byte[]> body=new CompletableFuture<>();
    private Flow.Subscription subscription;
    BoundedBodySubscriber(int maximum) { this.maximum=maximum; }
    @Override public CompletionStage<byte[]> getBody() { return body; }
    @Override public void onSubscribe(Flow.Subscription incoming) {
        if(subscription!=null){incoming.cancel();return;}
        subscription=incoming; incoming.request(1);
    }
    @Override public void onNext(List<ByteBuffer> buffers) {
        if(body.isDone())return;
        long incoming=buffers.stream().mapToLong(ByteBuffer::remaining).sum();
        if(incoming>maximum-bytes.size()) {
            subscription.cancel(); body.completeExceptionally(new AiFailure(AiFailure.Code.AI_RESPONSE_LIMIT)); return;
        }
        for(ByteBuffer buffer:buffers) {
            byte[] chunk=new byte[buffer.remaining()]; buffer.get(chunk); bytes.writeBytes(chunk);
        }
        subscription.request(1);
    }
    @Override public void onError(Throwable error) { body.completeExceptionally(error); }
    @Override public void onComplete() { body.complete(bytes.toByteArray()); }
}
