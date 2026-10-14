---
version: 1
name: "ai-dev-radar"
description: "A restrained light-mode enterprise analytics system for evidence-led AI engineering management."
colors:
  page: "#f7f8fa"
  surface: "#ffffff"
  text-primary: "#182230"
  text-secondary: "#475467"
  border: "#e4e7ec"
  primary: "#155eef"
  success: "#039855"
  warning: "#dc6803"
  danger: "#d92d20"
  danger-foreground: "#b42318"
  data-team-1: "#1f6feb"
  data-team-2: "#168e67"
  data-team-3: "#e88222"
  data-team-4: "#7756d8"
  data-team-5: "#0f9d9a"
  data-team-6: "#5f6b7a"
  data-team-7: "#c3436e"
  data-team-8: "#80533d"
  data-average: "#667085"
  data-target: "#a5adba"
  maturity-bg-0: "#f2f4f7"
  maturity-bg-1: "#eaecf0"
  maturity-bg-2: "#fffaeb"
  maturity-bg-3: "#fff4e5"
  maturity-bg-4: "#ecfdf3"
  maturity-bg-5: "#d1fadf"
typography:
  sans:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  app-shell: { }
  page-header: { }
  filter-toolbar: { }
  metric-kpi-card: { }
  chart-card: { }
  benchmark-legend: { }
  analytics-directory: { }
  maturity-matrix: { }
  settings-workspace: { }
  status-page: { }
  content-loading: { }
---

# ai-dev-radar Design System

## Overview

### Creative North Star

The product should feel like a management review assembled from an engineering evidence book: calm working surfaces, deliberate typography, and data that speaks before ornament. Its signature is an evidence-led reading order—context, metric, comparison, then drill-down—paired with vivid but stable chart series. Use visual weight to clarify real data; never to imply a synthetic score or unsupported conclusion.

### Product context and register

- **Audience and primary job:** R&D managers, domain owners, and team leaders assess verified AI engineering facts, maturity, variance, and operational data work.
- **Target market(s) and evidence:** No market-specific claim is maintained. The Chinese product language is grounded in [CONTEXT.md](CONTEXT.md) and the business design under [docs/business](docs/business/index.md).
- **Locale(s) and language policy:** Current product copy is Simplified Chinese with an English product name. New labels use concise, domain-defined Chinese; no Japanese-market behavior is inferred.
- **Usage scene:** Desktop-only redesign, with primary acceptance at 1920×1080 and wide-screen acceptance at 2560×1440. Analytics pages use the full post-sidebar canvas. Existing narrow-screen fallbacks remain in the product but are not redesigned or accepted as part of this change.
- **Register:** Product/admin application. The three modes are Executive Dashboard, Analytical Workspace, and Operational Console.
- **Memorable signature:** The engineering evidence itself carries the visual emphasis through large metric values, compact trends, stable team colors, and same-metric benchmarks; page chrome stays quiet.
- **Restraint:** Familiar Ant Design behavior, readable tables, filters, drawers, and navigation take priority over expression.
- **Anti-references:** Neon/AI spectacle, blue-purple glow dashboards, generic Ant Design Pro card grids, and pie/donut defaults all obscure evidence density or imitate a template.
- **Token ownership/runtime mapping:** `frontend/src/design/tokens.css` is the canonical runtime source. `frontend/src/design/theme.js` and `frontend/src/charts/chartTheme.js` resolve the CSS semantic tokens for Ant Design and ECharts; application and page CSS consume those canonical tokens directly. `app.css` keeps only true shell-local state such as the responsive `--shell-sidebar-width`; it no longer publishes compatibility color, spacing, motion, or visualization aliases. Shared components and chart options consume the resolved values.

## Colors

