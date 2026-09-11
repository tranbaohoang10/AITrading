package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;

class InstrumentCatalogProviderTests {
    @Test void keepsSameTickerOnDifferentExchangesAndSeparatesSpotFromFutures() {
        assertThat(InstrumentCatalogProvider.listingKey("STOCK","NASDAQ","AAPL"))
                .isNotEqualTo(InstrumentCatalogProvider.listingKey("STOCK","ASX","AAPL"));
        assertThat(InstrumentCatalogProvider.pairKey("COMMODITY","XAU","USD","SPOT"))
                .isNotEqualTo(InstrumentCatalogProvider.listingKey("FUTURES","COMEX","GC1!"));
        assertThat(InstrumentCatalogProvider.normalizeAlias("EUR/USD")).isEqualTo("EURUSD");
    }

    @Test void parsesFreeTickerRowsWithExchangeAndIsinIdentity() {
        StringBuilder csv=new StringBuilder("listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases,instrument_group_key,scope_reason\n");
        for(int index=0;index<100;index++)csv.append("NASDAQ::T").append(index).append(",T").append(index).append(",NASDAQ,Company ").append(index).append(",Stock,Technology,,United States,US,US000000").append(String.format("%04d",index)).append(",alias ").append(index).append(",GROUP").append(index).append(",primary_listing\n");
        csv.append("NYSE ARCA::SPY,SPY,NYSE ARCA,SPDR S&P 500 ETF Trust,ETF,,Equity,United States,US,US78462F1030,,US78462F1030,primary_listing\n");
        var rows=FreeTickerDatabaseCatalogProvider.parse(csv.toString());
        assertThat(rows).hasSize(101);
        assertThat(rows.getLast()).extracting(InstrumentCatalogProvider.Candidate::assetClass,InstrumentCatalogProvider.Candidate::exchange,InstrumentCatalogProvider.Candidate::isin).containsExactly("ETF","NYSE ARCA","US78462F1030");
        assertThat(rows.getLast().canonicalKey()).isEqualTo("IDENTIFIER:ETF:ISIN:US78462F1030:EXCHANGE:NYSE ARCA");
    }

    @Test void buildsDynamicFrankfurterForexAndMetalReferences() {
        var rows=new ArrayList<String>();
        for(String code:List.of("USD","EUR","GBP","JPY","XAU","XAG","XPT","XPD"))rows.add(currency(code,code+" currency"));
        for(char first='A';first<='Z'&&rows.size()<60;first++)for(char second='A';second<='Z'&&rows.size()<60;second++){String code="Q"+first+second;if(Set.of("QAA","QAB").contains(code))continue;rows.add(currency(code,code+" currency"));}
        var catalog=FrankfurterCatalogProvider.parse("["+String.join(",",rows)+"]",LocalDate.parse("2026-09-11"));
        assertThat(catalog).hasSizeGreaterThan(100);
        assertThat(catalog).anyMatch(row->row.canonicalKey().equals("PAIR:FOREX:EUR:USD:SPOT"));
        assertThat(catalog).anyMatch(row->row.assetClass().equals("COMMODITY")&&row.displaySymbol().equals("XAU/USD"));
    }

    @Test void parsesTwelveDataReferencePayloadWithoutProviderSecrets() {
        var rows=TwelveDataCatalogProvider.parse("{\"data\":[{\"symbol\":\"EUR/USD\",\"currency_group\":\"Major\",\"currency_base\":\"EUR\",\"currency_quote\":\"USD\"}]}","FOREX");
        assertThat(rows).singleElement().satisfies(row->{assertThat(row.displaySymbol()).isEqualTo("EUR/USD");assertThat(row.canonicalKey()).isEqualTo("PAIR:FOREX:EUR:USD:SPOT");assertThat(row.aliases()).contains("EURUSD");});
        assertThat(new TwelveDataCatalogProvider("",java.net.http.HttpClient.newHttpClient()).descriptors().getFirst().available()).isFalse();
    }
    @Test void boundsProviderNamesWithoutChangingRoutingIdentity() {
        String longName="A".repeat(220)+"\nignored";
        var item=new MarketDataProvider.Instrument("ALPACA:SPY","SPY","SPY","ALPACA","US_EQUITY","SPY","USD","NYSE ARCA","USD","IEX","America/New_York",null,null,null,null,null,"SHARES",null,null,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),List.of("1m","1d"),"UNKNOWN",longName);
        var row=ExistingMarketCatalogProvider.candidate(item,20);
        assertThat(row.name()).hasSize(200).doesNotContain("\n");
        assertThat(row.canonicalKey()).isEqualTo("LISTING:STOCK:NYSE ARCA:SPY");
    }
    @Test void ingestsOnlyPopularCryptoWithApprovedIconCoverage() {
        var bitcoin=new MarketDataProvider.Instrument("COINBASE:BTC-USD","BTC/USD","BTC-USD","COINBASE","CRYPTO","BTC","USD","Coinbase","USD","PUBLIC","UTC",null,null,null,null,null,"BASE_QUANTITY",null,null,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),List.of("1m"),"UNKNOWN","Bitcoin");
        var obscure=new MarketDataProvider.Instrument("COINBASE:JUNK-USD","JUNK/USD","JUNK-USD","COINBASE","CRYPTO","JUNK","USD","Coinbase","USD","PUBLIC","UTC",null,null,null,null,null,"BASE_QUANTITY",null,null,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),List.of("1m"),"UNKNOWN","Junk token");
        assertThat(ExistingMarketCatalogProvider.included(bitcoin)).isTrue();
        assertThat(ExistingMarketCatalogProvider.included(obscure)).isFalse();
    }
    private static String currency(String code,String name){return "{\"iso_code\":\""+code+"\",\"name\":\""+name+"\",\"end_date\":\"2026-09-10\"}";}
}
