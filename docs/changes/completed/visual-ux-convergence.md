# Visual + UX Convergence

## Status
Completed

## Background

The four approved UX references under `docs/ux/reference/` show a denser analytics system than the current browser pages. This change converges the running Overview, Activity, Capability, and Team Drill-down pages to those references while preserving confirmed business behavior and metric meanings.

The repository already has a complete design system, analytics components, and chart tokens. The implementation should extend those owners and keep the work sequential: Overview, Activity, Capability, Team Drill-down, then global consistency.

## Requirement

- Match the approved references in app shell, section composition, density, KPI treatment, charts, type, surfaces, and spacing.
- Keep existing routes, permissions, URL filters, API contracts, metric formulas, missing-value behavior, and maturity semantics unless an explicit business decision changes them.
- Use real-browser screenshots at 1920×1080 for every target page. Also use 2560×1440 for Overview, Activity, and Team Drill-down.
- Require at least two fresh independent UX reviews per page. Do not advance to the next page until the current page receives a valid PASS. Finish with a separate global consistency review.
- Keep browser document scrolling as the only primary vertical scroll owner and prevent page-level horizontal overflow.
- Complete the required functional and documentation gates and retain screenshots and review history as evidence.

## Current Behavior

- Overview shows two four-card KPI rows using temporary IR-source totals, a master IR trend beside the FactRecord lifecycle overview, then maturity and team performance side by side. Its lifecycle has six accepted tiles: `需求` uses the `sa` source, `测试` uses `tcg`, and source activity/metric names remain visible; `tce` is the real-flow extension after testing. The code-review tile and `dta`/`dtf` are omitted from this strip. Code-review/general-capability maturity remains in its proper category; no `mrr` values are borrowed into lifecycle slots. Included activities use matching FactRecord `penetration` and `efficiency` types, and unsupported slots remain missing. The Activity page and maturity data retain their full scope. The maturity matrix includes a zero swatch and a 1.0–5.0 scale; the Team Matrix groups each KPI's value and change using established monthly/cycle semantics. Sparse team months are aligned to the chart axis rather than shifted across periods.
- Activity and Capability use the shared directory/workspace and existing metric-aware empty states.
- Team Drill-down uses the established overall-performance, lifecycle, maturity story and current metric summaries.
- The desktop shell has a light 248px sidebar, a 56px topbar with breadcrumbs, role-filtered page search, common entries including `团队详情` to the Overview team-performance anchor, account/session actions, and a disabled-notification state, plus fluid analytics content.
- The latest isolated-demo Overview browser run at 1920×1080 and 2560×1440 shows one document scroll owner, no page-level horizontal overflow, no API failures, and no visible alerts. The default application database remains untouched.

## Target Behavior

Converge each target page to its approved reference and the relevant sections of `docs/ux/UX-REDESIGN-SPEC.md`. Preserve current activity-metric names and units in activity details, keep FactRecord `company_average` separate from maturity `领域平均`, and retain missing values.

For the Overview lifecycle, use the accepted six tiles and their reference order: `需求`, `SE设计`, `开发设计`, `编码开发`, `测试`, and `测试用例执行`. Map `需求` to the existing `sa` FactRecord and `测试` to `tcg`, while showing each source activity and original metric name; keep `se`, `dd`, and `cd` on their matching stages and `tce` after `测试`. Omit the code-review tile and `dta`/`dtf` from this Overview strip; do not substitute general `mrr` metrics. Included activities with unsupported metric types keep missing slots.

For Activity, preserve the 220–240px directory and use its selected key activity as the sole FactRecord scope. Show two rows of four KPI slots for the selected month and selected statistic cycle. Penetration/efficiency KPI values use the matching activity `domain_summary` raw inputs; their trends and team-comparison rows use the same metric's `company_average`/team values. Coverage count sums the matching penetration numerator, and saved workload sums numerator minus denominator from the matching efficiency metric. Count/workload KPI totals use activity FactRecord `domain_summary` inputs and retain the source metric label. A missing type/fact stays missing; do not use Overview IR data or substitute a ratio/count metric. The paired trend charts show only matching penetration and efficiency metrics. Below team difference, preserve three distinct reference zones: metric/business-volume decomposition, AI saved-workload trend, and raw-indicator summary. The decomposition may show an `已覆盖 / 未覆盖` volume split only from the matching penetration metric's valid numerator/denominator; never import IR category data or fabricate categories, and suppress the split when facts are missing or the values cannot form a valid subset. The workload trend sums `numerator - denominator` from the selected activity's matching efficiency FactRecords by month, retaining gaps. The raw-indicator summary keeps the original catalog names and reports same-metric `company_average`, selected-period change, and valid-team coverage; the existing decomposition table continues to expose merged raw inputs and fact counts. Non-KPI activity metrics remain in the detail/evidence section.

The user resolved the two Overview decisions on 2026-09-25:

1. Use the four global KPI labels. Until their final business definitions are approved, source their first-pass values from IR requirements: `ai_assisted` status supplies AI demand penetration and covered-demand count; total estimated/actual workload on AI-assisted IRs supplies AI efficiency and saved workload. For this temporary mapping, penetration divides AI-true IR records by IR records with a known true/false AI attribute; efficiency is `(Σestimated - Σactual) / Σactual`, retaining the existing 0.5 fallback when actual is non-positive; saved workload is `Σ(estimated - actual)` in person-days. Missing AI status and incomplete workload pairs stay missing. SA/SE workload fields are not added to the total fields, avoiding double counting.
2. Treat the approved acceptance reference as the primary layout: place the master trend beside the lifecycle overview. This resolves the goal file's conflicting full-width chart instruction for this task.
3. Natural document scrolling is approved. Match the reference's card and chart proportions, readable spacing, and radar scale; do not compress the page to fit every section inside the 1080px first viewport.
4. In the Overview key-activity lifecycle only, temporarily omit activity codes `dta` (DTS缺陷分析) and `dtf` (DTS缺陷修复). Keep both activities, their facts, maturity, and the eight-item Activity page intact.
5. Add the maturity heat scale beneath the Overview matrix. Because the accepted score range includes valid zero, show a distinct 0.0 swatch and the 1.0–5.0 maturity scale; missing remains separate.
6. Add value/change subcolumns to each Team Performance KPI group. Month changes follow the same-metric month-over-month difference; cycle changes follow the existing KPI cycle semantics. Keep missing comparisons as missing and calculate the visible average-row change from the equal-weight team-matrix values.

These KPI formulas and source mapping are provisional and must remain visibly identified as IR-based. The lifecycle overview normalizes only the presentation: it reads each activity's existing FactRecord metric by type, retains the original catalog name in the chart description, and shows a missing state when a type is absent. Activity pages and detail records keep their original names and formulas. Do not use IR values to fabricate activity facts or treat a reviewer PARTIAL/FAIL as PASS.

## Design

- Reuse the existing `MetricKpiCard`, `AnalyticsPanel`, `ChartCard`, `AnalyticsSection`, chart options, semantic tokens, `AppShell`, and route state.
- Keep the reference's `团队详情` navigation entry without inventing a team picker: link it to the existing Overview Team Performance section, where selecting a team opens the existing Team Drill-down route. Preserve current URL filters.
- Compact desktop Overview KPI cards by placing the existing sparkline beside value/comparison content; preserve its visible area and keep natural document scrolling.
- Make the smallest UI changes needed to converge each reviewed page. Do not add a charting or icon dependency.
- Implement and gate one page at a time. Capture screenshots, obtain a fresh independent review, fix every critical/major gap, and repeat with a new reviewer.
- After all four pages pass, obtain a separate reviewer for global consistency. Include the approved references, final screenshots, and UX specification only.
- Carry forward the outstanding browser-only checks in `sidebar-light-logo-refresh.md`; verify the existing 390px fallback and shell interactions without expanding the redesign target beyond desktop.

### Overview Implementation Plan

1. Add a read-only IR overview aggregation in `backend/app/data_management.py`, expose it through `backend/app/data_api.py` and a response schema in `backend/app/schemas.py`. It will return monthly, per-team IR facts and domain totals for a bounded month range and selected version; missing AI status/workload remains explicit.
2. Add `frontend/src/overview/irKpiData.js` as the narrow IR-source fetch/summary owner, separate from the existing FactRecord `metricData.js` path. Rewire the monthly/cycle cards, master trend, team matrix, and team previews in `frontend/src/analytics/AnalyticsPages.jsx` to this source.
3. In the Overview lifecycle, present the two required slots—AI需求渗透率 and AI研发提效—for each included activity, selecting the existing FactRecord metric by its `penetration` or `efficiency` type. Omit the code-review tile plus `dta` and `dtf` from this Overview section only. If an included activity has no matching type, show missing; never substitute an execution rate or another metric. Keep the original catalog metric name available in chart descriptions/tooltips.
4. Pair the master trend and lifecycle overview in `frontend/src/analytics/AnalyticsPages.jsx` / `frontend/src/analytics/analytics.css`, following the approved acceptance reference.
5. Add the maturity matrix's zero swatch and 1.0–5.0 heat scale; add value/change subcolumns to Overview team performance, using the existing month/cycle delta semantics and preserving missing comparisons.
6. Add API and logic tests in `backend/tests/test_data_management.py`, `frontend/src/overview/irKpiData.test.js`, `frontend/src/overview/executiveLogic.test.js`, `frontend/src/overview/chartOption.test.js`, and relevant Overview rendering tests. Update current business/architecture docs after browser review stabilizes.

### Activity Implementation Plan

1. Keep the existing cycle/month KPIs, paired penetration/efficiency trend charts, and team-difference matrix; show period markers on the two reference trend charts.
2. Under team difference, arrange three aligned analysis panels: matching penetration numerator/denominator coverage split; monthly saved-workload bars from the matching efficiency metric's raw `domain_summary`; and an original-metric summary using `company_average`, same-metric period change, merged raw result, source formula, fact count, and valid-team coverage, with a same-metric trend cue.
3. Preserve missing values and show an explicit empty or invalid state if the penetration facts cannot support a volume split or the efficiency facts cannot support workload trend. Do not introduce IR category breakdowns, synthetic growth series, or new endpoints.
4. Capture populated/empty 1920×1080 and populated 2560×1440 browser evidence, including a chart-point tooltip, then obtain a fresh independent visual review before advancing to Capability.

### Capability Implementation Plan

1. Capture the current `/analytics/capabilities` state at 1920×1080 for the approved `03-capability.png` comparison, including the selected capability's indicators, team comparison, evidence, and maturity.
2. R1 fresh independent Macro review: FAIL. It found major composition/density gaps from full-width sections stacked vertically, weak current-value hierarchy, duplicated chart summaries, and a maturity chart that leaves wide-screen space unused. It also found no business-semantic violation.
3. Reuse the two actual `MR代码检视` metrics—AI检视意见数 (count) and AI检视率 (ratio)—as prominent current-state summaries: count uses `domain_summary` total, ratio uses same-metric `company_average`. Keep each period delta and sparkline on the same series. Do not add the reference's other-looking summaries as new metrics or combine maturity with FactRecord KPIs.
4. Move the general-capability month/granularity controls into the page header; remove current-value/coverage repetition from trend-card footers; place team difference and raw evidence side by side. Keep every source formula, company mean, merged result, fact count, and missing state in the evidence section.
5. Current manual maturity has one score per team and selected capability, not multiple evaluation dimensions. Keep the existing team/month trend and expand it to the available workspace width; do not invent radar axes.
6. Capture populated/empty 1920×1080 and populated 2560×1440 screenshots, then obtain an independent Capability Detail review R2 before advancing to Team Drill-down.

Capability R2 documentation impact: Business Design UPDATE `docs/business/analytics.md` to document the existing count-total/rate-average display mapping and keep team means/evidence separate; Architecture NONE; Standards NONE; ADR NONE; Change Design UPDATE (record the R1 findings, revised layout plan, and R2 evidence here).

#### Capability R1 Browser Baseline

- Screenshots: `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r1/`. The default selected capability is `MR代码检视` with two numeric indicators.
- At 1920, the full document is 1876px high; at 2560 it is also 1876px high. Both widths have no page-level horizontal overflow, nested vertical scroll owners, API failures, browser errors, or visible alerts. The baseline review found the maturity trend occupies only part of the available width.

#### Capability R1 Independent Review

