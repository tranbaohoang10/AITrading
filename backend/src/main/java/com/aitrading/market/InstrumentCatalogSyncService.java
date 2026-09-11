package com.aitrading.market;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class InstrumentCatalogSyncService {
    private final Map<String,Source> sources;private final InstrumentCatalogStore store;private final boolean schedulerEnabled;private final Consumer<Duration> wait;private final AtomicBoolean syncing=new AtomicBoolean();
    private record Source(InstrumentCatalogProvider owner,InstrumentCatalogProvider.Descriptor descriptor){}
    @Autowired
    public InstrumentCatalogSyncService(List<InstrumentCatalogProvider> providers,InstrumentCatalogStore store,@Value("${aitrading.market.catalog.scheduler:true}")boolean schedulerEnabled){this(providers,store,schedulerEnabled,InstrumentCatalogSyncService::sleep);}
    InstrumentCatalogSyncService(List<InstrumentCatalogProvider> providers,InstrumentCatalogStore store,boolean schedulerEnabled,Consumer<Duration> wait){var result=new TreeMap<String,Source>();for(var owner:providers)for(var descriptor:owner.descriptors())if(result.put(descriptor.providerId(),new Source(owner,descriptor))!=null)throw new IllegalStateException("Duplicate catalog provider");this.sources=Map.copyOf(result);this.store=store;this.schedulerEnabled=schedulerEnabled;this.wait=wait;}
    @Scheduled(initialDelayString="${aitrading.market.catalog.initial-delay-ms:2000}",fixedDelayString="${aitrading.market.catalog.refresh-ms:21600000}")
    public void scheduledRefresh(){if(schedulerEnabled)refreshAll();}
    public void refreshAll(){if(!syncing.compareAndSet(false,true))return;try{for(var source:sources.values())refresh(source);}finally{syncing.set(false);}}
    private void refresh(Source source){String provider=source.descriptor().providerId();if(!source.descriptor().available()){store.disabled(provider);return;}store.running(provider);for(int attempt=0;attempt<3;attempt++)try{store.replaceSnapshot(source.descriptor(),source.owner().fetch(provider));return;}catch(CatalogProviderFailure failure){if(!failure.transientFailure()||attempt==2){store.failed(provider,failure.code());return;}wait.accept(Duration.ofSeconds(1L<<attempt));}catch(RuntimeException failure){store.failed(provider,"CATALOG_SYNC_FAILED");return;}}
    private static void sleep(Duration duration){try{Thread.sleep(duration);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}}
}
