# Test cases

| ID | Scenario | Evidence |
|---|---|---|
| C-01 | Forex category shows base/quote flag icon and accessible label | PASS — `LiveChartForex.test.tsx` |
| C-02 | Select EUR/USD locks provider to ECB EOD and timeframe to 1D | PASS — existing Forex test |
| C-03 | Fixed UTC+07:00 formats 00:00Z as 07:00 without invalid Intl zone | PASS — `chartTimezone.test.ts` |
| C-04 | IANA Asia/Ho_Chi_Minh and ET labels remain available | PASS — `chartTimezone.test.ts` |
| C-05 | Time axis and crosshair share the chart timezone | PASS — both call shared `formatChartDate` |