- Fresh 15-dimension Macro review R1 returned FAIL. It passed Information Architecture, but marked Page Composition, Information Density, KPI Visual Treatment, Chart Visual Treatment, and Overall Visual Fidelity partial/failed; Grid / Width Utilization failed because the maturity plot leaves wide-screen space unused. The main required changes were a prominent summary for the two real numeric metrics, removal of duplicate chart summaries, side-by-side team/evidence panels, header-aligned filters, and a full-width maturity trend without invented axes.

#### Capability R2 Browser Evidence

- Updated screenshots are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r2/`. They cover populated/empty 1920×1080, populated 2560×1440, both trend tooltips, and the metric detail drawer.
- At 1920, the document is 1555px high; the paired team/evidence panels begin at y=938 and the full-width maturity trend at y=1270. At 2560, the document is 1562px high. Browser evidence reports no page-level horizontal overflow, nested vertical scroll owner, API failures, browser errors, or visible alerts.

#### Capability R2 Independent Review

- Fresh independent Detail review R2 returned FAIL. Critical KPI Visual Treatment failed because the 190px summary cards leave a large blank middle; Overall Visual Fidelity is also partial. Minor follow-ups are aligning the MR count/rate accents with the reference and capturing a clearly visible metric-detail drawer without a chart tooltip over it.

### Capability R3 — Compact KPI Treatment

- Reuse the existing compact side-sparkline KPI pattern to reduce the two status cards' empty center space while retaining the actual values, same-series deltas, prior-period context, and coverage note.
- For MR code-review KPIs, align the count/rate accent roles with the accepted reference. Capture chart tooltips and the metric drawer as separate states so neither overlays the other. Capability R3 documentation impact: Business Design NONE (source formulas and aggregate semantics are unchanged); Architecture NONE; Standards NONE; ADR NONE; Change Design UPDATE.
- Recapture populated/empty 1920×1080 and populated 2560×1440 screenshots and obtain a fresh independent Detail review R3.

#### Capability R3 Browser Evidence

- Captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r3/`. The metric detail drawer screenshot is now a separate visible panel with the chart tooltip dismissed.
- Both state cards measure 136px tall, down from about 190px, with their mini trend integrated on the right. The count card uses the reference's orange accent and the rate card uses teal. The full-width maturity trend remains one-dimensional, matching the available manual assessment data.
- Populated page height is 1503px at 1920 and 2560; the empty 1920 state is 1552px. There is no page-level horizontal overflow, nested vertical scroll owner, API failure, or browser error. Frontend unit/rendering tests and build passed; full `npm run gate` remains pending.

#### Capability R3 Independent Review

- Fresh independent Detail review R3 returned PASS with no critical or major findings. It confirmed the metric colors and separate one-dimensional maturity trend match the available business data; minor suggestions were to label the last valid sparkline period on empty months and make the team-row drill-down action visible.

### Capability R4 — Missing-period and Team Drill-down Cues

- Empty-month state cards now show the last period in the mini-trend while preserving the selected period's missing value. Team difference rows navigate to the matching Team Drill-down route, retaining the current search state; the panel description explains this action.
- Updated browser captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r4/`. Both metric cards remain 136px high. Populated pages are 1533px tall at 1920 and 2560; the empty 1920 page is 1582px. No horizontal overflow, nested vertical scroll, API failures, or browser errors occurred. Clicking Team A opens `/analytics/teams/1?month=2026-09&cycle=half`.
- R4 fresh independent Detail review returned FAIL: Chart Visual Treatment was PARTIAL because the count trend exposed an arbitrary cursor value, and Interaction Affordance failed because the supplied route screenshot still showed Capability. The new drill-down entry point is in Business Design; no architecture or API contract changed.

#### Capability R4 Browser Evidence

- R4 captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r4/`. They cover populated/empty 1920×1080, populated 2560×1440, both trend tooltips, team hover/focus, and a separate metric drawer. The file named `team-drilldown-from-capability.png` still shows Capability, so it does not prove the destination page.
- The browser log recorded `month=2026-09&cycle=half`, but the screenshot contradicted the claimed route appearance. Empty-month cards did identify the latest valid trend period; both KPI cards measured 136px. The populated document heights were 1533px at 1920 and 2560; empty 1920 was 1582px. No horizontal overflow, nested vertical scroll, API failures, or browser errors occurred.
- Frontend unit/rendering tests and production build passed after R4; documentation check/tests passed. Full `npm run gate` remains pending.

### Capability R4 — Missing-period and Team Drill-down Cues

- For an empty selected month with valid history, identify the latest period used by the KPI sparkline so its endpoint is not mistaken for the selected month.
- Make the existing team-difference team labels open their corresponding Team Drill-down route; preserve URL analysis state and expose the action in the panel description. Capability R4 documentation impact: Business Design UPDATE `docs/business/analytics.md` for the team drill-down entry point; Architecture NONE; Standards NONE; ADR NONE; Change Design UPDATE.
- Capture populated/empty 1920×1080 and populated 2560×1440 evidence, including an empty-month card and team-row hover/focus; obtain a fresh independent Detail review R4.

### Capability R5 — Chart Pointer and Route Entry

- Hide the y-axis cursor value for count trends in shared `buildTrendOption` while keeping their actual point tooltip. Reset the document to the top on pushed/replaced path changes; leave POP navigation to the browser's scroll restoration.
- Add a browser regression for Capability → Team Drill-down from a scrolled page, assert the team heading, preserved month/cycle, and top position. Capability R5 documentation impact: Business Design UPDATE `docs/business/analytics.md` for route-entry position; Architecture NONE; Standards NONE; ADR NONE; Change Design UPDATE.
- Capture fresh populated/empty 1920×1080 and populated 2560×1440 Capability screenshots, plus count tooltip and Team Drill-down from Capability at the top. Obtain a fresh independent Detail review R5.

#### Capability R5 Browser Evidence

- Captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r5/`. They include populated and empty 1920×1080 viewport/full-page images, populated 2560×1440 viewport/full-page images, a count tooltip, and the Team A Drill-down reached from Capability.
- Real browser evidence: populated 1920 document height 1533px; empty 1920 1582px; populated 2560 1533px; Team Drill-down 2988px. All document widths are within the viewport. Count hover retains the data tooltip without the arbitrary horizontal-axis cursor label. Clicking Team A from a scrolled Capability page opens `/analytics/teams/1?month=2026-09&cycle=half`, shows `团队A · 团队下钻`, and starts at `scrollY=0`. No API failures or browser errors occurred.
- Frontend unit/rendering checks passed (68 Node tests, 104 Vitest tests), production build passed, docs checks/tests passed, and the targeted browser route regression passed. The complete `npm run gate` remains pending. Fresh independent Detail review R5 is in progress.

#### Capability R5 Independent Review

- Fresh independent Detail review R5 returned FAIL. Critical findings: Team Drill-down opened from Capability still marked Overview as selected and showed a fixed “返回总览” action; the maturity panel showed only a history trend rather than a current team score matrix. Interaction Affordance was partial because team labels were not visually link-like.
- The maturity API and model contain one scalar score per team, activity, and month. Do not invent sub-dimensions or radar axes to mimic the reference.

### Capability R6 — Team Context and Single-Score Maturity Matrix

- For Team Drill-down navigation, mark `团队详情` selected, use it in the breadcrumb, and retain the originating analytics route in navigation state so the header return action goes back to Capability or Activity. Direct links without an origin continue to return to Overview.
- Make Capability team labels visually link-like. Display the selected capability's current team scores and domain average in a single-column maturity matrix beside the existing month trend; state that this is one maturity score per team and do not create radar dimensions.
- Capability R6 documentation impact: Business Design UPDATE `docs/business/analytics.md` for the single-score team matrix and navigation behavior; Architecture UPDATE `docs/architecture/overview.md` for AppShell Team Detail selection/source breadcrumbs; Standards NONE; ADR NONE; Change Design UPDATE.
- Capture populated/empty 1920×1080, populated 2560×1440, count tooltip, and scrolled Capability → Team Drill-down with corrected navigation state. Obtain a fresh independent Detail review R6 before advancing.

#### Capability R6 Browser Evidence

- Fresh captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r6/`. They cover populated/empty 1920×1080, populated 2560×1440, count tooltip, and the Team A page opened from a scrolled Capability page.
- Populated Capability is 1701px high at 1920 and 2560; the empty 1920 page is 1750px. Team Drill-down is 3009px high. Document widths remain within the viewport. The team score matrix contains one selected-capability maturity score per team plus domain average, alongside the six-month trend; no synthetic dimensions are added. Team navigation marks `团队详情` current, shows `来自研发能力` in the breadcrumb, returns to `研发能力`, preserves `month=2026-09&cycle=half`, and starts at the top. No API failures or browser errors occurred.
- Frontend unit/rendering checks passed (68 Node tests, 104 Vitest tests), the targeted browser route regression passed, the production build passed, and docs checks/tests passed. The complete `npm run gate` remains pending. Fresh independent Detail review R6 is in progress.

#### Capability R6 Independent Review

- Fresh independent Detail review R6 returned FAIL. Critical findings: Page Composition and Information Architecture remained partial because the selected capability was displayed only as a team-first single-score table; KPI Visual Treatment and Overall Visual Fidelity were partial because the two real FactRecord cards were stretched across the full row while the existing maturity score and assessment coverage were not in the status row.
- The maturity API provides a separate current `score` and `assessed_team_count` for the selected capability. These are valid independent summaries and can join the two FactRecord cards if their source and semantics remain explicit. The API still has no sub-dimensions for a radar.

### Capability R7 — Source-Separated Four-Card Status and Dimension-Oriented Matrix

- Show four evidence-backed status cards in reference order: current maturity score, assessment coverage, AI review rate, and review count. Keep maturity/API values separate from FactRecord `company_average` and `domain_summary`; retain source context and same-series changes/trends.
- Use all seven existing general-capability maturity activities as the real matrix dimensions and radar axes: show team × capability scores and compare current versus previous domain averages. Do not invent sub-dimensions; selected-capability maturity and coverage stay separate in the status cards.
- Capability R7 documentation impact: Business Design UPDATE `docs/business/analytics.md` for the status-row source mapping; Architecture UPDATE `docs/architecture/overview.md` for the combined read-only presentation of distinct existing API results; Standards NONE; ADR NONE; Change Design UPDATE.
- Capture populated/empty 1920×1080, populated 2560×1440, count tooltip, and Team Drill-down with source navigation. Obtain a fresh independent Detail review R7 before advancing.

#### Capability R7 Browser Evidence

- Captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r7/`. They include populated/empty 1920×1080, populated 2560×1440, count tooltip, and Team A Drill-down with Capability source context.
- The four top cards show the selected capability's maturity average and assessment coverage from the maturity API, followed by its `company_average` rate and `domain_summary` count from FactRecord. Browser evidence confirms those sources stay separate. The maturity matrix has all seven current general-capability dimensions across the domain-average and four team rows; the radar compares actual current/previous domain-average scores. No synthetic dimensions are used.
- Populated pages are 1873px high at 1920/2560; the empty 1920 page is 1922px. Team Drill-down is 2988px. No page-level horizontal overflow, API failures, or browser errors occurred. The team route selects `团队详情`, shows `来自研发能力`, returns to Capability, preserves `month=2026-09&cycle=half`, and starts at the top.
- Frontend unit/rendering checks passed (68 Node tests, 104 Vitest tests), the targeted browser route regression passed, the production build passed, and docs checks/tests passed. The complete `npm run gate` remains pending. Fresh independent Detail review R7 is in progress.

#### Capability R7 Independent Review

- Fresh independent Detail review R7 returned FAIL. It marked Page Composition, Information Architecture, Chart Visual Treatment, and Overall Visual Fidelity partial/critical because the period/version scope was not explicit and the supporting evidence table appeared less visual than the reference's sample charts. It also expected the maturity section within the first 1920×1080 viewport.
- The user explicitly approved natural document scrolling. R8 retains the full-page reading order and makes the selected-period/version applicability visible in the Capability toolbar instead of adding controls with no business effect. The MR catalog contains only two numeric FactRecord metrics; support visuals must use these existing facts and their source fields.

### Capability R8 — Filter Scope and Evidence Clarity

- Add a visible scope note beside the Capability filters: selected-granularity latest-period snapshot, the actual trend window (6 months / 12 weeks / 30 days), and version filtering not applicable because general capabilities have no iteration version scope. Do not add a cycle/version control that would not change the query.
- Keep the actual current/previous domain-average maturity radar and general-capability team matrix. Show the two FactRecord evidence rows with existing previous-period change, merged/raw values, fact coverage, and same-metric trends; do not recreate unsupported issue-category or progress charts.
- Capability R8 documentation impact: Business Design UPDATE `docs/business/analytics.md` for selected-period/filter scope and evidence fields; Architecture UPDATE `docs/architecture/overview.md` for the filter-scope note and matching query behavior; Standards NONE; ADR NONE; Change Design UPDATE.
- Recapture populated/empty 1920×1080 and populated 2560×1440 evidence, count tooltip, and source-aware Team Drill-down. Obtain a fresh independent Detail review R8 before advancing.

#### Capability R8 Browser Evidence

- Final R8 captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/capability-r8-final/`. They cover populated/empty 1920×1080, populated 2560×1440, count tooltip, and Team A Drill-down with source navigation.
- The filter note states the actual single-period snapshot/trend windows for month/week/day and explains that version filtering does not apply. The evidence table shows previous-period change, merged/raw values, fact/team coverage, and same-metric sparklines for both defined FactRecord metrics. The maturity matrix/radar uses the existing general-capability dimensions; zero and missing retain their meanings.
- Populated pages are 1903px high at 1920/2560; empty 1920 is 1952px. Team Drill-down is 3009px. All document widths stay within the viewport, with no API failures or browser errors. Team source breadcrumb/return state and scroll-to-top remain verified.
- Frontend unit/rendering checks passed (68 Node tests, 104 Vitest tests), targeted browser regression passed, production build passed, and docs checks/tests passed. Fresh independent Detail review R8 passed with one minor scroll-hint observation; the full `npm run gate` remains pending.