`--color-bg-page`, `--color-bg-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border-default`, and `--color-brand-primary` establish light-mode hierarchy. Semantic status colors only express real success, warning, and error meanings. Text on subtle error surfaces uses `--color-danger-foreground` to preserve readable contrast; `--color-danger` remains the indicator and chart color. `--color-data-team-1` through `--color-data-team-8` are fixed entity slots (blue, green, orange, purple, teal, slate, rose, brown); `--color-data-average` is the neutral dashed benchmark. The maturity `--color-data-maturity-bg-0` through `--color-data-maturity-bg-5` are ordinal cell fills, not positive/negative signals. Fact charts label `company_average` as “全公司均值”; Team IR and unversioned FactRecord comparisons name their valid-team cohorts “有数据团队等权均值” and “有事实团队等权均值”; version-scoped Team comparisons name the unversioned benchmark “领域参照 · 不限版本” and, for iteration charts, “领域参照（同日期范围、不限版本）”. Maturity charts label the assessment aggregate as “领域平均”. `--color-data-target` is intentionally quiet and can be rendered only when a true target exists.

The approved Overview maturity heatmap uses a page-scoped yellow → teal → blue ramp for levels 1–5 in `frontend/src/analytics/analytics.css`; valid 0.0 remains neutral. This composition-specific variant does not change the global maturity scale used by other routes.

Capability Team Difference uses its own `--color-data-capability-heatmap-1..5` scale. Each column is normalized against that metric's finite team values, with a visible low-to-high legend; missing values remain neutral. This scale compares relative magnitude and never encodes quality or performance. It is separate from all maturity assessment colors.

Future dark mode changes semantic mappings under a theme selector; pages must not depend on current primitive values. Focus uses the brand role with a visible outline, and selection uses the sidebar-specific semantic roles.

## Typography

The system stack supports Chinese UI text without a new font dependency. Page title is 26–30px (default 28px), page description 13–14px, section title 18–20px, chart/card title 13–15px, body 14px, supporting metadata 11–13px, axis/legend 11–12px, and KPI values 30–36px. Delta text is 12–14px and at least 600 weight. Numbers and charts use `font-variant-numeric: tabular-nums`; labels describe what is measured rather than manufacturing a score.

## Layout

The Analytics gutter is 20–28px at 1920×1080 (24px default). Analytics uses the full post-sidebar canvas without a page-level maximum width. Section gaps are 20–28px and card gaps are 12–16px. Four-column KPI rows share equal tracks. Activity/Capability directories reserve 210–230px and give the remaining width to their workspaces. Operational pages keep a separate table/workflow pattern; Readable stays available for form-oriented content.

The document owns page-level vertical scrolling. The Sidebar may scroll internally; analytics cards do not. Main content clips horizontal spill without creating a vertical scroll ancestor that breaks sticky navigation. The application uses a 208–224px expanded / 64px collapsed desktop sidebar and keeps the existing 280px navigation drawer breakpoint. The Topbar is 48–56px and remains a lightweight context-and-account strip; each route owns a content-level page header. Analytics filters sit beside the page title as compact selectors with an icon, small label, selected value, and chevron. Overview keeps Month and Statistical Period side by side. The Month card opens a keyboard-operable month grid with year controls; arrows move between months, Enter selects, and Escape closes. The cycle selector opens from the whole card and preserves native Select focus/keyboard behavior.

No page gets a fixed document height to make a table fill space. Tables own needed horizontal/vertical overflow; scrollbars remain visible, thin, and tokenised globally.

## Elevation & Depth

Primary hierarchy comes from the page/surface/subtle surface sequence, typography, and spacing. Panels use a one-pixel border and restrained `--shadow-panel` only when a floating boundary needs it. Nested cards and ornamental shadows are not layout primitives.

## Shapes

Controls use `--radius-sm`; independent panels use `--radius-md`; larger composed surfaces use `--radius-lg` only when their geometry calls for it. Dividers use `--color-border-default`; icon-only actions retain an accessible 40px target where the shell already establishes one.

## Components

Runtime ownership stays explicit: `frontend/src/design/tokens.css` is canonical; `frontend/src/design/theme.js` adapts spacing, typography, surfaces, and controls to Ant Design; `frontend/src/charts/chartTheme.js` adapts stable team, benchmark, maturity, and chart-axis colors to ECharts. `frontend/src/components/AnalyticsComponents.jsx` owns AnalyticsSection, ChartCard, BenchmarkLegend, AnalyticsDirectory, MaturityMatrix, and TeamMatrix. `frontend/src/components/MetricCard.jsx` owns MetricKpiCard. These components present caller-provided facts and never calculate metric meaning or permissions.

