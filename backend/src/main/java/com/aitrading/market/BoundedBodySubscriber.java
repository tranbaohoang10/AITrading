package com.aitrading.market;

import java.io.IOException;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

/** Completes after the whole bounded body; callers can enforce a complete-transfer deadline. */
final class BoundedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final HttpResponse.BodySubscriber<byte[]> delegate = HttpResponse.BodySubscribers.ofByteArray();
    private final long maximum;
    private Flow.Subscription subscription;
    private long received;
    private boolean finished;

    BoundedBodySubscriber(long maximum) {
        if (maximum < 1) throw new IllegalArgumentException("Invalid body limit");
        this.maximum = maximum;
    }
    public CompletionStage<byte[]> getBody() { return delegate.getBody(); }
    public void onSubscribe(Flow.Subscription value) {
        subscription = value;
        delegate.onSubscribe(value);
    }
    public void onNext(List<ByteBuffer> buffers) {
        if (finished) return;
        for (ByteBuffer buffer : buffers) {
            received += buffer.remaining();
            if (received > maximum) {
                finished = true;
                subscription.cancel();
                delegate.onError(new IOException("Provider response exceeds body limit"));
                return;
            }
        }
        delegate.onNext(buffers);
    }
    public void onError(Throwable error) {
        if (!finished) { finished = true; delegate.onError(error); }
    }
    public void onComplete() {
        if (!finished) { finished = true; delegate.onComplete(); }
    }
}
