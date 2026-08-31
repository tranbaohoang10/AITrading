package com.aitrading.journal;

import com.aitrading.api.ResourceFailure;
import com.aitrading.auth.UserPrincipal;
import com.aitrading.market.MarketCsvParser;
import com.aitrading.strategy.StrategyService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class JournalService {
    private static final BigDecimal MAX=new BigDecimal("1000000000000");
    private static final Instant FIRST=Instant.parse("2000-01-01T00:00:00Z"), LAST=Instant.parse("2101-01-01T00:00:00Z");
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final JdbcTemplate jdbc;
    public JournalService(JdbcTemplate jdbc) {this.jdbc=jdbc;}

    public record Input(String symbol,String timeframe,String settlementCurrency,String side,String state,
            String quantity,String entryPrice,String exitPrice,String entryFee,String exitFee,
            String entryTime,String exitTime,String entryReason,String notes,String datasetId) { }
    public record Write(String requestId,Integer expectedVersion,Input entry) { }
    public record Entry(UUID id,int version,Input data,String grossPnl,String netPnl,Instant createdAt,Instant updatedAt) { }
    public record Saved(UUID requestId,int appliedVersion,Entry entry) { }
    public record Filter(LocalDate from,LocalDate to,String zone,String currency) { }
    public record Range(Filter filter,Instant start,Instant end) { }
    public record Page(Filter filter,List<Entry> items,String nextCursor) { public Page {items=List.copyOf(items);} }
    public record Values(int closed,int open,int wins,int losses,int breakeven,String grossPnl,String fees,String netPnl) { }
    public record Day(LocalDate date,Values values) { }
    public record Summary(Filter filter,Values totals,List<Day> days) { public Summary {days=List.copyOf(days);} }

    private static IllegalArgumentException invalid() {return new IllegalArgumentException("Invalid journal request");}
    public static String currency(String value) {
        if(value==null||!value.matches("[A-Z0-9]{2,12}"))throw invalid();return value;
    }
    private static String decimal(String value,boolean zero) {
        if(value==null||!value.matches("(0|[1-9][0-9]{0,12})(\\.[0-9]{1,8})?"))throw invalid();
        BigDecimal amount=new BigDecimal(value);
        if(amount.compareTo(MAX)>0||(!zero&&amount.signum()==0))throw invalid();
        return MarketCsvParser.decimal(amount);
    }
    private static String text(String value,int max,boolean required) {
        if(value==null){if(required)throw invalid();return "";}
        if(value.length()>max||value.getBytes(StandardCharsets.UTF_8).length>max
                ||value.codePoints().anyMatch(c->(c>=0xD800&&c<=0xDFFF)||(Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t')))throw invalid();
        if(required){value=value.strip();if(value.isEmpty())throw invalid();}return value;
    }
    private static Instant time(String value,Instant now) {
        if(value==null||!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,3})?Z"))throw invalid();
        try {
            // OffsetDateTime rejects leap seconds and 24:00 rather than normalizing them.
            Instant time=OffsetDateTime.parse(value).toInstant();
            if(time.isBefore(FIRST)||!time.isBefore(LAST)||time.isAfter(now))throw invalid();return time;
        } catch(DateTimeException rejected){throw invalid();}
    }
    public static Input validate(Input input,Instant now) {
        if(input==null)throw invalid();
        String symbol=MarketCsvParser.symbol(input.symbol());MarketCsvParser.timeframeSeconds(input.timeframe());
        String unit=currency(input.settlementCurrency());
        if(input.side()==null||!Set.of("LONG","SHORT").contains(input.side())
                ||input.state()==null||!Set.of("OPEN","CLOSED").contains(input.state()))throw invalid();
        String quantity=decimal(input.quantity(),false),entry=decimal(input.entryPrice(),false),
                entryFee=decimal(input.entryFee(),true),exitFee=decimal(input.exitFee(),true);
        Instant entryTime=time(input.entryTime(),now),exitTime=null;String exit=null;
        if(input.state().equals("OPEN")) {
            if(input.exitPrice()!=null||input.exitTime()!=null||!exitFee.equals("0"))throw invalid();
        } else {
            exit=decimal(input.exitPrice(),false);exitTime=time(input.exitTime(),now);
            if(exitTime.isBefore(entryTime))throw invalid();
        }
        String dataset=input.datasetId()==null?null:StrategyService.id(input.datasetId()).toString();
        return new Input(symbol,input.timeframe(),unit,input.side(),input.state(),quantity,entry,exit,entryFee,exitFee,
                entryTime.toString(),exitTime==null?null:exitTime.toString(),text(input.entryReason(),2000,true),text(input.notes(),4000,false),dataset);
    }
    public static Range range(String from,String to,String zone,String unit) {
        try {
            if(from==null||to==null||!from.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")||!to.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")
                    ||zone==null||zone.length()>64||!ZoneId.getAvailableZoneIds().contains(zone))throw invalid();
            LocalDate first=LocalDate.parse(from),last=LocalDate.parse(to);long days=ChronoUnit.DAYS.between(first,last)+1;
            if(days<1||days>366||first.getYear()<2000||last.getYear()>2100)throw invalid();
            ZoneId tz=ZoneId.of(zone);
            return new Range(new Filter(first,last,zone,currency(unit)),first.atStartOfDay(tz).toInstant(),last.plusDays(1).atStartOfDay(tz).toInstant());
        } catch(DateTimeException rejected){throw invalid();}
    }
    private void lock(UserPrincipal user) {
        if(jdbc.queryForList("SELECT id FROM trading.app_user WHERE id=? AND credential_version=? FOR UPDATE",UUID.class,user.id(),user.credentialVersion()).isEmpty())
            throw new BadCredentialsException("Invalid session");
    }
    private static BigDecimal amount(String value) {return new BigDecimal(value);}
    private static String gross(Input data) {
        return data.state().equals("OPEN")?null:MarketCsvParser.decimal(amount(data.exitPrice()).subtract(amount(data.entryPrice()))
                .multiply(amount(data.quantity())).multiply(BigDecimal.valueOf(data.side().equals("LONG")?1:-1)));
    }
    private Entry row(ResultSet r,int ignored)throws SQLException {
        OffsetDateTime exit=r.getObject("exit_time",OffsetDateTime.class);UUID dataset=r.getObject("dataset_id",UUID.class);
        Input data=new Input(r.getString("symbol"),r.getString("timeframe"),r.getString("settlement_currency"),r.getString("side"),r.getString("state"),
                MarketCsvParser.decimal(r.getBigDecimal("quantity")),MarketCsvParser.decimal(r.getBigDecimal("entry_price")),
                r.getBigDecimal("exit_price")==null?null:MarketCsvParser.decimal(r.getBigDecimal("exit_price")),
                MarketCsvParser.decimal(r.getBigDecimal("entry_fee")),MarketCsvParser.decimal(r.getBigDecimal("exit_fee")),
                r.getObject("entry_time",OffsetDateTime.class).toInstant().toString(),exit==null?null:exit.toInstant().toString(),
                r.getString("entry_reason"),r.getString("notes"),dataset==null?null:dataset.toString());
        String gross=gross(data),net=gross==null?null:MarketCsvParser.decimal(amount(gross).subtract(amount(data.entryFee())).subtract(amount(data.exitFee())));
        return new Entry(r.getObject("id",UUID.class),r.getInt("version"),data,gross,net,
                r.getObject("created_at",OffsetDateTime.class).toInstant(),r.getObject("updated_at",OffsetDateTime.class).toInstant());
    }
    private Entry owned(UserPrincipal user,UUID id) {
        return jdbc.query("SELECT * FROM trading.journal_entry WHERE id=? AND owner_id=? FOR UPDATE",this::row,id,user.id())
                .stream().findFirst().orElseThrow(ResourceFailure::missing);
    }
    @Transactional
    public Entry get(UserPrincipal user,UUID id) {lock(user);return owned(user,id);}
    private void source(UserPrincipal user,Input data) {
        if(data.datasetId()==null)return;
        var matches=jdbc.queryForList("SELECT id FROM trading.market_dataset WHERE id=? AND owner_id=? AND symbol=? AND timeframe=?",
                UUID.class,UUID.fromString(data.datasetId()),user.id(),data.symbol(),data.timeframe());
        if(matches.isEmpty())throw ResourceFailure.missing();
    }
    private static void expected(Integer value,int current) {
        if(value==null||value<0||value>100)throw invalid();
        if(value!=current)throw ResourceFailure.conflict();
    }
    @Transactional
    public Saved write(UserPrincipal user,UUID entryId,Write request) {
        if(request==null)throw invalid();UUID requestId=StrategyService.id(request.requestId());
        if(request.expectedVersion()==null||request.expectedVersion()<0||request.expectedVersion()>100
                ||(entryId==null?request.expectedVersion()!=0:request.expectedVersion()==0))throw invalid();
        Input data=validate(request.entry(),Instant.now());
        String hash=MarketCsvParser.hash(JSON.writeValueAsString(Arrays.asList(entryId,request.expectedVersion(),data)));
        lock(user);Entry current=entryId==null?null:owned(user,entryId);
        var replays=jdbc.queryForList("SELECT entry_id,request_hash,applied_version FROM trading.journal_write WHERE owner_id=? AND request_id=?",user.id(),requestId);
        if(!replays.isEmpty()) {
            var replay=replays.getFirst();if(!hash.equals(replay.get("request_hash")))throw ResourceFailure.conflict();
            return new Saved(requestId,(Integer)replay.get("applied_version"),owned(user,(UUID)replay.get("entry_id")));
        }
        int version=current==null?1:current.version()+1;
        expected(request.expectedVersion(),current==null?0:current.version());
        if(version>100)throw ResourceFailure.conflict();
        if(current==null&&jdbc.queryForObject("SELECT count(*) FROM trading.journal_entry WHERE owner_id=?",Long.class,user.id())>=500)throw ResourceFailure.conflict();
        source(user,data);UUID id=entryId==null?UUID.randomUUID():entryId;
        List<Object> fields=new ArrayList<>(Arrays.asList(version,data.symbol(),data.timeframe(),data.settlementCurrency(),data.side(),data.state(),
                amount(data.quantity()),amount(data.entryPrice()),data.exitPrice()==null?null:amount(data.exitPrice()),amount(data.entryFee()),amount(data.exitFee()),
                Timestamp.from(Instant.parse(data.entryTime())),data.exitTime()==null?null:Timestamp.from(Instant.parse(data.exitTime())),
                data.entryReason(),data.notes(),data.datasetId()==null?null:UUID.fromString(data.datasetId())));
        fields.add(id);fields.add(user.id());
        if(current==null)jdbc.update("""
                INSERT INTO trading.journal_entry(version,symbol,timeframe,settlement_currency,side,state,quantity,entry_price,exit_price,
                    entry_fee,exit_fee,entry_time,exit_time,entry_reason,notes,dataset_id,id,owner_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,fields.toArray());
        else jdbc.update("""
                UPDATE trading.journal_entry SET version=?,symbol=?,timeframe=?,settlement_currency=?,side=?,state=?,quantity=?,entry_price=?,exit_price=?,
                    entry_fee=?,exit_fee=?,entry_time=?,exit_time=?,entry_reason=?,notes=?,dataset_id=?,updated_at=clock_timestamp() WHERE id=? AND owner_id=?
                """,fields.toArray());
        jdbc.update("INSERT INTO trading.journal_write(owner_id,request_id,entry_id,request_hash,applied_version) VALUES (?,?,?,?,?)",user.id(),requestId,id,hash,version);
        return new Saved(requestId,version,owned(user,id));
    }
    @Transactional
    public void delete(UserPrincipal user,UUID id,Integer version) {
        lock(user);Entry current=owned(user,id);expected(version,current.version());
        jdbc.update("DELETE FROM trading.journal_entry WHERE id=? AND owner_id=?",id,user.id());
    }
    private static Instant activity(Entry entry) {return Instant.parse(entry.data().exitTime()==null?entry.data().entryTime():entry.data().exitTime());}
    private static String filterHash(Range range) {return MarketCsvParser.hash(JSON.writeValueAsString(range.filter()));}
    private static final String SELECT_RANGE="SELECT * FROM trading.journal_entry WHERE owner_id=? AND settlement_currency=? AND COALESCE(exit_time,entry_time)>=? AND COALESCE(exit_time,entry_time)<? ";
    private List<Object> parameters(UserPrincipal user,Range range) {return new ArrayList<>(List.of(user.id(),range.filter().currency(),Timestamp.from(range.start()),Timestamp.from(range.end())));}
    @Transactional
    public Page list(UserPrincipal user,Range range,int limit,String cursor) {
        if(limit<1||limit>50)throw invalid();lock(user);String sql=SELECT_RANGE;var args=parameters(user,range);
        if(cursor!=null) {
            if(cursor.length()>256||!cursor.matches("[A-Za-z0-9_-]+"))throw invalid();
            String[] parts=new String(Base64.getUrlDecoder().decode(cursor),StandardCharsets.UTF_8).split("\\|",-1);
            if(parts.length!=3||!parts[2].equals(filterHash(range)))throw invalid();
            Instant time=time(parts[0],Instant.now());UUID id=StrategyService.id(parts[1]);
            if(time.isBefore(range.start())||!time.isBefore(range.end()))throw invalid();
            sql+="AND (COALESCE(exit_time,entry_time),id)<(?,?) ";args.add(Timestamp.from(time));args.add(id);
        }
        args.add(limit+1);
        var rows=jdbc.query(sql+"ORDER BY COALESCE(exit_time,entry_time) DESC,id DESC LIMIT ?",this::row,args.toArray());
        boolean more=rows.size()>limit;var items=rows.subList(0,Math.min(limit,rows.size()));Entry last=items.isEmpty()?null:items.getLast();
        String next=more?Base64.getUrlEncoder().withoutPadding().encodeToString((activity(last)+"|"+last.id()+"|"+filterHash(range)).getBytes(StandardCharsets.UTF_8)):null;
        return new Page(range.filter(),items,next);
    }
    private static class Accumulator {
        int closed,open,wins,losses,breakeven;BigDecimal gross=BigDecimal.ZERO,fees=BigDecimal.ZERO,net=BigDecimal.ZERO;
        void add(Entry entry) {
            if(entry.data().state().equals("OPEN")){open++;return;}
            closed++;BigDecimal value=amount(entry.netPnl());if(value.signum()>0)wins++;else if(value.signum()<0)losses++;else breakeven++;
            gross=gross.add(amount(entry.grossPnl()));net=net.add(value);fees=fees.add(amount(entry.data().entryFee())).add(amount(entry.data().exitFee()));
        }
        Values values() {return new Values(closed,open,wins,losses,breakeven,MarketCsvParser.decimal(gross),MarketCsvParser.decimal(fees),MarketCsvParser.decimal(net));}
    }
    @Transactional
    public Summary summary(UserPrincipal user,Range range) {
        lock(user);var rows=jdbc.query(SELECT_RANGE+"ORDER BY id LIMIT 501",this::row,parameters(user,range).toArray());
        if(rows.size()>500)throw ResourceFailure.conflict();
        Map<LocalDate,Accumulator> days=new LinkedHashMap<>();var totals=new Accumulator();
        for(LocalDate date=range.filter().from();!date.isAfter(range.filter().to());date=date.plusDays(1))days.put(date,new Accumulator());
        ZoneId zone=ZoneId.of(range.filter().zone());
        for(Entry entry:rows){totals.add(entry);days.get(activity(entry).atZone(zone).toLocalDate()).add(entry);}
        return new Summary(range.filter(),totals.values(),days.entrySet().stream().map(day->new Day(day.getKey(),day.getValue().values())).toList());
    }
}
