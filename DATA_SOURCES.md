# Data sources and interpretation

## Current public data source

SpreadSignal queries the [CDC Wastewater Viral Activity Level dataset](https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Viral-Activity-Level-for-SARS-CoV-2/atcp-73re) from the National Wastewater Surveillance System (NWSS).

The current public release supports only:

- SARS-CoV-2 (displayed as COVID-19)
- Influenza A
- RSV

For each selected state or the United States, SpreadSignal requests up to 12 weekly records and displays the median wastewater viral activity level across reported sites. The dashboard also shows the number of reporting sites in the latest week.

## Important limits

- A reporting-site count is not population coverage.
- Data can be revised by CDC as additional reports arrive.
- A wastewater trend is not a forecast, diagnosis, individual risk estimate, or a directive to take action.
- State comparisons are limited to the same selected pathogen and common reporting weeks.
- If the source fails or comparable weeks are unavailable, no replacement values are displayed.

## Source access

SpreadSignal publishes a same-origin weekly snapshot generated from the public CDC API at `https://data.cdc.gov/resource/atcp-73re.json`. This lets the dashboard load without a browser-to-CDC cross-site request. The snapshot is refreshed automatically every Friday after the CDC weekly update; if it is unavailable, the app attempts the public CDC endpoint directly. SpreadSignal does not send user identifiers, selected regions, or browsing activity to a SpreadSignal server.

For the CDC’s methodology and current coverage notes, consult the dataset and the [CDC state/territory wastewater page](https://www.cdc.gov/wastewater/respiratory-viruses/state.html).
