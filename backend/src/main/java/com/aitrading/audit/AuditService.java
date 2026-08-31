package com.aitrading.audit;

import com.aitrading.api.RequestIdFilter;
import com.aitrading.auth.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    public static final String ACTOR = AuditService.class.getName()+".actor";
    private final JdbcTemplate jdbc;
    public record Event(String id,Instant occurredAt,UUID requestId,String category,String operation,
                        String method,Integer httpStatus,UUID resourceId,String errorCode) { }
    public record Page(List<Event> items,String nextCursor) { }
    public AuditService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    public static String operation(String path) {
        return switch(path) {
            case "/api/auth/login" -> "LOGIN";
            case "/api/auth/logout" -> "LOGOUT";
            case "/api/auth/register" -> "REGISTER";
            case "/api/auth/profile" -> "PROFILE";
            case "/api/auth/password" -> "PASSWORD";
            default -> {
                for(String group:List.of("conversations","datasets","strategies","backtests","journal","dsl","ai","audit"))
                    if(path.equals("/api/"+group)||path.startsWith("/api/"+group+"/"))yield group.toUpperCase(Locale.ROOT);
                yield path.startsWith("/api/auth/")?"AUTH_OTHER":"OTHER";
            }
        };
    }

    /** Called outside the business transaction; never turn an already committed mutation into an error. */
    public void http(HttpServletRequest request,int status) {
        String rawMethod=request.getMethod();
        String method=Set.of("GET","HEAD","OPTIONS","POST","PUT","PATCH","DELETE").contains(rawMethod)?rawMethod:"OTHER";
        String operation=operation(request.getRequestURI());
        if(status<400 && (Set.of("GET","HEAD","OPTIONS").contains(method)||operation.equals("OTHER")))return;
        String category=Set.of("LOGIN","LOGOUT","REGISTER","PROFILE","PASSWORD","AUTH_OTHER").contains(operation)?"AUTH"
                :status>=400?"SECURITY":"RESOURCE";
        Object actor=request.getAttribute(ACTOR);
        UUID owner=actor instanceof UUID value?value:null;
        UUID id=UUID.fromString((String)request.getAttribute(RequestIdFilter.ATTRIBUTE));
        try {
            // Missing/deleted owners are anonymous. Never derive identity from headers or request bodies.
            jdbc.update("""
                INSERT INTO trading.audit_event(owner_id,request_id,category,operation,method,http_status)
                VALUES ((SELECT id FROM trading.app_user WHERE id=?),?,?,?,?,?)
                """,owner,id,category,operation,method,status);
        } catch(RuntimeException unavailable) {
            LoggerFactory.getLogger(AuditService.class).warn("audit_write_unavailable requestId={}",id);
        }
    }

    private Event row(ResultSet rs,int ignored)throws SQLException {
        return new Event(Long.toString(rs.getLong("id")),rs.getObject("occurred_at",OffsetDateTime.class).toInstant(),
                rs.getObject("request_id",UUID.class),rs.getString("category"),rs.getString("operation"),rs.getString("method"),
                rs.getObject("http_status",Integer.class),rs.getObject("resource_id",UUID.class),rs.getString("error_code"));
    }
    @Transactional
    public Page list(UserPrincipal user,int limit,String before) {
        if(limit<1||limit>50)throw new IllegalArgumentException("Invalid limit");
        Long cursor=null;
        if(before!=null) {
            if(!before.matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException("Invalid cursor");
            try{cursor=Long.parseLong(before);}catch(NumberFormatException invalid){throw new IllegalArgumentException("Invalid cursor");}
        }
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR SHARE",
                UUID.class,user.id(),user.credentialVersion()).isEmpty())throw new BadCredentialsException("Invalid session");
        String sql="SELECT * FROM trading.audit_event WHERE owner_id=? AND occurred_at>=clock_timestamp()-interval '30 days'";
        var rows=cursor==null?jdbc.query(sql+" ORDER BY id DESC LIMIT ?",this::row,user.id(),limit+1)
                :jdbc.query(sql+" AND id<? ORDER BY id DESC LIMIT ?",this::row,user.id(),cursor,limit+1);
        var items=List.copyOf(rows.subList(0,Math.min(limit,rows.size())));
        return new Page(items,rows.size()>limit?items.getLast().id():null);
    }
    @Transactional
    public int purge() {
        return jdbc.update("""
            DELETE FROM trading.audit_event WHERE id IN (
                SELECT id FROM trading.audit_event WHERE occurred_at<clock_timestamp()-interval '30 days'
                ORDER BY occurred_at,id LIMIT 5000 FOR UPDATE SKIP LOCKED)
            """);
    }
}