### Foundational visual states

Focus-visible always has a 2px brand outline. Hover/pressed states are perceptible without replacing labels or moving layout. Loading, empty, error, not-evaluated, no-permission, and partial-data states use compact stable `feedback-state` regions and explain the condition; a missing fact is never displayed as zero.

### Buttons and actions

Ant Design Button remains canonical. Solid brand actions are reserved for page primary actions and confirmed commits; neutral/ghost actions support secondary work; danger stays separated until a destructive confirmation. Busy buttons keep their geometry.

### Analytics and data display

**Activity page R2 (2026-10-06):** the Activity Analysis directory card is paired with the selected-activity KPI/core-trend workspace and ends at the core-trend bottom; its eight rows use small decorative SVG icons. Team Difference and the three summary cards sit below at full workspace width and do not change when Activity selection changes. Lower cards target `226px` at 1920×1080 and `313px` at 2560×1440; workload uses blue bars plus an IR same-month-last-year growth line, leaving absent comparisons blank. The six raw-summary labels remain visible, while unconfigured catalog counts stay missing. Activity metric Error states use concise generic recovery copy and do not expose server/transport or test-fixture detail.

**Capability page refinement (2026-10-10):** Capability uses the same compact white directory panel, header divider, 36px rows, and small icons as Activity, while retaining its own full-page workspace and selection logic. Selecting an ability updates only that ability's defined metric status, trend cards, Team Difference, and evidence. The separate maturity matrix/radar remains the overall seven-capability assessment and is unchanged by ability selection; no cross-capability score is synthesized. The Capability-only Team Difference uses a five-level within-column relative heatmap; its legend says low-to-high, the fill does not imply quality, and missing or unconfigured cells remain neutral. The requested effective-review fields and trends remain explicitly unconfigured until their source and formulas are approved; they never alias the existing MR review count/rate metrics. This heatmap does not use the maturity palette.

Team Detail uses page-local geometry at both accepted Desktop widths: Overall trend hosts are `133px` with at least `80px` effective plot height; lifecycle trend hosts are `120px` with at least `70px` effective plot height. Vertical panel padding and inter-story spacing are `6px`; preserve the separate breathing gap between lifecycle cards and trend charts. The maturity heading starts by `y=1040px` at 1920×1080 and `y=1400px` at 2560×1440; the full matrix/radar remains on natural vertical scroll. These Team-only values do not change shared Analytics card defaults.

