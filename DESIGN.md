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

`--color-bg-page`, `--color-bg-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border-default`, and `--color-brand-primary` establish light-mode hierarchy. Semantic status colors only express real success, warning, and error meanings. Text on subtle error surfaces uses `--color-danger-foreground` to preserve readable contrast; `--color-danger` remains the indicator and chart color. `--color-data-team-1` through `--color-data-team-8` are fixed entity slots (blue, green, orange, purple, teal, slate, rose, brown); `--color-data-average` is the neutral dashed benchmark. The maturity `--color-data-maturity-bg-0` through `--color-data-maturity-bg-5` are ordinal cell fills, not positive/negative signals. Fact charts label `company_average` as “全公司均值”; maturity charts label the assessment aggregate as “领域平均”. `--color-data-target` is intentionally quiet and can be rendered only when a true target exists.

Future dark mode changes semantic mappings under a theme selector; pages must not depend on current primitive values. Focus uses the brand role with a visible outline, and selection uses the sidebar-specific semantic roles.

## Typography

The system stack supports Chinese UI text without a new font dependency. Page title is 28px, section title 20px, card title 16px, body 14px, secondary copy 13px, label 12px, and KPI values range from 32–38px across the accepted desktop widths. Numbers and charts use `font-variant-numeric: tabular-nums`; labels describe what is measured rather than manufacturing a score.

## Layout

The Analytics gutter is 24–32px at the 1920×1080 and 2560×1440 acceptance sizes. Analytics uses the full post-sidebar canvas without a fixed narrow maximum width. Four-column KPI rows share equal tracks; a directory-based Analytics page may reserve 220–240px and gives the remaining width to its workspace. Operational pages keep a separate table/workflow pattern; Readable stays available for form-oriented content.

The document owns page-level vertical scrolling. The Sidebar may scroll internally; analytics cards do not. Main content clips horizontal spill without creating a vertical scroll ancestor that breaks sticky navigation. The application keeps 248px/64px desktop navigation and the existing 280px navigation drawer breakpoint. The Topbar is a 56px context-and-account strip; each route owns a content-level page header.

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

App navigation is a light, role-filtered sidebar with current-route indication, keyboard focus, and the existing drawer fallback. Breadcrumbs provide context in Topbar. The shared `FilterToolbar` groups analysis controls by meaning and preserves route-specific URL state and the selected analysis month. Analytics pages use product-owned KPI, chart, benchmark, directory, and matrix patterns; a card only displays one named catalog metric or a business-approved aggregation with a documented formula. The Overview keeps separate selected-month and selected-cycle KPI rows; both use the same four existing catalog metrics with activity and metric labels. Period rate/efficiency values recompute one metric from team raw facts before taking the team-equal mean; count changes use the current-month team-equal value. The core trend shows all teams plus the same metric's `company_average`; the team matrix never combines unlike metrics. `AnalyticsDirectory` uses the shared `.analytics-directory-workspace` in `design-system.css`: a 220–240px sticky directory and a fluid workspace. Activities show one selected activity's outcomes, same-metric trends, team differences, and raw evidence. Capabilities use a different status/evolution/team/evidence/maturity hierarchy based on catalog types. Team Drilldown follows Overall Performance → R&D Lifecycle → Maturity Profile with sticky section navigation; the Team's four selected catalog metrics stay individually named, same-metric `company_average` is the benchmark, and maturity shows the Team against domain averages without filling missing assessments. Maturity has its own selected category, team matrix, and current/previous domain-average radar. Team colors stay fixed across routes, and `company_average` remains a different fact from maturity's `领域平均`. Trend charts show same-metric comparisons; missing values remain gaps. Operational tables keep numeric alignment, compact controls, sticky headers where supported, and local horizontal scrolling only when needed. Pie/donut is not a default.

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

Desktop navigation keeps the 248px/64px expanded/collapsed widths and the 56px Breadcrumb/account Topbar. The account area presents the username, one localized role label, and a quiet logout action. Existing narrow-screen fallback behavior remains for compatibility, but this redesign does not rework or visually accept narrow analytics layouts.

### Forms and overlays

Ant Design Form, Alert, and application App feedback remain canonical. Modal side panels use `FocusRestoringDrawer`, an Ant Design Drawer adapter that restores focus to its invoking control after Escape or close; the mobile navigation Drawer keeps its explicit AppShell opener behavior. Global route states use the shared `StatusPage` component rather than the library's default oversized Result layout. Select and date controls retain their existing Ant Design/native ownership per route until a later phase intentionally changes it. Drawers retain list context for create/edit/detail operations; validation stays associated with fields and server errors preserve entered values.

The `/data/maturity` monthly editor is a batch workflow: score and note stay in the activity table, “复制上月已有值” only populates the draft, and an explicit preview Drawer reviews the full month before confirmation. Blank remains not evaluated; numeric zero remains a valid value. Clearing stays a separately confirmed action.

### Iconography

Use the installed Ant Design icon family. Icons are 16–18px in navigation and always keep an accessible name when used alone; a tooltip supplements icons whose meaning is not universal.

### Motion

Motion is functional: 160ms interaction feedback and 240ms shell/layout changes using `cubic-bezier(.2, 0, 0, 1)`. It reverses cleanly when interrupted and is disabled for `prefers-reduced-motion`.

### Content and data visualization

Copy is direct, Chinese, and evidence-bounded. Team colors remain stable across pages. The fact `全公司均值` and maturity `领域平均` are both neutral/dashed but remain separately labeled and calculated; targets are weakened, positive/negative colors only represent actual semantic direction, and all charts retain an accessible name or data alternative.

## Do's and Don'ts

- **Do:** Establish hierarchy with evidence order, typography, and whitespace before adding a surface.
- **Do:** Reuse semantic tokens and shared page patterns across the three UX modes.
- **Don't:** Create a composite AI score, synthetic target, or cross-metric ranking to make a layout look more decisive.
- **Don't:** Add a card or literal colour just because a page needs visual separation.
