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
  metric-card: { }
  analytics-panel: { }
  chart: { }
---

# ai-dev-radar Design System

## Overview

### Creative North Star

The product should feel like a concise management review assembled from an engineering evidence book: calm working surfaces, deliberate typography, and data that speaks before ornament. Its signature is the evidence-led reading order—context, decision signal, supporting fact, then drill-down—not decorative dashboard chrome.

### Product context and register

- **Audience and primary job:** R&D managers, domain owners, and team leaders assess verified AI engineering facts, maturity, variance, and operational data work.
- **Target market(s) and evidence:** No market-specific claim is maintained. The Chinese product language is grounded in [CONTEXT.md](CONTEXT.md) and the business design under [docs/business](docs/business/index.md).
- **Locale(s) and language policy:** Current product copy is Simplified Chinese with an English product name. New labels use concise, domain-defined Chinese; no Japanese-market behavior is inferred.
- **Usage scene:** Desktop-first analytical work at 1440–1920px, with responsive fallback for narrow screens. Analytical and operational pages can be dense; executive pages must make the current evidence hierarchy obvious at a glance.
- **Register:** Product/admin application. The three modes are Executive Dashboard, Analytical Workspace, and Operational Console.
- **Memorable signature:** A sparse evidence rail through hierarchy and spacing, not extra cards, gradients, or synthetic KPI scoring.
- **Restraint:** Familiar Ant Design behavior, readable tables, filters, drawers, and navigation take priority over expression.
- **Anti-references:** Neon/AI spectacle, blue-purple glow dashboards, generic Ant Design Pro card grids, and pie/donut defaults all obscure evidence density or imitate a template.
- **Token ownership/runtime mapping:** `frontend/src/design/tokens.css` is the canonical runtime source. `frontend/src/design/theme.js` adapts the documented semantic values to Ant Design; `app.css` retains temporary `--app-*` compatibility aliases. Shared components consume semantic variables. Phase 5 removes aliases and legacy literals after route migration.

## Colors

`--color-bg-page`, `--color-bg-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border-default`, and `--color-brand-primary` establish light-mode hierarchy. Semantic status colors only express real success, warning, and error meanings. `--color-data-team-*` are fixed entity slots; `--color-data-average` is neutral gray and dashed. Fact charts label `company_average` as “全公司均值”; maturity charts label the assessment aggregate as “领域平均”. `--color-data-target` is intentionally quiet and can be rendered only when a true target exists.

Future dark mode changes semantic mappings under a theme selector; pages must not depend on current primitive values. Focus uses the brand role with a visible outline, and selection uses the sidebar-specific semantic roles.

## Typography

The system stack supports Chinese UI text without a new font dependency. Page title is 28px, section title 20px, card title 16px, body 14px, secondary copy 13px, label 12px, and KPI 32px. Numbers and charts use `font-variant-numeric: tabular-nums`; labels describe what is measured rather than manufacturing a score.

## Layout

The desktop content gutter is responsive from 24px to 40px. `.app-page-grid` is a 12-column grid; dashboard regions may be fluid, analytical content preserves readable line length, and forms/tables own their own overflow. System-configuration pages with forms are centered and capped at 1120px; individual form groups may remain narrower for readable entry. The application keeps the tested 248px/64px desktop navigation and converts it to a 280px drawer at the existing 680px breakpoint. The Topbar is a 56px context-and-account strip; each route owns a content-level page header.

No page gets a fixed document height to make a table fill space. Tables own needed horizontal/vertical overflow; scrollbars remain visible, thin, and tokenised globally.

## Elevation & Depth

Primary hierarchy comes from the page/surface/subtle surface sequence, typography, and spacing. Panels use a one-pixel border and restrained `--shadow-panel` only when a floating boundary needs it. Nested cards and ornamental shadows are not layout primitives.

## Shapes

Controls use `--radius-sm`; independent panels use `--radius-md`; larger composed surfaces use `--radius-lg` only when their geometry calls for it. Dividers use `--color-border-default`; icon-only actions retain an accessible 40px target where the shell already establishes one.

## Components

### Foundational visual states

Focus-visible always has a 2px brand outline. Hover/pressed states are perceptible without replacing labels or moving layout. Loading, empty, error, not-evaluated, no-permission, and partial-data states use compact stable `feedback-state` regions and explain the condition; a missing fact is never displayed as zero.

### Buttons and actions

Ant Design Button remains canonical. Solid brand actions are reserved for page primary actions and confirmed commits; neutral/ghost actions support secondary work; danger stays separated until a destructive confirmation. Busy buttons keep their geometry.

### Navigation and data display

App navigation is a light, role-filtered sidebar with current-route indication, keyboard focus, and a narrow drawer fallback. Breadcrumbs provide context in Topbar. `FilterToolbar` groups analysis controls as one compact, wrapping surface; dimension, metric, period, and maturity month remain explicitly labeled rather than hidden in the page title. Tables are operational surfaces with numeric alignment, compact controls, sticky headers where supported, and local horizontal scrolling only when necessary. Charts use line trends, ranked horizontal bars, radar profiles, and status lists/matrices according to data type. Executive Snapshot includes two maturity summaries and two real catalog facts; a separate trend panel shows one selectable metric at a time with the `全公司均值` series. The lifecycle uses six user-requested stages with named catalog metrics, current values, and same-metric trends without cross-unit aggregation. The capabilities workspace selects one capability for its current state and evolution. Pie/donut is not a default.

### Forms and overlays

Ant Design Form, Drawer, Alert, Result, and application App feedback remain canonical. Select and date controls retain their existing Ant Design/native ownership per route until a later phase intentionally changes it. Drawers retain list context for create/edit/detail operations; validation stays associated with fields and server errors preserve entered values.

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
