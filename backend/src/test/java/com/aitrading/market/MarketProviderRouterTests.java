package com.aitrading.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.Test;

class MarketProviderRouterTests {
    @Test
    void usesDeterministicAssetSpecificPrimaryAndFallbackOrder() {
        assertThat(MarketProviderRouter.providersFor("STOCK")).containsExactly("ALPACA");
        assertThat(MarketProviderRouter.providersFor("ETF")).containsExactly("ALPACA");
        assertThat(MarketProviderRouter.providersFor("CRYPTO")).containsExactly("BINANCE");
        assertThat(MarketProviderRouter.providersFor("FOREX")).containsExactly("CTRADER", "CAPITAL", "DUKASCOPY");
        assertThat(MarketProviderRouter.providersFor("COMMODITY")).containsExactly("CAPITAL", "CTRADER", "DUKASCOPY");
        assertThat(MarketProviderRouter.primary("FOREX")).isEqualTo("CTRADER");
    }

    @Test
    void rejectsUnknownAssetAndDoesNotAllowCrossAssetFallback() {
        assertThatThrownBy(() -> MarketProviderRouter.providersFor("BOND"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(MarketProviderRouter.fallbackAllowed("FOREX", "CAPITAL")).isTrue();
        assertThat(MarketProviderRouter.fallbackAllowed("FOREX", "BINANCE")).isFalse();
    }
}
