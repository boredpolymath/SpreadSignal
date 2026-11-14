/*
 * Public CDC NWSS adapter.
 * SpreadSignal requests only state- or national-level weekly aggregates; it
 * neither stores nor republishes site-level records in the browser.
 */
(() => {
  const ENDPOINT = "https://data.cdc.gov/resource/atcp-73re.json";
  const SNAPSHOT = "./data/cdc-wastewater.json";
  const TARGETS = { "COVID-19": "SARS-CoV-2", "Influenza A": "Influenza A", RSV: "RSV" };
  const cache = new Map();
  let snapshot;

  const query = async params => {
    const url = new URL(ENDPOINT);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
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

  const escapeSocrata = value => String(value).replaceAll("'", "''");
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
    try {
      const published = await getSnapshot();
      rows = published.rows.filter(row => row.pathogen_target === target && row.state_territory === region).slice(0, limit);
    } catch {
      rows = await query(seriesQuery(target, region, limit));
    }
    const series = rows
      .map(row => ({ weekEnd: row.week_end, value: Number(row.value), sites: Number(row.reporting_sites), updated: row.date_updated }))
      .filter(row => row.weekEnd && Number.isFinite(row.value) && row.sites > 0)
      .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
    if (series.length < 2) throw new Error("CDC does not currently provide enough comparable weeks for this selection");
    cache.set(key, series);
    return series;
  };

  window.SpreadSignalData = {
    supportedPathogens: Object.freeze(Object.keys(TARGETS)),
    sourceName: "CDC National Wastewater Surveillance System",
    sourceUrl: "https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Viral-Activity-Level-for-SARS-CoV-2/atcp-73re",
    getSeries
  };
})();
