package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class InstrumentCatalogPersistenceTests {
    @Autowired InstrumentCatalogStore store;
    @Autowired JdbcTemplate jdbc;
    private final InstrumentCatalogProvider.Descriptor descriptor=new InstrumentCatalogProvider.Descriptor("TEST_CATALOG",List.of("STOCK","FOREX"),20,true,false,"test");
    @BeforeEach void clear(){jdbc.update("DELETE FROM trading.instrument_alias");jdbc.update("DELETE FROM trading.instrument_provider_mapping");jdbc.update("DELETE FROM trading.market_instrument");jdbc.update("DELETE FROM trading.instrument_catalog_sync");}

    @Test void persistsExchangeCollisionsAliasesPaginationAndLastKnownGood() {
        var rows=new ArrayList<InstrumentCatalogProvider.Candidate>();
        rows.add(candidate("STOCK","NASDAQ","AAPL","Apple Inc",null,null));
        rows.add(candidate("STOCK","ASX","AAPL","AAPL Australia",null,null));
        rows.add(candidate("FOREX","FX","EUR-USD","Euro / U.S. Dollar","EUR","USD"));
        for(int index=0;index<55;index++)rows.add(candidate("STOCK","NYSE","T"+String.format("%02d",index),"Test "+index,null,null));
        store.replaceSnapshot(descriptor,rows);
        assertThat(store.search("AAPL","STOCK","","",true,null).items()).hasSize(2).extracting(MarketDataProvider.Instrument::exchange).containsExactlyInAnyOrder("NASDAQ","ASX");
        assertThat(store.search("EUR/USD","FOREX","","",true,null).items()).singleElement().extracting(MarketDataProvider.Instrument::displaySymbol).isEqualTo("EUR/USD");
        var first=store.search("","STOCK","","",true,null);assertThat(first.items()).hasSize(50);assertThat(first.nextCursor()).isNotNull();assertThat(store.search("","STOCK","","",true,first.nextCursor()).items()).hasSize(7);
        assertThatThrownBy(()->store.search("AAPL","STOCK","","",true,first.nextCursor())).isInstanceOf(IllegalArgumentException.class);
        store.failed("TEST_CATALOG","CATALOG_PROVIDER_UNAVAILABLE");
        assertThat(store.search("AAPL","STOCK","","",true,null).items()).hasSize(2);
        assertThatThrownBy(()->store.replaceSnapshot(descriptor,List.of())).isInstanceOf(IllegalArgumentException.class);
        assertThat(store.search("AAPL","STOCK","","",true,null).items()).hasSize(2);
    }

    @Test void cursorIsBoundToTheSearchAndSpotDoesNotMergeWithFuture() {
        var spot=candidate("COMMODITY","SPOT","XAU-USD","Gold spot","XAU","USD");
        var future=new InstrumentCatalogProvider.Candidate(InstrumentCatalogProvider.listingKey("FUTURES","COMEX","GC1!"),"FUTURES","GC1!","GC1!","GC1!","Gold futures","COMEX",null,null,null,"USD",null,null,"Future",null,null,"TEST_CATALOG",20,List.of("HISTORICAL"),List.of("1d"),"America/New_York",null,List.of("Gold futures"));
        store.replaceSnapshot(new InstrumentCatalogProvider.Descriptor("TEST_CATALOG",List.of("COMMODITY","FUTURES"),20,true,false,"test"),List.of(spot,future));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM trading.market_instrument",Integer.class)).isEqualTo(2);
        assertThatThrownBy(()->store.search("GC","FUTURES","","",true,"../../secret")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void reconcilesRoutableStockMappingToReferenceEtfIdentity() {
        var alpaca=new InstrumentCatalogProvider.Descriptor("ALPACA",List.of("STOCK","ETF"),20,true,true,"6h");
        var alpacaSpy=new InstrumentCatalogProvider.Candidate(InstrumentCatalogProvider.listingKey("STOCK","NYSE ARCA","SPY"),"STOCK","SPY","SPY","SPY","SPDR S&P 500 ETF Trust","NYSE ARCA",null,null,"US","USD","SPY","USD","STOCK",null,null,"ALPACA",20,List.of("HISTORICAL","REALTIME"),List.of("1m","1d"),"America/New_York",null,List.of());
        store.replaceSnapshot(alpaca,List.of(alpacaSpy));
        var reference=new InstrumentCatalogProvider.Descriptor("FREE_TICKER_DB",List.of("STOCK","ETF"),30,true,false,"24h");
        var referenceSpy=new InstrumentCatalogProvider.Candidate("IDENTIFIER:ETF:ISIN:US78462F1030:EXCHANGE:NYSE ARCA","ETF","SPY","SPY","SPY","SPDR S&P 500 ETF Trust","NYSE ARCA",null,"United States","US","USD",null,null,"ETF","US78462F1030",null,"FREE_TICKER_DB",30,List.of(),List.of(),null,null,List.of());
        store.replaceSnapshot(reference,List.of(referenceSpy));
        assertThat(store.search("SPY","ETF","NYSE ARCA","US",true,null).items()).singleElement().satisfies(item->{assertThat(item.provider()).isEqualTo("ALPACA");assertThat(item.supportedModes()).containsExactly("HISTORICAL","REALTIME");});
        assertThat(store.search("SPY","STOCK","NYSE ARCA","US",true,null).items()).isEmpty();
        store.replaceSnapshot(alpaca,List.of(alpacaSpy));
        assertThat(store.search("SPY","ETF","NYSE ARCA","US",true,null).items()).singleElement().extracting(MarketDataProvider.Instrument::provider).isEqualTo("ALPACA");
        assertThat(store.search("SPY","STOCK","NYSE ARCA","US",true,null).items()).isEmpty();
    }

    @Test void ranksExactSymbolBeforeContainsMatches() {
        store.replaceSnapshot(descriptor,List.of(candidate("STOCK","NYSE","3SPY","Contains first alphabetically",null,null),candidate("STOCK","NYSE","SPY","Exact symbol",null,null),candidate("STOCK","NYSE","SPYX","Contains after",null,null)));
        assertThat(store.search("SPY","STOCK","","",true,null).items()).extracting(MarketDataProvider.Instrument::displaySymbol).containsExactly("SPY","3SPY","SPYX");
    }

    @Test void prioritizesFeaturedSymbolsAcrossAssetClassesForEmptySearch() {
        var mixed=new InstrumentCatalogProvider.Descriptor("TEST_CATALOG",List.of("CRYPTO","STOCK","ETF","FOREX","COMMODITY"),20,true,false,"test");
        var btc=candidate("CRYPTO","SPOT","BTC-USD","Bitcoin","BTC","USD");
        var eur=candidate("FOREX","SPOT","EUR-USD","Euro / U.S. Dollar","EUR","USD");
        var gold=candidate("COMMODITY","SPOT","XAU-USD","Gold / U.S. Dollar","XAU","USD");
        store.replaceSnapshot(mixed,List.of(candidate("STOCK","NASDAQ","ZZZZ","Alphabetic tail",null,null),candidate("STOCK","NASDAQ","AAPL","Apple",null,null),candidate("ETF","NYSE ARCA","SPY","SPDR",null,null),btc,eur,gold));
        assertThat(store.search("","","","",true,null).items()).extracting(MarketDataProvider.Instrument::displaySymbol).startsWith("BTC/USD","AAPL","SPY","EUR/USD","XAU/USD");
    }

    @Test void prefersUsdQuoteForFeaturedCrypto() {
        var crypto=new InstrumentCatalogProvider.Descriptor("TEST_CATALOG",List.of("CRYPTO"),20,true,false,"test");
        store.replaceSnapshot(crypto,List.of(candidate("CRYPTO","SPOT","SOL-BNB","Solana / BNB","SOL","BNB"),candidate("CRYPTO","SPOT","SOL-USD","Solana / US Dollar","SOL","USD")));
        assertThat(store.search("","CRYPTO","","",true,null).items()).extracting(MarketDataProvider.Instrument::displaySymbol).containsExactly("SOL/USD","SOL/BNB");
    }

    private static InstrumentCatalogProvider.Candidate candidate(String asset,String exchange,String symbol,String name,String base,String quote){String key=base==null?InstrumentCatalogProvider.listingKey(asset,exchange,symbol):InstrumentCatalogProvider.pairKey(asset,base,quote,"SPOT");return new InstrumentCatalogProvider.Candidate(key,asset,symbol,symbol.replace('-','/'),symbol,name,exchange,null,null,null,quote,base,quote,asset,null,null,"TEST_CATALOG",20,List.of("HISTORICAL"),List.of("1d"),"UTC",null,List.of(name));}
}