App navigation is a light, role-filtered sidebar with current-route indication, keyboard focus, and the existing drawer fallback. Breadcrumbs provide context in Topbar. The shared `FilterToolbar` groups analysis controls by meaning and preserves route-specific URL state and the selected analysis month. Analytics pages use product-owned KPI, chart, benchmark, directory, and matrix patterns; a card only displays one named catalog metric or a business-approved aggregation with a documented formula. KPI cards are 116–128px high with equal baselines; their mini trends generally occupy 35–45% of the content width or span the lower edge at 28–42px high. Overview follows its approved reference-specific ratio: about 50–52% of the full KPI card width. **Overview BR-03/BR-04 exceptions (2026-09-30):** its four-card KPI rows use 180px cards and expanded plot/maturity/team-preview areas; Month and Statistical Period stay inline. The six lifecycle cards remain 92px, with a 12±4px separation before paired trend cards that fill the remaining lifecycle-panel content height. The lower matrix/radar tracks use 61.2/38.8 of available width after their 16px gap; the matrix/color scale and radar legend use the maturity-panel content height. Team preview has a 12±4px gap after the table and fills remaining panel height; BR-05 R6 (2026-10-01) supersedes the R3 height minimums: the Overview maturity grid and Team preview plot surfaces target 70% ±3 percentage points of fresh R5 measurements at each accepted Desktop viewport. R3 keeps maturity/team panels bottom-aligned; each lifecycle trend card, maturity grid/scale/radar legend, and team preview chart grid leaves at most 12px to its panel content edge. BR-05 R6 targets a 70% height ratio for the maturity grid and Team plot surfaces; the R6 candidate keeps both heights at 70%, aligns the panel tops, and records outer bottom offsets of 67.72/78.72px at 1920×1080/2560×1440. This Overview-only deviation from BR-04 bottom alignment still needs user full-page confirmation. Content-bottom distance is measured from the panel border-box bottom after subtracting computed bottom padding and border. These remain Overview-only rules; they do not alter shared KPI geometry for Activity or Capability. Analytics cards use a white surface, subtle border, and soft visible shadow. The Overview keeps separate selected-month and selected-cycle KPI rows for the four user-approved provisional IR KPIs; their source mapping and formula are documented in `docs/business/analytics.md`. Rate/efficiency values recompute from IR raw totals; count/workload values represent the selected window, and cycle deltas show the selected-month contribution. The core trend shows IR team series and their same-metric equal-weight mean over teams with valid values; the team matrix keeps the four KPI columns separate. `AnalyticsDirectory` uses the shared `.analytics-directory-workspace` in `design-system.css`: a 210–230px sticky directory and a full-width fluid workspace. Activities keep selected-activity KPI outcomes and same-metric trends in the upper workspace; a separate full-width lower band shows page-wide IR team comparison, IR coverage breakdown, global workload trend, and the fixed six-slot raw summary without following Activity selection. Capabilities use a different status/evolution/team/evidence/maturity hierarchy based on catalog types. The general-capability maturity matrix displays all seven catalog axes as rows against the domain average and team cohorts; evaluated levels 1–5 use distinct ordered fills, while unevaluated cells retain a neutral fill. Capability uses a 670×460 Radar label frame scaled proportionally inside its existing layout slot; full axis names wrap and adjacent labels do not overlap. Reference-normalized series bounds are tracked in the active baseline. Team Detail keeps a page-scoped compact density so the maturity-section heading enters the first accepted Desktop viewport while its full matrix/radar content remains on the natural page scroll. Team Drilldown follows Overall Performance → R&D Lifecycle → Maturity Profile with sticky section navigation; Overall Performance uses the same four provisional IR KPIs, with the selected Team as the main series and its same-KPI equal-weight mean over teams with values as the benchmark. When only one team has a valid value, the UI discloses the valid-team count and unavailable multi-team comparison. Lifecycle trends use FactRecord; maturity shows the Team against domain averages without filling missing assessments. Maturity has its own selected category, team matrix, and current/previous domain-average radar. Team colors stay fixed across routes; fact `company_average` remains distinct from maturity's `领域平均`. Trend charts show same-metric comparisons; missing values remain gaps. Operational tables keep numeric alignment, compact controls, sticky headers where supported, and local horizontal scrolling only when needed. Pie/donut is not a default.

**Overview BR-05 R7 candidate (2026-10-01, pending page acceptance):** the lower maturity and team panels share the same outer bottom edge while the matrix remains 70% of its R5 measured height and Team plots remain 70%. This leaves the maturity grid, scale, and Radar legend 67.72px/78.72px above the panel content edge at 1920×1080/2560×1440. The independent Reviewer passed UI-04C (lifecycle gap/fill), UI-05D (Team selection updates both previews), UI-05F (plot height), and UI-06 (stable data-state geometry); UI-05C/UI-05E remain PARTIAL because the maturity content inset exceeds the ≤12px rule. The R7 full page is not accepted. The earlier R6 top-aligned candidate is retained as historical evidence.

**Overview BR-08 R8 candidate (2026-10-01, user-directed):** shorten Team preview plot hosts by 30% from R7 (`97px` / `194px` at the accepted desktop sizes), preserve a readable top `100%` tick with `12px` internal grid inset, and let the maturity matrix grid flex to the lower panel's available height. Center the Radar SVG in its track. These changes address separate screenshot findings; they preserve metric definitions, missing-data treatment, and existing panel widths. The independent Reviewer passed the four R8 leaves and rechecked the older UI-05C/UI-05E maturity findings as PASS under BR-08. R8 still needs the user's full-page confirmation.

The 1920 Team matrix has five body rows, including four selectable team targets with a 24px minimum height; its measured height is 147.22px and its approximate accessible floor is 143.2px. Compacting those rows cannot absorb the full 67.72px maturity inset. Keep UI-05C/UI-05E open until the lower-row structure or approved geometry contract changes; do not squeeze row targets to simulate fill.

