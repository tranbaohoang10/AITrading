package com.aitrading.backtest;

import static org.assertj.core.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.node.ObjectNode;

class BacktestWorkerTests {
    static final Path ROOT=Path.of("..").toAbsolutePath().normalize();
    @TempDir Path fixture;
    byte[] expected;
    BacktestStore.Work work;
    @BeforeEach void setup()throws Exception {
        expected=Files.readAllBytes(ROOT.resolve("specs/PB-010/test-evidence/example-result.json"));
        String input=BacktestJson.canonical(BacktestJson.parse(Files.readAllBytes(ROOT.resolve("python/examples/long-next-open.json")),BacktestJson.MAX_INPUT));
        var result=BacktestJson.parse(expected,BacktestJson.MAX_OUTPUT).path("result");
        var card=result.path("runCard");UUID id=UUID.randomUUID();Instant at=Instant.now();
        var job=new BacktestStore.Job(id,UUID.randomUUID(),UUID.randomUUID(),2,"Synthetic",UUID.randomUUID(),"Synthetic","TEST_USD","1h","SYNTHETIC",null,"RUNNING",null,
                BacktestJson.hash(input),card.path("dslHash").asString(),card.path("dataset").path("dataHash").asString(),3,null,at,at,at.plusSeconds(60),null);
        work=new BacktestStore.Work(job,UUID.randomUUID(),1,input);
        assertThat(System.getenv("AITRADING_PYTHON_EXECUTABLE")).isNotBlank();
        Files.createDirectories(fixture.resolve("python/aitrading_engine"));Files.writeString(fixture.resolve("python/aitrading_engine/engine.py"),"# Trusted test fixture only");
    }
    BacktestJson.Result decode(byte[] raw,int exit){return BacktestJson.result(raw,exit,work.input(),work.job().inputHash(),work.job().dslHash(),work.job().dataHash(),3);}
    PythonWorker worker(String source,Duration timeout)throws Exception {
        Files.writeString(fixture.resolve("python/fixture.py"),source);
        return new PythonWorker(System.getenv("AITRADING_PYTHON_EXECUTABLE"),fixture.toString(),timeout,"fixture.py");
    }
    void failure(Runnable action,BacktestFailure.Code code){assertThatThrownBy(action::run).isInstanceOfSatisfying(BacktestFailure.class,e->{assertThat(e.code()).isEqualTo(code);assertThat(e.getCause()).isNull();assertThat(e.getMessage()).isEqualTo(code.name());});}
    @Test void actualSupervisedPythonMatchesHandComputedProvenanceAndResult() {
        var actual=new PythonWorker(System.getenv("AITRADING_PYTHON_EXECUTABLE"),ROOT.toString()).run(work,()->true);
        assertThat(actual.hash()).isEqualTo("b04fd6e6beb34cea4e48d341fe1057854d82da10d6059ccfbded44fa48353494");
        assertThat(BacktestJson.JSON.readTree(actual.json()).path("metrics").path("netProfit").asString()).isEqualTo("100");
        assertThat(decode(expected,0)).isEqualTo(actual);
    }
    @Test void malformedShapeHashProvenanceAndExitCannotBecomeSuccess() {
        for(String text:List.of("{}","null","[]","{}{}","{\"ok\":true,\"ok\":false}","{\"ok\":\"true\"}"))failure(()->decode(text.getBytes(StandardCharsets.UTF_8),0),BacktestFailure.Code.WORKER_INVALID_RESULT);
        failure(()->decode(new byte[]{(byte)255},0),BacktestFailure.Code.WORKER_INVALID_RESULT);
        failure(()->decode(expected,2),BacktestFailure.Code.WORKER_INVALID_RESULT);
        for(String key:List.of("inputHash","dslHash","canonicalDsl","engineVersion","protocolVersion")) {
            var changed=(ObjectNode)BacktestJson.parse(expected,BacktestJson.MAX_OUTPUT);((ObjectNode)changed.path("result").path("runCard")).put(key,"wrong");
            failure(()->decode(BacktestJson.JSON.writeValueAsBytes(changed),0),BacktestFailure.Code.WORKER_INVALID_RESULT);
        }
        var changed=(ObjectNode)BacktestJson.parse(expected,BacktestJson.MAX_OUTPUT);((ObjectNode)changed.path("result")).put("resultHash","0".repeat(64));
        failure(()->decode(BacktestJson.JSON.writeValueAsBytes(changed),0),BacktestFailure.Code.WORKER_INVALID_RESULT);
        failure(()->decode("{\"ok\":false,\"error\":{\"code\":\"WORK_LIMIT\"}}".getBytes(),2),BacktestFailure.Code.ENGINE_REJECTED);
        failure(()->decode("{\"ok\":false,\"error\":{\"code\":\"WORKER_RESOURCE_UNAVAILABLE\"}}".getBytes(),3),BacktestFailure.Code.WORKER_RESOURCE_UNAVAILABLE);
    }
    @Test void actualPipesTimeoutCancellationOutputAndStderrAreBounded()throws Exception {
        var hangs=worker("import time\ntime.sleep(30)",Duration.ofMillis(250));
        failure(()->hangs.run(work,()->true),BacktestFailure.Code.WORKER_TIMEOUT);
        var blockedInput=new BacktestStore.Work(work.job(),work.ownerId(),work.credentialVersion()," ".repeat(1024*1024));
        failure(()->hangs.run(blockedInput,()->true),BacktestFailure.Code.WORKER_TIMEOUT);
        var calls=new AtomicInteger();var cancel=worker("import time\ntime.sleep(30)",Duration.ofSeconds(5));
        failure(()->cancel.run(work,()->calls.incrementAndGet()<3),BacktestFailure.Code.JOB_CANCELLED);
        var oversized=worker("import sys,time\nsys.stdin.buffer.read()\nsys.stdout.buffer.write(b'x'*(32*1024*1024+2));sys.stdout.flush();time.sleep(5)",Duration.ofSeconds(8));
        failure(()->oversized.run(work,()->true),BacktestFailure.Code.WORKER_OUTPUT_LIMIT);
        var stderr=worker("import sys\nsys.stdin.buffer.read()\nsys.stderr.write('PRIVATE_SYNTHETIC_DIAGNOSTIC')",Duration.ofSeconds(5));
        failure(()->stderr.run(work,()->true),BacktestFailure.Code.WORKER_FAILED);
        var errorFlood=worker("import sys,time\nsys.stderr.write('x'*4097);sys.stderr.flush();time.sleep(5)",Duration.ofSeconds(8));
        failure(()->errorFlood.run(work,()->true),BacktestFailure.Code.WORKER_OUTPUT_LIMIT);
    }
    @Test void processReceivesOnlyFixedArgumentsPrivateInputAndSanitizedEnvironment()throws Exception {
        String encoded=Base64.getEncoder().encodeToString(expected);
        var safe=worker("import sys,os,base64\nassert len(sys.argv)==1\nassert all(k.upper() in ('SYSTEMROOT','WINDIR','LANG','LC_CTYPE') for k in os.environ)\nassert sys.stdin.buffer.read().startswith(b'{')\nsys.stdout.buffer.write(base64.b64decode('"+encoded+"'))",Duration.ofSeconds(5));
        assertThat(safe.run(work,()->true)).isEqualTo(decode(expected,0));
        assertThat(new PythonWorker("python",ROOT.toString()).configured()).isFalse();
        failure(()->new PythonWorker("",ROOT.toString()).run(work,()->true),BacktestFailure.Code.WORKER_UNCONFIGURED);
    }
    @Test void independentWatchdogKillsProcessEvenWhenStatusLookupBlocks()throws Exception {
        var slow=worker("import time\nfrom pathlib import Path\ntime.sleep(.6)\nPath('SHOULD_NOT_EXIST').write_text('late')",Duration.ofMillis(200));
        var count=new AtomicInteger();
        failure(()->slow.run(work,()->{if(count.incrementAndGet()>1)try{Thread.sleep(1000);}catch(InterruptedException e){Thread.currentThread().interrupt();}return true;}),BacktestFailure.Code.WORKER_TIMEOUT);
        assertThat(fixture.resolve("SHOULD_NOT_EXIST")).doesNotExist();
    }
}