#### Capability R8 Independent Review

- Fresh independent 15-dimension review R8 returned PASS. All five critical dimensions passed and no major issue remains. Its only minor note is that at 1920px, five of seven maturity columns appear without an obvious visual hint that the matrix scrolls horizontally; the matrix already exposes a focusable horizontal-scroll region. Natural page scrolling is accepted and the full-page image includes the maturity matrix and radar.

### Team Drill-down Implementation Plan

1. Compare the current real-browser Team page against `docs/ux/reference/04-team-detail.png` at 1920×1080 and 2560×1440, with populated and selected-period empty states.
2. Preserve the user team's protagonist role, equal-weight domain-average benchmark, current activity/maturity semantics, missing-versus-zero behavior, URL filters, and the source-aware navigation/return behavior validated in Capability R8.
3. Validate overall KPI summaries, same-metric trends, key lifecycle, team maturity matrix/radar, sticky section navigation, and the full-page scroll model. Do not remove DTS lifecycle support from Team Detail; the user's temporary omission applies only to Overview.
4. Obtain fresh independent Macro and Detail reviews before completing the Team page. Update Business/Architecture docs only for actual semantic or structural changes; update this Change Design for each review loop.

#### Team R1 Browser Baseline

- Direct Team A captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/team-r1/`. They include populated 1920×1080 and 2560×1440 viewport/full-page states, empty 1920×1080, and a selected `SE设计` lifecycle state.
- Browser evidence: populated document heights are 3242px at 1920 and 3585px at 2560; the empty 1920 page is 2475px. Document widths remain inside their viewports; no API failures or browser errors occurred. The reference places month, statistic cycle, and version together in the header; current Team controls show month/version there and place the cycle buttons in the cycle KPI section. The user-approved DTS scope remains limited to Overview, so Team's real DTS activities stay available.

#### Team R1 Independent Review

- Fresh independent Macro review R1 returned FAIL. Critical findings: top KPI cards use four unrelated FactRecord metrics instead of the four core AI KPIs; lifecycle stages do not consistently present penetration and efficiency; maturity comparisons omit Team previous scores; efficiency outliers flatten chart series; MaturityRadar appears with default black fills because its styles are loaded only with AnalyticsPages. The screenshot also showed the statistic-cycle control below the header.
- These findings conflict with the approved Team Detail reference and UX Spec §9.1–9.3. The IR overview endpoint already returns per-team contributions and equal-weight domain averages for the four user-approved provisional KPI definitions; use it for Team KPI/core trend surfaces while keeping activity lifecycle/detail values on matching FactRecord metric types.

### Team R2 — Reference Semantics and Chart Readability

- Put month, statistic cycle, and version in the Team page filter toolbar; remove the cycle control from the second KPI section and distinguish selected fact period from statistic cycle in the summary text.
- Use the existing IR overview aggregation for the four Team monthly/cycle KPI cards and the two overall penetration/efficiency trends; select the Team series and use the same-metric equal-weight domain average as benchmark. Keep FactRecord as the lifecycle, detail, and raw-evidence source.
- Share Overview's existing lifecycle type-slot mapping: every core stage presents AI需求渗透率 and AI研发提效; show source activity/metric names, and keep unsupported slots missing. Retain real DTS activities in Team Detail because the user's temporary exclusion is Overview-only.
- Load current/previous Team maturity records plus current/previous domain summaries. Present Team current, Team previous, and domain average in maturity matrices/radars; move reusable MaturityRadar base styles to shared `design-system.css` so Team and analytics pages render identically.
- Use the existing efficiency outlier rule for Team time and iteration charts: clamp only the plotted point at the ±100% boundary, retain raw tooltip value/comparison, and keep the axis readable.
- Team R2 documentation impact: Business Design UPDATE `docs/business/analytics.md` for Team KPI source and matching activity lifecycle slots; Architecture UPDATE `docs/architecture/overview.md` for the IR overview read in TeamDrilldown and shared chart-style ownership; Standards NONE; ADR NONE; Change Design UPDATE.
- Capture populated/empty 1920×1080 and populated 2560×1440 plus selected lifecycle, period/cycle controls, maturity matrix/radar, and an outlier tooltip. Obtain a fresh independent Detail review R2.

#### Team R2 Implementation and Browser Evidence

- The four monthly/cycle Team KPI cards now use the provisional IR aggregate per team; the two overall trends show that team’s IR penetration/efficiency series against the same-metric equal-weight company average. Month, cycle, and version are in the top FilterBar.
- FactRecord lifecycle stages retain exactly two fixed slots (penetration and efficiency), source metric names, explicit missing slots, and real DTS activities. Time charts reuse Overview’s efficiency outlier boundary and structured tooltip; iteration bars cap only the plot and retain the raw tooltip value.
- Team maturity now shows Team current, Team previous, and current domain average in both matrix and radar. The shared MaturityRadar styles load from the global design system, so the Team route no longer renders black fills.
- Isolated-demo captures are in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/team-r2/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`: populated 1920/2560 full-page views and empty-month 1920. The full pages are 3076px/3052px tall and naturally scroll; the screenshot/overflow E2E and Team route behavior test passed. The latter checks four IR KPI labels in both rows, the global cycle control and URL state, two fixed lifecycle metrics per stage, DTS retention, three maturity rows/series, and a non-black radar grid stroke.
- Frontend checks passed: 67 Node tests, 104 Vitest tests, production build, docs check/tests. Business and architecture current-state documents were updated; Standards NONE; ADR NONE. Fresh independent Detail review R2 is recorded below.

#### Team R2 Independent Review

- Fresh screenshot-only Detail review R2 returned FAIL: Information Density major FAIL and Grid / Width Utilization major FAIL at 2560; Page Composition, Information Architecture, KPI treatment, chart treatment, and Overall Visual Fidelity also failed their critical thresholds. It additionally requested an explicit equal-weight benchmark label, compact missing-month KPI context, and a visible tooltip-state capture.
- R3 will group each analysis story in the reference's card hierarchy, compact Team-only KPI/preview geometry, cap the 2560 content width without narrowing normal desktop layouts, explicitly label the benchmark `有数据团队等权均值`, expose no-data context, capture scrolled sticky-nav and tooltip states, then recapture and obtain a fresh Detail review.

#### Team R3 Implementation Plan and Documentation Impact

- Group Team overall KPI/trend, lifecycle/activity trend, and maturity matrix/radar content inside their existing `AnalyticsPanel` story surfaces; keep missing-versus-zero, filters, source-aware return navigation, and Team-local DTS support intact.
- Compact Team-only KPI and chart geometry, cap only the >2300px Team content canvas, reduce the selected FactRecord trend height, and use separate IR/FactRecord equal-weight benchmark labels. Add visible sparse-comparison context rather than inventing team values.
- In the maturity story card, show one key/general category at a time through an in-card selector, defaulting to key activity. Preserve access to both categories and the Team current/previous/domain-average comparison while avoiding two stacked matrix/radar sets.
- Browser evidence: 1920/2560 populated and 1920 empty states, 1920 general-maturity, sticky-navigation and efficiency-tooltip viewport captures, document geometry, card grouping and horizontal-overflow assertions.
- Documentation Impact: Business Design UPDATE `docs/business/analytics.md` for visible IR/FactRecord equal-weight benchmark labels and the sparse-team comparison note; Architecture UPDATE `docs/architecture/overview.md` and UX Design UPDATE `docs/ux/UX-REDESIGN-SPEC.md` for the Team card story and wide-screen layout; Standards UPDATE `docs/standards/testing.md` to separate Gateway fixture E2E from seeded UI smoke; ADR NONE; Change Design UPDATE.

#### Team R3 Independent Review and R4 Fix

- Fresh screenshot-only Team R3 review returned FAIL with one major issue: the efficiency-hover screenshot plotted the value at the +100% cap but the non-compact shared trend tooltip showed only the original raw value. The crosshair also drew an unrelated +51% y-axis pointer label. The reviewer found the three parent cards, KPI treatment, 2560 width, sticky nav, and maturity selector structurally correct; it marked the remaining density gap minor and requested an effective-zero capture as optional evidence.
- R4 fixes the shared `buildTrendOption` tooltip to state both plotted boundary value and raw value, and hides crosshair axis labels while keeping the crosshair line and month tooltip. Capture the updated tooltip, then request a fresh independent Detail review. No chart data or aggregation semantics change.
- R4 also aligns month/cycle/version filters with the page title and source-aware return action, and suppresses flat KPI sparklines when the current Team value is missing. Capture the general-maturity state after scrolling the card fully into the viewport. Documentation Impact: UX Design UPDATE `docs/ux/UX-REDESIGN-SPEC.md` for Team page-head placement and missing-current sparkline state; Architecture UPDATE `docs/architecture/overview.md` for page-header/filter ownership; Business Design NONE, Standards NONE, ADR NONE, Change Design UPDATE.
- Fresh screenshot-only Team R4 review returned FAIL: it found the general-maturity screenshot still showed the previous selected state, plus minor empty-month sparkline and filter placement gaps. R5 corrects the screenshot scroll position and selected-state assertion, uses an empty trend treatment for missing current values, and places filters beside the title with the return action. No metric values or aggregation change.
- R5 screenshots are historical in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/team-r5/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`; the R6/R7 screenshots below supersede them for acceptance.
- Fresh screenshot-only Team R6 review returned FAIL with one major issue: missing-month KPI cards still showed the shared pale empty-trend baseline even after historical sparkline values were suppressed. The page-head filter placement, general maturity selection/evidence, tooltip boundary/raw labels, and crosshair cleanup now pass. R7 removes the placeholder only for Team KPI cards; the missing marker and explanatory detail remain. No data, KPI, or navigation semantics change.
- The full root gate also exposed that `run-gateway-e2e.mjs` ran both the Gateway L3 spec and the seeded Phase 5 UI suite against the Gateway-only fixture database. R7 narrows that runner to `gateway.e2e.spec.js`; the Phase 5 suite continues to run separately against the isolated demo database. The stale route-title expectation is updated from `团队下钻` to the maintained `团队详情` title.

#### Team R7 Implementation and Browser Evidence

- Missing current-month Team KPI values now retain the explicit `—` and team-coverage detail while hiding the flat empty-trend placeholder; valid current values still show their mini trends. The page title, filters, and source-aware return action share one header row. `npm run test:e2e:gateway` runs only the Gateway L3 spec; the seeded Phase 5 UI suite remains a separate run against the isolated demo database.
- Final Phase 5 evidence is in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/phase5-final/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`: 1920/2560 Overview and Team captures, Overview empty/general/lifecycle states, Team empty/general maturity, sticky navigation, and the efficiency tooltip. Browser geometry reports Team document heights of 2440px/2413px and widths within 1608px/2160px; no page-level horizontal overflow.
- The complete seeded Phase 5 UI smoke passed 8/8. `npm run gate` passed: 146 backend tests, 67 Node tests, 104 Vitest tests, 3 Gateway L3 tests, production build, docs checks and docs tests. The build keeps existing ECharts/Ant Design chunk-size warnings; backend tests report existing deprecation/cache warnings. Strict Premium UI audit returned zero findings.
- Fresh independent Team R7 screenshot review returned PASS with no critical or major issues. Its remaining minor notes are dense source/average text on lifecycle cards, a relatively small radar plot area, IR trend/mean overlap when only Team A has data, and slight scroll-nav/current-view alignment. These reflect the sparse demo and available panel geometry; do not invent data or insight content to remove them.

