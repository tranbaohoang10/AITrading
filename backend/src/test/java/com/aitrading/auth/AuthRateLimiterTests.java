package com.aitrading.auth;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class AuthRateLimiterTests {
    @Test void publicCoinbaseBucketFitsThePersistedKeyLimit() {
        assertThat(AuthRateLimiter.bucketKey("mkt", "127.0.0.1")).hasSizeLessThanOrEqualTo(80);
    }
}
