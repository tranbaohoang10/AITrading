package com.aitrading.backtest;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public final class PythonWorker {
    private final Path executable,root,entry;
    private final Duration timeout;
    @Autowired public PythonWorker(@Value("${AITRADING_PYTHON_EXECUTABLE:}")String python,@Value("${AITRADING_PROJECT_ROOT:}")String project) {
        this(python,project,Duration.ofSeconds(25),"run_supervised_backtest.py");
    }
    // Test-only bounded process fixtures; no request/environment-controlled launcher name.
    PythonWorker(String python,String project,Duration timeout,String launcher) {
        Path cwd=Path.of("").toAbsolutePath().normalize();
        this.root=project.isBlank()?(Files.isDirectory(cwd.resolve("python"))?cwd:cwd.getParent()):Path.of(project).toAbsolutePath().normalize();
        this.executable=python.isBlank()?null:Path.of(python);
        this.entry=root.resolve("python").resolve(launcher).normalize();this.timeout=timeout;
    }
    public boolean configured(){return executable!=null&&executable.isAbsolute()&&Files.isRegularFile(executable)&&Files.isExecutable(executable)&&Files.isRegularFile(entry)&&Files.isRegularFile(root.resolve("python/aitrading_engine/engine.py"));}
    public Map<String,Object> capabilities(){return Map.of("configured",configured(),"engineVersion","1.0.0","maxConcurrent",2,"maxInputBytes",BacktestJson.MAX_INPUT,"maxOutputBytes",BacktestJson.MAX_OUTPUT,"wallSeconds",25,"memoryMiB",512,"cpuSeconds",20);}
    public BacktestJson.Result run(BacktestStore.Work work,BooleanSupplier active) {
        if(!configured())throw new BacktestFailure(BacktestFailure.Code.WORKER_UNCONFIGURED);
        byte[] input=work.input().getBytes(StandardCharsets.UTF_8);
        if(input.length>BacktestJson.MAX_INPUT)throw new BacktestFailure(BacktestFailure.Code.SNAPSHOT_INVALID);
        if(!active.getAsBoolean())throw new BacktestFailure(BacktestFailure.Code.JOB_CANCELLED);
        Process process=null;
        var io=Executors.newVirtualThreadPerTaskExecutor();
        var watchdog=Executors.newSingleThreadScheduledExecutor();var expired=new AtomicBoolean();
        try {
            var builder=new ProcessBuilder(executable.toString(),"-I",entry.toString()).directory(root.toFile());
            var environment=builder.environment();environment.clear();
            for(String key:List.of("SystemRoot","WINDIR")){String value=System.getenv(key);if(value!=null)environment.put(key,value);}
            environment.put("LANG","C.UTF-8");process=builder.start();final Process child=process;
            long deadline=System.nanoTime()+timeout.toNanos();
            watchdog.schedule(()->{if(child.isAlive()){expired.set(true);terminate(child);}},timeout.toNanos(),TimeUnit.NANOSECONDS);
            var output=io.submit(()->read(child.getInputStream(),BacktestJson.MAX_OUTPUT+1));
            var error=io.submit(()->read(child.getErrorStream(),4096));
            var write=io.submit(()->{try(var stream=child.getOutputStream()){stream.write(input);}return true;});
            while(true) {
                if(System.nanoTime()>=deadline)throw new BacktestFailure(BacktestFailure.Code.WORKER_TIMEOUT);
                if(!active.getAsBoolean())throw new BacktestFailure(BacktestFailure.Code.JOB_CANCELLED);
                if(expired.get())throw new BacktestFailure(BacktestFailure.Code.WORKER_TIMEOUT);
                if(output.isDone())output.get();if(error.isDone())error.get();
                if(child.waitFor(100,TimeUnit.MILLISECONDS))break;
            }
            byte[] bytes=output.get(remaining(deadline),TimeUnit.NANOSECONDS),stderr=error.get(remaining(deadline),TimeUnit.NANOSECONDS);
            write.get(remaining(deadline),TimeUnit.NANOSECONDS);
            if(stderr.length!=0)throw new BacktestFailure(BacktestFailure.Code.WORKER_FAILED);
            if(!active.getAsBoolean())throw new BacktestFailure(BacktestFailure.Code.JOB_CANCELLED);
            return BacktestJson.result(bytes,child.exitValue(),work.input(),work.job().inputHash(),work.job().dslHash(),work.job().dataHash(),work.job().candleCount());
        }catch(BacktestFailure safe){throw safe;}
        catch(TimeoutException deadlineReached){throw new BacktestFailure(BacktestFailure.Code.WORKER_TIMEOUT);}
        catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new BacktestFailure(BacktestFailure.Code.WORKER_INTERRUPTED);}
        catch(ExecutionException failed){if(expired.get())throw new BacktestFailure(BacktestFailure.Code.WORKER_TIMEOUT);if(failed.getCause() instanceof BacktestFailure safe)throw safe;throw new BacktestFailure(BacktestFailure.Code.WORKER_FAILED);}
        catch(IOException failed){throw new BacktestFailure(BacktestFailure.Code.WORKER_FAILED);}
        finally {
            watchdog.shutdownNow();
            if(process!=null) {
                terminate(process);boolean interrupted=Thread.interrupted();
                try {if(!process.waitFor(3,TimeUnit.SECONDS))throw new BacktestFailure(BacktestFailure.Code.WORKER_FAILED);}
                catch(InterruptedException again){interrupted=true;}
                finally{if(interrupted)Thread.currentThread().interrupt();}
                try{process.getInputStream().close();process.getErrorStream().close();process.getOutputStream().close();}catch(IOException ignored){}
            }
            io.shutdownNow();
        }
    }
    private static void terminate(Process process){process.descendants().forEach(child->{if(child.isAlive())child.destroyForcibly();});if(process.isAlive())process.destroyForcibly();}
    private long remaining(long deadline)throws TimeoutException{long left=deadline-System.nanoTime();if(left<=0)throw new TimeoutException();return left;}
    private byte[] read(InputStream input,int maximum)throws IOException {
        try(input;var output=new ByteArrayOutputStream()) {
            byte[] chunk=new byte[8192];int count;
            while((count=input.read(chunk))!=-1){if(count>maximum-output.size())throw new BacktestFailure(BacktestFailure.Code.WORKER_OUTPUT_LIMIT);output.write(chunk,0,count);}
            return output.toByteArray();
        }
    }
}