## Business Impact

The four Overview KPI labels and initial IR data source are approved; their formulas remain temporary. Activity values come from existing FactRecord metrics selected by `penetration` and `efficiency` type for the lifecycle display. Unsupported activity types stay missing; the mapping does not convert count/ratio metrics into efficiency. The user temporarily excludes the code-review tile, `dta`, and `dtf` from Overview lifecycle cards only; Activity pages, Catalog, FactRecords, and the general-capability maturity category remain unchanged. The Overview maturity scale distinguishes valid zero from 1.0–5.0 levels, and Team Matrix change values reuse the monthly/cycle KPI semantics. Record these current Overview decisions in `docs/business/analytics.md`; do not add implementation rules to `CONTEXT.md`.

## Architecture Impact

Overview gains one read-only IR aggregation endpoint; existing `/api/compute` FactRecord semantics remain unchanged. Update `docs/architecture/overview.md` and `docs/architecture/modules/data-management.md` to describe the endpoint, month/version filters, team scope, and aggregate-only response.

## API / Contract Changes

Add a read-only Overview IR metrics endpoint returning per-month, per-team aggregate contributions and domain totals. Keep IR record identifiers and employee fields out of the response; do not alter `/api/compute` or its FactRecord contract.

## Data Changes

None planned. Preserve current fact and maturity storage, including missing-versus-zero behavior.

## Compatibility

- Preserve route paths, role visibility, sidebar collapse preference, and the 680px drawer behavior.
- Preserve the `month`, `cycle`, and `version` URL state and existing backend request semantics.
- Keep same-metric team comparisons and the distinction between `company_average` and maturity `领域平均`.
- Keep existing narrow-screen behavior; only the documented desktop widths are part of this redesign's visual acceptance.

## Error & Boundary Handling

- Missing facts remain missing and retain stable card/chart geometry.
- Empty, loading, and error states remain inside their owning analytics modules.
- Do not add fabricated targets, trends, counts, coverage, or maturity scores.
- Keep keyboard focus, reduced-motion behavior, and chart accessibility intact.

## Risks & Trade-offs

- IR-only KPI formulas are a temporary proxy; later business definitions may change formulas and source systems. The implementation must not present the proxy as an accepted long-term metric standard.
- IR currently has sparse team coverage; teams without IR facts remain missing in trends/matrices rather than borrowing FactRecord values.
- A source aggregation API must enforce existing authenticated team visibility and return only aggregate values.
- The full-width instruction in the attached goal objective is superseded by the user's explicit choice to prioritize the approved acceptance reference for this task.
- Keep one document scroll owner and avoid page-level horizontal overflow. Natural page scrolling is preferred over shrinking chart, card, and radar content to fit a single viewport.

## Test Strategy

- After relevant changes: `npm --prefix frontend run test:unit`, `npm --prefix frontend run build`, `npm run check:docs`, `npm run test:docs`, and `git diff --check`.
- Final gate: `npm run gate`.
- In a real browser, verify the changed controls and chart interactions, focus, reduced motion, empty and populated months, sticky behavior, document scroll, and no page-level horizontal overflow.
- Capture 1920×1080 for all four pages and 2560×1440 for Overview, Activity, and Team Drill-down.
- Do not re-seed or mutate the current application database for screenshots.

## Documentation Impact

- Business Design: UPDATE `docs/business/analytics.md` for the temporary global IR mapping, selected-cycle totals/deltas, the Activity FactRecord-to-KPI presentation, shared lifecycle display slots, missing cases, workload-comparison availability, and current page composition.
- Product design contracts: UPDATE root `DESIGN.md` and `UX-CONTRACT.md` to replace the obsolete existing-catalog KPI description with the user-approved provisional IR mapping and page-specific valid-team benchmark labels.
- Architecture: UPDATE `docs/architecture/overview.md` and `docs/architecture/modules/data-management.md` for the read-only aggregate endpoint, security scope, selected-cycle totals/deltas, aggregate-only response, and FactRecord/IR boundary.
- Standards: NONE; route, accessibility, design-token, and test standards are unchanged.
- CONTEXT: NONE. It is a glossary and this temporary implementation mapping does not create a stable domain term or definition; the business analytics document records the temporary behavior.
- ADR: NONE. The temporary proxy and display mapping are reversible and do not supersede any accepted architecture decision.
- Change Design: COMPLETE this record with the final page/global review history, validation and accepted minor deviations; move it to `docs/changes/completed/` and update both lifecycle indexes.

## Validation

### Overview implementation checkpoint

