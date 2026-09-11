package com.aitrading.market;

import static org.mockito.Mockito.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class InstrumentCatalogSyncServiceTests {
    @Test void retriesTransientFailureAndStoresOnlyTheSuccessfulSnapshot() {
        var store=mock(InstrumentCatalogStore.class);var attempts=new AtomicInteger();
        InstrumentCatalogProvider provider=new InstrumentCatalogProvider(){
            public List<Descriptor> descriptors(){return List.of(new Descriptor("RETRY_SOURCE",List.of("STOCK"),10,true,false,"test"));}
            public List<Candidate> fetch(String ignored){if(attempts.incrementAndGet()<3)throw new CatalogProviderFailure("CATALOG_RATE_LIMIT",true);return List.of(candidate());}
        };
        var waits=new ArrayList<Duration>();new InstrumentCatalogSyncService(List.of(provider),store,true,waits::add).refreshAll();
        verify(store).running("RETRY_SOURCE");verify(store).replaceSnapshot(provider.descriptors().getFirst(),List.of(candidate()));verify(store,never()).failed(anyString(),anyString());
        org.assertj.core.api.Assertions.assertThat(waits).containsExactly(Duration.ofSeconds(1),Duration.ofSeconds(2));
    }
    @Test void disablesMissingKeyProviderWithoutFetch() {
        var store=mock(InstrumentCatalogStore.class);InstrumentCatalogProvider provider=new InstrumentCatalogProvider(){public List<Descriptor> descriptors(){return List.of(new Descriptor("OPTIONAL_SOURCE",List.of("ETF"),10,false,true,"test"));}public List<Candidate> fetch(String ignored){throw new AssertionError();}};
        new InstrumentCatalogSyncService(List.of(provider),store,true,duration->{}).refreshAll();verify(store).disabled("OPTIONAL_SOURCE");verifyNoMoreInteractions(store);
    }
    private static InstrumentCatalogProvider.Candidate candidate(){return new InstrumentCatalogProvider.Candidate(InstrumentCatalogProvider.listingKey("STOCK","NASDAQ","AAPL"),"STOCK","AAPL","AAPL","AAPL","Apple Inc","NASDAQ",null,"United States","US","USD",null,null,"Stock","US0378331005",null,"RETRY_SOURCE",10,List.of("HISTORICAL"),List.of("1d"),"America/New_York",null,List.of("Apple"));}
}