### Operational Console

Operational pages use the sequence PageHeader → necessary context/status → FilterToolbar → primary workspace → Drawer/review flow. Topbar Breadcrumb owns route context, so the page header does not repeat the full navigation path. Keep one primary action at most; a read-only role is a compact header status.

Operational filters keep common controls visible. Advanced filters expand as a light region, show an active-filter count, and reset at low visual weight. Preserve each route's existing query timing and filter state. Controls wrap naturally and stop growing at a readable width on wide screens.

`.operational-table` is the shared Ant Design table pattern: 42px header, 48px rows, 12px horizontal cell padding, 12px secondary metadata, tabular numbers, consistent date alignment, sticky headers offset below the 56px Topbar, fixed identifier/action columns, compact actions and pagination, selected/hover states, and a moderate in-body empty row. Long secondary metadata stays one line with its full text available as a title. Only the table may scroll horizontally when its complete columns need more width; the page document does not overflow horizontally. The 1600px operational container uses nearly the full post-sidebar canvas at 1920px.

Operational status tags use semantic tokens only for real states; ordinary metadata stays neutral. Pending domains use a compact state under PageHeader and do not fabricate fields or actions. Maintainer team filters remain locked to the account scope and explain why. Loading keeps the header and filter context stable while the workspace loads. Errors stay with the data domain or operation that failed.

The IR workspace table is the page surface, not a nested Card. An empty pending collector list reserves no panel; existing batches use a compact table and open a shared review Drawer. Import and collector previews identify source, file/team and generated time, row counts, warnings/errors, and the explicit whole-batch confirmation. Create/edit Drawers preserve list context, group existing fields by business meaning, keep save actions visible, and retain field validation.

Maturity remains an Operational Editing workflow. Its table distinguishes blank/not evaluated from valid zero; copy-previous changes only the draft; an explicit Drawer previews the month before save; clearing remains separately confirmed. Viewer summaries use two compact table sections.

### System Management

System Management is an Administrative Workspace: medium-high information density, table-first, and organized by object relationships. Its shared order is PageHeader → required scope/status → primary workspace → Drawer or detail panel. Breadcrumb owns route context, so settings pages do not repeat “系统管理 / …” as an eyebrow. Use one primary page action at most.

Teams use a compact master list and selected team detail. Products show Product → Version → Iteration ownership without a custom tree editor. Dashboard metric catalog and IR source metric rules remain separate tabs; activity selection narrows its metric table, and compute output is a configuration check. Users and permissions use the operational table as the page surface with subdued bilingual role labels and a quiet current-account marker.

Settings workspaces use the shared `.settings-master-detail`, `.settings-workspace`, and `.settings-section` patterns in `frontend/src/design/design-system.css`. Dividers and table surfaces express relationships; Cards are reserved for independent objects or floating content. The collection page uses the 1600px Operational width for its seven-column run-history workspace; schedule controls stay within a readable 1040px form and manual time-window fields remain disclosed. Gateway settings keep a 1120px Readable form. Failed collection outcomes show their message/code and retryable state when the API reports it; no retry action is shown without an API. Gateway configuration has one PageHeader-owned primary action.

### Authentication and global status

Login uses one restrained, token-based sign-in panel with the shared radar mark, visible labels, associated errors, password-manager autocomplete, and a stable submit action. Session-expired feedback stays near the form. The shared `StatusPage` pattern covers 403, 404, pending capability, and fatal load errors; it uses a short status label, a clear title, concise explanation, and a relevant action. Pending is neutral/informational, while actual failures use the danger role. Route loading retains App Shell geometry and uses a compact `ContentLoadingState`; action loading stays on its button.

### App Shell and existing fallback

Desktop navigation keeps a 208–224px/64px expanded/collapsed width and a 48–56px Breadcrumb/account Topbar. The account area presents the username, one localized role label, and a quiet logout action. Existing narrow-screen fallback behavior remains for compatibility, but this redesign does not rework or visually accept narrow analytics layouts.

### Forms and overlays