- Moved the existing month, period, and version controls into the Overview PageHeader as a single bordered control group. Their current URL state and data behavior are unchanged.
- Updated sidebar and breadcrumb group names to “分析 / 数据 / 管理” and localized the existing product context caption.
- Moved maturity before team performance and placed the two modules in adjacent columns. Compact chart heights and a fixed-width maturity matrix make all eight activity columns visible at both target widths.
- `npm --prefix frontend run test:unit` passed: 54 Node tests and 99 Vitest tests.
- `npm --prefix frontend run build` passed. Vite retained the existing ECharts and Ant Design chunk-size warnings. `git diff --check` passed.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed at the latest checkpoint.
- The shared KPI card now has a 40px sparkline in a 153.5px card (about 26% of card height). The core chart uses a single team-plus-benchmark legend and 2.75px team lines; selected activity/team preview charts are shorter.
- The master trend now uses the six-month window ending at the selected month. KPI cards have explicit selected-month/cycle empty messages. The tooltip reports same-metric mean differences in percentage points, previous visible-period changes when facts exist, and “—” otherwise; it omits missing team series and stays below the chart legend.
- The PageHeader control group now wraps at 390px: month, cycle, and version controls are all inside the viewport. This fixes a regression caused by the desktop header move; the desktop layout is unchanged.
- Real-browser checks at 1920×1080 and 2560×1440 show August 2026 with 28/29 fact-bearing catalog metrics and September with 0/29 current-month metrics. Both widths have no page-level horizontal overflow, nested vertical scroll owner, or accessibility alert. Full-page height is 2251px at 1920 and 2243px at 2560; density and the master chart/activity composition remain under review.
- Browser interaction checks confirmed month/cycle changes remain URL-backed, clicking a chart legend hides and restores Team A without navigating or adding API requests, and the 390px menu Escape path restores focus.
- Round 4 screenshots in `C:\Users\80726\.codex\visualizations\2026\09\25\01a0d75e-a556-7c81-bc87-058b73717ab6\`: `overview-r4-populated-1920-viewport.png`, `overview-r4-populated-1920-full.png`, `overview-r4-empty-month-1920-viewport.png`, `overview-r4-empty-month-1920-full.png`, `overview-r4-populated-2560-viewport.png`, `overview-r4-populated-2560-full.png`, `overview-r4-hover-1920.png`, `overview-r4-legend-team-a-hidden-1920.png`, `overview-r4-legend-restored-1920.png`, `overview-r4-mobile-controls-390.png`, and `overview-r4-mobile-drawer-390.png`.

### Round 1 — Overview Macro Baseline

- Independent UX Reviewer gate: FAIL. The valid-schema review marked Page Composition FAIL, Information Architecture FAIL, Chart Visual Treatment PARTIAL, and Overall Visual Fidelity FAIL.
- Major gaps: Information Density, Grid / Width Utilization, and Spacing / Visual Rhythm.
- Passed dimensions included KPI treatment, typography, surfaces, color, missing-value treatment, and alignment.
- Required changes: reduce vertical stacking, use the resolved chart/lifecycle composition, keep maturity before team performance, and preserve activity-qualified metric labels. The header filter group and maturity/team order have since been updated.
- The reviewer requested the `领域平均` label for fact charts. The current business contract distinguishes fact `company_average` from maturity `领域平均`; keep the fact meaning until the user explicitly changes it and have a fresh reviewer assess the visual treatment with this distinction.
- Evidence: `C:\Users\80726\.codex\visualizations\2026\09\25\01a0d75e-a556-7c81-bc87-058b73717ab6\baseline-overview-2026-08-1920-viewport.png` and `baseline-overview-2026-08-1920-full.png`.

### Round 2 — Overview Detail

- Independent UX Reviewer gate: FAIL.
- Critical gap: Information Architecture FAIL because the current activity-specific KPI titles do not match the four global KPI names in the Goal/UX Spec. The user has been asked to confirm the formulas and authoritative source; no metric renaming or aggregation has been introduced.
- Major gaps: Chart Visual Treatment PARTIAL (separate benchmark legend, line weight, and no hover evidence at review time) and Overall Visual Fidelity PARTIAL. Information Density and Spacing / Visual Rhythm were PARTIAL.
- Passed dimensions included App Shell Composition, Page Composition, Grid / Width Utilization, KPI treatment, surfaces, color, missing data, and geometry.
- Fixes after the review: the core chart now uses one ECharts legend for teams and the existing `全公司均值`; team lines use 2.75px weight; the hover screenshot shows the structured tooltip. A fresh reviewer must re-evaluate these fixes.
- Round 2 evidence: `overview-r2-populated-1920-full.png`, `overview-r2-empty-1920-full.png`, `overview-r2-populated-2560-full.png`, and `overview-tooltip-hover-1920.png` in the task evidence directory.

### Round 3 — Overview Macro Review

- Independent UX Reviewer gate: FAIL. Critical gaps were Page Composition, Information Architecture, Chart Visual Treatment, and Overall Visual Fidelity.
- The 1920 viewport reached only the key activity heading; the KPI naming conflict remained; the tooltip lacked mean differences/period changes and overlapped the chart controls or legend. Major gaps included a sparse two-point chart, wrapped maturity headings, and no direct month-level empty message in each KPI card.
- This checkpoint adds explicit empty messages, extends the master trend to six months, and adds tooltip comparisons/placement. The page remains vertically long; Round 4 reviews the updated screenshots.
- Evidence: `overview-round3-populated-1920-viewport.png`, `overview-round3-empty-1920-full.png`, `overview-round3-populated-2560-viewport.png`, and `overview-round3-hover-1920.png` in the task evidence directory.

### Round 4 — Overview Review

- Fresh independent UX Reviewer gate: PARTIAL, with no critical issues. Information Architecture, Information Density, Grid / Width Utilization, typography, surfaces, spacing, colors, no-data behavior, alignment, and visible interaction affordances passed.
- At the Round 4 checkpoint the chart/KPI choices were unresolved. The user later approved the four global KPI labels and IR as the provisional source, and chose the reference-paired master chart/lifecycle layout on 2026-09-25; these are no longer open decisions.
- Minor gaps: the topbar lacks the reference search/notification/help actions. A data-backed follow-up found the SA design efficiency chart's high point in the current demo facts: Team C, 2026-05, estimated 76.8 and actual 0 yields 153.6 (15360%) under the existing zero-denominator fallback of 0.5. The chart must retain that point; clipping the axis would misrepresent it. Any formula change needs a business decision outside this visual task.
- Tooltip evidence shows same-metric mean differences and previous-period values where present; missing prior facts render as `—`. The 1920 hover card no longer overlaps the legend.
- Evidence: all `overview-r4-*` screenshots listed above. This is not a PASS, so work cannot advance to Activity yet.

### Round 5 — IR Overview Review

- Fresh independent UX Reviewer gate: FAIL. Page structure and labels were accepted, but critical gaps remained in KPI no-data visualization and chart treatment.
- Required changes: mark the current month as missing in the core trend, distinguish valid teams from the equal-value benchmark, show a designed neutral KPI empty trend, and make the SA efficiency outlier readable without hiding its value.
- The empty 2026-10 screenshot showed no IR records while older months remained in the trend. The activity efficiency source included a high point caused by the existing 0.5 denominator fallback; its raw value must remain visible on hover.
- Round 5 evidence: `overview-r5-ir-demo-populated-1920-viewport.png`, `overview-r5-ir-demo-populated-1920-full.png`, `overview-r5-ir-demo-empty-ir-month-1920-viewport.png`, `overview-r5-ir-demo-populated-2560-viewport.png`, and `overview-r5-ir-demo-hover-1920.png`.

### Round 6 — Density and Chart Review

- Fresh independent UX Reviewer gate: FAIL. The master trend/lifecycle pair, four global labels and grid widths passed; the reviewer still saw the empty month as a continuous line, found the one-team/benchmark overlap hard to distinguish, and found the activity efficiency axis dominated by an extreme value. Page density and KPI trend emphasis were also PARTIAL.
- The service-backed browser run exposed an HTTP 500 because the API helper returned `record_count` while its response DTO required `fact_count`; the helper now returns `fact_count`, and the route integration tests cover the contract.
- Round 6 evidence: `overview-r6-ir-demo-populated-1920-viewport.png`, `overview-r6-ir-demo-empty-1920-viewport.png`, `overview-r6-ir-demo-populated-2560-viewport.png`, and `overview-r6-browser-evidence.json`.

### Round 8 — Lifecycle and Density Review

- Fresh independent UX Reviewer gate: FAIL. Information Architecture and Chart Visual Treatment passed, including explicit missing activity slots and the empty-month marker. Critical gaps remained in KPI sparkline strength and Overall Visual Fidelity; Information Density and Spacing / Visual Rhythm were major gaps because maturity/team content was still only beginning to enter the 1920 viewport.
- Changes since that review: standardized each key activity to penetration/efficiency slots from matching FactRecord metric types, left unsupported types missing, retained source names in chart descriptions, aligned sparse team series to the month axis, added KPI sparkline endpoints, and compressed the top and chart rows.
- Round 8 evidence: `overview-r7-ir-demo-populated-1920-viewport.png`, `overview-r7-ir-demo-empty-1920-viewport.png`, `overview-r7-ir-demo-populated-2560-viewport.png`, and `overview-r7-lifecycle-no-metric-selection-1920.png`.

### Round 9 — Chart Detail and Density Review

- Fresh independent UX Reviewer gate: FAIL. Critical gaps remained in Page Composition and Chart Visual Treatment; Information Density was also PARTIAL. The selected activity efficiency tooltip obscured the plot, and its note did not explain how values beyond the displayed range were drawn.
- R12 changes shortened lifecycle tile labels while retaining full metric names in the legend, chart headings, and accessible labels; compact chart tooltips retain the original value and now explain the ±100% boundary. Team table and preview spacing were tightened in this iteration.
- The user then clarified that the page may scroll and that matching the approved reference's chart size, radar scale, and spacing matters more than fitting everything into 1080px. The R12 compression was therefore relaxed in R13/R14: KPI padding and trends, master/activity/team plots, and radar scale were restored; maturity/team width is now 54:46.
- R14 screenshots were reviewed independently and failed on tooltip detail, shell controls, and full-page height. The user-approved natural-scroll preference remains in force.
- R14 evidence: `overview-r14-populated-1920-viewport.png`, `overview-r14-populated-1920-full.png`, `overview-r14-empty-1920-viewport.png`, `overview-r14-empty-1920-full.png`, `overview-r14-populated-2560-viewport.png`, `overview-r14-populated-2560-full.png`, `overview-r14-mobile-390-viewport.png`, `overview-r14-efficiency-outlier-hover-1920.png`, `overview-r14-lifecycle-no-metric-selection-1920.png`, and `overview-r14-browser-evidence.json`.

### Round 10 — Tooltip and Shell Review

- Fresh independent UX Reviewer gate: FAIL. The compact tooltip showed raw outliers against a capped axis without also labeling the plotted boundary value, and omitted benchmark/previous-period comparisons. App Shell differed visibly from the reference. The reviewer also requested a closer full-page height ratio; natural document scrolling itself was accepted per the user's instruction.
- R15/R16 changes restore plotted boundary and raw values together with compact benchmark/previous-period comparisons. The shell now provides role-filtered quick navigation, a working quick-entry menu, and a visibly disabled notification control. These screenshots were not the final tooltip spacing iteration.
- R17 is the current screenshot set and awaits a fresh independent review.
- R17 evidence: `overview-r17-populated-1920-viewport.png`, `overview-r17-populated-1920-full.png`, `overview-r17-empty-1920-viewport.png`, `overview-r17-empty-1920-full.png`, `overview-r17-populated-2560-viewport.png`, `overview-r17-populated-2560-full.png`, `overview-r17-mobile-390-viewport.png`, `overview-r17-efficiency-outlier-hover-1920.png`, `overview-r17-topbar-help-open-1920.png`, `overview-r17-lifecycle-no-metric-selection-1920.png`, and `overview-r17-browser-evidence.json`.

### Round 11 — KPI, Heatmap, and Team Matrix Review

- The user supplied annotated screenshots identifying KPI card mismatch, flat trend plots, and missing heatmap scale/team metric changes, then separately approved omitting `dta`/`dtf` from the Overview lifecycle only.
- The lifecycle now displays six activities and does not request the two omitted activities' FactRecord metrics. Catalog, maturity, Activity page and records remain unchanged.
- The maturity matrix now labels its heat scale and distinguishes valid 0.0 from the 1.0–5.0 scale. Each team KPI group now has metric value/change subcolumns; monthly and cycle changes follow the existing KPI semantics and missing comparisons remain missing.
- R19 was reviewed independently. The report's `gate` field says PASS, but KPI Visual Treatment, Chart Visual Treatment, and Overall Visual Fidelity are all PARTIAL; the goal's critical-dimension rule therefore makes R19 a non-passing round.
- R19 evidence: `overview-r19-populated-1920-viewport.png`, `overview-r19-populated-1920-full.png`, `overview-r19-empty-1920-viewport.png`, `overview-r19-empty-1920-full.png`, `overview-r19-populated-2560-viewport.png`, `overview-r19-populated-2560-full.png`, `overview-r19-mobile-390-viewport.png`, `overview-r19-efficiency-outlier-hover-1920.png`, `overview-r19-topbar-help-open-1920.png`, `overview-r19-lifecycle-no-metric-selection-1920.png`, and `overview-r19-browser-evidence.json`.

### Round 12 — KPI and Chart Detail Follow-up

- R20 increases the Overview KPI sparkline area to 36px, shows every scoped team in the trend legend with “无数据” on fully missing series, and separates compact tooltip values from their benchmark/period comparisons.
- The user-added heat scale and Team Performance value/change columns remain visible in the same screenshots.
- Fresh independent review R20: FAIL. KPI Visual Treatment and Overall Visual Fidelity are critical PARTIAL because deltas remain visually detached and mini trends have too little visual weight. Empty-month KPI helper text also changes card height. Chart treatment, including the tooltip, and the two user-added matrix items passed.
- R20 screenshots: `overview-r20-populated-1920-viewport.png`, `overview-r20-populated-1920-full.png`, `overview-r20-empty-1920-viewport.png`, `overview-r20-empty-1920-full.png`, `overview-r20-populated-2560-viewport.png`, `overview-r20-populated-2560-full.png`, `overview-r20-mobile-390-viewport.png`, `overview-r20-efficiency-outlier-hover-1920.png`, `overview-r20-topbar-help-open-1920.png`, `overview-r20-lifecycle-no-metric-selection-1920.png`, and `overview-r20-browser-evidence.json`.

### Round 13 — KPI Visual Hierarchy

- The shared KPI card now places delta beside the primary value, uses a directional accent for positive/negative changes, and reserves a consistent detail line in the Overview KPI rows so empty-month explanations do not grow those cards.
- Fresh independent review R21: FAIL. Information Architecture is critical PARTIAL because the reference stages (`需求`, `代码检视`, and one `测试`) differ from the real FactRecord key-activity catalog after excluding `dta`/`dtf` (SA, SE, 开发设计, 编码开发, 测试用例生成, 测试用例执行). KPI Visual Treatment is major PARTIAL; the trend is still judged too small and a large empty gap remains. Overall Visual Fidelity is critical PARTIAL.
- R21 screenshots: `overview-r21-populated-1920-viewport.png`, `overview-r21-populated-1920-full.png`, `overview-r21-empty-1920-viewport.png`, `overview-r21-empty-1920-full.png`, `overview-r21-populated-2560-viewport.png`, `overview-r21-populated-2560-full.png`, `overview-r21-mobile-390-viewport.png`, `overview-r21-efficiency-outlier-hover-1920.png`, `overview-r21-topbar-help-open-1920.png`, `overview-r21-lifecycle-no-metric-selection-1920.png`, and `overview-r21-browser-evidence.json`.

### Round 14 — KPI Card Proportion

- The Overview no-data explanation now shares the existing comparison line instead of adding a detail row. The KPI sparkline region is 48px. R22 browser measurements show all cards in each KPI row are 148px in both populated and empty states, with no page overflow.
- A fresh R22 visual report identified three critical partials: KPI trend presence, core chart differentiation, and overall fidelity; it also caught a percent axis-pointer label displaying a raw decimal. The report did not follow the required 15-dimension contract, so its findings are diagnostic and do not count as a valid gate.
- R22 screenshots: `overview-r22-populated-1920-viewport.png`, `overview-r22-populated-1920-full.png`, `overview-r22-empty-1920-viewport.png`, `overview-r22-empty-1920-full.png`, `overview-r22-populated-2560-viewport.png`, `overview-r22-populated-2560-full.png`, `overview-r22-mobile-390-viewport.png`, `overview-r22-efficiency-outlier-hover-1920.png`, `overview-r22-topbar-help-open-1920.png`, `overview-r22-lifecycle-no-metric-selection-1920.png`, and `overview-r22-browser-evidence.json`.
- The user has been asked how to resolve the lifecycle mismatch. `backend/app/seed.py` contains six remaining key activities after the approved DTS omissions; `需求` has no FactRecord key activity, and `mrr` is a general capability with only count/ratio metrics. The existing decision limits IR sourcing to the four global KPIs and does not authorize reusing it in activity detail. Do not change stage mappings until this decision is answered.

### Round 15 — Trend Legibility and Axis Units

- Constant KPI histories now use a shallower line position so their neutral/colored area is visible; empty histories keep a dashed neutral baseline. The master trend marks each real team/benchmark point so coincident series remain distinguishable and states when the only populated team equals the equal-weight mean; it does not add or change values.
- The y-axis crosshair label uses the same metric formatter as the y-axis, so an efficiency fraction such as `0.879` is shown as `+88%` on the percentage axis.
- R23 screenshots: `overview-r23-populated-1920-viewport.png`, `overview-r23-populated-1920-full.png`, `overview-r23-empty-1920-viewport.png`, `overview-r23-empty-1920-full.png`, `overview-r23-populated-2560-viewport.png`, `overview-r23-populated-2560-full.png`, `overview-r23-mobile-390-viewport.png`, `overview-r23-efficiency-outlier-hover-1920.png`, `overview-r23-topbar-help-open-1920.png`, `overview-r23-lifecycle-no-metric-selection-1920.png`, and `overview-r23-browser-evidence.json`.
- Fresh 15-dimension independent review R23: FAIL. Information Architecture FAIL is critical because the six displayed stages do not match the approved reference. KPI Visual Treatment and Overall Visual Fidelity are PARTIAL because prior-period baselines are not explicit and IR coverage copy repeats. The fourth trend tab wraps at 1920px. Chart treatment passed, including the percentage axis-pointer label.

### Round 16 — KPI Comparisons and Control Row

- KPI cards now show the previous-month value or the cumulative value before the selected month, while a single section-level line carries the IR/source coverage summary for each row. Trend tabs use a no-wrap desktop layout at 1920px and above.
- R24 screenshots: `overview-r24-populated-1920-viewport.png`, `overview-r24-populated-1920-full.png`, `overview-r24-empty-1920-viewport.png`, `overview-r24-empty-1920-full.png`, `overview-r24-populated-2560-viewport.png`, `overview-r24-populated-2560-full.png`, `overview-r24-mobile-390-viewport.png`, `overview-r24-efficiency-outlier-hover-1920.png`, `overview-r24-topbar-help-open-1920.png`, `overview-r24-lifecycle-no-metric-selection-1920.png`, and `overview-r24-browser-evidence.json`.
- Fresh 15-dimension independent review R24: FAIL. KPI Visual Treatment passed with explicit baselines; Chart Visual Treatment is major PARTIAL because date ticks overlap in the two narrow team previews; Information Architecture FAIL and Overall Visual Fidelity PARTIAL because the visible lifecycle names/order differ from the reference. The reviewer also notes the 390px coverage line clipping, outside the current desktop acceptance scope.
- The lifecycle mapping question remains unanswered; do not advance to Activity without a valid Overview PASS.

### Round 17 — Team Preview Axis Labels

- Compact month chart axes now show `YY/MM`; the underlying category and tooltip retain the full `YYYY-MM` period. A single IR coverage summary is shown per KPI row and both rows expose their comparison baselines.
- R25 screenshots: `overview-r25-populated-1920-viewport.png`, `overview-r25-populated-1920-full.png`, `overview-r25-empty-1920-viewport.png`, `overview-r25-empty-1920-full.png`, `overview-r25-populated-2560-viewport.png`, `overview-r25-populated-2560-full.png`, `overview-r25-mobile-390-viewport.png`, `overview-r25-efficiency-outlier-hover-1920.png`, `overview-r25-topbar-help-open-1920.png`, `overview-r25-lifecycle-no-metric-selection-1920.png`, and `overview-r25-browser-evidence.json`.
- Fresh 15-dimension independent review R25: FAIL. KPI and chart treatment passed. Information Architecture FAIL and Overall Visual Fidelity PARTIAL because lifecycle sequence and per-stage change values differ from the approved design; the reviewer treated the taller 1920 page as a density gap despite allowing natural scroll.
- The lifecycle mapping question remains unanswered. Stage changes are being added with the existing FactRecord mean month-over-month values; no new source or formula is introduced.

### Round 18 — Lifecycle Change Values

- Shared metric-delta formatting now reports rates/efficiency in percentage points (`pp`) and count changes with their signed value. The Overview lifecycle shows current value plus month-over-month delta per supported penetration/efficiency slot; missing data/comparison stays missing.
- KPI cards use the same percentage-point semantics. Team Performance description clarifies the compact `pp` unit.
- R26 browser screenshots: `overview-r26-populated-1920-viewport.png`, `overview-r26-populated-1920-full.png`, `overview-r26-empty-1920-viewport.png`, `overview-r26-empty-1920-full.png`, `overview-r26-populated-2560-viewport.png`, `overview-r26-populated-2560-full.png`, `overview-r26-mobile-390-viewport.png`, `overview-r26-efficiency-outlier-hover-1920.png`, `overview-r26-topbar-help-open-1920.png`, `overview-r26-lifecycle-no-metric-selection-1920.png`, and `overview-r26-browser-evidence.json`.
- Fresh 15-dimension independent review R26: FAIL. The lifecycle title/order remains a critical PARTIAL. R26 added stage deltas successfully; the 2560 layout still leaves excess KPI/lifecycle card width, and Overall Visual Fidelity is major PARTIAL. The report treats 390px clipping as out-of-scope for the desktop gate.
- The user's stage mapping decision is still pending.

### Round 19 — Wide-Viewport Card Proportions

- At 2560px and above, KPI sparkline width can grow to 60% of its card (capped at 320px); lifecycle labels, values, and deltas scale up slightly. The 1920 layout remains unchanged.
- R27 screenshots: `overview-r27-populated-1920-viewport.png`, `overview-r27-populated-1920-full.png`, `overview-r27-empty-1920-viewport.png`, `overview-r27-empty-1920-full.png`, `overview-r27-populated-2560-viewport.png`, `overview-r27-populated-2560-full.png`, `overview-r27-mobile-390-viewport.png`, `overview-r27-efficiency-outlier-hover-1920.png`, `overview-r27-topbar-help-open-1920.png`, `overview-r27-lifecycle-no-metric-selection-1920.png`, and `overview-r27-browser-evidence.json`.
- Fresh 15-dimension independent review R27: FAIL. KPI and chart treatment passed. Information Architecture FAIL is critical because the stage sequence still differs; Information Density and Overall Visual Fidelity remain partial because the 1920 document is 1471px tall and lower tables begin below the initial viewport. Natural scrolling is user-approved, but overall fidelity remains partial.
- The user has not yet selected how to resolve the lifecycle taxonomy mismatch; do not advance to Activity without a valid Overview PASS.

### Invalid review attempt

- The Round 7 reviewer session was interrupted before producing a result. It is not a valid visual review and does not count toward the required review rounds.
- The R17 reviewer was stopped after the user changed the Overview scope to omit two activities and added heatmap/team-matrix feedback; its old screenshots did not represent the accepted scope and it produced no gate result.

### Implementation checkpoint before Round 9

- The live IR aggregate endpoint now returns its DTO-required `fact_count`; full backend tests passed (146 tests). Frontend unit/route tests passed: 62 Node tests and 100 Vitest tests. The production build passed with existing ECharts/Ant Design chunk-size warnings. `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed; Git emitted only its configured LF-to-CRLF working-copy warnings.
- The latest R11 real-browser evidence shows no API failures, visible alerts, page-level horizontal overflow, or nested vertical scroll owners at 1920×1080, 2560×1440, and 390×844. The 1920 document height is 1380px; the 2560 page fits the 1440px viewport. Filled and empty states use the isolated IR demo SQLite; the default application database was not used.
- A read-only query confirmed the default `ai-dev-radar.db` still has zero `ir_requirements`; its data was not changed. The populated screenshot values therefore represent only the isolated demo database.
- Hovering the SA efficiency chart at 2026-07 displays Team C's original `+15,580%` and its estimated/actual workload while the point is explicitly placed at the ±100% display boundary. Selecting “测试用例执行” shows both unsupported lifecycle slots as missing and adds zero API requests.
- R11 screenshots: `overview-r11-ir-demo-populated-1920-viewport.png`, `overview-r11-ir-demo-populated-1920-full.png`, `overview-r11-ir-demo-empty-1920-viewport.png`, `overview-r11-ir-demo-empty-1920-full.png`, `overview-r11-ir-demo-populated-2560-viewport.png`, `overview-r11-ir-demo-populated-2560-full.png`, `overview-r11-ir-demo-mobile-390-viewport.png`, `overview-r11-efficiency-outlier-hover-1920.png`, `overview-r11-lifecycle-no-metric-selection-1920.png`, and `overview-r11-browser-evidence.json`.

