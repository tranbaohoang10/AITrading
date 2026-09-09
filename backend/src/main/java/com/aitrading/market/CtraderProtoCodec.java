package com.aitrading.market;

import java.io.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

final class CtraderProtoCodec {
    static final int APP_AUTH_REQ=2100,APP_AUTH_RES=2101,ACCOUNT_AUTH_REQ=2102,ACCOUNT_AUTH_RES=2103,SYMBOLS_REQ=2114,SYMBOLS_RES=2115,SYMBOL_BY_ID_REQ=2116,SYMBOL_BY_ID_RES=2117,SUBSCRIBE_SPOTS_REQ=2127,SUBSCRIBE_SPOTS_RES=2128,SPOT_EVENT=2131,TRENDBARS_REQ=2137,TRENDBARS_RES=2138,ERROR_RES=2142,HEARTBEAT=51;
    record Envelope(int type,byte[] payload,String clientMessageId){}
    record Symbol(long id,String name,String description,int digits,String timezone){}
    record Spot(long symbolId,Instant time,BigDecimal price){}
    record Trendbar(Instant time,BigDecimal open,BigDecimal high,BigDecimal low,BigDecimal close,BigDecimal volume){}
    static byte[] applicationAuth(String id,String secret){return envelope(APP_AUTH_REQ,message(field(1,APP_AUTH_REQ),field(2,id),field(3,secret)));}
    static byte[] accountAuth(long account,String token){return envelope(ACCOUNT_AUTH_REQ,message(field(1,ACCOUNT_AUTH_REQ),field(2,account),field(3,token)));}
    static byte[] symbols(long account){return envelope(SYMBOLS_REQ,message(field(1,SYMBOLS_REQ),field(2,account),field(3,0)));}
    static byte[] symbolDetails(long account,List<Long> ids){var fields=new ArrayList<byte[]>();fields.add(field(1,SYMBOL_BY_ID_REQ));fields.add(field(2,account));ids.forEach(id->fields.add(field(3,id)));return envelope(SYMBOL_BY_ID_REQ,message(fields.toArray(byte[][]::new)));}
    static byte[] subscribe(long account,long symbol){return envelope(SUBSCRIBE_SPOTS_REQ,message(field(1,SUBSCRIBE_SPOTS_REQ),field(2,account),field(3,symbol),field(4,1)));}
    static byte[] trendbars(long account,long symbol,int period,Instant from,Instant to,int count){return envelope(TRENDBARS_REQ,message(field(1,TRENDBARS_REQ),field(2,account),field(3,from.toEpochMilli()),field(4,to.toEpochMilli()),field(5,period),field(6,symbol),field(7,count)));}
    static byte[] heartbeat(){return envelope(HEARTBEAT,message(field(1,HEARTBEAT)));}
    static Envelope envelope(byte[] raw){var value=parse(raw);return new Envelope(Math.toIntExact(value.number(1)),value.bytes(2),value.textOr(3,""));}
    static List<Symbol> symbols(byte[] listPayload,byte[] detailsPayload){var names=new HashMap<Long,String[]>();for(byte[] raw:parse(listPayload).allBytes(3)){var item=parse(raw);if(item.number(3)!=0){long id=item.number(1);names.put(id,new String[]{item.textOr(2,""),item.textOr(7,"")});}}
        var result=new ArrayList<Symbol>();for(byte[] raw:parse(detailsPayload).allBytes(3)){var item=parse(raw);long id=item.number(1);var name=names.get(id);if(name!=null&&!name[0].isBlank()){int digits=Math.toIntExact(item.number(2));if(digits>=0&&digits<=12)result.add(new Symbol(id,name[0],name[1],digits,item.textOr(26,"UTC")));}}return result;}
    static List<Long> lightSymbolIds(byte[] payload){var result=new ArrayList<Long>();for(byte[] raw:parse(payload).allBytes(3)){var item=parse(raw);if(item.number(3)!=0&&item.number(1)>0)result.add(item.number(1));}if(result.size()>20000||result.stream().distinct().count()!=result.size())throw invalid();return result;}
    static List<Trendbar> trendbars(byte[] payload,Instant from,Instant to){var result=new ArrayList<Trendbar>();Instant previous=null;for(byte[] raw:parse(payload).allBytes(5)){var item=parse(raw);Instant time=Instant.ofEpochSecond(item.number(9)*60);long low=item.number(5),open=low+item.number(6),close=low+item.number(7),high=low+item.number(8);if(time.isBefore(from)||!time.isBefore(to)||previous!=null&&!time.isAfter(previous)||low<=0||open<=0||close<=0||high<Math.max(open,close))throw invalid();result.add(new Trendbar(time,price(open),price(high),price(low),price(close),BigDecimal.valueOf(item.number(3))));if(result.size()>1000)throw invalid();previous=time;}return result;}
    static Optional<Spot> spot(byte[] payload,long expected,Instant now){var item=parse(payload);long id=item.number(3);if(id!=expected)return Optional.empty();long bid=item.number(4),ask=item.number(5),timestamp=item.number(8);if(bid<=0||ask<=0||timestamp<=0)throw invalid();Instant time=Instant.ofEpochMilli(timestamp);if(time.isAfter(now.plusSeconds(5)))throw invalid();return Optional.of(new Spot(id,time,price(bid).add(price(ask)).divide(BigDecimal.valueOf(2),12,RoundingMode.HALF_UP).stripTrailingZeros()));}
    static String error(byte[] payload){var item=parse(payload);return item.textOr(3,item.textOr(2,"CTRADER_PROVIDER_ERROR"));}
    private static BigDecimal price(long value){return BigDecimal.valueOf(value,5).stripTrailingZeros();}
    private static byte[] envelope(int type,byte[] payload){return message(field(1,type),field(2,payload));}
    static byte[] message(byte[]... fields){var out=new ByteArrayOutputStream();try{for(var field:fields)out.write(field);}catch(IOException impossible){throw new IllegalStateException(impossible);}return out.toByteArray();}
    static byte[] field(int number,long value){var out=new ByteArrayOutputStream();writeVarint(out,(long)number<<3);writeVarint(out,value);return out.toByteArray();}
    static byte[] field(int number,String value){return field(number,value.getBytes(StandardCharsets.UTF_8));}
    static byte[] field(int number,byte[] value){var out=new ByteArrayOutputStream();writeVarint(out,((long)number<<3)|2);writeVarint(out,value.length);try{out.write(value);}catch(IOException impossible){throw new IllegalStateException(impossible);}return out.toByteArray();}
    private static void writeVarint(ByteArrayOutputStream out,long value){while((value&~0x7fL)!=0){out.write((int)(value&0x7f)|0x80);value>>>=7;}out.write((int)value);}
    private static Message parse(byte[] raw){if(raw==null||raw.length>1_048_576)throw invalid();var fields=new HashMap<Integer,List<Object>>();int[] offset={0};while(offset[0]<raw.length){long tag=readVarint(raw,offset);int number=(int)(tag>>>3),wire=(int)(tag&7);if(number<=0)throw invalid();Object value;
            if(wire==0)value=readVarint(raw,offset);else if(wire==2){int length=Math.toIntExact(readVarint(raw,offset));if(length<0||offset[0]+length>raw.length)throw invalid();value=Arrays.copyOfRange(raw,offset[0],offset[0]+length);offset[0]+=length;}else if(wire==1){if(offset[0]+8>raw.length)throw invalid();offset[0]+=8;continue;}else if(wire==5){if(offset[0]+4>raw.length)throw invalid();offset[0]+=4;continue;}else throw invalid();fields.computeIfAbsent(number,key->new ArrayList<>()).add(value);}return new Message(fields);}
    private static long readVarint(byte[] raw,int[] offset){long result=0;for(int shift=0;shift<64;shift+=7){if(offset[0]>=raw.length)throw invalid();int value=raw[offset[0]++]&255;if(shift==63&&(value&254)!=0)throw invalid();result|=(long)(value&127)<<shift;if((value&128)==0)return result;}throw invalid();}
    private record Message(Map<Integer,List<Object>> fields){long number(int field){var values=fields.get(field);return values==null||values.isEmpty()||!(values.getFirst() instanceof Long value)?0:value;}byte[] bytes(int field){var values=fields.get(field);return values==null||values.isEmpty()||!(values.getFirst() instanceof byte[] value)?new byte[0]:value;}List<byte[]> allBytes(int field){var values=fields.getOrDefault(field,List.of());return values.stream().filter(byte[].class::isInstance).map(byte[].class::cast).toList();}String textOr(int field,String fallback){var value=bytes(field);if(value.length==0)return fallback;var text=new String(value,StandardCharsets.UTF_8);return text.length()<=512?text:fallback;}}
    private static CtraderDataFailure invalid(){return new CtraderDataFailure("CTRADER_INVALID_PROTOBUF",502);}
}
