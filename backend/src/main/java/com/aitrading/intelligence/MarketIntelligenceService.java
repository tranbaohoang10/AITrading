package com.aitrading.intelligence;

import com.aitrading.auth.UserPrincipal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Provider-ready boundary. External payloads are intentionally not fabricated when no key is configured. */
@Service
public final class MarketIntelligenceService {
    public record FeedStatus(String provider, boolean configured, String status, String limitation) { }
    public record Status(FeedStatus news, FeedStatus calendar) { }
    public record NewsItem(String id, String title, String source, String publishedAt, String url, String symbols) { }
    public record NewsResponse(String provider, String query, String timezone, List<NewsItem> items, String status) { }
    public record CalendarEvent(String id, String country, String event, String importance, String scheduledAt, String timezone, String sourceUrl) { }
    public record CalendarResponse(String provider, String from, String to, String timezone, List<CalendarEvent> items, String status) { }

    private final String newsKey;
    private final String calendarKey;

    public MarketIntelligenceService(@Value("${aitrading.market.news.api-key:}") String newsKey,
            @Value("${aitrading.market.calendar.api-key:}") String calendarKey) {
        this.newsKey = clean(newsKey); this.calendarKey = clean(calendarKey);
    }

    public Status status(UserPrincipal ignored) {
        return new Status(
                new FeedStatus("MARKETAUX", !newsKey.isEmpty(), newsKey.isEmpty() ? "NOT_CONFIGURED" : "READY", "Requires server-side MARKET_NEWS_API_KEY"),
                new FeedStatus("TRADING_ECONOMICS", !calendarKey.isEmpty(), calendarKey.isEmpty() ? "NOT_CONFIGURED" : "READY", "Requires server-side MARKET_CALENDAR_API_KEY"));
    }

    public NewsResponse news(UserPrincipal user, String query, String timezone) {
        requireUser(user); zone(timezone); String checked = query == null ? "" : query.strip();
        if (checked.length() > 80) throw new IllegalArgumentException("query too long");
        if (newsKey.isEmpty()) throw new MarketIntelligenceFailure("MARKET_NEWS_NOT_CONFIGURED", 503);
        // The transport is deliberately kept behind this boundary until a credential and retention policy are configured.
        return new NewsResponse("MARKETAUX", checked, timezone, List.of(), "PROVIDER_ADAPTER_PENDING");
    }

    public CalendarResponse calendar(UserPrincipal user, String from, String to, String timezone) {
        requireUser(user); zone(timezone);
        LocalDate start = date(from), end = date(to);
        if (end.isBefore(start) || start.plusDays(31).isBefore(end)) throw new IllegalArgumentException("calendar range must be 32 days or fewer");
        if (calendarKey.isEmpty()) throw new MarketIntelligenceFailure("MARKET_CALENDAR_NOT_CONFIGURED", 503);
        return new CalendarResponse("TRADING_ECONOMICS", from, to, timezone, List.of(), "PROVIDER_ADAPTER_PENDING");
    }

    private static String clean(String value) { return value == null ? "" : value.strip(); }
    private static void requireUser(UserPrincipal user) { if (user == null) throw new MarketIntelligenceFailure("UNAUTHORIZED", 401); }
    private static ZoneId zone(String value) { if (value == null || value.length() > 64) throw new IllegalArgumentException("invalid timezone"); try { return ZoneId.of(value); } catch (Exception e) { throw new IllegalArgumentException("invalid timezone"); } }
    private static LocalDate date(String value) { if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException("invalid date"); try { return LocalDate.parse(value); } catch (Exception e) { throw new IllegalArgumentException("invalid date"); } }
}