### Browser checkpoint — R14 (before Round 10)

- A fresh Chromium browser run with the isolated IR preview database confirms 1920×1080 and 2560×1440 layouts, empty and populated states, the outlier tooltip, and unsupported lifecycle metrics. There is no page-level horizontal overflow, no nested vertical scroll owner, no API failure, and no browser error; the 1920 document height is 1335px and the 2560 page height is 1440px.
- Hovering the SA efficiency chart at 2026-07 shows Team C's original `+15,580%`; the source note explains the ±100% display boundary. Selecting “测试用例执行” preserves both unsupported metrics as missing without an additional API request.
- The default `ai-dev-radar.db` was not used or modified. R14 full-page screenshots show the entire lower team section; the 1080px viewport intentionally shows the start of the lower content, which the user has approved for natural scrolling.
- Frontend tests passed: 63 Node tests and 100 Vitest tests. The production build passed with existing ECharts/Ant Design chunk-size warnings.

### Implementation checkpoint — R17

- R17 screenshots include the revised compact boundary tooltip and the role-filtered topbar navigation/search controls. Playwright confirms quick search opens “研发活动”, the help menu opens, and the notification control is explicitly disabled. Browser evidence reports no horizontal overflow, nested vertical scroll owner, API failures, or browser errors at 1920×1080, 2560×1440, and 390px.
- The R17 1920 document was 1302px high and retained the lower team section in the full-page screenshot. The default database was not used or modified.
- Frontend tests passed: 63 Node tests and 101 Vitest tests. The production build passed with existing ECharts/Ant Design chunk-size warnings. The R17 visual gate, docs recheck, and final gates remain pending.

### Current implementation checkpoint — R27

- Playwright used the isolated IR preview database at the user's selected 2026-09 month. The Overview lifecycle shows six cards, the maturity legend and team value/change columns are visible, and browser checks report no horizontal overflow, nested scroll owner, API failures, or browser errors at 1920×1080, 2560×1440, and 390px. Route changes produced cancelled in-flight requests; no API request returned an error.
- Quick search navigates to the Activities page, the help menu opens, and the notification icon remains explicitly disabled. Selecting “测试用例执行” keeps unsupported metrics missing without an extra request; the efficiency tooltip shows the plotted boundary, original value, benchmark difference, and previous-period change.
- The populated/empty 1920 documents are 1471px/1485px tall; all KPI cards measure 148px at both states and sparkline boxes are 52px. The 2560 document is 1440px tall. The 390px page has no horizontal overflow. The user approves natural page scrolling. The default database was not used or modified.
- Frontend tests passed: 64 Node tests and 102 Vitest tests. The production build passed with existing ECharts/Ant Design chunk-size warnings. R27 independent review failed Information Architecture and marked Overall Visual Fidelity partial; lifecycle mapping and final gates remain pending.

### Current implementation checkpoint — R28

- The lifecycle now follows the reference stage order: `需求` (source `SA设计`), `SE设计`, `开发设计`, `编码开发`, `代码检视`, `测试` (source `测试用例生成`), then the `测试用例执行` real-flow extension. Stage values still come only from existing matching FactRecord types. The code-review stage remains missing and explains why general MR metrics are not substituted. `dta`/`dtf` remain omitted from this lifecycle.
- R28 screenshots: `overview-r28-populated-1920-viewport.png`, `overview-r28-populated-1920-full.png`, `overview-r28-empty-1920-viewport.png`, `overview-r28-empty-1920-full.png`, `overview-r28-populated-2560-viewport.png`, `overview-r28-populated-2560-full.png`, `overview-r28-mobile-390-viewport.png`, `overview-r28-efficiency-outlier-hover-1920.png`, `overview-r28-topbar-help-open-1920.png`, `overview-r28-lifecycle-code-review-empty-1920.png`, `overview-r28-lifecycle-test-execution-empty-1920.png`, and `overview-r28-browser-evidence.json`.
- Playwright evidence: 1920×1080 document height 1487px; 2560×1440 document height 1440px; mobile 390px has no page horizontal overflow. All target widths have no page-level horizontal overflow or nested vertical scroll owner. Quick search, help menu, and disabled notification affordance behave as expected. No API failures, browser errors, or visible alerts occurred. Screenshots use the isolated IR preview database; the default database was not used.
- Frontend tests passed: 64 Node tests and 102 Vitest tests. The production build passed with the existing ECharts/Ant Design chunk-size warnings. Fresh independent R28 visual review is pending.

### Round 20 — Sidebar Team Entry and Compact KPI Cards

- Fresh independent 15-dimension R28 review: PASS. All critical dimensions passed with no major failures. The reviewer noted two minor gaps: no visible `团队详情` sidebar entry, and KPI bands/vertical spacing taller than the reference.
- R29 adds a `团队详情` sidebar link to the existing Overview team-performance section and preserves URL filters. Selecting a team there still uses the existing Team Drill-down route. Desktop KPI cards place the 52px sparklines beside the value/comparison content and are 120px high (down from 152px).
- R29 screenshots: `overview-r29-populated-1920-viewport.png`, `overview-r29-populated-1920-full.png`, `overview-r29-empty-1920-viewport.png`, `overview-r29-empty-1920-full.png`, `overview-r29-populated-2560-viewport.png`, `overview-r29-populated-2560-full.png`, `overview-r29-mobile-390-viewport.png`, `overview-r29-efficiency-outlier-hover-1920.png`, `overview-r29-topbar-help-open-1920.png`, `overview-r29-lifecycle-code-review-empty-1920.png`, `overview-r29-lifecycle-test-execution-empty-1920.png`, `overview-r29-team-details-anchor-1920.png`, and `overview-r29-browser-evidence.json`.
- Playwright confirms the sidebar link preserves `month=2026-09`, reaches `#team-performance`, and becomes the selected entry. The populated/empty 1920 documents are 1422px tall; the 2560 document is 1440px. At 1920, the KPI cards are 120px high and retain 52px sparklines. The 390px page has no horizontal overflow. All target widths have no page-level horizontal overflow or nested vertical scroll owner, no API failures, browser errors, or alerts. The default user database was not used.
- Frontend tests passed: 64 Node tests and 103 Vitest tests. The production build passed with the existing ECharts/Ant Design chunk-size warnings. Fresh independent 15-dimension R29 review: PASS, with no critical or major gaps and no required changes.

