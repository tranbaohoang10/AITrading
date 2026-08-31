package com.aitrading.backtest;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name="aitrading.backtest.scheduler",havingValue="true",matchIfMissing=true)
public final class BacktestScheduler {
    private final BacktestStore store;
    private final PythonWorker worker;
    private final ExecutorService pool=Executors.newFixedThreadPool(2);
    private final Semaphore slots=new Semaphore(2);
    public BacktestScheduler(BacktestStore store,PythonWorker worker){this.store=store;this.worker=worker;}
    @Scheduled(fixedDelay=250)
    public void tick() {
        // Failures leave durable leases for recovery. Never log private SQL/input/process output.
        try {
            store.expire();if(!worker.configured()||!slots.tryAcquire())return;
            boolean submitted=false;
            try {
                var work=store.claim();if(work==null)return;
                pool.submit(()->{
                    try {
                        BacktestJson.Result result=null;BacktestFailure.Code failure=null;
                        try{result=worker.run(work,()->store.running(work));}
                        catch(BacktestFailure safe){failure=safe.code();}
                        catch(RuntimeException failed){failure=BacktestFailure.Code.WORKER_FAILED;}
                        store.finish(work,result,failure);
                    }catch(RuntimeException unavailable){/* Lease recovery will expose an interrupted run. */}
                    finally{slots.release();}
                });submitted=true;
            }finally{if(!submitted)slots.release();}
        }catch(RuntimeException unavailable){/* Next bounded polling tick retries only admission/recovery. */}
    }
    @PreDestroy public void shutdown(){pool.shutdownNow();try{pool.awaitTermination(5,TimeUnit.SECONDS);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}}
}
