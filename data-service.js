/*
 * Public CDC NWSS adapter.
 * SpreadSignal requests only state- or national-level weekly aggregates; it
 * neither stores nor republishes site-level records in the browser.
 */
(() => {
  const ENDPOINT = "https://data.cdc.gov/resource/atcp-73re.json";
  const HOSPITAL_ENDPOINT = "https://data.cdc.gov/resource/vdzy-6i9v.json";
  const ED_ENDPOINT = "https://data.cdc.gov/resource/f3zz-zga5.json";
  const NNDSS_ENDPOINT = "https://data.cdc.gov/resource/x9gk-5huc.json";
  const SNAPSHOT = "./data/cdc-wastewater.json";
  const TARGETS = { "COVID-19": "SARS-CoV-2", "Influenza A": "Influenza A", RSV: "RSV" };
  const STATE_CODES = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY" };
  const HOSPITAL_FIELDS = { "COVID-19": ["totalconfc19newadmper100k", "totalconfc19newadmper100klevel", "totalconfc19newadmperchosprep"], "Influenza A": ["totalconfflunewadmper100k", "totalconfflunewadmper100klevel", "totalconfflunewadmperchosprep"], RSV: ["totalconfrsvnewadmper100k", "totalconfrsvnewadmper100klevel", "totalconfrsvnewadmperchosprep"] };
  const REPORTED_CONDITIONS = { Pertussis: ["Pertussis"], Mpox: ["Mpox"], Measles: ["Measles, Indigenous", "Measles, Imported"] };
  const cache = new Map();
  let snapshot;

  const query = async (params, endpoint = ENDPOINT) => {
    const url = new URL(endpoint);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { mode: "cors", cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`CDC data request failed (${response.status})`);
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error("CDC returned an unexpected response");
      return body;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The CDC data source did not respond within 12 seconds");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  const escapeSocrata = value => String(value).replace(/'/g, "''");
  const getSnapshot = async () => {
    if (snapshot) return snapshot;
    const response = await fetch(SNAPSHOT, { cache: "no-store" });
    if (!response.ok) throw new Error(`Published CDC snapshot failed to load (${response.status})`);
    const body = await response.json();
    if (!Array.isArray(body.rows)) throw new Error("Published CDC snapshot is invalid");
    snapshot = body;
    return snapshot;
  };
  const seriesQuery = (target, region, limit) => {
    const where = [`pathogen_target='${escapeSocrata(target)}'`];
    if (region !== "United States") where.push(`state_territory='${escapeSocrata(region)}'`);
    return {
      "$select": "week_end,median(site_wval) as value,count(*) as reporting_sites,max(date_updated) as date_updated",
      "$where": where.join(" AND "),
      "$group": "week_end",
      "$order": "week_end DESC",
      "$limit": String(limit)
    };
  };

  const getSeries = async ({ pathogen, region, limit = 12 }) => {
    const target = TARGETS[pathogen];
    if (!target) throw new Error("This pathogen is not available in the public release");
    const key = `${target}|${region}|${limit}`;
    if (cache.has(key)) return cache.get(key);
    let rows;
    let source;
    try {
      rows = await query(seriesQuery(target, region, limit));
      source = "live";
    } catch (liveError) {
      try {
        const published = await getSnapshot();
        rows = published.rows.filter(row => row.pathogen_target === target && row.state_territory === region).slice(0, limit);
        source = "snapshot";
      } catch {
        throw liveError;
      }
    }
    const series = rows
      .map(row => ({ weekEnd: row.week_end, value: Number(row.value), sites: Number(row.reporting_sites), updated: row.date_updated }))
      .filter(row => row.weekEnd && Number.isFinite(row.value) && row.sites > 0)
      .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
    if (series.length < 2) throw new Error("CDC does not currently provide enough comparable weeks for this selection");
    const result = { series, source };
    cache.set(key, result);
    return result;
  };

  const getHospitalImpact = async ({ pathogen, region }) => {
    const jurisdiction = STATE_CODES[region];
    if (!jurisdiction) throw new Error("CDC publishes this hospital measure for states and territories, not a U.S. total");
    const [rateField, levelField, completenessField] = HOSPITAL_FIELDS[pathogen] || [];
    if (!rateField) throw new Error("This pathogen is not available in the hospital dataset");
    const rows = await query({
      "$select": `weekendingdate,${rateField} as rate,${levelField} as level,${completenessField} as completeness`,
      "$where": `jurisdiction='${jurisdiction}'`, "$order": "weekendingdate DESC", "$limit": "1"
    }, HOSPITAL_ENDPOINT);
    const row = rows[0];
    if (!row || !Number.isFinite(Number(row.rate))) throw new Error("CDC does not currently provide a comparable hospital admission rate for this selection");
    return { weekEnd: row.weekendingdate, rate: Number(row.rate), level: row.level || "Not classified", completeness: Number(row.completeness) };
  };

  const getEmergencyActivity = async ({ region }) => {
    if (region === "United States") throw new Error("CDC publishes this emergency-department activity level by state and territory");
    const rows = await query({
      "$select": "week_end,geography,label,buildnumber", "$where": `geography='${escapeSocrata(region)}'`, "$order": "week_end DESC", "$limit": "1"
    }, ED_ENDPOINT);
    const row = rows[0];
    if (!row || !row.label || row.label === "Data Unavailable") throw new Error("CDC does not currently provide emergency-department activity for this selection");
    return { weekEnd: row.week_end.slice(0, 10), level: row.label };
  };

  const getReportedCases = async ({ region, condition }) => {
    const labels = REPORTED_CONDITIONS[condition];
    if (!labels) throw new Error("This reportable condition is not supported");
    const reportingArea = region === "United States" ? "Total" : region;
    const labelsClause = labels.map(label => `'${escapeSocrata(label)}'`).join(",");
    const rows = await query({
      "$select": "year,week,label,m1,m1_flag,m3,sort_order", "$where": `states='${escapeSocrata(reportingArea)}' AND label IN(${labelsClause})`, "$order": "sort_order DESC", "$limit": "16"
    }, NNDSS_ENDPOINT);
    const latest = rows[0];
    if (!latest) throw new Error("CDC does not currently provide this reported-case series for the selection");
    const period = `${latest.year}-${latest.week}`;
    const currentRows = rows.filter(row => `${row.year}-${row.week}` === period);
    const cases = currentRows.reduce((total, row) => total + (Number.isFinite(Number(row.m1)) ? Number(row.m1) : 0), 0);
    const yearToDate = currentRows.reduce((total, row) => total + (Number.isFinite(Number(row.m3)) ? Number(row.m3) : 0), 0);
    return { condition, cases, yearToDate, year: latest.year, week: latest.week };
  };

  window.SpreadSignalData = {
    supportedPathogens: Object.freeze(Object.keys(TARGETS)),
    sourceName: "CDC National Wastewater Surveillance System",
    sourceUrl: "https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Viral-Activity-Level-for-SARS-CoV-2/atcp-73re",
    getSeries, getHospitalImpact, getEmergencyActivity, getReportedCases,
    reportedConditions: Object.freeze(Object.keys(REPORTED_CONDITIONS))
  };
})();
