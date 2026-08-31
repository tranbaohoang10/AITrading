package com.aitrading.notification;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class NotificationService {
    private final JdbcTemplate jdbc;
    public record Notice(String id,UUID jobId,String state,String errorCode,Instant createdAt,Instant readAt) { }
    public record Page(List<Notice> items,String nextCursor,long unreadCount) { }
    public NotificationService(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public static long id(String value) {
        if(value==null||!value.matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException("Invalid notification ID");
        try{return Long.parseLong(value);}catch(NumberFormatException invalid){throw new IllegalArgumentException("Invalid notification ID");}
    }
    private void current(UserPrincipal user,boolean write) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR "+(write?"UPDATE":"SHARE"),
                UUID.class,user.id(),user.credentialVersion()).isEmpty())throw new BadCredentialsException("Invalid session");
    }
    private Notice row(ResultSet rs,int ignored)throws SQLException {
        OffsetDateTime read=rs.getObject("read_at",OffsetDateTime.class);
        return new Notice(Long.toString(rs.getLong("id")),rs.getObject("job_id",UUID.class),rs.getString("state"),rs.getString("error_code"),
                rs.getObject("created_at",OffsetDateTime.class).toInstant(),read==null?null:read.toInstant());
    }
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public Page list(UserPrincipal user,int limit,String before) {
        if(limit<1||limit>50)throw new IllegalArgumentException("Invalid limit");
        Long cursor=before==null?null:id(before);current(user,false);
        String sql="SELECT * FROM trading.backtest_notification WHERE owner_id=? AND created_at>=CURRENT_TIMESTAMP-interval '30 days'";
        var rows=cursor==null?jdbc.query(sql+" ORDER BY id DESC LIMIT ?",this::row,user.id(),limit+1)
                :jdbc.query(sql+" AND id<? ORDER BY id DESC LIMIT ?",this::row,user.id(),cursor,limit+1);
        var items=List.copyOf(rows.subList(0,Math.min(limit,rows.size())));
        long unread=jdbc.queryForObject("SELECT count(*) FROM trading.backtest_notification WHERE owner_id=? AND read_at IS NULL AND created_at>=CURRENT_TIMESTAMP-interval '30 days'",Long.class,user.id());
        return new Page(items,rows.size()>limit?items.getLast().id():null,unread);
    }
    @Transactional
    public Notice read(UserPrincipal user,String value) {
        long id=id(value);current(user,true);
        return jdbc.query("""
                UPDATE trading.backtest_notification SET read_at=COALESCE(read_at,clock_timestamp())
                WHERE id=? AND owner_id=? AND created_at>=clock_timestamp()-interval '30 days' RETURNING *
                """,this::row,id,user.id()).stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    @Transactional
    public int purge() {
        return jdbc.update("""
                DELETE FROM trading.backtest_notification WHERE id IN (
                    SELECT id FROM trading.backtest_notification WHERE created_at<clock_timestamp()-interval '30 days'
                    ORDER BY created_at,id LIMIT 5000 FOR UPDATE SKIP LOCKED)
                """);
    }
}