Ant Design Form, Alert, and application App feedback remain canonical. Modal side panels use `FocusRestoringDrawer`, an Ant Design Drawer adapter that restores focus to its invoking control after Escape or close; the mobile navigation Drawer keeps its explicit AppShell opener behavior. Global route states use the shared `StatusPage` component rather than the library's default oversized Result layout. Select and date controls retain their existing Ant Design/native ownership per route until a later phase intentionally changes it. Drawers retain list context for create/edit/detail operations; validation stays associated with fields and server errors preserve entered values.

The `/data/maturity` monthly editor is a batch workflow: score and note stay in the activity table, “复制上月已有值” only populates the draft, and an explicit preview Drawer reviews the full month before confirmation. Blank remains not evaluated; numeric zero remains a valid value. Clearing stays a separately confirmed action.

### Iconography

Use the installed Ant Design icon family. Icons are 16–18px in navigation and always keep an accessible name when used alone; a tooltip supplements icons whose meaning is not universal.

### Motion

Motion is functional: 160ms interaction feedback and 240ms shell/layout changes using `cubic-bezier(.2, 0, 0, 1)`. It reverses cleanly when interrupted and is disabled for `prefers-reduced-motion`.

### Content and data visualization

Copy is direct, Chinese, and evidence-bounded. Team colors remain stable across pages. Fact `全公司均值`, Team's valid-team benchmarks, and maturity `领域平均` use the neutral dashed style but remain separately labeled and calculated; targets are weakened, positive/negative colors only represent actual semantic direction, and all charts retain an accessible name or data alternative.

Overview lifecycle charts are scoped to one selected activity, so their same-metric valid-team `company_average` is labeled `领域平均`. Close current/prior values remain visually distinct: current uses the primary solid line, restrained area, and circle markers; prior uses the neutral dashed line and hollow diamonds. A complete maturity series closes its polygon; a missing axis keeps a visible gap and removes the fill for that incomplete series.

**Overview BR-09 R9 candidate (2026-10-02, user-directed; review pending):** the selected key-stage trend names its existing same-metric valid-team mean `领域平均`; the data formula stays unchanged. Keep team and benchmark legends separate from the 100% axis label by using a 34px top grid inset without changing the `207/327px` chart hosts. The Overview Radar closes a fully evaluated series and uses a quiet current-period fill with solid circles against a neutral dashed prior series with hollow diamonds. Missing axes retain gaps and never receive a complete-polygon fill. This is Overview-scoped until its four leaves pass independent review and the user confirms the full page.

## Do's and Don'ts

- **Do:** Establish hierarchy with evidence order, typography, and whitespace before adding a surface.
- **Do:** Reuse semantic tokens and shared page patterns across the three UX modes.
- **Don't:** Create a composite AI score, synthetic target, or cross-metric ranking to make a layout look more decisive.
- **Don't:** Add a card or literal colour just because a page needs visual separation.

### Activity transition and summary table

When the Activity directory changes, keep the committed Activity heading, selected state, KPI cards and trends in place until the new Activity requests settle. Announce the pending selection, retain keyboard focus, and switch those elements together. Activity Team Difference groups each metric over fixed, aligned value/change tracks; group labels are centered, the `指标值` and `变化` subheaders are visible, and restrained separators mark only metric-group boundaries. The workload legend occupies its own top band away from the right percentage axis. The six-row raw summary is month-scoped and uses `本月数值`、`上月数值`、`环比变化`、`趋势`; data state changes must not collapse table geometry.

Activity's month-scoped raw summary shows a metric-name column plus `本月数值`、`上月数值`、`环比变化`、`趋势`; source provenance stays available in row title and accessible name. Keep all six row bounds identical across data states and ensure the last row stays inside the owning panel.

Activity R4 table readability: keep Team Difference metric-group headings at 13px or larger, visible `指标值` / `变化` subheadings at 12px or larger, and enough vertical line-box space to prevent heading clipping. Center numeric values and change values. Positive change is green, negative change is red, and zero/missing change remains neutral. The Activity monthly raw summary uses at least 12px for visible labels, headers and values; its metric-name column stays left-aligned and all four data columns are centered. On the Activity page only, Month and Statistical Period selector cards put their selected value on the same horizontal line to the right of the label; preserve full text and keyboard/focus behavior. These corrections must not alter Overview's confirmed table/filter geometry or Capability filter semantics.
