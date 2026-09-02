package com.aitrading.notification;

import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="aitrading.retention.scheduler",havingValue="true",matchIfMissing=true)
public class NotificationRetention {
    private final NotificationService notices;
    public NotificationRetention(NotificationService notices){this.notices=notices;}
    @Scheduled(initialDelay=60000,fixedDelay=60000)
    public void run() {
        try{notices.purge();}
        catch(RuntimeException unavailable){LoggerFactory.getLogger(NotificationRetention.class).warn("notification_retention_unavailable");}
    }
}
