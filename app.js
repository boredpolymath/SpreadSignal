const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const supportedRegions = ["United States", "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"];
$$('[data-region-select]').forEach(select => { const regions = select.hasAttribute("data-state-only") ? supportedRegions.slice(1) : supportedRegions; select.innerHTML = regions.map(region => `<option value="${region}">${region}</option>`).join(""); select.value = select.dataset.default || regions[0]; });
const modal = $("#modal"), backdrop = $("#modalBackdrop"), modalContent = $("#modalContent");
function openModal(title, html) { modalContent.innerHTML = `<h2 class="modal-title">${title}</h2><div class="modal-copy">${html}</div>`; backdrop.hidden = false; modal.showModal(); }
function closeModal() { modal.close(); backdrop.hidden = true; }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2600); }
function showView(id) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
  $$(".nav-item").forEach(button => {
    const active = button.dataset.view === id;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const title = {dashboard:"Regional dashboard",explore:"Data explorer",sources:"Sources & quality",plans:"Preparedness plans"}[id];
  $("#crumbTitle").textContent = title;
  window.scrollTo({top:0,behavior:"auto"});
  const heading = $(`#${id} h1`);
  heading.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => heading.focus({preventScroll:true}));
}
$$('.nav-item').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
$$('[data-go]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.go)));
$$('.metric-select').forEach(button => button.addEventListener('click', loadLiveData));

let activeSeries = [];
let activeRange = 12;
let liveRequestId = 0;
const rangeLabels = {4:"4 weeks",12:"12 weeks",26:"6 months",52:"1 year"};
const formatDate = value => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const formatShortDate = value => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const formatValue = value => Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 });
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const seriesPath = points => points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function renderLiveChart(series) {
  const values = series.map(item => item.value);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
  const points = series.map((item, index) => [index * (760 / Math.max(series.length - 1, 1)), 218 - ((item.value - min) / span) * 172]);
  const path = seriesPath(points);
  $("#linePath").setAttribute("d", path); $("#linePath").setAttribute("stroke", "#c8461f");
  $("#areaPath").setAttribute("d", `${path} L760,240 L0,240 Z`);
  $("#dataPoints").setAttribute("stroke", "#c8461f");
  $("#dataPoints").innerHTML = points.map(([cx, cy], index) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${index === points.length - 1 ? 5 : 4}"/>`).join("");
  const axis = [max, max - span * .25, max - span * .5, max - span * .75, min];
  $$(".y-axis span").forEach((element, index) => element.textContent = formatValue(axis[index]));
  const xAxis = $$(".x-axis span");
  xAxis.forEach((element, index) => element.textContent = formatShortDate(series[Math.round(index * (series.length - 1) / (xAxis.length - 1))].weekEnd));
}

function setLiveUnavailable(message) {
  $("#datasetStatus").textContent = "Source unavailable"; $("#datasetUpdated").textContent = "No cached or fallback data shown";
  $("#connectionText").textContent = "Source unavailable"; $("#lastSync").textContent = "Try again later";
  $("#wastewaterMetricValue").textContent = "—"; $("#wastewaterMetricUnit").textContent = "no estimate";
  $("#wastewaterTrend").innerHTML = `Unavailable <span>${message}</span>`;
  $("#reportingSites").textContent = "—"; $("#coverageTrend").innerHTML = "Unavailable <span>CDC source could not be reached</span>";
  $("#latestWeek").textContent = "—"; $("#sourceTrend").innerHTML = "Unavailable <span>No substitute data are shown</span>";
  $("#chartUnavailable").hidden = false; $(".chart-wrap").classList.add("is-unavailable"); $(".chart-legend").classList.add("is-unavailable");
  $("#chartUnavailable").innerHTML = `<b>Live data unavailable</b><span>${message}. SpreadSignal does not replace a failed source with fallback values.</span>`;
  $("#chartDateRange").textContent = "No live date range available";
}

function setLiveLoading() {
  $("#chartUnavailable").hidden = false; $(".chart-wrap").classList.add("is-unavailable"); $(".chart-legend").classList.add("is-unavailable");
  $("#chartUnavailable").innerHTML = `<b>Loading live CDC data</b><span>Retrieving the latest ${rangeLabels[activeRange]} of reported weekly activity.</span>`;
  $("#chartDateRange").textContent = "Loading live weekly data";
}

async function loadLiveData() {
  const requestId = ++liveRequestId;
  const region = $("#regionSelect").value, pathogen = $("#pathogenSelect").value;
  $("#regionTitle").textContent = region; $("#datasetStatus").textContent = "Refreshing CDC data"; $("#datasetUpdated").textContent = `Loading ${rangeLabels[activeRange]} of weekly records`;
  $("#connectionText").textContent = "Refreshing source"; setLiveLoading();
  const displayTimeout = setTimeout(() => {
    if (requestId === liveRequestId) setLiveUnavailable("The live source is taking longer than expected");
  }, 12_500);
  try {
    const series = await window.SpreadSignalData.getSeries({ pathogen, region, limit: activeRange });
    if (requestId !== liveRequestId) return;
    clearTimeout(displayTimeout);
    activeSeries = series;
    const latest = series.at(-1), previous = series.at(-2), change = latest.value - previous.value, direction = change > 0 ? "↑" : change < 0 ? "↓" : "→";
    const title = `${pathogen === "COVID-19" ? "SARS-CoV-2" : pathogen} wastewater viral activity`;
    $("#chartHeading").textContent = title; $("#chartSubline").textContent = "Weekly median wastewater viral activity level · CDC NWSS";
    $("#wastewaterMetricTitle").textContent = title; $("#wastewaterMetricValue").textContent = formatValue(latest.value); $("#wastewaterMetricUnit").textContent = "viral activity level";
    $("#wastewaterTrend").className = `metric-trend ${change > 0 ? "up" : change < 0 ? "down" : ""}`; $("#wastewaterTrend").innerHTML = `${direction} ${formatValue(Math.abs(change))} <span>from the prior reported week</span>`;
    $("#wastewaterCoverage").innerHTML = `${plural(latest.sites, "reporting site")} <b>•</b> week ending ${formatShortDate(latest.weekEnd)}`;
    $("#reportingSites").textContent = latest.sites; $("#coverageTrend").innerHTML = `CDC-reported <span>for the latest weekly estimate</span>`; $("#coverageFooter").textContent = "Site count is not population coverage";
    $("#latestWeek").textContent = formatShortDate(latest.weekEnd); $("#sourceTrend").innerHTML = "CDC weekly series <span>values may be revised</span>"; $("#sourceFooter").textContent = `Source updated ${latest.updated || "with the latest weekly release"}`;
    $("#pathogenMode").textContent = "CDC wastewater monitoring"; $("#pathogenModeCopy").textContent = `Weekly ${pathogen} wastewater viral activity is available for ${region}.`;
    $(".metric-select", $("[data-indicator='Wastewater concentration']")).setAttribute("aria-label", `Select ${title} for the Trend Explorer`);
    $("#datasetStatus").textContent = "CDC source"; $("#datasetUpdated").textContent = `Latest week: ${formatDate(latest.weekEnd)}`;
    $("#connectionText").textContent = "Live CDC source"; $("#lastSync").textContent = latest.updated || formatDate(latest.weekEnd);
    $("#provenanceMeta").textContent = `${pathogen} · ${region} · week ending ${formatDate(latest.weekEnd)}`; $("#sourceRetrieved").textContent = latest.updated || formatDate(latest.weekEnd);
    renderLiveChart(series);
    $("#chartUnavailable").hidden = true; $(".chart-wrap").classList.remove("is-unavailable"); $(".chart-legend").classList.remove("is-unavailable");
    $("#chartDateRange").textContent = `${formatShortDate(series[0].weekEnd)} — ${formatShortDate(latest.weekEnd)}`;
    $(".chart-callout p").innerHTML = `<b>Observed weekly change</b><span>The latest reported value is ${formatValue(Math.abs(change))} ${change === 0 ? "unchanged from" : `${change > 0 ? "higher than" : "lower than"}`} the prior reported week. This is not a forecast or measure of individual risk.</span>`;
  } catch (error) {
    if (requestId !== liveRequestId) return;
    clearTimeout(displayTimeout); activeSeries = []; setLiveUnavailable(error.message);
  }
}

$("#regionSelect").addEventListener("change", loadLiveData);
$("#pathogenSelect").addEventListener("change", loadLiveData);
$$('[data-range]').forEach(button => button.addEventListener('click', () => {
  activeRange = Number(button.dataset.range);
  $$('[data-range]').forEach(control => { const active = control === button; control.classList.toggle("active", active); control.setAttribute("aria-pressed", String(active)); });
  $("#rangeAnnouncement").textContent = `Showing the last ${rangeLabels[activeRange]} of reported weekly data.`;
  loadLiveData();
}));

function comparisonPoints(series, min, max) {
  const span = Math.max(max - min, 1);
  return series.map((item, index) => `${(index * 760 / Math.max(series.length - 1, 1)).toFixed(1)},${(174 - ((item.value - min) / span) * 138).toFixed(1)}`).join(" ");
}
async function runComparison() {
  const primary = $("#primaryRegionSelect").value, secondary = $("#secondaryRegionSelect").value, pathogen = $("#pathogenSelect").value;
  $("#comparisonPrimary").textContent = primary; $("#comparisonSecondary").textContent = secondary; $("#comparisonStatus").textContent = "Loading CDC data";
  try {
    const [first, second] = await Promise.all([window.SpreadSignalData.getSeries({ pathogen, region: primary, limit: activeRange }), window.SpreadSignalData.getSeries({ pathogen, region: secondary, limit: activeRange })]);
    const secondByWeek = new Map(second.map(item => [item.weekEnd, item]));
    const paired = first.map(item => [item, secondByWeek.get(item.weekEnd)]).filter(([, item]) => item).slice(-activeRange);
    if (paired.length < 2) throw new Error("The selected states do not have enough overlapping weekly data");
    const firstSeries = paired.map(([item]) => item), secondSeries = paired.map(([, item]) => item), values = [...firstSeries, ...secondSeries].map(item => item.value), min = Math.min(...values), max = Math.max(...values);
    $("#comparisonPrimaryLegend").textContent = primary; $("#comparisonSecondaryLegend").textContent = secondary;
    $("#comparisonPrimarySeries").setAttribute("points", comparisonPoints(firstSeries, min, max)); $("#comparisonSecondarySeries").setAttribute("points", comparisonPoints(secondSeries, min, max));
    const latestFirst = firstSeries.at(-1), latestSecond = secondSeries.at(-1), firstChange = latestFirst.value - firstSeries.at(-2).value, secondChange = latestSecond.value - secondSeries.at(-2).value;
    $("#comparisonLatest").innerHTML = `${formatValue(latestFirst.value)} <small>vs ${formatValue(latestSecond.value)}</small>`; $("#comparisonLatestNote").textContent = `${primary} vs ${secondary} · week ending ${formatShortDate(latestFirst.weekEnd)}`;
    $("#comparisonChange").innerHTML = `${firstChange >= 0 ? "↑" : "↓"} ${formatValue(Math.abs(firstChange))} <small>vs ${secondChange >= 0 ? "↑" : "↓"} ${formatValue(Math.abs(secondChange))}</small>`; $("#comparisonChangeNote").textContent = "Change from each state’s prior reported week.";
    $("#comparisonQuality").textContent = "Comparable"; $("#comparisonQualityNote").textContent = `Same CDC ${pathogen} wastewater measure; ${paired.length} overlapping weeks.`;
    $("#comparisonStatus").textContent = "Live CDC data"; $("#comparisonPeriod").textContent = `CDC data · ${paired.length} overlapping weeks`;
    $$(".comparison-axis span").forEach((element, index, array) => element.textContent = formatShortDate(firstSeries[Math.round(index * (firstSeries.length - 1) / (array.length - 1))].weekEnd));
  } catch (error) {
    $("#comparisonStatus").textContent = "Source unavailable"; $("#comparisonLatest").textContent = "—"; $("#comparisonLatestNote").textContent = error.message; $("#comparisonChange").textContent = "—"; $("#comparisonChangeNote").textContent = "No substitute values are shown."; $("#comparisonPrimarySeries").setAttribute("points", ""); $("#comparisonSecondarySeries").setAttribute("points", "");
  }
}
$("#interpretationButton").addEventListener("click", () => openModal("How to read this dashboard", `<p><strong>Observed</strong> means a source reported a measurement. It does not establish why it changed or what will happen next.</p><ul><li>Compare values only when the unit and reporting period are compatible.</li><li>Check age, coverage, and method before interpreting an apparent change.</li><li>Forecasts, when available, will use distinct labels.</li></ul>`));
$("#qualityButton").addEventListener("click", () => openModal("Quality notes", `<p class="modal-label">CDC WASTEWATER ACTIVITY</p><p><strong>Coverage:</strong> the reporting-site count shown on the dashboard identifies contributing sites for the latest weekly estimate. It is not a population-coverage measure.</p><p><strong>Comparability:</strong> compare only the same selected pathogen and overlapping reporting weeks.</p><p><strong>Freshness:</strong> CDC updates this source weekly, and historical values may be revised.</p>`));
$("#metadataButton").addEventListener("click", () => openModal("Dataset metadata", `<p><strong>Provider:</strong> Centers for Disease Control and Prevention National Wastewater Surveillance System.</p><p><strong>Indicator:</strong> Weekly wastewater viral activity level for ${$("#pathogenSelect").value}.</p><p><strong>Aggregation:</strong> SpreadSignal requests a weekly median across the CDC-reported sites for the selected state or the United States.</p><p><strong>Coverage:</strong> reporting-site count is shown with every latest estimate; it is not a population-coverage estimate.</p><p><a href="${window.SpreadSignalData.sourceUrl}" target="_blank" rel="noreferrer">Open the CDC dataset</a></p>`));
$("#sourceLink").addEventListener("click", () => showView("sources"));
$("#compareButton").addEventListener("click", () => { showView("explore"); });
$("#runCompare").addEventListener("click", runComparison);
$("#aboutButton").addEventListener("click", () => openModal("About SpreadSignal", `<p>SpreadSignal is a public, source-linked workspace for reading U.S. outbreak surveillance signals with their limitations in view.</p><p>This release currently supports weekly CDC wastewater activity for COVID-19, Influenza A, and RSV. It is not medical advice, a diagnosis, or a forecast.</p>`));
$("#closeModal").addEventListener("click", closeModal); backdrop.addEventListener("click", closeModal);
$("#exportButton").addEventListener("click", () => { if (!activeSeries.length) { toast("Live data is not available to export"); return; } const rows = ["pathogen,region,week_end,viral_activity_level,reporting_sites,source", ...activeSeries.map(row => [$("#pathogenSelect").value, $("#regionSelect").value, row.weekEnd, row.value, row.sites, "CDC National Wastewater Surveillance System"].map(value => `\"${String(value).replaceAll("\"", "\"\"")}\"`).join(","))]; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n")], {type:"text/csv"})); a.download = "spreadsignal-cdc-wastewater.csv"; a.click(); URL.revokeObjectURL(a.href); toast("CDC source data exported"); });
$$('.definition').forEach(button => button.addEventListener('click', () => openModal("Indicator definition", `<p><strong>${$("#chartHeading").textContent}</strong></p><p>This view displays a CDC weekly wastewater viral activity level. It is a community-level surveillance signal, not a diagnosis, individual risk measure, or forecast.</p>`)));
$("#reviewSourceButton").addEventListener("click", () => showView("dashboard"));
const thresholdLabels = {1:"One weekly increase",2:"Two consecutive weekly increases",3:"Three consecutive weekly increases"};
$("#thresholdRange").addEventListener("input", e => { $("#thresholdLabel").textContent = thresholdLabels[e.target.value]; });
function planValues() { return { org: $("#orgName").value.trim() || "Unnamed organization", owner: $("#planOwner").value.trim() || "No owner assigned", scenario: $("#scenarioSelect").value, threshold: $("#thresholdLabel").textContent, actions: $$(".action-option input:checked").map(x => x.value) }; }
$("#previewPlan").addEventListener("click", () => { const p = planValues(); const actions = p.actions.length ? `<ul>${p.actions.map(a => `<li>${a}</li>`).join("")}</ul>` : "<p>No preparedness actions selected.</p>"; openModal("Preparedness plan preview", `<p class="modal-label">DRAFT · HUMAN APPROVAL REQUIRED</p><p><strong>${p.org}</strong><br>${p.scenario}</p><p><strong>Review threshold:</strong> ${p.threshold}<br><strong>Plan owner:</strong> ${p.owner}</p><p><strong>Selected actions</strong></p>${actions}<p>This is an organizational planning aid, not medical advice or an automatic response trigger.</p>`); });
$("#approvePlan").addEventListener("click", () => { const p = planValues(); if (p.owner === "No owner assigned") { toast("Add a plan owner before marking the plan reviewed"); $("#planOwner").focus(); return; } const content = ["SPREADSIGNAL — PREPAREDNESS PLAN", "", `Organization: ${p.org}`, `Scenario: ${p.scenario}`, `Review threshold: ${p.threshold}`, `Plan owner: ${p.owner}`, "Status: Human reviewed", "", "Selected actions:", ...p.actions.map(a => `- ${a}`), "", "Note: This is an organizational planning aid. It is not medical advice and does not trigger actions automatically."].join("\n"); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([content],{type:"text/plain"})); a.download="preparedness-plan.txt"; a.click(); URL.revokeObjectURL(a.href); $("#planStatus").textContent="Reviewed · export created"; $("#planSummary").textContent=`${p.owner} reviewed this plan for ${p.org}.`; toast("Human-reviewed plan exported"); });
$("#loadPlan").addEventListener("click", () => { $("#orgName").value="Northside Community Center"; $("#planOwner").value="Operations director"; $("#scenarioSelect").value="Prepare for sustained indicator increase"; $("#thresholdRange").value=2; $("#thresholdLabel").textContent=thresholdLabels[2]; $$(".action-option input").forEach((x,i)=>x.checked=i<3); toast("Sample preparedness plan loaded"); });
loadLiveData();
if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.map(registration => registration.unregister()))).catch(() => {});