### Overview addendum — Heat scale and KPI changes

- The user added two acceptance checks: show the maturity heat scale below the matrix, and show a separate change column for each Team Performance KPI.
- Both are already present in R29: the scale distinguishes valid `0.0` from `1.0–5.0`, and each KPI header groups `指标值` / `变化` subcolumns. The R29 full-page capture `overview-r29-populated-1920-full.png` visibly confirms both; no duplicate implementation is needed. Recheck them in the final Overview evidence after shared UI changes.

### Overview R30 — Card composition and visual scale

- The user supplied a fresh current-vs-acceptance comparison and reopened Overview after R29. Required changes: make the core trend plot substantially taller and align it with the lifecycle module; keep each non-KPI area's title, description, and content inside one enclosing card; include lifecycle tiles and trends in the same card, and include the Team Performance matrix and selected-team trends in one card; combine maturity context with the matrix description and keep the matrix/radar together in one card; increase KPI card height/icon weight and use the available sparkline area without a large dead gap; remove the Overview code-review stage tile and add stage icons.
- Preserve the already approved 0.0 / 1.0–5.0 maturity scale, Team Performance `指标值` / `变化` subcolumns, natural page scrolling, and the prior Overview-only exclusion of `dta` / `dtf`.
- Documentation impact: Business Design UPDATE `docs/business/analytics.md` for the visible Overview lifecycle stages; Architecture UPDATE `docs/architecture/overview.md` if the shared panel/visual ownership changes; Standards NONE; ADR NONE; Change Design UPDATE. Complete the browser/screenshots and fresh independent reviewers before treating R29 as current acceptance.

#### R30 Implementation and Browser Evidence

- The overview lifecycle, maturity, and team sections now use one enclosing `AnalyticsPanel` each; the maturity matrix/radar and team matrix/preview trends sit within their parent card. Non-KPI section descriptions are inside those cards.
- The core trend and lifecycle cards share a grid row and equal bounds. The master chart is 360px high; lifecycle activity tiles now include icons, and the code-review tile is omitted. The KPI cards use 44px icon accents, 64px sparklines, and a 152px minimum desktop height. Existing heat scale and TeamMatrix value/change subcolumns are retained.
- Browser evidence is in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/overview-r30/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`: populated/empty 1920 screenshots, populated 2560 screenshots, lifecycle missing-slot capture, and `overview-r30-browser-evidence.json`. At 1920 the document is 1686px tall (empty: 1700px); at 2560 it is 1649px. There is no page-level horizontal overflow; the paired cards have identical top/bottom bounds, six lifecycle tiles render, each KPI matrix has eight value/change subcolumns, and the maturity scale remains visible.
- `frontend` `npm run test:unit` passed (66 Node tests and 104 Vitest tests), `npm run build` passed with the existing ECharts/Ant Design chunk warnings, and the isolated-demo Playwright screenshot/overflow run passed. The R30 review result and follow-up are recorded below.
- Documentation updated: UX composition and current Overview lifecycle exception in `docs/ux/UX-REDESIGN-SPEC.md`; visible stages and card composition in `docs/business/analytics.md`; panel/style ownership in `docs/architecture/overview.md`. Standards: NONE. ADR: NONE.

#### R30 Independent Review

- The fresh screenshot-only reviewer returned `gate: PASS`, with all critical dimensions PASS, but marked Information Density PARTIAL at major severity and Empty / No-data State PARTIAL at minor severity. The goal allows only minor residual deviations, so R30 is not accepted despite the reviewer's `gate` field.
- R31 fixes: stop stretching the shorter maturity card to the Team card height while keeping both cards top-aligned; show the selected test-execution missing-metric explanation once, use concise per-slot labels, and reduce the empty chart frames. Capture the same 1920/2560 and empty/selected lifecycle states, then request another fresh independent review.

#### R31 Browser Evidence

- Updated screenshots are in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/overview-r31/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`. The set contains 1920/2560 viewport and full-page captures, a 1920 empty-month state, the selected test-execution empty slots, and `overview-browser-evidence.json`.
- The 1920 and 2560 documents are 1686px and 1649px tall; the empty 1920 document is 1700px. No page-level horizontal overflow occurred. The paired middle panels retain identical bounds; the maturity panel is now content-height while its top stays aligned with Team Performance. Test-execution shows its explanation once and two short metric-specific missing states.
- The updated isolated-demo screenshot/overflow E2E passed. Fresh independent visual review R31 is recorded below.

#### R31 Independent Review

- Fresh screenshot-only R31 review returned FAIL: Information Architecture PARTIAL at critical severity because the default key-activity maturity matrix does not contain the code-review dimension; Information Density PARTIAL at major severity due to the full-page vertical rhythm; lower-row panel height mismatch was minor.
- The underlying catalog classifies `MR代码检视` as a general R&D capability rather than a key activity. Do not merge its score into the key-activity maturity matrix; show the general-capability mode as separate evidence and make that classification explicit to the next reviewer. `dta`/`dtf` remaining in maturity data is consistent with the user's lifecycle-only exclusion.

### Overview R32 — Compactness and maturity scope evidence

- Keep the requested tall core trend and major card boundaries, but reduce nonessential height in the KPI bands and selected-team previews so the full page is closer to the reference density. Keep the lower maturity and team panels top-aligned and prevent a stretched maturity card.
- Capture an additional Overview screenshot with `通用研发能力` selected to show `MR代码检视` in its correct category, plus the default key-maturity and empty/selected lifecycle views. Re-run all 15-dimension review using only the approved reference, relevant UX spec, screenshot set, and the key/general maturity business fact.

#### R32 Browser Evidence

- Updated R32 screenshots are in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/overview-r32/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`. They include populated 1920/2560 viewport/full-page states, empty 1920, selected test-execution missing slots, and general-capability maturity mode.
- `MR代码检视` is visible in the general-capability matrix when that mode is selected; it is not merged into the key-activity matrix. The maturity mode selector stays on Overview and records `maturity_category=general`; the legacy `category` query remains reserved for route redirects.
- Browser evidence reports 1920/2560 document heights of 1633px/1599px and empty 1920 height 1662px. There is no horizontal overflow; KPI card heights are 142px at 2560 and 142–156px at 1920; the core trend/lifecycle cards retain equal top/bottom bounds. The isolated-demo screenshot/overflow E2E passed after checking the general maturity mode and unsupported lifecycle slots.
- Frontend unit/route tests (66 Node, 104 Vitest), build, documentation checks/tests, and the isolated-demo screenshot/overflow E2E pass after the URL-state separation. The general-maturity selector stays on `/`, writes `maturity_category=general`, and shows the `MR代码检视` column in the general-capability matrix.

#### R32 Independent Review

- Fresh screenshot-only R32 review returned PASS: all five critical dimensions pass, no major deviation remains, and there are no open visual findings. The reviewer recognizes the business-correct key/general maturity split and the approved lifecycle exclusions.

#### Overview R33/R34 User Follow-up and Re-review

- The user re-raised chart height/alignment, lifecycle card grouping and icons, maturity/team card composition, KPI size/sparkline spacing, and Overview-only code-review/DTS exclusions. A fresh 1920/2560 isolated-demo capture showed the requested 360px core chart, aligned paired panels, six icon-bearing lifecycle cards without code review or DTS, and enclosing maturity/team panels. The user explicitly accepts document scrolling and prefers the taller chart and larger KPI cards; do not shrink these to fit one viewport.
- R33 screenshot-only review returned FAIL because it treated below-the-fold content as a major density defect and also requested clearer cycle comparison wording. That density finding conflicts with the user's explicit scroll/tall-chart acceptance. R34 was given that user constraint and passed page length, KPI sizing, chart height, lifecycle, maturity, and team composition. It found one remaining major issue: the isolated demo has only one IR-populated team, so the core trend shows one overlapping team/average line. Do not fabricate data; add explicit unavailable multi-team comparison context and recapture.
- R34 screenshots are in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/overview-r33/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`. They predate the unavailable-comparison note and remain historical for that finding. Cycle comparison copy now identifies the prior cumulative value explicitly; obtain a fresh screenshot and reviewer after rebuilding.

#### Overview R35 Independent Review and Icon Adjustment

- Fresh screenshot-only R35 returned PASS with no critical or major findings. It confirmed the tall chart, generous KPI sizing, natural scroll, six requested lifecycle cards, separated key/general maturity, card grouping, and explicit sparse-team comparison note. Its only minor finding was that KPI icon glyphs looked small inside the circles.
- Increased Overview KPI glyphs from 21px to 24px while preserving their circular backgrounds/card geometry; the screenshot E2E asserts the new size. Current screenshots/evidence are in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/phase5-final/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`. No business, architecture, standards, or ADR change; Change Design UPDATE.

### Activity R14 — Cycle KPI and Trend Density

- Cycle KPI cards keep the numeric delta visible without repeating a long period label; the section description states the cycle-difference semantics for rates/efficiency and the selected-month contribution for counts/workload. Monthly labels and underlying calculations are unchanged.
- The paired activity trend charts use 140px plot heights (down from 155px) to bring the team-difference section closer to the approved reference while retaining natural page scrolling.
- R14 populated screenshots were captured at 1920×1080 and 2560×1440, plus a 1920×1080 selected-month empty state: `activity-r14-populated/populated-1920-viewport.png`, `activity-r14-populated/populated-1920-full.png`, `activity-r14-populated/populated-2560-viewport.png`, `activity-r14-populated/populated-2560-full.png`, `activity-r14-populated/empty-1920-viewport.png`, and `activity-r14-populated/empty-1920-full.png`. They use a freshly seeded isolated demo SQLite database, with `开发设计` selected. Browser evidence: 1920 document height 1533px, 2560 document height 1546px, no horizontal overflow or nested vertical scroll owners; populated KPI cards are 113px/119px high and trend cards 218px. The sole 401 was the expected unauthenticated `/api/auth/me` check before sign-in; no post-login API failures or browser errors occurred. The default user database was not read or modified.
- The complete `npm run gate` passed: 146 backend tests, 66 Node tests, 103 Vitest tests, 10 E2E tests, production build, and documentation checks/tests. The build retains its existing ECharts/Ant Design chunk-size warnings. The E2E captures 2560 screenshots using its own disposable database.
- Fresh independent 15-dimension Activity Detail review R2 returned FAIL: critical Information Architecture and major Page Composition/Overall Visual Fidelity because the reference's three lower analysis areas were not separately expressed; it also requested visible period markers and a tooltip-state screenshot. The R14 screenshots remain historical evidence for the KPI-density iteration, not final Activity evidence.

### Activity R15 — Restore Lower Reference Analysis

- The lower activity row now has three panels: a matched-penetration covered/uncovered volume split from its valid numerator/denominator, monthly saved-workload bars from matching efficiency facts, and a distinct original-metric summary retaining the same-metric mean/change, merged result/raw formula, fact count, and effective-team coverage.
- Invalid or absent penetration inputs keep the split unavailable; recorded zero remains a separate state. Missing workload months remain gaps. No IR data, invented demand categories, extra growth series, or new API are used.
- Activity penetration/efficiency trend charts now show subtle markers at valid periods so values can be located; their existing structured hover tooltip remains available.
- R15 real-browser screenshots: `activity-r15-final/populated-1920-viewport.png`, `activity-r15-final/populated-1920-full.png`, `activity-r15-final/populated-1920-hover.png`, `activity-r15-final/populated-2560-viewport.png`, `activity-r15-final/populated-2560-full.png`, `activity-r15-final/empty-1920-viewport.png`, and `activity-r15-final/empty-1920-full.png`. The populated run selects `开发设计` in a freshly seeded isolated SQLite database. Browser evidence: 1920 document height 1664px, 2560 document height 1625px, no horizontal overflow or nested vertical scroll owners, three aligned lower panels, and no post-login browser/API errors.
- Full `npm run gate` passed after R15: 146 backend tests, 68 Node tests, 103 Vitest tests, 10 E2E tests, production build, documentation check, and documentation tests. The production build retains the existing ECharts/Ant Design chunk-size warnings.
- Fresh independent 15-dimension Activity Detail review R3 returned PASS under the critical/major-Fail gate rule, but marked Information Density and Overall Visual Fidelity PARTIAL at major severity because the lower panels are only partly visible in the target viewports. R16 continues to close this full-composition gap before advancing.

### Activity R16 — Vertical Rhythm Follow-up

- R16 reduces the Activity workspace gaps, KPI icon footprint, paired chart height, and team-matrix row padding. The matrix already uses semantic team buttons with shared hover/focus styles; include a hovered/focused row capture to confirm the affordance visually.
- Capture populated/empty browser screenshots at 1920×1080 and populated at 2560×1440, then obtain a fresh independent Detail review R4.

### Activity R17 — Trend Tooltip Fit

- The paired Activity charts use a 130px chart height. An axis-triggered tooltip lists every team at once and can cover the Team Difference section; use the existing structured tooltip for the hovered data point on these two charts only. Keep valid point markers visible for the item target and derive the period label from its source point. Preserve the default axis tooltip for other callers.
- Capture the tooltip and adjacent team matrix in the real browser before the fresh independent Detail review.

#### R17 Browser Evidence

- Isolated demo-database screenshots are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/activity-r17/`. Captures cover populated/empty 1920×1080, populated 2560×1440, item-tooltip, and team hover/focus states.
- The item tooltip shows one team and resolves the period label from the hovered source point; its box stays inside the trend chart and above the Team Difference matrix. The browser reports no horizontal overflow, nested vertical scroll owner, visible alert, API failure, or browser error.
- Geometry: populated 1920 document height 1534px (matrix y=914, lower panels y=1157); empty 1920 height 1546px (matrix y=959, lower panels y=1202); populated 2560 document height 1495px (matrix y=927, lower panels y=1170). Natural document scrolling remains in use.

