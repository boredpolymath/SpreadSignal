# Data sources and interpretation

## Current public data source

SpreadSignal queries the [CDC Wastewater Viral Activity Level dataset](https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Viral-Activity-Level-for-SARS-CoV-2/atcp-73re) from the National Wastewater Surveillance System (NWSS).

The current public release supports only:

- SARS-CoV-2 (displayed as COVID-19)
- Influenza A
- RSV

The dashboard also provides companion signals that are deliberately kept separate from wastewater activity:

- CDC NHSN weekly hospital-admission rates for COVID-19, influenza, and RSV, available by state and territory.
- CDC acute respiratory illness activity from emergency-department data, available by state and territory. This is a broad respiratory-syndrome measure, not a pathogen-specific count.
- CDC NNDSS weekly provisional reports for currently available reportable-condition series, including pertussis, mpox, and measles. Measles combines CDC's indigenous and imported categories.

For each selected state or the United States, SpreadSignal requests 4, 12, 26, or 52 weekly records and displays the median wastewater viral activity level across reported sites. The dashboard also shows the number of reporting sites in the latest week.

## Important limits

- A reporting-site count is not population coverage.
- Data can be revised by CDC as additional reports arrive.
- A wastewater trend is not a forecast, diagnosis, individual risk estimate, or a directive to take action.
- State comparisons are limited to the same selected pathogen and common reporting weeks.
- Hospital admission rates and emergency-department activity are not published as a U.S. total in the datasets used here, so SpreadSignal does not calculate its own national aggregate.
- NNDSS weekly reports are provisional and can be revised as states complete case follow-up.
- If the source fails or comparable weeks are unavailable, no replacement values are displayed.

## Source access

SpreadSignal requests the public CDC API at `https://data.cdc.gov/resource/atcp-73re.json` first, so the dashboard reflects the CDC's current public release. If CDC's endpoint is unavailable, the app uses a same-origin weekly snapshot generated from that same source. The snapshot is refreshed automatically every Friday after the CDC weekly update. The dashboard labels which source supplied the displayed result, and SpreadSignal does not send user identifiers, selected regions, or browsing activity to a SpreadSignal server.

For the CDC’s methodology and current coverage notes, consult the dataset and the [CDC state/territory wastewater page](https://www.cdc.gov/wastewater/respiratory-viruses/state.html).
