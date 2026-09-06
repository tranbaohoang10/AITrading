package com.aitrading.intelligence;

import static org.assertj.core.api.Assertions.*;
import com.aitrading.auth.UserPrincipal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MarketIntelligenceServiceTests {
    private final UserPrincipal user = new UserPrincipal(UUID.randomUUID(), "synthetic@example.test", "ignored", 1);

    @Test
    void exposesProviderStatusWithoutLeakingCredentialsAndFailsClosedWhenUnset() {
        var service = new MarketIntelligenceService("", "");
        assertThat(service.status(user).news().configured()).isFalse();
        assertThat(service.status(user).calendar().configured()).isFalse();
        assertThatThrownBy(() -> service.news(user, "EUR USD", "UTC"))
                .isInstanceOf(MarketIntelligenceFailure.class)
                .extracting("code").isEqualTo("MARKET_NEWS_NOT_CONFIGURED");
        assertThatThrownBy(() -> service.calendar(user, "2026-09-06", "2026-09-07", "UTC"))
                .isInstanceOf(MarketIntelligenceFailure.class)
                .extracting("code").isEqualTo("MARKET_CALENDAR_NOT_CONFIGURED");
    }

    @Test
    void validatesBoundedQueryDatesAndTimezoneBeforeProviderUse() {
        var service = new MarketIntelligenceService("synthetic-key", "synthetic-key");
        assertThatThrownBy(() -> service.news(user, "x".repeat(81), "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.news(user, "EUR", "Not/AZone"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.calendar(user, "2026-09-01", "2026-11-01", "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.calendar(user, "2026-09-02", "2026-09-01", "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