#### R4 Independent Review

- R4 confirmed the Activity structure, KPI rows, paired charts, missing state, table affordances, and tooltip. It marked Chart Visual Treatment and Overall Visual Fidelity PARTIAL, although its `gate` field says PASS. Both are critical dimensions under the goal contract, so this is recorded as a FAIL and does not advance the page.
- R4's lower-panel findings were text-heavy original-metric details and the absent year-over-year workload line seen in the reference. The current Activity query has no year-ago comparison series; R18 keeps the bar series truthful, labels that boundary, and makes the existing same-metric company-average trend visible in the metric summary.

#### R18 Browser Evidence

- Updated isolated-demo captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/activity-r18/`. Populated and empty states cover 1920×1080; populated also covers 2560×1440. The set includes the item tooltip and team hover/focus states.
- The raw-metric summary now shows a compact sparkline from the same-metric company-average series and retains merged values, raw formula, fact count, and team coverage. The workload panel says it omits the year-over-year line because same-period-prior-year facts are absent from the current window.
- Browser evidence reports no horizontal overflow, nested vertical scroll owner, visible alert, API failure, or browser error. Populated document heights: 1501px at 1920 and 1514px at 2560; empty 1920 is 1546px. The charts and team matrix remain aligned; natural scrolling is preserved.

#### R5 Independent Review

- Fresh independent review R5 returned PASS: all critical dimensions passed and no major issue remains. It noted one minor wording ambiguity because empty selected-month charts still display historical team lines.

### Activity R19 — Selected-period Empty State

- Clarify that the selected period has no facts while valid history remains visible in the trend chart. Recapture the Activity viewport/full-page states and obtain a fresh independent Detail review R6.

#### R19 Browser Evidence

- Updated captures are in `C:/Users/80726/.codex/visualizations/2026/09/25/01a0d75e-a556-7c81-bc87-058b73717ab6/activity-r19/`. They cover the populated and empty 1920×1080 states, populated 2560×1440, paired-chart tooltip, and team hover/focus.
- Empty-month chart notices now identify the selected period and explain that valid historical data remains plotted. Geometry and browser health match R18: populated documents are 1501px at 1920 and 1514px at 2560; empty 1920 is 1546px. No page-level horizontal overflow, nested vertical scroll, API failures, or browser errors occurred.
- Frontend checks after the copy correction passed: 68 Node tests, 103 Vitest tests, production build, docs check/tests, and `git diff --check`. Full `npm run gate` passed at R18 before this copy-only correction: 146 backend tests, 68 Node tests, 103 Vitest tests, 10 E2E tests, production build, and docs checks.

#### R6 Independent Review

- Fresh independent 15-dimension review R6 returned PASS. All critical dimensions passed, with no major or minor issues; Activity may advance to Capability.

### Activity R18 — Lower Evidence Scanability

- R4 returned `gate: PASS` while marking Chart Visual Treatment and Overall Visual Fidelity PARTIAL; both are critical dimensions under the goal contract, so this round is treated as FAIL.
- The reference's workload chart includes a year-over-year line, but the Activity trend query contains only the current six-month window and has no same-period-prior-year series. Keep the supported monthly saved-workload bars and state why the comparison line is absent; do not derive a different comparison and label it year-over-year.
- Give the original-metric summary more width, add a compact trend cue from each existing same-metric company-average series, and keep the current merged raw values and coverage evidence readable.
- Update `docs/business/analytics.md` to record the comparator boundary; capture the revised real-browser states and obtain a fresh independent Detail review R5.

### Global Consistency R1 — Single-Team IR Benchmark Disclosure

- The fresh global review found one Major semantic disclosure gap: Overview explained that a single valid IR team cannot support multi-team comparison, while Team Drill-down labelled the same one-team value as an equal-weight benchmark without showing the valid-team count. This contradicted UX spec §9.1 and the existing Team business/architecture contract.
- Team Drill-down's overall panel now groups single-participant KPI means by month/cycle and names the sole valid team plus its `1/N` coverage and unavailable-comparison state. KPI calculations and missing-value behavior are unchanged. The seeded-browser E2E asserts both month and cycle warnings.
- Verification after the fix: `npm run gate` passed (146 backend, 67 Node, 104 Vitest, 3 Gateway E2E, build, docs check/tests); separate Phase 5 UI smoke passed 8/8. Final screenshots are in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/phase5-global-final-rerun/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`. Team R8 passed; only a fresh global consistency review remains.
- Fresh screenshot-only Team R8 review returned PASS across all 15 dimensions with no critical, major, or minor findings. It confirmed the month/cycle `1/4` warnings are readable inside Overall Performance and correctly qualify the equal-weight benchmark. No remaining Team-specific review change is required.

#### Global Consistency R2

- Fresh screenshot-only global review R2 returned PASS with no critical or major findings. It confirmed consistent shell, surfaces, KPI grids, team colors, benchmark styling, missing-value language, and the Team month/cycle `1/4` disclosure. Acceptable minors: Capability KPI primary values are smaller than Overview/Activity; Overview/Activity/Capability label their baseline “全公司均值” while Team explicitly names its valid cohort.
- R2 was given incorrect paths for the supplementary root `DESIGN.md` and `UX-CONTRACT.md` (`docs/` was mistakenly prefixed), so it did not cross-check those two documents. The required references, UX redesign spec, current screenshots, and business semantics were reviewed. The correct root documents have now been checked and their obsolete existing-catalog KPI statements corrected; current cycle count/workload text is also clarified as selected-window totals with the selected-month contribution shown as the delta. These documentation-only corrections do not change screenshots or implementation.
- R2 also noted that Capability KPI primary values were smaller than Overview and Activity. The actual root `DESIGN.md` token contract sets KPI values to 32–38px, while `analytics.css` had a one-off 22.4px override. That override is now removed so Capability uses the shared KPI scale. A fresh Capability screenshot review and a new global review must confirm this last visual adjustment.
- The full root gate passed after the CSS and Team copy adjustments (146 backend, 67 Node, 104 Vitest, 3 Gateway E2E, production build, documentation checks/tests); the isolated Phase 5 UI suite passed 8/8. The newest four-page evidence, including current Team wording and Capability viewports at 1920/2560, is in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/phase5-team-copy-compact/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`. Capability R9 passed; Team R9 and global R4 are pending.

#### Capability R9 Independent Review

- Fresh screenshot-only review R9 returned PASS across all 15 dimensions with no major issues. It confirmed the 32px primary values remain readable and fit the four-card row at both 1920 and 2560. The reviewer noted screenshot evidence cannot verify API source authenticity, keyboard/scroll behavior, or real missing/zero samples.
- Final Capability images: `qa-1920-analytics-capabilities-viewport.png`, `qa-1920-analytics-capabilities.png`, `qa-2560-analytics-capabilities-viewport.png`, and `qa-2560-analytics-capabilities.png` in the `phase5-team-copy-compact` evidence directory above. The updated UI follows the shared 32–38px KPI token and has no local scale override.

#### Global Consistency R3 and Team Copy Follow-up

- Fresh global review R3 returned PASS with no major findings and reviewed the correct root `DESIGN.md` and `UX-CONTRACT.md`, all four references, and current screenshots. It confirmed shared KPI scale, shell, team colors, and benchmark style; the updated Capability values match the reference and the shared KPI tier.
- R3 identified one minor copy mismatch: the Team page header called the benchmark “领域平均” while maturity alone uses that term. The header now summarizes only the selected filter scope; the relevant cards and chart legends name their IR and FactRecord benchmark cohorts. The monthly/cycle status lines now say each listed KPI has its own equal-weight mean. No formulas or values changed. The current screenshots are in the `phase5-team-copy-compact` directory above.

#### Team R9 Independent Review

- Fresh screenshot-only review R9 returned PASS across all 15 dimensions with no critical, major, or minor findings. It confirmed the shorter page-head scope, KPI-by-KPI `1/4` notices, separate mean labels, and layouts at both 1920 and 2560. No further Team-specific UI change is required.

#### Global Consistency R4

- Fresh independent global review R4 returned PASS with no Critical or Major issues. It confirmed the current four-page screenshots against the correct root `DESIGN.md`, `UX-CONTRACT.md`, approved references, and UX specification.
- The review's one remaining minor is a benchmark caption difference: Overview's provisional IR mean is labelled “全公司均值,” while the acceptance reference/UX spec sample says “领域平均.” The business analytics contract describes the IR line as an equal-weight mean over valid teams and uses “全公司均值”; `领域平均` is reserved in the design contract for maturity assessment. Keep the current term to preserve those meanings. Team uses the more explicit “有数据团队等权均值” / “有事实团队等权均值” labels.

## Final Verification

- Page visual gates: Overview R35 PASS; Activity R6 PASS; Capability R9 PASS; Team Drill-down R9 PASS; Global Consistency R4 PASS. No Critical or Major visual findings remain.
- Functional gate: `npm run gate` passed after the final UI copy change (146 backend tests, 67 Node tests, 104 Vitest tests, 3 Gateway E2E tests, production build, documentation check and test). Separate isolated-demo Phase 5 Browser UI Smoke passed 8/8 and produced final screenshots in `C:/Users/80726/.codex/visualizations/2026/09/27/01a0d75e-a556-7c81-bc87-058b73717ab6/phase5-team-copy-compact/playwright/phase5-smoke.e2e-Phase-5-B-ca8d7-ce-at-the-release-viewports/`.
- Documentation: Business, Architecture, Standards, Product Design contracts, UX Specification, and this Change Design are synchronized. No ADR was needed; metric/API architecture decisions were not superseded. `docs/index.md` has no new document to navigate.
- The browser suite used a seeded isolated demo database. The default user database was not modified. Build warnings for existing ECharts/Ant Design chunk sizes and existing pytest/Starlette deprecation/cache warnings remain.

## Remaining Minor Deviation

- Overview IR charts say “全公司均值”; the reference/UX spec sample says “领域平均.” This copy difference was accepted because the current business contract labels the valid-team IR arithmetic mean as “全公司均值,” while reserving “领域平均” for maturity.
- Visual reviewers used screenshots for copy/layout, and the separate browser suite covered routes, keyboard/focus, scroll reachability, and overflow. The demo environment does not prove calculations against a production data set.
- The topbar notification service is not implemented; its icon is shown disabled with an explicit unavailable label. Quick search is intentionally limited to role-visible navigation entries.
