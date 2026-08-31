package com.aitrading.notification;

import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NotificationRetention {
    private final NotificationService notices;
    public NotificationRetention(NotificationService notices){this.notices=notices;}
    @Scheduled(initialDelay=60000,fixedDelay=60000)
    public void run() {
        try{notices.purge();}
        catch(RuntimeException unavailable){LoggerFactory.getLogger(NotificationRetention.class).warn("notification_retention_unavailable");}
    }
}
