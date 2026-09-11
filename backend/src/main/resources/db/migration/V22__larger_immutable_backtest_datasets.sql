ALTER TABLE trading.market_dataset DROP CONSTRAINT market_dataset_candle_count_check;
ALTER TABLE trading.market_dataset ADD CONSTRAINT market_dataset_candle_count_check
    CHECK (candle_count BETWEEN 1 AND 20000);

ALTER TABLE trading.backtest_job DROP CONSTRAINT backtest_job_candle_count_check;
ALTER TABLE trading.backtest_job ADD CONSTRAINT backtest_job_candle_count_check
    CHECK (candle_count BETWEEN 1 AND 20000);
