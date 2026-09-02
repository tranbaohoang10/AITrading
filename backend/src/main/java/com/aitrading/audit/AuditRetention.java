package com.aitrading.audit;

import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name="aitrading.retention.scheduler",havingValue="true",matchIfMissing=true)
public class AuditRetention {
    private final AuditService audit;
    public AuditRetention(AuditService audit){this.audit=audit;}
    @Scheduled(initialDelay=60000,fixedDelay=60000)
    public void run() {
        try { audit.purge(); }
        catch(RuntimeException unavailable) { LoggerFactory.getLogger(AuditRetention.class).warn("audit_retention_unavailable"); }
    }
}
