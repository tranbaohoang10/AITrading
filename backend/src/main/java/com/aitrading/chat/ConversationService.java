package com.aitrading.chat;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConversationService {
    private final JdbcTemplate jdbc;
    public record Conversation(UUID id, String title, long version, Instant createdAt, Instant updatedAt, String lastMessage) { }
    public record Message(long sequence, UUID requestId, String role, String content, boolean hasAttachment, Instant createdAt) { }
    public record Page(List<Conversation> items, String nextCursor) { }
    public record Messages(Conversation conversation, List<Message> items, Long nextBefore) { }
    private record State(Conversation conversation, long sequence) { }
    private static final String SELECT = """
            SELECT c.*, COALESCE((SELECT left(m.content,160) FROM trading.conversation_message m
              WHERE m.conversation_id=c.id AND m.sequence=c.last_sequence),'') AS preview
            FROM trading.conversation c
            """;

    public ConversationService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public static UUID id(String text) {
        if (text == null || !text.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
            throw new IllegalArgumentException("Invalid identifier");
        return UUID.fromString(text);
    }
    public static int limit(String value, int fallback, int max) {
        if (value == null) return fallback;
        long parsed = positive(value);
        if (parsed > max) throw new IllegalArgumentException("Invalid page size");
        return (int) parsed;
    }
    public static long positive(String value) {
        if (value == null || !value.matches("[1-9][0-9]{0,18}")) throw new IllegalArgumentException("Invalid number");
        return Long.parseLong(value);
    }
    private static String text(String input, int max, boolean multiline) {
        if (input == null) throw new IllegalArgumentException("Missing text");
        String value = input.strip();
        if (value.isEmpty() || value.length() > max || value.codePoints().anyMatch(c ->
                (c >= 0xD800 && c <= 0xDFFF) || (Character.isISOControl(c) && !(multiline && (c == '\n' || c == '\r' || c == '\t')))))
            throw new IllegalArgumentException("Invalid text");
        return value;
    }
    private State row(ResultSet rs, int unused) throws SQLException {
        return new State(new Conversation(rs.getObject("id", UUID.class), rs.getString("title"), rs.getLong("version"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant(), rs.getString("preview")), rs.getLong("last_sequence"));
    }
    private Message message(ResultSet rs, int unused) throws SQLException {
        return new Message(rs.getLong("sequence"), rs.getObject("request_id", UUID.class), rs.getString("role"),
                rs.getString("content"), rs.getBytes("attachment_png") != null, rs.getObject("created_at", OffsetDateTime.class).toInstant());
    }
    private State owned(UserPrincipal user, UUID id, boolean lock) {
        return jdbc.query(SELECT + " WHERE c.id=? AND c.owner_id=?" + (lock ? " FOR UPDATE OF c" : ""),
                this::row, id, user.id()).stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    private void lockCurrentUser(UserPrincipal user) {
        var rows = jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",
                UUID.class, user.id(), user.credentialVersion());
        if (rows.isEmpty()) throw new BadCredentialsException("Invalid session");
    }
    private void requireVersion(Conversation conversation, Long expected) {
        if (expected == null || expected < 1) throw new IllegalArgumentException("Invalid version");
        if (conversation.version() != expected) throw ResourceFailure.conflict();
    }

    public Conversation get(UserPrincipal user, UUID id) { return owned(user, id, false).conversation(); }

    public Page list(UserPrincipal user, int limit, String cursor) {
        List<State> rows;
        if (cursor == null) rows = jdbc.query(SELECT + " WHERE c.owner_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT ?",
                this::row, user.id(), limit + 1);
        else {
            if (cursor.length() > 128 || !cursor.matches("[A-Za-z0-9_-]+")) throw new IllegalArgumentException("Invalid cursor");
            String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = decoded.split("\\|", -1);
            if (parts.length != 2) throw new IllegalArgumentException("Invalid cursor");
            Instant instant;
            try { instant = Instant.parse(parts[0]); } catch (java.time.DateTimeException invalid) { throw new IllegalArgumentException("Invalid cursor"); }
            if (instant.isBefore(Instant.parse("0001-01-01T00:00:00Z")) || instant.isAfter(Instant.parse("9999-12-31T23:59:59Z")))
                throw new IllegalArgumentException("Invalid cursor");
            rows = jdbc.query(SELECT + " WHERE c.owner_id=? AND (c.created_at,c.id)<(?,?) ORDER BY c.created_at DESC,c.id DESC LIMIT ?",
                    this::row, user.id(), OffsetDateTime.ofInstant(instant, java.time.ZoneOffset.UTC), id(parts[1]), limit + 1);
        }
        boolean more = rows.size() > limit;
        var items = rows.stream().limit(limit).map(State::conversation).toList();
        var last = items.isEmpty() ? null : items.getLast();
        String next = more ? Base64.getUrlEncoder().withoutPadding().encodeToString(
                (last.createdAt() + "|" + last.id()).getBytes(StandardCharsets.UTF_8)) : null;
        return new Page(items, next);
    }

    @Transactional
    public Conversation create(UserPrincipal user, UUID requestId) {
        lockCurrentUser(user);
        var existing = jdbc.query(SELECT + " WHERE c.owner_id=? AND c.request_id=?", this::row, user.id(), requestId);
        if (!existing.isEmpty()) return existing.getFirst().conversation();
        if (jdbc.queryForObject("SELECT count(*) FROM trading.conversation WHERE owner_id=?", Long.class, user.id()) >= 100)
            throw ResourceFailure.conflict();
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO trading.conversation(id,owner_id,request_id,title) VALUES (?,?,?,'New conversation')", id, user.id(), requestId);
        return get(user, id);
    }

    @Transactional
    public Conversation rename(UserPrincipal user, UUID id, String title, Long expected) {
        String checked = text(title, 120, false);
        lockCurrentUser(user);
        requireVersion(owned(user, id, true).conversation(), expected);
        jdbc.update("UPDATE trading.conversation SET title=?,version=version+1,updated_at=clock_timestamp() WHERE id=? AND owner_id=?", checked, id, user.id());
        return get(user, id);
    }

    @Transactional
    public void delete(UserPrincipal user, UUID id, Long expected) {
        lockCurrentUser(user);
        requireVersion(owned(user, id, true).conversation(), expected);
        jdbc.update("DELETE FROM trading.conversation WHERE id=? AND owner_id=?", id, user.id());
    }

    public Messages messages(UserPrincipal user, UUID id, int limit, Long before) {
        State current = owned(user, id, false);
        long upper = before == null ? current.sequence() + 1 : Math.min(before, current.sequence() + 1);
        var rows = jdbc.query("""
                SELECT m.* FROM trading.conversation_message m JOIN trading.conversation c ON c.id=m.conversation_id
                WHERE c.id=? AND c.owner_id=? AND m.sequence<? ORDER BY m.sequence DESC LIMIT ?
                """, this::message, id, user.id(), upper, limit + 1);
        boolean more = rows.size() > limit;
        var items = new ArrayList<>(rows.subList(0, Math.min(limit, rows.size())));
        Collections.reverse(items);
        return new Messages(current.conversation(), List.copyOf(items), more ? items.getFirst().sequence() : null);
    }

    @Transactional
    public Message append(UserPrincipal user, UUID id, UUID requestId, String content) {
        String checked = text(content, 4000, true);
        lockCurrentUser(user);
        State current = owned(user, id, true);
        var existing = jdbc.query("SELECT * FROM trading.conversation_message WHERE conversation_id=? AND request_id=?",
                this::message, id, requestId);
        if (!existing.isEmpty()) {
            if (!existing.getFirst().content().equals(checked)) throw ResourceFailure.conflict();
            return existing.getFirst();
        }
        if (current.sequence() >= 2000) throw ResourceFailure.conflict();
        long next = current.sequence() + 1;
        jdbc.update("INSERT INTO trading.conversation_message(conversation_id,sequence,request_id,role,content) VALUES (?,?,?,'user',?)", id, next, requestId, checked);
        jdbc.update("UPDATE trading.conversation SET last_sequence=?,version=version+1,updated_at=clock_timestamp() WHERE id=? AND owner_id=?", next, id, user.id());
        return jdbc.query("SELECT * FROM trading.conversation_message WHERE conversation_id=? AND sequence=?", this::message, id, next).getFirst();
    }

    @Transactional
    public Message appendAttachment(UserPrincipal user, UUID id, UUID requestId, String content, byte[] png, String context) {
        String checked = text(content, 4000, true);
        String checkedContext = text(context, 4000, true);
        if (png == null || png.length < 32 || png.length > 2 * 1024 * 1024 || !isPng(png))
            throw new IllegalArgumentException("Invalid chart attachment");
        lockCurrentUser(user);
        State current = owned(user, id, true);
        var existing = jdbc.query("SELECT * FROM trading.conversation_message WHERE conversation_id=? AND request_id=?",
                this::message, id, requestId);
        if (!existing.isEmpty()) {
            if (!existing.getFirst().content().equals(checked) || !existing.getFirst().hasAttachment()) throw ResourceFailure.conflict();
            return existing.getFirst();
        }
        if (current.sequence() >= 2000) throw ResourceFailure.conflict();
        long next = current.sequence() + 1;
        jdbc.update("INSERT INTO trading.conversation_message(conversation_id,sequence,request_id,role,content,attachment_png,attachment_mime,attachment_context) VALUES (?,?,?,'user',?,?,?,?)",
                id, next, requestId, checked, png, "image/png", checkedContext);
        jdbc.update("UPDATE trading.conversation SET last_sequence=?,version=version+1,updated_at=clock_timestamp() WHERE id=? AND owner_id=?", next, id, user.id());
        return jdbc.query("SELECT * FROM trading.conversation_message WHERE conversation_id=? AND sequence=?", this::message, id, next).getFirst();
    }

    private static boolean isPng(byte[] bytes) {
        return bytes.length >= 24 && bytes[0] == (byte) 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71
                && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10
                && bytes[bytes.length - 8] == 73 && bytes[bytes.length - 7] == 69 && bytes[bytes.length - 6] == 78
                && bytes[bytes.length - 5] == 68;
    }
}
