import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { iterationReferenceAverage, valueFromSums } from '../../frontend/src/drilldown/drilldownLogic.js'

const fixture = {
  full: { month: '2026-09', cycle: 'half' },
  partial: { month: '2026-08', cycle: 'half' },
  empty: { month: '2025-01', cycle: 'half' },
}
const viewports = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]
const reportedViewport = { width: 2560, height: 1271 }
const outputDir = path.join(process.env.E2E_RESULTS_DIR ?? 'e2e-results', 'overview-visual')
const stableGeometry = [
  'filters', 'monthControl', 'monthTrigger', 'monthLabel', 'monthValue', 'cycleControl', 'cycleSelect', 'cycleLabel', 'cycleValue', 'monthKpis', 'cycleKpis', 'corePanel', 'corePlot', 'coreTitle', 'coreSelectors', 'lifecyclePanel', 'lifecycleTitle', 'lifecycleLegend',
  'stageStrip', 'finalGrid', 'maturityPanel', 'maturityGrid', 'maturityMatrixBlock', 'maturityTable', 'maturityScale',
  'maturityRadarBlock', 'maturityRadar', 'teamPanel', 'teamTitle', 'teamMode', 'teamTable', 'teamPreview', 'teamPreviewHeading',
]

async function login(page) {
  await page.goto('/login')
  await page.getByLabel('账号').fill('admin')
  await page.getByLabel('密码').fill(process.env.SEED_PASSWORD ?? 'e2e-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('.executive-overview')).toBeVisible()
}

async function waitForOverview(page) {
  await expect(page.locator('.executive-kpi-grid .metric-card')).toHaveCount(8)
  await expect(page.locator('.executive-lifecycle__item')).toHaveCount(6)
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe('complete')
  await page.waitForLoadState('networkidle')
}

async function captureReferenceActualBoard(context, { referencePath, actualPath, outputPath, width, heading, note, boardHeight = 900 }) {
  const reference = (await readFile(referencePath)).toString('base64')
  const actual = (await readFile(actualPath)).toString('base64')
  const board = await context.newPage()
  await board.setViewportSize({ width, height: boardHeight })
  await board.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#1f2937;font:14px Arial,sans-serif}
    header{padding:18px 24px}h1{font-size:18px;margin:0 0 6px}.note{color:#667085;font-size:12px}
    main{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:0 24px 24px}
    figure{margin:0;background:#fff;border:1px solid #d0d5dd;border-radius:8px;overflow:hidden}
    figcaption{padding:10px 12px;font-weight:600;border-bottom:1px solid #eaecf0}
    img{display:block;width:100%;height:auto}
  </style></head><body><header><h1>${heading}</h1><div class="note">${note}</div></header><main>
    <figure><figcaption>批准 Reference</figcaption><img src="data:image/png;base64,${reference}" /></figure>
    <figure><figcaption>当前 Chromium 实际 · ${width}px 视口宽度</figcaption><img src="data:image/png;base64,${actual}" /></figure>
  </main></body></html>`)
  await board.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
  await board.screenshot({ path: outputPath, fullPage: true })
  await board.close()
}

async function captureTeamStateBoards(context, { issueId, state, viewportName, width, actualCrops, outputDirectory }) {
  const references = {
    overall: 'docs/ux/reference-crops/team-detail-overall-performance.png',
    lifecycle: 'docs/ux/reference-crops/team-detail-lifecycle.png',
    maturity: 'docs/ux/reference-crops/team-detail-maturity-reference-edge.png',
  }
  const boards = {}
  for (const [area, referencePath] of Object.entries(references)) {
    const outputPath = path.join(outputDirectory, `${issueId}-${state}-${area}-${viewportName}-reference-actual.png`)
    await captureReferenceActualBoard(context, {
      referencePath: path.resolve(referencePath),
      actualPath: actualCrops[area],
      outputPath,
      width,
      heading: `${issueId} · ${state} · ${area}`,
      note: 'Reference 对照实际浏览器状态；图块尺寸以原始 Chromium DOM geometry 记录为准。',
    })
    boards[area] = outputPath
  }
  return boards
}

async function emptyTeamVisualData(route) {
  const response = await route.fetch()
  const url = new URL(route.request().url())
  if (url.pathname === '/api/facts' || url.pathname === '/api/maturity/records') {
    return route.fulfill({ response, json: [] })
  }

  const payload = await response.json()
  if (url.pathname === '/api/compute') {
    payload.series = (payload.series ?? []).map((series) => ({
      ...series,
      values: (series.values ?? []).map((point) => ({ ...point, value: null, fact_count: 0, numerator: null, denominator: null, estimated: null, actual: null })),
    }))
    payload.company_average = (payload.company_average ?? []).map((point) => ({ ...point, value: null }))
    payload.domain_summary = (payload.domain_summary ?? []).map((point) => ({ ...point, value: null, fact_count: 0, sample_count: 0, numerator: null, denominator: null, estimated: null, actual: null }))
  } else if (url.pathname === '/api/data-metrics/overview') {
    const emptyPoint = (point) => ({ ...point, fact_count: 0, known_ai_count: 0, ai_assisted_count: null, ai_workload_count: 0, ai_estimated_workload: null, ai_actual_workload: null })
    payload.series = (payload.series ?? []).map((series) => ({ ...series, values: (series.values ?? []).map(emptyPoint) }))
    payload.domain_summary = (payload.domain_summary ?? []).map(emptyPoint)
  } else if (url.pathname === '/api/maturity/overview') {
    payload.activities = (payload.activities ?? []).map((activity) => ({ ...activity, score: null, score_raw: null, score_display: null, average_raw: null, grade: null, level: null, assessed_team_count: 0, grade_distribution: Object.fromEntries(Object.keys(activity.grade_distribution ?? {}).map((key) => [key, 0])) }))
    payload.teams = (payload.teams ?? []).map((team) => ({ ...team, cells: (team.cells ?? []).map((cell) => ({ ...cell, record_id: null, score: null, score_raw: null, score_display: null, grade: null, level: null, note: null, maintained_by: null, updated_at: null })) }))
    payload.assessed_cell_count = 0
    payload.coverage_rate = 0
    payload.strength_activity_ids = []
    payload.weakness_activity_ids = []
  }
  return route.fulfill({ response, json: payload })
}

async function expectOverviewUrl(page, expected) {
  await expect.poll(() => {
    const url = new URL(page.url())
    return { pathname: url.pathname, month: url.searchParams.get('month'), cycle: url.searchParams.get('cycle'), version: url.searchParams.get('version') }
  }).toEqual({ pathname: '/', month: expected.month, cycle: expected.cycle, version: expected.version ?? null })
}

async function measureTeamDetailState(page) {
  return page.evaluate(() => {
    const box = (element) => {
      if (!element) return null
      const { x, y, width, height } = element.getBoundingClientRect()
      return [x, y, width, height]
    }
    const rects = (selector) => [...document.querySelectorAll(selector)].map(box)
    const plotSurfaces = (selector) => [...document.querySelectorAll(`${selector} .overview-chart, ${selector} .analytics-chart-card__plot-state`)].map(box)
    const plotBounds = (selector) => [...document.querySelectorAll(selector)].map((element) => {
      const host = element.getBoundingClientRect()
      const plot = element.dataset.plotBounds?.split(',').map(Number)
      return {
        host: [host.x, host.y, host.width, host.height],
        effectivePlot: plot?.length === 4 ? [host.x + plot[0], host.y + plot[1], plot[2], plot[3]] : null,
      }
    })
    return {
      viewport: [innerWidth, innerHeight],
      document: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      pageRoot: box(document.querySelector('.drilldown-shell')),
      header: box(document.querySelector('.drilldown-page-head')),
      sectionNavigation: box(document.querySelector('.drilldown-section-nav')),
      storySections: rects('.drilldown-story-section'),
      overallKpiRows: rects('.drilldown-kpi-sections .drilldown-kpi-row'),
      overallKpiCards: rects('.drilldown-kpi-sections .metric-card'),
      overallTrendCards: rects('.drilldown-overall-trends > *'),
      overallPlotHosts: plotSurfaces('.drilldown-overall-trends'),
      overallEffectivePlots: plotBounds('.drilldown-overall-trends .overview-chart'),
      lifecycleCards: rects('.drilldown-lifecycle-cards > *'),
      lifecycleTrendCards: rects('.drilldown-lifecycle-trends > *'),
      lifecyclePlotHosts: rects('.drilldown-lifecycle-trends .drilldown-activity-plot'),
      lifecycleEffectivePlots: plotBounds('.drilldown-lifecycle-trends .overview-chart'),
      maturityPanel: box(document.querySelector('#team-maturity')),
      maturityCategories: rects('.drilldown-maturity__categories > *'),
      maturityModules: rects('.drilldown-maturity__category-grid > *'),
      maturityMatrixModule: box(document.querySelector('.drilldown-maturity__module:first-child')),
      maturityMatrixHeader: box(document.querySelector('.drilldown-maturity__module:first-child > header')),
      maturityMatrixHeaderText: rects('.drilldown-maturity__module:first-child > header > *'),
      maturityTable: box(document.querySelector('.drilldown-maturity .maturity-matrix__table')),
      maturityRadarModule: box(document.querySelector('.drilldown-maturity__module:nth-child(2)')),
      maturityRadarHeader: box(document.querySelector('.drilldown-maturity__module:nth-child(2) > header')),
      maturityRadar: box(document.querySelector('.drilldown-maturity .maturity-radar')),
    }
  })
}

async function measureOverview(page) {
  return page.evaluate(() => {
    const box = (element) => {
      if (!element) return null
      const { x, y, width, height } = element.getBoundingClientRect()
      return [x, y, width, height]
    }
    const contentBottomInset = (panel, child) => {
      if (!panel || !child) return null
      const panelRect = panel.getBoundingClientRect()
      const childRect = child.getBoundingClientRect()
      const style = getComputedStyle(panel)
      const panelContentBottom = panelRect.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom)
      return Number((panelContentBottom - childRect.bottom).toFixed(2))
    }
    const boxes = (selector) => [...document.querySelectorAll(selector)].map(box)
    const surface = (selector) => boxes(`${selector} .overview-chart, ${selector} .analytics-chart-card__plot-state`)
    const plotBoxes = (selector) => [...document.querySelectorAll(selector)].map((element) => {
      const bounds = element.dataset.plotBounds?.split(',').map(Number)
      if (!bounds || bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) return null
      const host = element.getBoundingClientRect()
      return [host.x + bounds[0], host.y + bounds[1], bounds[2], bounds[3]]
    })
    const grids = [...document.querySelectorAll('.executive-kpi-grid')]
    const kpiCardElements = [...document.querySelectorAll('.executive-kpi-grid .metric-card')]
    const sparklineSelector = '.metric-card__sparkline, .metric-card__empty-trend'
    return {
      viewport: [innerWidth, innerHeight],
      page: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      documentEndWhitespacePx: document.documentElement.scrollHeight - (window.scrollY + document.querySelector('.executive-final-grid')?.getBoundingClientRect().bottom ?? 0),
      filters: box(document.querySelector('.analytics-page-head')),
      monthControl: box(document.querySelector('.overview-filter-card--month')),
      monthTrigger: box(document.querySelector('.overview-filter-card__trigger')),
      monthLabel: box(document.querySelector('.overview-filter-card--month .overview-filter-card__copy small')),
      monthValue: box(document.querySelector('.overview-filter-card--month .overview-filter-card__copy strong')),
      cycleControl: box(document.querySelector('.overview-filter-card--cycle')),
      cycleSelect: box(document.querySelector('.overview-cycle-select')),
      cycleLabel: box(document.querySelector('.overview-filter-card--cycle .overview-filter-card__copy small')),
      cycleValue: box(document.querySelector('.overview-cycle-select')),
      cycleValueText: (() => {
        const value = document.querySelector('.overview-cycle-select .ant-select-content-has-value')
        return value ? { text: value.textContent, clientWidth: value.clientWidth, scrollWidth: value.scrollWidth } : null
      })(),
      monthKpis: box(grids[0]),
      cycleKpis: box(grids[1]),
      kpiCards: boxes('.executive-kpi-grid .metric-card'),
      kpiIconBoxes: boxes('.executive-kpi-grid .metric-card__icon'),
      kpiAccessoryBoxes: boxes('.executive-kpi-grid .metric-card__accessory'),
      kpiValueBoxes: boxes('.executive-kpi-grid .metric-card__value'),
      kpiDeltaBoxes: boxes('.executive-kpi-grid .metric-card__delta'),
      kpiSparklineBoxes: boxes(`.executive-kpi-grid ${sparklineSelector}`),
      kpiSparklineRatios: kpiCardElements.map((card) => {
        const plot = card.querySelector(sparklineSelector)
        return plot ? plot.getBoundingClientRect().width / card.getBoundingClientRect().width : null
      }),
      kpiTextHealth: kpiCardElements.map((card) => {
        const value = card.querySelector('.metric-card__value')
        const unit = card.querySelector('.metric-card__unit')
        const delta = card.querySelector('.metric-card__delta')
        const plot = card.querySelector(sparklineSelector)
        const overlaps = (text, visual) => {
          if (!text || !visual) return false
          const a = text.getBoundingClientRect()
          const b = visual.getBoundingClientRect()
          return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1
        }
        return {
          valueFits: !value || value.scrollWidth <= value.clientWidth + 1,
          unitFits: !unit || unit.getBoundingClientRect().right <= card.getBoundingClientRect().right,
          noTextPlotOverlap: !overlaps(value, plot) && !overlaps(delta, plot),
        }
      }),
      corePanel: box(document.querySelector('.executive-overall-trend')),
      corePlot: box(document.querySelector('.executive-overall-trend__plot')),
      coreEffectivePlot: plotBoxes('.executive-overall-trend__plot .overview-chart')[0] ?? null,
      coreTitle: box(document.querySelector('.executive-overall-trend .analytics-panel__title')),
      coreSelectors: box(document.querySelector('.executive-overall-trend .executive-trend-actions')),
      lifecyclePanel: box(document.querySelector('.executive-lifecycle')),
      lifecycleTitle: box(document.querySelector('.executive-lifecycle .analytics-panel__title')),
      lifecycleLegend: box(document.querySelector('.executive-lifecycle__legend')),
      stageStrip: box(document.querySelector('.executive-lifecycle__list')),
      stageCards: boxes('.executive-lifecycle__item'),
      stageIconBoxes: boxes('.executive-lifecycle__item .executive-lifecycle__icon'),
      stageTitleBoxes: boxes('.executive-lifecycle__item > strong'),
      stageMetricBoxes: boxes('.executive-lifecycle__item .executive-lifecycle__metric'),
      lifecycleTrendCards: boxes('.executive-lifecycle__trend-grid .analytics-chart-card'),
      lifecycleTrendSurfaces: surface('.executive-lifecycle__trend-grid'),
      lifecycleEffectivePlots: plotBoxes('.executive-lifecycle__trend-grid .overview-chart'),
      lifecycleGridTopInsets: [...document.querySelectorAll('.executive-lifecycle__trend-grid .overview-chart')].map((element) => Number(element.dataset.plotBounds?.split(',')[1] ?? NaN)),
      lifecycleChartLabels: [...document.querySelectorAll('.executive-lifecycle__trend-grid .overview-chart')].map((element) => element.getAttribute('aria-label')),
      lifecycleTrendContentBottomInsets: [...document.querySelectorAll('.executive-lifecycle__trend-grid .analytics-chart-card')].map((card) => contentBottomInset(document.querySelector('.executive-lifecycle'), card)),
      finalGrid: box(document.querySelector('.executive-final-grid')),
      finalGridColumnGap: Number.parseFloat(getComputedStyle(document.querySelector('.executive-final-grid')).columnGap) || 0,
      maturityPanel: box(document.querySelector('.executive-maturity-section')),
      maturityGrid: box(document.querySelector('.executive-maturity-grid')),
      maturityGridContentBottomInset: contentBottomInset(document.querySelector('.executive-maturity-section'), document.querySelector('.executive-maturity-grid')),
      maturityMatrixBlock: box(document.querySelector('.executive-maturity-block:first-child')),
      maturityTable: box(document.querySelector('.maturity-matrix__table')),
      maturityScale: box(document.querySelector('.executive-maturity-scale')),
      maturityScaleContentBottomInset: contentBottomInset(document.querySelector('.executive-maturity-section'), document.querySelector('.executive-maturity-scale')),
      maturityRadarBlock: box(document.querySelector('.executive-maturity-block:nth-child(2)')),
      maturityRadar: box(document.querySelector('.executive-maturity-section .maturity-radar')),
      maturityRadarStyle: (() => {
        const element = document.querySelector('.executive-maturity-section .maturity-radar')
        if (!element) return null
        const style = getComputedStyle(element)
        return { margin: style.margin, minHeight: style.minHeight, height: style.height, display: style.display, flex: style.flex }
      })(),
      maturityRadarSvg: box(document.querySelector('.executive-maturity-section .maturity-radar svg')),
      maturityRadarSeriesGeometry: [...document.querySelectorAll('.executive-maturity-section .maturity-radar--overview .maturity-radar__series')].map((group) => {
        const lines = [...group.querySelectorAll('polyline')].map((line) => {
          const points = line.getAttribute('points')?.trim().split(/\s+/) ?? []
          return { closed: points.length > 1 && points[0] === points[points.length - 1], pointCount: points.length }
        })
        return {
          name: group.dataset.seriesName,
          complete: group.dataset.seriesComplete === 'true',
          prior: group.dataset.seriesPrior === 'true',
          lines,
          areaCount: [...document.querySelectorAll('.maturity-radar__area')].filter((area) => area.dataset.seriesName === group.dataset.seriesName).length,
          markerKinds: [...group.querySelectorAll('[data-marker-kind]')].map((marker) => marker.dataset.markerKind),
        }
      }),
      maturityRadarCenterDeltaPx: (() => {
        const radar = document.querySelector('.executive-maturity-section .maturity-radar')?.getBoundingClientRect()
        const svg = document.querySelector('.executive-maturity-section .maturity-radar svg')?.getBoundingClientRect()
        return radar && svg ? Number(Math.abs((radar.left + radar.width / 2) - (svg.left + svg.width / 2)).toFixed(2)) : null
      })(),
      maturityRadarLegend: box(document.querySelector('.executive-maturity-section .maturity-radar__legend')),
      maturityRadarLegendContentBottomInset: contentBottomInset(document.querySelector('.executive-maturity-section'), document.querySelector('.executive-maturity-section .maturity-radar__legend')),
      maturityTableHeaders: boxes('.executive-maturity-section .maturity-matrix__table thead th'),
      maturityTableRows: boxes('.executive-maturity-section .maturity-matrix__table tr'),
      maturityHeaderHealth: [...document.querySelectorAll('.executive-maturity-section .maturity-matrix__table thead th')].map((header) => ({
        text: header.innerText.trim(),
        clientWidth: header.clientWidth,
        scrollWidth: header.scrollWidth,
        clientHeight: header.clientHeight,
        scrollHeight: header.scrollHeight,
        fits: header.scrollWidth <= header.clientWidth + 1 && header.scrollHeight <= header.clientHeight + 1,
      })),
      teamPanel: box(document.querySelector('.executive-team-section')),
      teamTitle: box(document.querySelector('.executive-team-section .analytics-panel__title')),
      teamMode: box(document.querySelector('.executive-team-mode')),
      teamTable: box(document.querySelector('.team-matrix__table')),
      teamTableHeaders: boxes('.executive-team-section .team-matrix__table thead tr:first-child th'),
      teamPreviewHeading: box(document.querySelector('.executive-team-preview > header')),
      teamPreview: box(document.querySelector('.executive-team-preview__charts')),
      teamPreviewCards: boxes('.executive-team-preview__charts .analytics-chart-card'),
      teamPreviewCardHeaders: boxes('.executive-team-preview__charts .analytics-chart-card__header'),
      teamPreviewSurfaces: surface('.executive-team-preview__charts'),
      teamPreviewEffectivePlots: plotBoxes('.executive-team-preview__charts .overview-chart'),
      teamPreviewGridTopInsets: [...document.querySelectorAll('.executive-team-preview__charts .overview-chart')].map((element) => Number(element.dataset.plotBounds?.split(',')[1] ?? NaN)),
      teamPreviewCardHeaderPlotGaps: [...document.querySelectorAll('.executive-team-preview__charts .analytics-chart-card')].map((card) => {
        const header = card.querySelector('.analytics-chart-card__header')?.getBoundingClientRect()
        const plot = card.querySelector('.overview-chart, .analytics-chart-card__plot-state')?.getBoundingClientRect()
        return header && plot ? Number((plot.top - header.bottom).toFixed(2)) : null
      }),
      teamPreviewContentBottomInset: contentBottomInset(document.querySelector('.executive-team-section'), document.querySelector('.executive-team-preview__charts')),
      lowerPanelBottomDeltaPx: (() => {
        const maturity = document.querySelector('.executive-maturity-section')?.getBoundingClientRect()
        const team = document.querySelector('.executive-team-section')?.getBoundingClientRect()
        return maturity && team ? Math.abs(maturity.bottom - team.bottom) : null
      })(),
      textStylePx: Object.fromEntries([
        ['kpiLabel', '.executive-kpi-grid .metric-card__label'],
        ['kpiValue', '.executive-kpi-grid .metric-card__value'],
        ['kpiDelta', '.executive-kpi-grid .metric-card__delta'],
        ['kpiIcon', '.executive-kpi-grid .metric-card__icon .anticon'],
        ['stageTitle', '.executive-lifecycle__item > strong'],
        ['stageMetricLabel', '.executive-lifecycle__item .executive-lifecycle__metric small'],
        ['stageMetricValue', '.executive-lifecycle__item .executive-lifecycle__metric b'],
        ['stageDelta', '.executive-lifecycle__item .executive-lifecycle__delta'],
        ['maturityTableHeader', '.executive-maturity-section .maturity-matrix__table thead th'],
        ['teamTableHeader', '.executive-team-section .team-matrix__table thead tr:first-child th'],
      ].map(([name, selector]) => [name, document.querySelector(selector) ? getComputedStyle(document.querySelector(selector)).fontSize : null])),
    }
  })
}

function expectStableGeometry(reference, actual, viewport, state) {
  for (const key of stableGeometry) {
    if (!Array.isArray(actual[key]) || !Array.isArray(reference[key])) throw new Error(`${viewport.width} ${state}: missing geometry for ${key}`)
    expect(actual[key], `${viewport.width} ${state} ${key}`).toHaveLength(4)
    expect(reference[key], `${viewport.width} reference ${key}`).toHaveLength(4)
    for (let index = 0; index < 4; index += 1) {
      expect(Math.abs(actual[key][index] - reference[key][index]), `${viewport.width} ${state} ${key}[${index}] actual=${actual[key][index]} reference=${reference[key][index]}`).toBeLessThanOrEqual(1)
    }
  }
  for (const key of ['kpiCards', 'kpiIconBoxes', 'kpiAccessoryBoxes', 'stageCards', 'stageIconBoxes', 'stageTitleBoxes', 'stageMetricBoxes', 'lifecycleTrendCards', 'lifecycleTrendSurfaces', 'maturityTableHeaders', 'teamTableHeaders', 'teamPreviewCards', 'teamPreviewSurfaces']) {
    expect(actual[key], `${viewport.width} ${state} ${key}`).toHaveLength(reference[key].length)
    for (let row = 0; row < reference[key].length; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        expect(Math.abs(actual[key][row][index] - reference[key][row][index]), `${viewport.width} ${state} ${key}[${row}][${index}]`).toBeLessThanOrEqual(1)
      }
    }
  }
  for (const key of ['maturityGridContentBottomInset', 'maturityScaleContentBottomInset', 'teamPreviewContentBottomInset']) {
    expect(Math.abs(actual[key] - reference[key]), `${viewport.width} ${state} ${key}`).toBeLessThanOrEqual(1)
  }
  expect(actual.lifecycleTrendContentBottomInsets).toHaveLength(reference.lifecycleTrendContentBottomInsets.length)
  for (let index = 0; index < reference.lifecycleTrendContentBottomInsets.length; index += 1) {
    expect(Math.abs(actual.lifecycleTrendContentBottomInsets[index] - reference.lifecycleTrendContentBottomInsets[index]), `${viewport.width} ${state} lifecycleTrendContentBottomInsets[${index}]`).toBeLessThanOrEqual(1)
  }
  if (reference.maturityRadarLegendContentBottomInset !== null && actual.maturityRadarLegendContentBottomInset !== null) {
    expect(Math.abs(actual.maturityRadarLegendContentBottomInset - reference.maturityRadarLegendContentBottomInset), `${viewport.width} ${state} maturityRadarLegendContentBottomInset`).toBeLessThanOrEqual(1)
  }
}

test('captures fixed Overview golden data, real browser interactions, and stable full/partial/empty geometry', async ({ page }) => {
  test.setTimeout(120_000)
  await mkdir(outputDir, { recursive: true })
  const requests = []
  const computeResponses = new Map()
  let catalogMetrics = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) {
      requests.push({ state: activeState, method: request.method(), path: url.pathname, query: Object.fromEntries(url.searchParams) })
    }
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname === '/api/catalog' && response.ok()) {
      response.json().then((catalog) => { catalogMetrics = catalog.flatMap((activity) => activity.metrics ?? []) }).catch(() => {})
    }
    if (url.pathname === '/api/compute' && response.ok()) {
      const metricId = url.searchParams.get('metric_id')
      if (metricId) response.json().then((data) => computeResponses.set(metricId, data)).catch(() => {})
    }
  })
  let activeState = 'login'
  const evidence = { fixture: 'overview-golden-2026-09-v1', screenshots: [], geometry: {}, requests, interactions: [] }
  await login(page)

  for (const viewport of viewports) {
    const viewportName = `${viewport.width}x${viewport.height}`
    await page.setViewportSize(viewport)
    evidence.geometry[viewportName] = {}
    let fullReference
    let fullKpiShape

    for (const [state, filter] of Object.entries(fixture)) {
      activeState = state
      await page.goto(`/?month=${filter.month}&cycle=${filter.cycle}`)
      await waitForOverview(page)
      await expect(page.locator('.overview-filter-card--month')).toContainText(`${filter.month.slice(0, 4)}年${Number(filter.month.slice(5))}月`)
      await expect(page.locator('.overview-filter-card--cycle')).toContainText('本半年度')
      await expect(page.locator('.analytics-page-head [aria-label="版本"]')).toHaveCount(0)
      await expect(page.locator('.executive-lifecycle__item strong')).toHaveText([
        'SA设计', 'SE设计', '开发设计', '编码开发', '测试用例生成', '测试用例执行',
      ])
      await expect(page.locator('.executive-team-preview > header h3')).toContainText('趋势预览')
      await expect(page.locator('.executive-team-preview > header').getByRole('button', { name: '查看团队详情 →' })).toBeVisible()
      await expect(page.locator('.executive-team-preview__charts .analytics-chart-card__header h2')).toHaveText(['AI需求渗透率', 'AI研发提效'])

      const geometry = await measureOverview(page)
      await writeFile(path.join(outputDir, `${viewportName}-${state}-geometry-debug.json`), JSON.stringify(geometry, null, 2), 'utf8')
      expect(geometry.page[1]).toBeLessThanOrEqual(geometry.page[0])
      expect(geometry.kpiCards).toHaveLength(8)
      expect(geometry.kpiCards.map((box) => box[3])).toEqual(Array(8).fill(180))
      for (let index = 1; index < 4; index += 1) {
        expect(Math.abs(geometry.kpiCards[index][2] - geometry.kpiCards[0][2])).toBeLessThanOrEqual(1)
        expect(Math.abs(geometry.kpiCards[index + 4][2] - geometry.kpiCards[4][2])).toBeLessThanOrEqual(1)
      }
      expect(geometry.kpiIconBoxes).toHaveLength(8)
      expect(geometry.kpiIconBoxes.every((box) => box[2] === 48 && box[3] === 48)).toBe(true)
      expect(geometry.kpiAccessoryBoxes).toHaveLength(8)
      expect(geometry.kpiValueBoxes).toHaveLength(8)
      expect(geometry.kpiDeltaBoxes).toHaveLength(8)
      expect(geometry.kpiSparklineBoxes).toHaveLength(8)
      expect(geometry.kpiSparklineBoxes.every((box) => box[3] >= 54)).toBe(true)
      expect(geometry.kpiSparklineRatios.every((ratio) => ratio >= 0.48 && ratio <= 0.54)).toBe(true)
      expect(geometry.kpiTextHealth.every((item) => item.valueFits && item.unitFits && item.noTextPlotOverlap)).toBe(true)
      expect(geometry.teamPreviewCards[0][3]).toBeCloseTo(geometry.teamPreviewCards[1][3], 1)
      const expanded = viewport.width >= 2400 && viewport.height >= 1300
      const baselineTeamPlotHeight = expanded ? 277 : 139
      expect(geometry.teamPreviewSurfaces.every((box) => {
        const ratio = box[3] / baselineTeamPlotHeight
        return ratio >= 0.67 && ratio <= 0.73
      })).toBe(true)
      const expectedLifecycleHost = expanded ? 327 : 207
      expect(geometry.lifecycleTrendSurfaces.map((box) => box[3])).toEqual([expectedLifecycleHost, expectedLifecycleHost])
      if (geometry.lifecycleGridTopInsets.length) expect(geometry.lifecycleGridTopInsets).toEqual([34, 34])
      else expect(state).toBe('empty')
      const minimumLifecycleHost = expanded ? 300 : 158
      expect(geometry.corePlot[3]).toBe(expanded ? 480 : 360)
      expect(geometry.lifecycleTrendSurfaces.every((box) => box[3] > minimumLifecycleHost)).toBe(true)
      const lifecycleGap = geometry.lifecycleTrendCards[0][1] - (geometry.stageStrip[1] + geometry.stageStrip[3])
      expect(lifecycleGap).toBeGreaterThanOrEqual(8)
      expect(lifecycleGap).toBeLessThanOrEqual(16)
      expect(geometry.lifecycleTrendContentBottomInsets.every((inset) => inset >= 0 && inset <= 12)).toBe(true)
      const teamPreviewGap = geometry.teamPreviewHeading[1] - (geometry.teamTable[1] + geometry.teamTable[3])
      expect(teamPreviewGap).toBeGreaterThanOrEqual(8)
      expect(teamPreviewGap).toBeLessThanOrEqual(16)
      expect(geometry.teamPreviewContentBottomInset).toBeGreaterThanOrEqual(0)
      expect(geometry.teamPreviewContentBottomInset).toBeLessThanOrEqual(12)
      expect(geometry.maturityGridContentBottomInset).toBeGreaterThanOrEqual(0)
      expect(geometry.maturityGridContentBottomInset).toBeLessThanOrEqual(12)
      expect(geometry.maturityScaleContentBottomInset).toBeGreaterThanOrEqual(0)
      expect(geometry.maturityScaleContentBottomInset).toBeLessThanOrEqual(12)
      const lowerTrackWidth = geometry.finalGrid[2] - geometry.finalGridColumnGap
      const expectedMaturityWidth = lowerTrackWidth * 0.55
      const expectedTeamWidth = lowerTrackWidth * 0.45
      expect(Math.abs(geometry.maturityPanel[2] - expectedMaturityWidth) / expectedMaturityWidth).toBeLessThanOrEqual(0.02)
      expect(Math.abs(geometry.teamPanel[2] - expectedTeamWidth) / expectedTeamWidth).toBeLessThanOrEqual(0.02)
      if (state === 'full') {
        expect(geometry.coreEffectivePlot).not.toBeNull()
        expect(geometry.coreEffectivePlot[3] / geometry.corePlot[3]).toBeGreaterThanOrEqual(0.6)
        expect(geometry.lifecycleEffectivePlots).toHaveLength(2)
        expect(geometry.lifecycleEffectivePlots.every((box, index) => box && box[3] / geometry.lifecycleTrendSurfaces[index][3] >= 0.6)).toBe(true)
        expect(geometry.teamPreviewEffectivePlots).toHaveLength(2)
        expect(geometry.teamPreviewEffectivePlots.every((box, index) => box && box[3] / geometry.teamPreviewSurfaces[index][3] >= 0.6)).toBe(true)
        expect(geometry.teamPreviewGridTopInsets).toEqual([12, 12])
        expect(geometry.teamPreviewCardHeaderPlotGaps.every((gap) => gap >= 0)).toBe(true)
        expect(geometry.maturityRadarCenterDeltaPx).toBeLessThanOrEqual(2)
        expect(geometry.maturityRadarLegendContentBottomInset).toBeGreaterThanOrEqual(0)
        expect(geometry.maturityRadarLegendContentBottomInset).toBeLessThanOrEqual(12)
        expect(geometry.lifecycleChartLabels).toHaveLength(2)
        expect(geometry.lifecycleChartLabels.every((label) => label?.includes('领域平均') && !label.includes('全公司均值'))).toBe(true)
        expect(geometry.maturityRadarSeriesGeometry).toHaveLength(2)
        expect(geometry.maturityRadarSeriesGeometry.every((series) => series.complete && series.lines.length === 1 && series.lines[0].closed)).toBe(true)
        const currentDomain = geometry.maturityRadarSeriesGeometry.find((series) => series.name?.includes('本期领域平均'))
        const previousDomain = geometry.maturityRadarSeriesGeometry.find((series) => series.name?.includes('上期领域平均'))
        expect(currentDomain.areaCount).toBe(1)
        expect(previousDomain.areaCount).toBe(0)
        expect(currentDomain.markerKinds.every((kind) => kind === 'circle')).toBe(true)
        expect(previousDomain.markerKinds.every((kind) => kind === 'hollow-diamond')).toBe(true)
      }
      expect(geometry.stageCards.map((box) => box[3])).toEqual(Array(6).fill(92))
      expect(Math.max(...geometry.stageCards.map((box) => box[2])) - Math.min(...geometry.stageCards.map((box) => box[2]))).toBeLessThanOrEqual(1)
      expect(geometry.stageIconBoxes.map((box) => box[2])).toEqual(Array(6).fill(28))
      expect(geometry.textStylePx.stageTitle).toBe('15px')
      expect(geometry.textStylePx.stageMetricLabel).toBe('12px')
      expect(geometry.textStylePx.stageMetricValue).toBe('14px')
      expect(geometry.textStylePx.stageDelta).toBe('11px')
      expect(geometry.textStylePx.teamTableHeader).toBe('14px')
      const centerY = (box) => box[1] + box[3] / 2
      expect(Math.abs(centerY(geometry.monthLabel) - centerY(geometry.monthValue))).toBeLessThanOrEqual(4)
      expect(Math.abs(centerY(geometry.cycleLabel) - centerY(geometry.cycleValue))).toBeLessThanOrEqual(4)
      expect(geometry.cycleSelect[1]).toBeGreaterThanOrEqual(geometry.cycleControl[1])
      expect(geometry.cycleSelect[1] + geometry.cycleSelect[3]).toBeLessThanOrEqual(geometry.cycleControl[1] + geometry.cycleControl[3])
      expect(geometry.cycleSelect[2]).toBe(82)
      expect(geometry.cycleLabel[0] + geometry.cycleLabel[2]).toBeLessThanOrEqual(geometry.cycleSelect[0])
      expect(geometry.cycleValueText.text).toBe('本半年度')
      expect(geometry.cycleValueText.scrollWidth).toBeLessThanOrEqual(geometry.cycleValueText.clientWidth + 1)
      const maturityAvailableWidth = geometry.maturityGrid[2] - 16
      const maturityMatrixTrackShare = geometry.maturityMatrixBlock[2] / maturityAvailableWidth
      const maturityRadarTrackShare = geometry.maturityRadarBlock[2] / maturityAvailableWidth
      expect(maturityMatrixTrackShare).toBeGreaterThanOrEqual(0.602)
      expect(maturityMatrixTrackShare).toBeLessThanOrEqual(0.622)
      expect(maturityRadarTrackShare).toBeGreaterThanOrEqual(0.378)
      expect(maturityRadarTrackShare).toBeLessThanOrEqual(0.398)
      expect(geometry.maturityTable[2] / geometry.maturityMatrixBlock[2]).toBeGreaterThanOrEqual(0.99)
      expect(geometry.maturityTable[3]).toBeGreaterThan(expanded ? 400 : 240)
      expect(geometry.maturityHeaderHealth.every((item) => item.fits)).toBe(true)
      if (state === 'full') expect(geometry.maturityRadarLegendContentBottomInset).toBeLessThanOrEqual(12)
      expect(geometry.maturityRadar[3]).toBeGreaterThanOrEqual(expanded ? 320 : 220)
      if (geometry.maturityRadarSvg) {
        expect(geometry.maturityRadarSvg[2]).toBeGreaterThan(expanded ? 320 : 200)
        expect(geometry.maturityRadarSvg[3]).toBeGreaterThan(expanded ? 320 : 200)
      }
      expect(geometry.lowerPanelBottomDeltaPx).toBeLessThanOrEqual(1)
      if (viewport.height === 1440) {
        expect(geometry.documentEndWhitespacePx).toBeGreaterThanOrEqual(0)
        expect(geometry.documentEndWhitespacePx).toBeLessThanOrEqual(viewport.height * 0.03)
      }
      const gap = (left, right) => right[0] - left[0] - left[2]
      expect(geometry.monthControl[2]).toBe(172)
      expect(geometry.cycleControl[2]).toBe(194)
      expect(geometry.monthControl[3]).toBe(42)
      expect(geometry.cycleControl[3]).toBe(42)
      expect(Math.abs(geometry.monthControl[1] - geometry.cycleControl[1])).toBeLessThanOrEqual(1)
      expect(geometry.monthControl[0] + geometry.monthControl[2]).toBeLessThan(geometry.cycleControl[0])
      expect(gap(geometry.coreTitle, geometry.coreSelectors)).toBeGreaterThanOrEqual(0)
      expect(gap(geometry.coreTitle, geometry.coreSelectors)).toBeLessThanOrEqual(16)
      expect(gap(geometry.teamTitle, geometry.teamMode)).toBeGreaterThanOrEqual(0)
      expect(gap(geometry.teamTitle, geometry.teamMode)).toBeLessThanOrEqual(16)
      expect(geometry.lifecycleLegend[0] + geometry.lifecycleLegend[2]).toBeLessThanOrEqual(geometry.lifecyclePanel[0] + geometry.lifecyclePanel[2] - 8)
      evidence.geometry[viewportName][state] = geometry
      if (state === 'full') {
        fullReference = geometry
        fullKpiShape = { kpiSparklineBoxes: geometry.kpiSparklineBoxes }
      } else {
        expectStableGeometry(fullReference, geometry, viewport, state)
        expect(geometry.kpiSparklineBoxes, `${viewport.width} ${state} KPI sparkline geometry`).toEqual(fullKpiShape.kpiSparklineBoxes)
      }

      const stateDir = path.join(outputDir, viewportName, state)
      await mkdir(stateDir, { recursive: true })
      const fullPagePath = path.join(stateDir, 'overview-full-page.png')
      await page.screenshot({ path: fullPagePath, fullPage: true })
      evidence.screenshots.push(fullPagePath)
      const regions = [
        ['header-filters', page.locator('.analytics-page-head')],
        ['month-kpis', page.locator('.executive-kpi-grid').nth(0)],
        ['cycle-kpis', page.locator('.executive-kpi-grid').nth(1)],
        ['core-trend', page.locator('.executive-overall-trend')],
        ['lifecycle-and-trends', page.locator('.executive-lifecycle')],
        ['maturity', page.locator('.executive-maturity-section')],
        ['team-performance', page.locator('.executive-team-section')],
      ]
      for (const [name, locator] of regions) {
        const screenshotPath = path.join(stateDir, `${name}.png`)
        await locator.screenshot({ path: screenshotPath })
        evidence.screenshots.push(screenshotPath)
      }
      if (state === 'full') {
        await page.mouse.move(viewport.width - 24, Math.floor(viewport.height / 2))
        await page.mouse.wheel(0, viewport.height * 3)
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
        await expect.poll(() => page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1), { timeout: 10000 }).toBe(true)
        const scrolled = await page.evaluate(() => ({
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          url: location.href,
        }))
        expect(scrolled.scrollY + scrolled.viewportHeight).toBeGreaterThanOrEqual(scrolled.documentHeight - 1)
        expect(scrolled.scrollWidth).toBeLessThanOrEqual(scrolled.clientWidth)
        const scrollPath = path.join(outputDir, viewportName, 'scroll', 'overview-scrolled-to-bottom.png')
        await mkdir(path.dirname(scrollPath), { recursive: true })
        await page.screenshot({ path: scrollPath })
        evidence.screenshots.push(scrollPath)
        await page.mouse.wheel(0, -viewport.height * 3)
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
        evidence.interactions.push({ viewport: viewportName, action: 'mouse wheel to document bottom and back to top', scrolledY: scrolled.scrollY, documentHeight: scrolled.documentHeight, reachedDocumentEnd: scrolled.scrollY + scrolled.viewportHeight >= scrolled.documentHeight - 1, returnedToTop: await page.evaluate(() => window.scrollY === 0), horizontalOverflowPx: Math.max(0, scrolled.scrollWidth - scrolled.clientWidth), url: scrolled.url, screenshot: scrollPath })
      }
    }
  }

  // Supplemental capture for the authenticated Chrome's prior 2560×1271 window.
  // This is diagnostic only; accepted visual viewports remain 1920×1080 and 2560×1440.
  activeState = 'reported-window-2560x1271'
  await page.setViewportSize(reportedViewport)
  await page.goto('/?month=2026-09&cycle=half')
  await waitForOverview(page)
  const reportedGeometry = await measureOverview(page)
  expect(reportedGeometry.page[1]).toBeLessThanOrEqual(reportedGeometry.page[0])
  expect(reportedGeometry.teamPreviewSurfaces.every((box) => box[3] / 221 >= 0.67 && box[3] / 221 <= 0.73)).toBe(true)
  expect(reportedGeometry.maturityGridContentBottomInset).toBeGreaterThanOrEqual(0)
  expect(reportedGeometry.maturityGridContentBottomInset).toBeLessThanOrEqual(12)
  expect(reportedGeometry.maturityScaleContentBottomInset).toBeLessThanOrEqual(12)
  expect(reportedGeometry.maturityRadarCenterDeltaPx).toBeLessThanOrEqual(2)
  evidence.geometry['2560x1271-reported-window'] = { full: reportedGeometry }
  const reportedDir = path.join(outputDir, '2560x1271-reported-window', 'full')
  await mkdir(reportedDir, { recursive: true })
  await writeFile(path.join(reportedDir, 'geometry.json'), JSON.stringify(reportedGeometry, null, 2), 'utf8')
  const reportedFullPage = path.join(reportedDir, 'overview-full-page.png')
  await page.screenshot({ path: reportedFullPage, fullPage: true })
  evidence.screenshots.push(reportedFullPage)
  for (const [name, selector] of [
    ['lifecycle-and-trends', '.executive-lifecycle'],
    ['maturity', '.executive-maturity-section'],
    ['team-performance', '.executive-team-section'],
  ]) {
    const screenshotPath = path.join(reportedDir, `${name}.png`)
    await page.locator(selector).screenshot({ path: screenshotPath })
    evidence.screenshots.push(screenshotPath)
  }

  activeState = 'interaction-month-open-2560'
  await page.setViewportSize(viewports[1])
  await page.goto('/?month=2026-09&cycle=half')
  await waitForOverview(page)
  await page.getByRole('button', { name: '月份', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '选择月份' })).toBeVisible()
  const monthPicker2560Path = path.join(outputDir, '2560x1440', 'interaction-month-picker.png')
  await page.screenshot({ path: monthPicker2560Path })
  evidence.screenshots.push(monthPicker2560Path)
  await page.keyboard.press('Escape')

  activeState = 'interaction-cycle'
  await page.setViewportSize(viewports[0])
  await page.goto('/?month=2026-09&cycle=half')
  await waitForOverview(page)
  const cycleCard = page.locator('.overview-filter-card--cycle')
  await cycleCard.click({ position: { x: 5, y: 27 } })
  const cycleCombo = page.getByRole('combobox', { name: '统计周期' })
  await expect(cycleCombo).toHaveAttribute('aria-expanded', 'true')
  await expect(cycleCombo).toBeFocused()
  const cycleMenuPath = path.join(outputDir, '1920x1080', 'interaction-cycle-menu.png')
  await page.screenshot({ path: cycleMenuPath })
  evidence.screenshots.push(cycleMenuPath)
  const cycleOptions = await page.locator('.ant-select-item-option').evaluateAll((options) => options.map((option) => {
    const content = option.querySelector('.ant-select-item-option-content')
    return { text: option.getAttribute('title'), clientWidth: content?.clientWidth ?? 0, scrollWidth: content?.scrollWidth ?? 0, width: option.getBoundingClientRect().width }
  }))
  expect(cycleOptions.map((option) => option.text)).toEqual(['近6个月', '本半年度', '年度累计'])
  expect(cycleOptions.every((option) => option.scrollWidth <= option.clientWidth + 1)).toBe(true)
  const cycleRequestCount = requests.length
  const sixMonths = page.locator('.ant-select-item-option').filter({ hasText: '近6个月' })
  await expect(sixMonths).toBeVisible()
  await sixMonths.click()
  await expect(page).toHaveURL(/\?month=2026-09$/)
  await expect(page.locator('.executive-overview > .analytics-section').nth(1)).toContainText('近6个月')
  await expect(page.locator('.executive-kpi-coverage').nth(1)).toContainText('近6个月 IR 需求 46 条')
  expect(requests.length).toBe(cycleRequestCount)
  evidence.interactions.push({ action: 'click-cycle-card-and-select', url: page.url(), options: cycleOptions, cycleHeading: await page.locator('.executive-overview > .analytics-section').nth(1).innerText(), coverage: await page.locator('.executive-kpi-coverage').nth(1).innerText(), requestEffect: 'no new API request; the already loaded 12-month IR series is aggregated client-side' })
  await cycleCard.click({ position: { x: 5, y: 27 } })
  await expect(cycleCombo).toHaveAttribute('aria-expanded', 'true')
  await expect(cycleCombo).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expectOverviewUrl(page, { month: '2026-09', cycle: 'half' })
  await expect(page.locator('.executive-kpi-coverage').nth(1)).toContainText('2026下半年 IR 需求 22 条')
  expect(requests.length).toBe(cycleRequestCount)
  evidence.interactions.push({ action: 'restore-half-year-by-keyboard', url: page.url(), coverage: await page.locator('.executive-kpi-coverage').nth(1).innerText(), requestEffect: 'no new API request; the already loaded 12-month IR series is aggregated client-side' })

  activeState = 'interaction-month'
  const monthTrigger = page.getByRole('button', { name: '月份', exact: true })
  const originalMonth = '2026-09'
  const originalCoverage = await page.locator('.executive-kpi-coverage').first().innerText()
  await monthTrigger.click()
  const monthPicker = page.getByRole('dialog', { name: '选择月份' })
  await expect(monthPicker).toBeVisible()
  await expect(monthPicker.getByRole('button', { name: '9月', exact: true })).toBeFocused()
  const monthPickerPath = path.join(outputDir, '1920x1080', 'interaction-month-picker.png')
  await page.screenshot({ path: monthPickerPath })
  evidence.screenshots.push(monthPickerPath)
  const requestStart = requests.length
  await monthPicker.getByRole('button', { name: '8月', exact: true }).click()
  await expect(page).toHaveURL(/month=2026-08/)
  await expect(page.locator('.executive-kpi-coverage').first()).not.toHaveText(originalCoverage)
  await expect.poll(() => requests.slice(requestStart).some((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-08' && entry.query.version_id === 'all')).toBe(true)
  const monthRequest = requests.slice(requestStart).find((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-08')
  const pointerSelectedUrl = page.url()
  await expect(page.locator('.overview-filter-card--month')).toContainText('2026年8月')
  await expect(page.locator('.executive-kpi-coverage').first()).toContainText('当月 IR 需求 6 条')
  const pointerSelectedCoverage = await page.locator('.executive-kpi-coverage').first().innerText()
  await monthTrigger.click()
  await expect(monthPicker).toBeVisible()
  await expect(monthPicker.getByRole('button', { name: '8月', exact: true })).toBeFocused()
  const keyboardPickerPath = path.join(outputDir, '1920x1080', 'interaction-month-picker-keyboard.png')
  await page.screenshot({ path: keyboardPickerPath })
  evidence.screenshots.push(keyboardPickerPath)
  const keyboardRequestStart = requests.length
  await page.keyboard.press('ArrowRight')
  const septemberOption = monthPicker.getByRole('button', { name: '9月', exact: true })
  await expect(septemberOption).toBeFocused()
  await page.keyboard.press('Enter')
  await expectOverviewUrl(page, { month: '2026-09', cycle: 'half' })
  await expect(monthTrigger).toContainText('2026年9月')
  await expect.poll(() => requests.slice(keyboardRequestStart).some((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-09' && entry.query.version_id === 'all')).toBe(true)
  await expect(page.locator('.executive-kpi-coverage').first()).toContainText('当月 IR 需求 8 条')
  const keyboardRestoredCoverage = await page.locator('.executive-kpi-coverage').first().innerText()
  const keyboardRestoredUrl = page.url()
  evidence.interactions.push({ action: 'click-month-picker-select-and-keyboard-select', originalMonth, selectedByPointer: '2026-08', pointerSelectedUrl, pointerSelectedCoverage, restoredByKeyboard: '2026-09', keyboardRestoredUrl, keyboardFocused: true, originalCoverage, keyboardRestoredCoverage, monthRequest, keyboardRequest: requests.slice(keyboardRequestStart).find((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-09') })

  activeState = 'interaction-legacy-version'
  await page.goto('/?month=2026-09&cycle=half&version=1')
  await waitForOverview(page)
  await expectOverviewUrl(page, { month: '2026-09', cycle: 'half' })
  await expect(page.locator('.executive-kpi-coverage').first()).toContainText('当月 IR 需求 8 条')
  evidence.interactions.push({ action: 'ignore-legacy-version', url: page.url(), monthlyCoverage: await page.locator('.executive-kpi-coverage').first().innerText() })

  activeState = 'interaction-maturity-category'
  const maturityCategory = page.getByRole('group', { name: '成熟度范围' })
  const maturityInteractions = []
  for (const viewport of viewports) {
    const viewportName = `${viewport.width}x${viewport.height}`
    await page.setViewportSize(viewport)
    await page.goto('/?month=2026-09&cycle=half')
    await waitForOverview(page)
    const generalButton = maturityCategory.getByRole('button', { name: '通用研发能力' })
    const requestStart = requests.length
    await generalButton.click()
    await expect(generalButton).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/maturity_category=general/)
    const pointerUrl = page.url()
    const generalTable = page.locator('.executive-maturity-section .maturity-matrix__table')
    await expect(generalTable.locator('thead th')).toHaveCount(8)
    await expect(generalTable).toContainText('MR代码检视')
    await expect.poll(() => requests.slice(requestStart).some((entry) => entry.path === '/api/maturity/overview' && entry.query.kind === 'general' && entry.query.month === '2026-09')).toBe(true)
    const generalAxisNames = (await generalTable.locator('thead th').allTextContents()).slice(1)
    const currentMonthRequest = requests.slice(requestStart).find((entry) => entry.path === '/api/maturity/overview' && entry.query.kind === 'general' && entry.query.month === '2026-09')
    const generalHistoryRequests = requests.slice(requestStart).filter((entry) => entry.path === '/api/maturity/overview' && entry.query.kind === 'general').map((entry) => entry.query.month)
    const generalGeometry = await measureOverview(page)
    evidence.geometry[viewportName].maturityGeneral = {
      maturityPanel: generalGeometry.maturityPanel,
      maturityGrid: generalGeometry.maturityGrid,
      maturityTable: generalGeometry.maturityTable,
      maturityRadar: generalGeometry.maturityRadar,
    }
    const generalScreenshot = path.join(outputDir, viewportName, 'interaction-maturity-general.png')
    await page.locator('.executive-maturity-section').screenshot({ path: generalScreenshot })
    evidence.screenshots.push(generalScreenshot)
    const radarTrigger = page.getByRole('button', { name: '查看雷达数据表' })
    const radarDialog = page.getByRole('dialog', { name: '雷达数据表' })
    await radarTrigger.click()
    await expect(radarDialog).toBeVisible()
    const radarTable = radarDialog.locator('table')
    await expect(radarTable).toBeVisible()
    await expect(radarTable.locator('thead th')).toHaveCount(3)
    await expect(radarTable.locator('tbody tr')).toHaveCount(7)
    const radarDialogBounds = await radarDialog.boundingBox()
    expect(radarDialogBounds.x).toBeGreaterThanOrEqual(0)
    expect(radarDialogBounds.y).toBeGreaterThanOrEqual(0)
    expect(radarDialogBounds.x + radarDialogBounds.width).toBeLessThanOrEqual(viewport.width)
    expect(radarDialogBounds.y + radarDialogBounds.height).toBeLessThanOrEqual(viewport.height)
    const radarDisclosurePath = path.join(outputDir, viewportName, 'interaction-radar-table-open.png')
    await page.screenshot({ path: radarDisclosurePath })
    evidence.screenshots.push(radarDisclosurePath)
    await page.keyboard.press('Escape')
    await expect(radarDialog).not.toBeVisible()
    await expect(radarTrigger).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(radarDialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(radarDialog).not.toBeVisible()
    const keyButton = maturityCategory.getByRole('button', { name: '关键研发活动' })
    await generalButton.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(keyButton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(keyButton).toHaveAttribute('aria-pressed', 'true')
    await expectOverviewUrl(page, { month: '2026-09', cycle: 'half' })
    await expect.poll(() => requests.slice(requestStart).some((entry) => entry.path === '/api/maturity/overview' && entry.query.kind === 'key' && entry.query.month === '2026-09')).toBe(true)
    await radarTrigger.click()
    await expect(radarDialog).toBeVisible()
    const keyDataRows = await radarDialog.locator('tbody tr').evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.innerText.trim())))
    expect(keyDataRows).toHaveLength(8)
    const keyRadarScreenshot = path.join(outputDir, viewportName, 'interaction-radar-key-data-table-open.png')
    await page.screenshot({ path: keyRadarScreenshot })
    evidence.screenshots.push(keyRadarScreenshot)
    await page.keyboard.press('Escape')
    await expect(radarDialog).not.toBeVisible()
    await expect(radarTrigger).toBeFocused()
    maturityInteractions.push({ viewport: viewportName, pointerSelected: '通用研发能力', pointerUrl, currentMonthRequest, generalHistoryRequests, generalAxisNames, radarDisclosure: { pointerOpened: true, columnCount: 3, dataRowCount: 7, dialogBounds: radarDialogBounds, screenshot: radarDisclosurePath, escapeClosed: true, keyboardEnterOpened: true, focusRestored: true }, keyboardRestored: '关键研发活动', keyboardUrl: page.url(), keyboardCurrentMonthRequest: requests.slice(requestStart).find((entry) => entry.path === '/api/maturity/overview' && entry.query.kind === 'key' && entry.query.month === '2026-09'), keyRadarTable: { pointerOpened: true, axisRowCount: keyDataRows.length, rows: keyDataRows, screenshot: keyRadarScreenshot, escapeClosed: true, focusRestored: true } })
  }
  evidence.interactions.push({ action: 'maturity-category', selections: maturityInteractions })

  activeState = 'interaction-core-metrics'
  await page.goto('/?month=2026-09&cycle=half')
  await waitForOverview(page)
  const coreButtons = page.locator('.executive-trend-actions > button')
  const coreMetrics = ['AI需求渗透率', 'AI研发提效', 'AI覆盖需求数', 'AI提效工作量']
  const coreInteractions = []
  const coreRequestCount = requests.length
  for (let index = 0; index < coreMetrics.length; index += 1) {
    const button = coreButtons.nth(index)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    const chartLabel = await page.locator('.executive-overall-trend .overview-chart').getAttribute('aria-label')
    expect(chartLabel).toContain(coreMetrics[index])
    if (coreMetrics[index] === 'AI提效工作量') expect(chartLabel).toContain('单位 人天')
    const screenshotPath = path.join(outputDir, '1920x1080', `core-metric-${index + 1}.png`)
    await page.locator('.executive-overall-trend').screenshot({ path: screenshotPath })
    evidence.screenshots.push(screenshotPath)
    const chart = page.locator('.executive-overall-trend .overview-chart')
    const chartBox = await chart.boundingBox()
    await page.mouse.move(chartBox.x + chartBox.width * 0.78, chartBox.y + chartBox.height * 0.58)
    const tooltipText = await chart.innerText()
    expect(tooltipText.length).toBeGreaterThan(0)
    expect(tooltipText).toMatch(/2026-\d{2}/)
    expect(tooltipText).toContain('全公司均值')
    expect(tooltipText).toMatch(/\d/)
    if (coreMetrics[index] === 'AI提效工作量') {
      expect(chartLabel).toContain('单位 人天')
      await expect(page.locator('.executive-overall-trend .analytics-panel__description')).toContainText('单位：人天')
      expect(tooltipText).toContain('全公司均值')
    }
    coreInteractions.push({ action: 'pointer', metric: coreMetrics[index], pressed: true, chartLabel, tooltipText, url: page.url() })
    await page.mouse.move(4, 4)
  }
  await coreButtons.nth(0).press('Tab')
  await expect(coreButtons.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(coreButtons.nth(1)).toHaveAttribute('aria-pressed', 'true')
  coreInteractions.push({ action: 'Tab+Enter', metric: 'AI研发提效', focused: true, url: page.url() })
  expect(requests.length).toBe(coreRequestCount)
  evidence.interactions.push({ action: 'core-metrics', selections: coreInteractions, requestEffect: 'client-only; no additional API requests' })

  await page.setViewportSize(viewports[1])
  const wideCoreButtons = page.locator('.executive-trend-actions > button')
  const wideCoreInteractions = []
  for (let index = 0; index < coreMetrics.length; index += 1) {
    const button = wideCoreButtons.nth(index)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    const chartLabel = await page.locator('.executive-overall-trend .overview-chart').getAttribute('aria-label')
    expect(chartLabel).toContain(coreMetrics[index])
    if (coreMetrics[index] === 'AI提效工作量') {
      expect(chartLabel).toContain('单位 人天')
      await expect(page.locator('.executive-overall-trend .analytics-panel__description')).toContainText('单位：人天')
    }
    const screenshotPath = path.join(outputDir, '2560x1440', `core-metric-${index + 1}.png`)
    await page.locator('.executive-overall-trend').screenshot({ path: screenshotPath })
    evidence.screenshots.push(screenshotPath)
    wideCoreInteractions.push({ action: 'pointer', metric: coreMetrics[index], pressed: true, chartLabel, url: page.url() })
  }
  evidence.interactions.push({ action: 'core-metrics-wide-viewport', selections: wideCoreInteractions, requestEffect: 'client-only; no additional API requests' })

  activeState = 'interaction-lifecycle'
  const lifecycleLabels = ['SA设计', 'SE设计', '开发设计', '编码开发', '测试用例生成', '测试用例执行']
  const lifecycleInteractions = []
  for (const label of lifecycleLabels) {
    const card = page.locator(`.executive-lifecycle__item[aria-label="选择关键环节：${label}"]`)
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    const headings = await page.locator('.executive-lifecycle__trend-grid .analytics-chart-card__header h2').allTextContents()
    expect(headings).toEqual([`${label} · AI需求渗透率趋势`, `${label} · AI研发提效趋势`])
    lifecycleInteractions.push({ action: 'pointer', label, headings, missingValues: await card.locator('.executive-lifecycle__metric b').allTextContents() })
  }
  const saCard = page.locator('.executive-lifecycle__item[aria-label="选择关键环节：SA设计"]')
  await saCard.press('Tab')
  const seCard = page.locator('.executive-lifecycle__item[aria-label="选择关键环节：SE设计"]')
  await expect(seCard).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(seCard).toHaveAttribute('aria-pressed', 'true')
  lifecycleInteractions.push({ action: 'Tab+Enter', label: 'SE设计', focused: true })
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const saCard = page.locator('.executive-lifecycle__item[aria-label="选择关键环节：SA设计"]')
    await saCard.click()
    const chart = page.locator('.executive-lifecycle__trend-grid .overview-chart').first()
    await chart.scrollIntoViewIfNeeded()
    const chartLabel = await chart.getAttribute('aria-label')
    expect(chartLabel).toContain('领域平均')
    const chartBounds = await chart.boundingBox()
    await page.mouse.move(chartBounds.x + chartBounds.width * 0.6, chartBounds.y + chartBounds.height * 0.5)
    await expect.poll(() => chart.innerText()).toContain('领域平均')
    const tooltipText = await chart.innerText()
    expect(tooltipText).not.toContain('全公司均值')
    const metricName = await saCard.locator('.executive-lifecycle__metric').first().getAttribute('title')
    await expect.poll(() => catalogMetrics.length).toBeGreaterThan(0)
    const catalogMetric = catalogMetrics.find((metric) => metric.name === metricName)
    expect(catalogMetric, `catalog metric ${metricName}`).toBeTruthy()
    await expect.poll(() => computeResponses.has(String(catalogMetric.id))).toBe(true)
    const response = computeResponses.get(String(catalogMetric.id))
    expect(response, `compute response for metric ${metricName}`).toBeTruthy()
    const period = response.periods.find((item) => item.label === '2026-07' || item.id === '2026-07')
    expect(period).toBeTruthy()
    const teamValues = response.series.map((series) => ({ team: series.team_name, value: series.values.find((item) => String(item.period_id) === String(period.id))?.value })).filter((item) => Number.isFinite(item.value))
    const equalTeamMean = teamValues.reduce((sum, item) => sum + item.value, 0) / teamValues.length
    const companyAverage = response.company_average.find((item) => String(item.period_id) === String(period.id))?.value
    const domainSummary = response.domain_summary.find((item) => String(item.period_id) === String(period.id))?.value
    expect(companyAverage).toBeCloseTo(equalTeamMean, 8)
    expect(tooltipText).toContain(`${Math.round(companyAverage * 100)}%`)
    const screenshot = path.join(outputDir, `${viewport.width}x${viewport.height}`, 'interaction-lifecycle-domain-tooltip.png')
    await page.locator('.executive-lifecycle__trend-grid').screenshot({ path: screenshot })
    evidence.screenshots.push(screenshot)
    lifecycleInteractions.push({ action: 'hover-domain-average-series', viewport: `${viewport.width}x${viewport.height}`, selectedStage: 'SA设计', chartLabel, tooltipText, screenshot, benchmarkApiEvidence: { path: '/api/compute', metricName, metricId: catalogMetric.id, periodId: period.id, sourceField: 'company_average', teamValues, equalTeamMean, companyAverage, domainSummary } })
    await page.mouse.move(4, 4)
  }
  evidence.interactions.push({ action: 'lifecycle-cards', selections: lifecycleInteractions, requestEffect: 'client-only; no additional API requests' })

  const teamMode = page.getByRole('group', { name: '团队表现统计范围' })
  await teamMode.getByRole('button', { name: '统计周期' }).click()
  await expect(teamMode.getByRole('button', { name: '统计周期' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#team-performance .team-matrix__table')).toHaveAttribute('aria-label', /2026下半年/)
  evidence.interactions.push({ action: 'team-period-mode', selected: '统计周期', tableLabel: await page.locator('#team-performance .team-matrix__table').getAttribute('aria-label') })

  activeState = 'interaction-team-selection'
  const teamPreviewSelections = []
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const teamA = page.getByRole('button', { name: '选择团队：团队A' })
    const teamB = page.getByRole('button', { name: '选择团队：团队B' })
    await expect(teamA).toHaveAttribute('aria-pressed', 'true')
    const before = {
      heading: await page.locator('.executive-team-preview > header h3').innerText(),
      chartLabels: await page.locator('.executive-team-preview__charts .overview-chart').evaluateAll((charts) => charts.map((chart) => chart.getAttribute('aria-label'))),
    }
    await teamB.click()
    await expect(teamB).toHaveAttribute('aria-pressed', 'true')
    await expect(teamA).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.executive-team-preview > header h3')).toHaveText('团队B · 趋势预览')
    const after = {
      heading: await page.locator('.executive-team-preview > header h3').innerText(),
      chartLabels: await page.locator('.executive-team-preview__charts .overview-chart').evaluateAll((charts) => charts.map((chart) => chart.getAttribute('aria-label'))),
    }
    expect(before.heading).toBe('团队A · 趋势预览')
    expect(before.chartLabels.every((label) => label?.includes('团队A'))).toBe(true)
    expect(after.chartLabels).toHaveLength(2)
    expect(after.chartLabels.every((label) => label?.includes('团队B'))).toBe(true)
    const screenshotPath = path.join(outputDir, `${viewport.width}x${viewport.height}`, 'interaction-team-preview-selected.png')
    await page.locator('.executive-team-section').screenshot({ path: screenshotPath })
    evidence.screenshots.push(screenshotPath)
    teamPreviewSelections.push({ viewport: `${viewport.width}x${viewport.height}`, before, after, selectedButton: await teamB.getAttribute('aria-pressed') })
    await teamA.click()
    await expect(teamA).toHaveAttribute('aria-pressed', 'true')
  }
  evidence.interactions.push({ action: 'team-selection-updates-preview', selections: teamPreviewSelections, requestEffect: 'client-only; no additional API requests' })

  activeState = 'interaction-team-detail-from-preview'
  await page.setViewportSize(viewports[0])
  await page.goto('/?month=2026-09&cycle=half')
  await waitForOverview(page)
  await page.locator('.executive-team-preview > header').getByRole('button', { name: '查看团队详情 →' }).click()
  await expect(page).toHaveURL(/\/analytics\/teams\/\d+/)
  evidence.interactions.push({ action: 'open-team-detail-from-preview-heading', url: page.url() })

  const networkEvidencePath = path.join(outputDir, 'request-and-interaction-evidence.json')
  await writeFile(networkEvidencePath, JSON.stringify(evidence, null, 2), 'utf8')
  expect(requests.some((entry) => entry.path === '/api/data-metrics/overview' && entry.query.version_id === 'all')).toBe(true)
  expect(requests.every((entry) => entry.query.version_id !== '1')).toBe(true)
})

test('Overview Radar closes complete series and preserves missing-axis gaps', async ({ page }) => {
  await mkdir(outputDir, { recursive: true })
  await login(page)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.route('**/api/maturity/overview?*', async (route) => {
      const url = new URL(route.request().url())
      const response = await route.fetch()
      const payload = await response.json()
      if (url.searchParams.get('month') === '2026-09' && url.searchParams.get('kind') === 'key' && payload.activities?.length) {
        payload.activities[0].score = null
        payload.activities[0].score_display = null
        payload.activities[0].grade = null
      }
      await route.fulfill({ response, body: JSON.stringify(payload) })
    })
    await page.goto('/?month=2026-09&cycle=half')
    await waitForOverview(page)
    const radarSeries = page.locator('.executive-maturity-section .maturity-radar--overview .maturity-radar__series')
    await expect(radarSeries).toHaveCount(2)
    const series = await radarSeries.evaluateAll((groups) => groups.map((group) => ({
      name: group.dataset.seriesName,
      complete: group.dataset.seriesComplete === 'true',
      areaCount: [...document.querySelectorAll('.maturity-radar__area')].filter((area) => area.dataset.seriesName === group.dataset.seriesName).length,
      loops: [...group.querySelectorAll('polyline')].map((line) => {
        const points = line.getAttribute('points')?.trim().split(/\s+/) ?? []
        return points.length > 1 && points[0] === points[points.length - 1]
      }),
    })))
    const current = series.find((entry) => entry.name.includes('本期领域平均'))
    const previous = series.find((entry) => entry.name.includes('上期领域平均'))
    expect(current.complete).toBe(false)
    expect(current.areaCount).toBe(0)
    expect(current.loops).toEqual([false])
    expect(previous.complete).toBe(true)
    expect(previous.loops).toEqual([true])
    expect(previous.areaCount).toBe(0)
    const geometry = await measureOverview(page)
    expect(geometry.page[1]).toBeLessThanOrEqual(geometry.page[0])
    expect(geometry.maturityGridContentBottomInset).toBeLessThanOrEqual(12)
    const screenshot = path.join(outputDir, `${viewport.width}x${viewport.height}`, 'interaction-radar-missing-axis.png')
    await page.locator('.executive-maturity-section').screenshot({ path: screenshot })
  }
})

test('loading and error states keep the Overview grid in its owning positions at both target sizes', async ({ page }) => {
  await login(page)
  for (const viewport of viewports) {
    const viewportName = `${viewport.width}x${viewport.height}`
    await page.setViewportSize(viewport)
    const stateDir = path.join(outputDir, viewportName, 'loading-error')
    await mkdir(stateDir, { recursive: true })
    await page.route('**/api/data-metrics/overview?*', async (route) => {
      await page.waitForTimeout(3000)
      try { await route.continue() } catch { /* React may cancel a superseded request while this fixture is held. */ }
    })
    await page.goto('/?month=2026-09&cycle=half')
    await expect(page.locator('.executive-kpi-grid .metric-card--loading')).toHaveCount(8)
    await expect(page.locator('.maturity-matrix__table')).toHaveCount(1)
    const loadingGeometry = await measureOverview(page)
    const loadingPath = path.join(stateDir, 'overview-loading.png')
    await page.screenshot({ path: loadingPath, fullPage: true })
    await page.waitForLoadState('networkidle')
    await page.unroute('**/api/data-metrics/overview?*')
    await waitForOverview(page)
    const fullGeometry = await measureOverview(page)

    await page.route('**/api/data-metrics/overview?*', (route) => route.abort())
    await page.reload()
    await expect(page.getByRole('alert').filter({ hasText: 'IR 指标加载失败' }).first()).toBeVisible()
    await expect(page.locator('.maturity-matrix__table')).toHaveCount(1)
    const errorGeometry = await measureOverview(page)
    const errorPath = path.join(stateDir, 'overview-error.png')
    await page.screenshot({ path: errorPath, fullPage: true })
    expectStableGeometry(fullGeometry, loadingGeometry, viewport, 'loading')
    expectStableGeometry(fullGeometry, errorGeometry, viewport, 'error')
    await writeFile(path.join(stateDir, 'state-geometry.json'), JSON.stringify({ full: fullGeometry, loading: loadingGeometry, error: errorGeometry, screenshots: [loadingPath, errorPath] }, null, 2), 'utf8')
    await page.unroute('**/api/data-metrics/overview?*')
  }
})

test('captures October Month and Statistical Period spacing and pointer/keyboard interactions at both target sizes', async ({ page }) => {
  const filterEvidenceDir = path.join(outputDir, 'r11-filter-spacing')
  await mkdir(filterEvidenceDir, { recursive: true })
  const requests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) requests.push({ method: request.method(), path: url.pathname, query: Object.fromEntries(url.searchParams) })
  })
  await login(page)
  const viewportEvidence = []
  for (const viewport of viewports) {
    const viewportName = `${viewport.width}x${viewport.height}`
    await page.setViewportSize(viewport)
    await page.goto('/?month=2026-10&cycle=6m')
    await waitForOverview(page)
    const geometry = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null
        const { x, y, width, height, right, bottom } = element.getBoundingClientRect()
        return { x, y, width, height, right, bottom }
      }
      const monthCard = document.querySelector('.overview-filter-card--month')
      const monthTrigger = monthCard?.querySelector('.overview-filter-card__trigger')
      const monthCopy = monthCard?.querySelector('.overview-filter-card__copy')
      const monthLabel = monthCopy?.querySelector('small')
      const monthValue = monthCopy?.querySelector('strong')
      const monthIcon = monthTrigger?.querySelector('.anticon:first-child')
      const monthArrow = monthTrigger?.querySelector('.anticon:last-child')
      const cycleCard = document.querySelector('.overview-filter-card--cycle')
      const cycleCopy = cycleCard?.querySelector('.overview-filter-card__copy')
      const cycleLabel = cycleCopy?.querySelector('small')
      const cycleSelect = cycleCopy?.querySelector('.overview-cycle-select')
      const cycleValue = cycleCopy?.querySelector('.ant-select-content-has-value')
      const cycleIcon = cycleCard?.querySelector('.anticon:first-child')
      const cycleArrow = cycleCard?.querySelector('.anticon:last-child')
      const centerY = (element) => {
        const bounds = element?.getBoundingClientRect()
        return bounds ? bounds.y + bounds.height / 2 : null
      }
      const horizontalOverlap = (left, right) => {
        const a = left?.getBoundingClientRect()
        const b = right?.getBoundingClientRect()
        return Boolean(a && b && a.right > b.left + 1 && a.left < b.right - 1)
      }
      return {
        viewport: [innerWidth, innerHeight],
        page: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
        month: {
          card: rect(monthCard), trigger: rect(monthTrigger), icon: rect(monthIcon), copy: rect(monthCopy), label: rect(monthLabel), value: rect(monthValue), arrow: rect(monthArrow),
          copyClientWidth: monthCopy?.clientWidth ?? null, copyScrollWidth: monthCopy?.scrollWidth ?? null,
          labelValueSameRow: Math.abs(centerY(monthLabel) - centerY(monthValue)) <= 2,
          copyFits: (monthCopy?.scrollWidth ?? 0) <= (monthCopy?.clientWidth ?? 0) + 1,
          valueFits: (monthValue?.scrollWidth ?? 0) <= (monthValue?.clientWidth ?? 0) + 1,
          valueArrowGapPx: monthValue && monthArrow ? monthArrow.getBoundingClientRect().left - monthValue.getBoundingClientRect().right : null,
          valueArrowOverlap: horizontalOverlap(monthValue, monthArrow),
          cardPadding: monthCard ? getComputedStyle(monthCard).padding : null,
          valueText: monthValue?.innerText ?? null,
        },
        cycle: {
          card: rect(cycleCard), icon: rect(cycleIcon), copy: rect(cycleCopy), label: rect(cycleLabel), select: rect(cycleSelect), value: rect(cycleValue), arrow: rect(cycleArrow),
          copyClientWidth: cycleCopy?.clientWidth ?? null, copyScrollWidth: cycleCopy?.scrollWidth ?? null,
          labelValueSameRow: Math.abs(centerY(cycleLabel) - centerY(cycleValue)) <= 2,
          copyFits: (cycleCopy?.scrollWidth ?? 0) <= (cycleCopy?.clientWidth ?? 0) + 1,
          valueFits: (cycleValue?.scrollWidth ?? 0) <= (cycleValue?.clientWidth ?? 0) + 1,
          labelValueGapPx: cycleLabel && cycleValue ? cycleValue.getBoundingClientRect().left - cycleLabel.getBoundingClientRect().right : null,
          labelLineHeight: cycleLabel ? getComputedStyle(cycleLabel).lineHeight : null,
          valueLineHeight: cycleValue ? getComputedStyle(cycleValue).lineHeight : null,
          labelValueOverlap: horizontalOverlap(cycleLabel, cycleValue),
          valueArrowOverlap: horizontalOverlap(cycleValue, cycleArrow),
          cardPadding: cycleCard ? getComputedStyle(cycleCard).padding : null,
          valueText: cycleValue?.innerText ?? null,
        },
      }
    })
    expect(geometry.page[1]).toBeLessThanOrEqual(geometry.page[0])
    expect(geometry.month.card.width).toBe(172)
    expect(geometry.month.card.height).toBe(42)
    expect(geometry.month.cardPadding).toBe('0px')
    expect(geometry.month.valueText).toBe('2026年10月')
    expect(geometry.month.labelValueSameRow && geometry.month.copyFits && geometry.month.valueFits).toBe(true)
    expect(geometry.month.valueArrowOverlap).toBe(false)
    expect(geometry.month.valueArrowGapPx).toBeGreaterThanOrEqual(16)
    expect(geometry.cycle.card.width).toBe(194)
    expect(geometry.cycle.card.height).toBe(42)
    expect(geometry.cycle.cardPadding).toBe('3px 4px')
    expect(geometry.cycle.valueText).toBe('近6个月')
    expect(geometry.cycle.labelValueSameRow && geometry.cycle.copyFits && geometry.cycle.valueFits).toBe(true)
    expect(geometry.cycle.labelValueOverlap).toBe(false)
    expect(geometry.cycle.valueArrowOverlap).toBe(false)
    expect(geometry.cycle.labelValueGapPx).toBeGreaterThanOrEqual(14)
    expect(geometry.cycle.labelLineHeight).toBe('22px')
    expect(geometry.cycle.valueLineHeight).toBe('22px')

    const headerPath = path.join(filterEvidenceDir, `${viewportName}-header.png`)
    await page.locator('.analytics-page-head').screenshot({ path: headerPath })
    const filterCropPath = path.join(filterEvidenceDir, `${viewportName}-filter-controls.png`)
    await page.locator('.overview-filter-toolbar').screenshot({ path: filterCropPath })
    const monthTrigger = page.getByRole('button', { name: '月份', exact: true })
    const monthDialog = page.getByRole('dialog', { name: '选择月份' })
    const monthPointerStart = requests.length
    await monthTrigger.click()
    await expect(monthDialog).toBeVisible()
    await expect(monthDialog.getByRole('button', { name: '10月', exact: true })).toBeFocused()
    const monthPointerOpen = path.join(filterEvidenceDir, `${viewportName}-month-pointer-open.png`)
    await page.screenshot({ path: monthPointerOpen })
    await monthDialog.getByRole('button', { name: '9月', exact: true }).click()
    await expect(page).toHaveURL(/month=2026-09/)
    await expect.poll(() => requests.slice(monthPointerStart).some((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-09')).toBe(true)
    await expect(page.locator('.executive-kpi-coverage').first()).toContainText('当月 IR 需求 8 条')
    const monthPointer = { openMethod: 'pointer', selectMethod: 'pointer', focusedMonthOnOpen: '10月', url: page.url(), coverage: await page.locator('.executive-kpi-coverage').first().innerText(), monthRequest: requests.slice(monthPointerStart).find((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-09') }

    await page.goto('/?month=2026-10&cycle=6m')
    await waitForOverview(page)
    const monthKeyboardStart = requests.length
    await monthTrigger.press('Enter')
    await expect(monthDialog).toBeVisible()
    await expect(monthDialog.getByRole('button', { name: '10月', exact: true })).toBeFocused()
    const monthKeyboardOpen = path.join(filterEvidenceDir, `${viewportName}-month-keyboard-open.png`)
    await page.screenshot({ path: monthKeyboardOpen })
    await page.keyboard.press('ArrowLeft')
    await expect(monthDialog.getByRole('button', { name: '9月', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/month=2026-09/)
    await expect.poll(() => requests.slice(monthKeyboardStart).some((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-09')).toBe(true)
    await expect(page.locator('.executive-kpi-coverage').first()).toContainText('当月 IR 需求 8 条')
    const monthKeyboard = { openMethod: 'keyboard', selectMethod: 'ArrowLeft+Enter', focusedMonthOnOpen: '10月', focusedMonthBeforeCommit: '9月', focusedTriggerAfterCommit: await monthTrigger.evaluate((element) => element === document.activeElement), url: page.url(), coverage: await page.locator('.executive-kpi-coverage').first().innerText(), monthRequest: requests.slice(monthKeyboardStart).find((entry) => entry.path === '/api/data-metrics/overview' && entry.query.to_month === '2026-09') }
    await expect(monthTrigger).toBeFocused()

    const cycleCard = page.locator('.overview-filter-card--cycle')
    const cycleSelect = page.getByRole('combobox', { name: '统计周期' })
    const cyclePointerStart = requests.length
    await cycleCard.click({ position: { x: 5, y: 20 } })
    await expect(cycleSelect).toHaveAttribute('aria-expanded', 'true')
    await expect(cycleSelect).toBeFocused()
    const cycleMenu = page.locator('.ant-select-dropdown:visible')
    await expect(cycleMenu).toBeVisible()
    await expect.poll(() => cycleMenu.evaluate((menu) => Number(getComputedStyle(menu).opacity))).toBe(1)
    await expect(cycleMenu.locator('.ant-select-item-option:visible')).toHaveCount(3)
    const cycleOptions = await cycleMenu.locator('.ant-select-item-option').evaluateAll((options) => options.map((option) => {
      const content = option.querySelector('.ant-select-item-option-content')
      return { text: content?.textContent?.trim() ?? '', clientWidth: content?.clientWidth ?? 0, scrollWidth: content?.scrollWidth ?? 0 }
    }))
    expect(cycleOptions).toHaveLength(3)
    expect(cycleOptions.every((option) => option.scrollWidth <= option.clientWidth + 1)).toBe(true)
    const cyclePointerOpen = path.join(filterEvidenceDir, `${viewportName}-cycle-pointer-open.png`)
    await page.screenshot({ path: cyclePointerOpen })
    await cycleMenu.locator('.ant-select-item-option').filter({ hasText: '本半年度' }).click()
    await expect(page).toHaveURL(/cycle=half/)
    await expect(page.locator('.executive-kpi-coverage').nth(1)).toContainText('2026下半年 IR 需求 22 条')
    const cyclePointer = { openMethod: 'pointer', selectMethod: 'pointer', focusedControlOnOpen: true, options: cycleOptions, url: page.url(), coverage: await page.locator('.executive-kpi-coverage').nth(1).innerText(), requestEffect: 'no additional request; loaded IR series is aggregated client-side' }

    await expect(cycleSelect).toBeFocused()
    const cycleKeyboardStart = requests.length
    await cycleSelect.press('Enter')
    await expect(cycleSelect).toHaveAttribute('aria-expanded', 'true')
    await expect(cycleMenu).toBeVisible()
    await expect.poll(() => cycleMenu.evaluate((menu) => Number(getComputedStyle(menu).opacity))).toBe(1)
    const cycleKeyboardOpen = path.join(filterEvidenceDir, `${viewportName}-cycle-keyboard-open.png`)
    await page.screenshot({ path: cycleKeyboardOpen })
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/cycle=year/)
    await expect(cycleCard).toContainText('年度累计')
    await expect(page.locator('.executive-overview > .analytics-section').nth(1)).toContainText('2026年度 IR 需求 46 条')
    const cycleKeyboard = { openMethod: 'keyboard', selectMethod: 'ArrowDown+Enter', focusedControlOnOpen: true, url: page.url(), heading: await page.locator('.executive-overview > .analytics-section').nth(1).innerText(), requestEffect: requests.length === cycleKeyboardStart ? 'client-side cycle aggregation; no additional request' : requests.slice(cycleKeyboardStart) }

    await page.goto('/?month=2026-10&cycle=6m')
    await waitForOverview(page)
    const escapeMonthTrigger = page.getByRole('button', { name: '月份', exact: true })
    const escapeMonthDialog = page.getByRole('dialog', { name: '选择月份' })
    await escapeMonthTrigger.press('Enter')
    await expect(escapeMonthDialog).toBeVisible()
    await expect(escapeMonthDialog.getByRole('button', { name: '10月', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(escapeMonthDialog).toBeHidden()
    await expect(escapeMonthTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(escapeMonthTrigger).toBeFocused()
    const monthEscapeClosedPath = path.join(filterEvidenceDir, `${viewportName}-month-escape-closed.png`)
    await page.screenshot({ path: monthEscapeClosedPath })
    const monthEscape = { openMethod: 'keyboard', closeMethod: 'Escape', selectedMonth: '2026-10', dialogClosed: true, focusedTriggerAfterClose: await escapeMonthTrigger.evaluate((element) => element === document.activeElement), url: page.url() }

    viewportEvidence.push({ viewport: viewportName, geometry, screenshots: { headerPath, filterCropPath, monthPointerOpen, monthKeyboardOpen, cyclePointerOpen, cycleKeyboardOpen, monthEscapeClosedPath }, monthPointer, monthKeyboard, monthEscape, cyclePointer, cycleKeyboard })
  }
  await writeFile(path.join(filterEvidenceDir, 'filter-evidence.json'), JSON.stringify({ interactions: viewportEvidence, requests }, null, 2), 'utf8')
})

test('captures Activity, Capability, and Team Detail candidates and checks Activity filter scope', async ({ page }) => {
  test.setTimeout(480_000)
  await mkdir(outputDir, { recursive: true })
  const baselineDir = path.join(outputDir, 'sibling-visual-candidate')
  await mkdir(baselineDir, { recursive: true })
  const siblingPageBoardDir = path.join(baselineDir, 'comparisons', 'sibling-page-review')
  await mkdir(siblingPageBoardDir, { recursive: true })
  const requests = []
  let activeRoute = ''
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) requests.push({ route: activeRoute, method: request.method(), path: url.pathname, query: Object.fromEntries(url.searchParams) })
  })
  await login(page)
  const teamsResponse = await page.request.get('/api/teams')
  expect(teamsResponse.ok()).toBe(true)
  const teams = await teamsResponse.json()
  expect(teams.length).toBeGreaterThan(0)
  const catalogResponse = await page.request.get('/api/catalog')
  expect(catalogResponse.ok()).toBe(true)
  const catalog = await catalogResponse.json()
  const generalCapabilities = catalog.filter((item) => item.kind === 'general')
  expect(generalCapabilities.map((item) => item.name).sort()).toEqual([
    'MR代码检视', 'MR-E2E能力', 'CodeCheck问题修复', '三方件治理', '漏洞修复', '自动化构建部署', '白盒安全问题修复',
  ].sort())
  const versionsResponse = await page.request.get('/api/versions')
  expect(versionsResponse.ok()).toBe(true)
  const versions = await versionsResponse.json()
  expect(Array.isArray(versions)).toBe(true)
  const visualDataset = JSON.parse(await readFile(path.resolve('e2e/support/overview-visual-dataset.json'), 'utf8'))
  const legacyVersion = versions.find((version) => version.name === visualDataset.productlessVersion.name)
  const legacyIteration = legacyVersion?.iterations?.find((iteration) => iteration.name === visualDataset.productlessVersion.iterationName)
  const legacyMetric = catalog.flatMap((activity) => activity.metrics).find((metric) => metric.code === visualDataset.productlessVersion.metricCode)
  const baselineTeamId = teams.find((team) => team.name === visualDataset.productlessVersion.team).id
  expect(legacyVersion).toMatchObject({ product_id: null, team_id: null })
  expect(legacyIteration).toBeTruthy()
  expect(legacyMetric).toBeTruthy()
  const legacyIterationId = legacyIteration.id
  const legacyMetricId = legacyMetric.id
  const foreignVersion = versions.find((version) => version.team_id && String(version.team_id) !== String(baselineTeamId))
  const ownedVersion = versions.find((version) => version.team_id && String(version.team_id) === String(baselineTeamId) && version.product_id && version.iterations?.length)
  const iterationVersion = foreignVersion?.iterations?.length ? foreignVersion : versions.find((version) => version.iterations?.length)
  const legacyActivityParams = new URLSearchParams({ month: '2026-09', cycle: 'half' })
  if (foreignVersion) legacyActivityParams.set('version', String(foreignVersion.id))
  if (iterationVersion?.iterations?.[0]) {
    legacyActivityParams.set('dimension', 'iteration')
    legacyActivityParams.set('period', String(iterationVersion.iterations[0].id))
  }
  const productlessVersions = versions.filter((version) => !version.team_id || !version.product_id).map(({ id, name, product_id, team_id }) => ({ id, name, product_id, team_id }))
  const pages = [
    { id: 'activities', url: `/analytics/activities?${legacyActivityParams}`, root: '.activity-workspace' },
    { id: 'capabilities', url: '/analytics/capabilities?month=2026-09&granularity=month', root: '.capability-page' },
    { id: 'team-detail', teamId: baselineTeamId, url: `/analytics/teams/${baselineTeamId}?month=2026-09&cycle=half`, root: '.drilldown-shell' },
  ]
  const evidence = []
  const apiResponses = []
  const apiResponseReads = []
  const irOverviewResponses = []
  const irOverviewResponseReads = []
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname === '/api/data-metrics/overview') {
      const route = activeRoute
      const query = Object.fromEntries(url.searchParams)
      irOverviewResponseReads.push(response.json().then((payload) => irOverviewResponses.push({
        route,
        query,
        status: response.status(),
        payload,
      })).catch((error) => irOverviewResponses.push({ route, query, status: response.status(), parseError: error.message })))
      return
    }
    if (url.pathname !== '/api/compute') return
    const route = activeRoute
    const query = Object.fromEntries(url.searchParams)
    apiResponseReads.push(response.json().then((payload) => {
      const pointValues = (payload.series ?? []).flatMap((series) => (series.values ?? []).map((point) => point.value))
      const includesLegacyPeriod = (payload.periods ?? []).some((period) => String(period.id) === String(legacyIterationId))
      const legacyTeamPoint = query.metric_id === String(legacyMetricId) && includesLegacyPeriod
        ? payload.series?.find((series) => String(series.team_id) === String(baselineTeamId))?.values?.find((point) => String(point.period_id) === String(legacyIterationId))
        : null
      apiResponses.push({
        route,
        query,
        status: response.status(),
        periods: (payload.periods ?? []).map((period) => period.id),
        domainSummary: (payload.domain_summary ?? []).map((point) => ({
          period_id: point.period_id,
          value: point.value,
          numerator: point.numerator,
          fact_count: point.fact_count,
          sample_count: point.sample_count,
        })),
        numericTeamPoints: pointValues.filter(Number.isFinite).length,
        numericMeanPoints: (payload.company_average ?? []).filter((point) => Number.isFinite(point.value)).length,
        teamPeriodsWithFacts: payload.series?.find((series) => String(series.team_id) === String(baselineTeamId))?.values
          ?.filter((point) => point.fact_count > 0).map((point) => point.period_id) ?? [],
        ...(route === 'team-detail' && query.dim === 'time' && query.gran === 'day' ? {
          dailyReferenceData: {
            periods: (payload.periods ?? []).map(({ id, start_date, end_date }) => ({ id, start_date, end_date })),
            series: (payload.series ?? []).map(({ team_id, values }) => ({ team_id, values })),
          },
        } : {}),
        ...(legacyTeamPoint ? { productlessHistoryPoint: { team_id: baselineTeamId, ...legacyTeamPoint } } : {}),
      })
    }).catch((error) => apiResponses.push({ route, query, status: response.status(), parseError: error.message })))
  })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const viewportName = `${viewport.width}x${viewport.height}`
    for (const item of pages) {
      activeRoute = item.id
      const pageRequestStart = requests.length
      let activityR2IssueBoards = {}
      let activityR3IssueBoards = {}
      let activityR3Directory = ''
      let activityR3Geometry = null
      let activityR4IssueBoards = {}
      let activityR4Directory = ''
      let activityR4Geometry = null
      let activityR4FilterInteractions = null
      let activityR5FilterChevronEvidence = null
      let activityReferenceState = null
      await page.goto(item.url)
      await expect(page.locator(item.root)).toBeVisible()
      await page.waitForLoadState('networkidle')
      const initialUrl = page.url()
      const actualDir = path.join(baselineDir, viewportName, item.id)
      await mkdir(actualDir, { recursive: true })
      const viewportScreenshot = path.join(actualDir, 'viewport.png')
      const fullPageScreenshot = path.join(actualDir, 'full-page.png')
      if (item.id === 'activities') {
        const initiallySelected = await page.locator('.activity-directory .analytics-directory__item[aria-pressed="true"] .analytics-directory__label-text').innerText()
        expect(initiallySelected).toBe('SA设计')
        const lowerSummaryBefore = await page.locator('.activity-page-summary').innerText()
        const developmentDefinition = catalog.find((activity) => activity.name === '开发设计')
        const developmentMetricIds = (developmentDefinition?.metrics ?? []).map((metric) => String(metric.id)).sort()
        expect(developmentMetricIds.length).toBeGreaterThan(0)
        const requestStart = requests.length
        const developmentButton = page.getByRole('button', { name: '选择活动：开发设计' })
        await developmentButton.click()
        await expect(developmentButton).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByRole('heading', { name: '研发活动 / 开发设计' })).toBeVisible()
        await page.waitForLoadState('networkidle')
        await expect(page.locator('.activity-workspace')).not.toHaveAttribute('aria-busy', 'true')
        const selectionRequests = requests.slice(requestStart).filter((request) => request.route === 'activities' && request.path === '/api/compute')
        const requestedMetricIds = [...new Set(selectionRequests.map((request) => request.query.metric_id).filter(Boolean))].sort()
        expect(requestedMetricIds).toEqual(developmentMetricIds)
        const lowerSummaryAfter = await page.locator('.activity-page-summary').innerText()
        expect(lowerSummaryAfter).toBe(lowerSummaryBefore)
        await page.evaluate(() => {
          window.scrollTo(0, 0)
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        })
        const selectedStateGeometry = await page.evaluate(() => {
          const box = (element) => {
            if (!element) return null
            const { x, y, width, height } = element.getBoundingClientRect()
            return [x, y, width, height]
          }
          return {
            viewport: [innerWidth, innerHeight],
            selectedActivity: document.querySelector('.activity-directory .analytics-directory__item[aria-pressed="true"] .analytics-directory__label-text')?.innerText.trim() ?? '',
            pageTitle: document.querySelector('.analytics-page-head h1')?.innerText.trim() ?? '',
            directory: box(document.querySelector('.activity-directory')),
            upperGrid: box(document.querySelector('.activity-upper-grid')),
            monthKpis: box(document.querySelector('.activity-workspace > .analytics-section:nth-of-type(1)')),
            cycleKpis: box(document.querySelector('.activity-workspace > .analytics-section:nth-of-type(2)')),
            trendSection: box(document.querySelector('.activity-workspace > .analytics-section:nth-of-type(3)')),
            trendCards: [...document.querySelectorAll('.activity-trend-grid > *')].map(box),
            teamDifference: box(document.querySelector('.activity-team-matrix')),
            lowerGrid: box(document.querySelector('.activity-lower-grid')),
            trendTitles: [...document.querySelectorAll('.activity-trend-grid h2, .activity-trend-grid h3')].map((element) => element.innerText.trim()),
            monthlyKpiText: document.querySelector('.activity-workspace > .analytics-section:nth-of-type(1)')?.innerText ?? '',
            horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          }
        })
        expect(selectedStateGeometry.selectedActivity).toBe('开发设计')
        expect(selectedStateGeometry.pageTitle).toBe('研发活动 / 开发设计')
        expect(selectedStateGeometry.trendTitles).toEqual(expect.arrayContaining(['开发设计 · AI需求渗透率趋势', '开发设计 · AI研发提效趋势']))
        expect(selectedStateGeometry.monthlyKpiText).not.toContain('正在加载')
        expect(selectedStateGeometry.horizontalOverflowPx).toBe(0)
        await page.screenshot({ path: viewportScreenshot })
        await page.screenshot({ path: fullPageScreenshot, fullPage: true })
        activityReferenceState = {
          reference: 'docs/ux/reference/02-activity.png',
          selectedActivity: selectedStateGeometry.selectedActivity,
          priorDefaultSelection: initiallySelected,
          selectionMethod: 'pointer click on 选择活动：开发设计',
          selectedUrl: page.url(),
          requestedMetricIds,
          expectedMetricIds: developmentMetricIds,
          selectionRequests,
          selectedStateGeometry,
          lowerSummaryIndependent: true,
          viewportScreenshot,
          fullPageScreenshot,
          sameStateReferenceActualBoard: path.join(siblingPageBoardDir, `activities-${viewportName}-full-page-reference-actual.png`),
          screenshotMatchesSelectedState: true,
          restoreActivity: 'SA设计',
        }
        const defaultActivityButton = page.getByRole('button', { name: '选择活动：SA设计' })
        await defaultActivityButton.click()
        await expect(defaultActivityButton).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByRole('heading', { name: '研发活动 / SA设计' })).toBeVisible()
        await page.waitForLoadState('networkidle')
        expect(await page.locator('.activity-page-summary').innerText()).toBe(lowerSummaryBefore)
      } else {
        await page.screenshot({ path: viewportScreenshot })
        await page.screenshot({ path: fullPageScreenshot, fullPage: true })
      }
      const siblingReferences = {
        activities: 'docs/ux/reference/02-activity.png',
        capabilities: 'docs/ux/reference/03-capability.png',
        'team-detail': 'docs/ux/reference/04-team-detail.png',
      }
      const viewportReferenceActualBoard = await captureReferenceActualBoard(page.context(), {
        referencePath: path.resolve(siblingReferences[item.id]),
        actualPath: viewportScreenshot,
        outputPath: path.join(siblingPageBoardDir, `${item.id}-${viewportName}-viewport-reference-actual.png`),
        width: viewport.width,
        heading: `${item.id} · 首屏视觉对照`,
        note: '批准 Reference 与同档 Desktop 视口的真实 Chromium 截图并排；区块几何以 DOM 记录为准。',
      })
      const fullPageReferenceActualBoard = await captureReferenceActualBoard(page.context(), {
        referencePath: path.resolve(siblingReferences[item.id]),
        actualPath: fullPageScreenshot,
        outputPath: path.join(siblingPageBoardDir, `${item.id}-${viewportName}-full-page-reference-actual.png`),
        width: viewport.width,
        heading: `${item.id} · 完整页面视觉对照`,
        note: 'Reference 与固定 Golden 数据的真实 Chromium 页面并排；区块几何以 DOM 记录为准。',
      })
      if (item.id === 'activities') {
        const cropDir = path.join(actualDir, 'blocks')
        await mkdir(cropDir, { recursive: true })
        for (const [name, selector] of Object.entries({
          header: '.analytics-page-head',
          upperComposition: '.activity-upper-grid',
          directory: '.activity-directory',
          monthKpis: '.activity-workspace > .analytics-section:nth-of-type(1)',
          cycleKpis: '.activity-workspace > .analytics-section:nth-of-type(2)',
          trends: '.activity-workspace > .analytics-section:nth-of-type(3)',
          pageSummary: '.activity-page-summary',
          teamDifference: '.activity-team-matrix',
          lowerGrid: '.activity-lower-grid',
          coverage: '.activity-lower-grid > .analytics-panel:nth-child(1)',
          workload: '.activity-lower-grid > .analytics-panel:nth-child(2)',
          rawSummary: '.activity-lower-grid > .analytics-panel:nth-child(3)',
        })) {
          const element = page.locator(selector)
          if (await element.count()) await element.screenshot({ path: path.join(cropDir, `${name}.png`) })
        }
        const issueBoardDir = path.join(baselineDir, 'activity-r2-issues', viewportName)
        await mkdir(issueBoardDir, { recursive: true })
        const issueBoards = {}
        const issueReferences = {
          'UI-ACT-05-DIRECTORY-COMPOSITION-ICONS': ['docs/ux/reference-crops/activity-directory.png', 'directory'],
          'UI-ACT-06-LOWER-SUMMARY-SELECTION-INDEPENDENCE': ['docs/ux/reference-crops/activity-team-differences.png', 'teamDifference'],
          'UI-ACT-07-LOWER-ROW-HEIGHT-30PCT': ['docs/ux/reference-crops/activity-bottom-evidence.png', 'lowerGrid'],
          'UI-ACT-08-WORKLOAD-YOY-LINE': ['docs/ux/reference-crops/activity-bottom-workload.png', 'workload'],
          'UI-ACT-09-RAW-SUMMARY-SIX-SLOTS': ['docs/ux/reference-crops/activity-bottom-raw-summary.png', 'rawSummary'],
        }
        for (const [issueId, [referencePath, cropName]] of Object.entries(issueReferences)) {
          const actualPath = path.join(cropDir, `${cropName}.png`)
          const boardPath = path.join(issueBoardDir, `${issueId}-reference-actual.png`)
          await captureReferenceActualBoard(page.context(), {
            referencePath: path.resolve(referencePath),
            actualPath,
            outputPath: boardPath,
            width: viewport.width,
            heading: `${issueId} · ${viewportName}`,
            note: '同一浏览器状态下的批准 Reference 与真实 Chromium 区块截图；几何以 DOM rect 和 chart plot bounds 为准。',
          })
          issueBoards[issueId] = { reference: referencePath, actual: actualPath, board: boardPath }
        }
        activityR2IssueBoards = issueBoards
        activityR3Directory = path.join(baselineDir, 'activity-r3-issues', viewportName)
        await mkdir(activityR3Directory, { recursive: true })
        const activityR3References = {
          'UI-ACT-12-TEAM-DIFFERENCE-GROUPED-HEADERS': ['docs/ux/reference-crops/activity-team-differences.png', '.activity-team-matrix'],
          'UI-ACT-13-WORKLOAD-LEGEND-OVERLAP': ['docs/ux/reference-crops/activity-bottom-workload.png', '.activity-lower-grid > .analytics-panel:nth-child(2)'],
          'UI-ACT-14-RAW-SUMMARY-MONTHLY': ['docs/ux/reference-crops/activity-bottom-raw-summary.png', '.activity-lower-grid > .analytics-panel:nth-child(3)'],
        }
        for (const [issueId, [referencePath, selector]] of Object.entries(activityR3References)) {
          const actualPath = path.join(activityR3Directory, issueId + '-actual.png')
          const boardPath = path.join(activityR3Directory, issueId + '-reference-actual.png')
          await page.locator(selector).screenshot({ path: actualPath })
          await captureReferenceActualBoard(page.context(), {
            referencePath: path.resolve(referencePath),
            actualPath,
            outputPath: boardPath,
            width: viewport.width,
            heading: issueId + ' · ' + viewportName,
            note: '批准 Reference 与同一真实 Chromium 状态的区块截图；列头和绘图区另以 DOM 几何验证。',
          })
          activityR3IssueBoards[issueId] = { reference: referencePath, actual: actualPath, board: boardPath }
        }
        activityR3Geometry = await page.evaluate(() => {
          const rect = (element) => {
            if (!element) return null
            const box = element.getBoundingClientRect()
            return [box.x, box.y, box.width, box.height]
          }
          const matrix = document.querySelector('.activity-team-matrix .team-matrix__table')
          const groups = [...(matrix?.querySelectorAll('thead tr:first-child th[colspan="2"]') ?? [])]
          const subheaders = [...(matrix?.querySelectorAll('thead tr:nth-child(2) th') ?? [])]
          const firstRow = [...(matrix?.querySelectorAll('tbody tr:first-child td') ?? [])]
          const pairs = groups.map((group, index) => {
            const first = subheaders[index * 2]
            const second = subheaders[index * 2 + 1]
            const firstCell = firstRow[index * 2]
            const secondCell = firstRow[index * 2 + 1]
            const groupBox = group.getBoundingClientRect()
            const firstBox = first?.getBoundingClientRect()
            const secondBox = second?.getBoundingClientRect()
            return {
              label: group.innerText.trim(),
              group: rect(group),
              subheaders: [rect(first), rect(second)],
              bodyCells: [rect(firstCell), rect(secondCell)],
              groupCenterError: firstBox && secondBox ? Math.abs((groupBox.left + groupBox.right) / 2 - (firstBox.left + secondBox.right) / 2) : null,
              valueHeaderBodyLeftError: firstBox && firstCell ? Math.abs(firstBox.left - firstCell.getBoundingClientRect().left) : null,
              changeHeaderBodyLeftError: secondBox && secondCell ? Math.abs(secondBox.left - secondCell.getBoundingClientRect().left) : null,
              headerAlign: getComputedStyle(group).textAlign,
            }
          })
          const chart = document.querySelector('.activity-workload-chart .overview-chart')
          const chartBox = chart?.getBoundingClientRect()
          const plot = chart?.dataset.plotBounds?.split(',').map(Number)
          return {
            teamHeaders: [...(matrix?.querySelectorAll('thead tr:nth-child(2) th') ?? [])].map((element) => element.innerText.trim()),
            teamHeaderGeometry: pairs,
            teamColumnWidths: [...(matrix?.querySelectorAll('colgroup col') ?? [])].map((element) => getComputedStyle(element).width),
            workloadHost: rect(chart),
            workloadPlot: chartBox && plot?.length === 4 ? [chartBox.x + plot[0], chartBox.y + plot[1], plot[2], plot[3]] : null,
            workloadLegendBandTopPx: chartBox && plot?.length === 4 ? plot[1] : null,
            workloadAriaLabel: chart?.getAttribute('aria-label') ?? null,
            rawHeaders: [...(document.querySelectorAll('.activity-raw-summary-table thead th') ?? [])].map((element) => element.innerText.trim()),
            rawSummaryPanel: rect(document.querySelector('.activity-lower-grid > .analytics-panel:nth-child(3)')),
            rawSummaryTable: rect(document.querySelector('.activity-raw-summary-table')),
            rawSummaryLastRowBottom: document.querySelector('.activity-raw-summary-table tbody tr:last-child')?.getBoundingClientRect().bottom ?? null,
            rawRows: [...(document.querySelectorAll('.activity-raw-summary-table tbody tr') ?? [])].map((row) => ({
              label: row.cells[0]?.innerText.trim() ?? '',
              source: row.cells[0]?.dataset.source ?? '',
              sourceTitle: row.cells[0]?.title ?? '',
              accessibleName: row.cells[0]?.getAttribute('aria-label') ?? '',
              cells: [...row.cells].slice(1).map((cell) => cell.innerText.trim()),
              trendLabel: row.cells[4]?.querySelector('[aria-label]')?.getAttribute('aria-label') ?? null,
            })),
            rawSummaryLabel: document.querySelector('.activity-raw-summary-table')?.getAttribute('aria-label') ?? null,
          }
        })
        expect(activityR3Geometry.teamHeaders).toEqual(['指标值', '变化', '指标值', '变化', '指标值', '变化', '指标值', '变化'])
        expect(activityR3Geometry.teamHeaderGeometry).toHaveLength(4)
        expect(activityR3Geometry.teamHeaderGeometry.every((pair) => pair.groupCenterError <= 1.5 && pair.valueHeaderBodyLeftError <= 1.5 && pair.changeHeaderBodyLeftError <= 1.5 && pair.headerAlign === 'center')).toBe(true)
        expect(activityR3Geometry.workloadHost?.[3]).toBeGreaterThan(0)
        expect(activityR3Geometry.workloadPlot?.[3]).toBeGreaterThan(0)
        expect(activityR3Geometry.workloadLegendBandTopPx).toBeGreaterThanOrEqual(30)
        expect(activityR3Geometry.workloadAriaLabel).toContain('蓝色柱状图和同比增幅绿色曲线')
        expect(activityR3Geometry.rawHeaders).toEqual(['原始指标', '本月数值', '上月数值', '环比变化', '趋势'])
        expect(activityR3Geometry.rawRows.map((row) => row.label)).toEqual([
          'AI覆盖IR需求数', 'AI覆盖AR需求数', 'SE设计文档生成数', '开发详细设计生成数', '测试用例生成数', '测试用例执行数',
        ])
        expect(activityR3Geometry.rawRows.every((row) => row.sourceTitle === row.source && row.accessibleName.includes(row.source))).toBe(true)
        expect(activityR3Geometry.rawRows.every((row) => row.cells.length === 4)).toBe(true)
        expect(activityR3Geometry.rawSummaryLabel).toContain('月度摘要')
        expect(activityR3Geometry.rawSummaryLastRowBottom).toBeLessThanOrEqual(activityR3Geometry.rawSummaryPanel[1] + activityR3Geometry.rawSummaryPanel[3] + 1)
        await writeFile(path.join(activityR3Directory, 'geometry.json'), JSON.stringify(activityR3Geometry, null, 2), 'utf8')
        await writeFile(path.join(activityR3Directory, 'candidate-geometry.json'), JSON.stringify(activityR3Geometry, null, 2), 'utf8')

        activityR4Directory = path.join(baselineDir, 'activity-r4-issues', viewportName)
        await mkdir(activityR4Directory, { recursive: true })
        const activityR4References = {
          'UI-ACT-15-TEAM-DIFFERENCE-READABILITY-ALIGNMENT': ['docs/ux/reference-crops/activity-team-differences.png', '.activity-team-matrix'],
          'UI-ACT-16-RAW-SUMMARY-TYPOGRAPHY-ALIGNMENT': ['docs/ux/reference-crops/activity-bottom-raw-summary.png', '.activity-lower-grid > .analytics-panel:nth-child(3)'],
        }
        for (const [issueId, [referencePath, selector]] of Object.entries(activityR4References)) {
          const actualPath = path.join(activityR4Directory, issueId + '-actual.png')
          const boardPath = path.join(activityR4Directory, issueId + '-reference-actual.png')
          await page.locator(selector).screenshot({ path: actualPath })
          await captureReferenceActualBoard(page.context(), {
            referencePath: path.resolve(referencePath),
            actualPath,
            outputPath: boardPath,
            width: viewport.width,
            heading: issueId + ' · ' + viewportName,
            note: '批准 Reference 与同一真实 Chromium 状态的区块截图；字体和对齐以 DOM computed style 与 bounding box 验证。',
          })
          activityR4IssueBoards[issueId] = { reference: referencePath, actual: actualPath, board: boardPath }
        }

        const monthControl = page.getByRole('button', { name: '月份', exact: true })
        const monthDialog = page.getByRole('dialog', { name: '选择月份' })
        const cycleControl = page.getByRole('combobox', { name: '统计周期', exact: true })
        const monthRequestOffset = requests.length
        const monthArrow = page.locator('.activity-page-actions .analytics-filter-card--month .analytics-filter-card__month-trigger .anticon-down')
        await monthArrow.click()
        await expect(monthDialog).toBeVisible()
        await expect(monthControl).toHaveAttribute('aria-expanded', 'true')
        const monthDialogBoundsAtOpen = await monthDialog.boundingBox()
        const monthTriggerBoundsAtOpen = await monthControl.boundingBox()
        const viewportSize = page.viewportSize()
        expect(monthTriggerBoundsAtOpen).not.toBeNull()
        expect(monthDialogBoundsAtOpen).not.toBeNull()
        expect(monthDialogBoundsAtOpen.x).toBeGreaterThanOrEqual(0)
        expect(monthDialogBoundsAtOpen.y).toBeGreaterThanOrEqual(0)
        expect(monthDialogBoundsAtOpen.x + monthDialogBoundsAtOpen.width).toBeLessThanOrEqual(viewportSize.width)
        expect(monthDialogBoundsAtOpen.y + monthDialogBoundsAtOpen.height).toBeLessThanOrEqual(viewportSize.height)
        expect(monthDialogBoundsAtOpen.y).toBeGreaterThan(monthTriggerBoundsAtOpen.y)
        await expect(monthDialog.getByRole('button', { name: '9月', exact: true })).toBeFocused()
        const monthPointerOpenPath = path.join(activityR4Directory, 'UI-ACT-18-month-picker-pointer-open.png')
        await page.screenshot({ path: monthPointerOpenPath })
        await monthDialog.getByRole('button', { name: '10月', exact: true }).click()
        await expect(monthControl).toContainText('2026年10月')
        await expect(monthDialog).toBeHidden()
        await expect(page.getByRole('heading', { name: '月度核心成效 · 2026-10' })).toBeVisible()
        await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBeNull()
        expect(new URL(page.url()).searchParams.get('period')).toBe('2026-09')
        await page.waitForLoadState('networkidle')
        expect(requests.slice(monthRequestOffset).some((request) => request.route === 'activities' && request.path === '/api/data-metrics/overview' && request.query.to_month === '2026-10')).toBe(true)
        await page.evaluate(() => window.scrollTo(0, 0))
        const filterActualPath = path.join(activityR4Directory, 'UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE-actual.png')
        const filterBoardPath = path.join(activityR4Directory, 'UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE-reference-actual.png')
        const filterSelector = '.activity-page-actions .analytics-global-filter-toolbar'
        await page.locator('body').evaluate((body) => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        })
        const filterBox = await page.locator(filterSelector).boundingBox()
        const clipX = Math.max(0, Math.floor((filterBox?.x ?? 0) - 8))
        const clipY = Math.max(0, Math.floor((filterBox?.y ?? 0) - 8))
        await page.screenshot({
          path: filterActualPath,
          clip: {
            x: clipX,
            y: clipY,
            width: Math.min(viewportSize.width - clipX, Math.ceil((filterBox?.width ?? 1) + 16)),
            height: Math.min(viewportSize.height - clipY, Math.ceil((filterBox?.height ?? 1) + 16)),
          },
        })
        await captureReferenceActualBoard(page.context(), {
          referencePath: path.resolve('docs/ux/reference-crops/activity-header-filters.png'),
          actualPath: filterActualPath,
          outputPath: filterBoardPath,
          width: viewport.width,
          heading: 'UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE · ' + viewportName,
          note: '真实 Chromium 当前月为 2026-10；值应在标签右侧且完全可见。',
        })
        activityR4IssueBoards['UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE'] = {
          reference: 'docs/ux/reference-crops/activity-header-filters.png', actual: filterActualPath, board: filterBoardPath,
        }
        const activityR4FilterGeometry = await page.evaluate(() => {
          const box = (element) => {
            if (!element) return null
            const { x, y, width, height } = element.getBoundingClientRect()
            return [x, y, width, height]
          }
          return {
            scrollY: window.scrollY,
            analysisMonthParameter: new URL(location.href).searchParams.get('month'),
            rawFactPeriodParameter: new URL(location.href).searchParams.get('period'),
            visibleMonth: document.querySelector('.activity-page-actions .analytics-global-filter-toolbar .analytics-filter-card__month-trigger strong')?.textContent?.trim() ?? null,
            cards: [...document.querySelectorAll('.activity-page-actions .analytics-global-filter-toolbar .analytics-filter-card')].map((card) => {
              const label = card.querySelector('.analytics-filter-card__label')
              const value = card.querySelector('.analytics-filter-card__value')
              const labelBox = label?.getBoundingClientRect()
              const valueBox = value?.getBoundingClientRect()
              const cardStyle = getComputedStyle(card)
              return {
                card: box(card), label: box(label), value: box(value),
                display: cardStyle.display,
                flexDirection: cardStyle.flexDirection,
                rowCenterDelta: labelBox && valueBox ? Math.abs((labelBox.top + labelBox.bottom) / 2 - (valueBox.top + valueBox.bottom) / 2) : null,
                valueStartsAfterLabel: Boolean(labelBox && valueBox && valueBox.left >= labelBox.right - 1),
                valueText: value?.querySelector('.analytics-filter-card__month-trigger strong')?.textContent?.trim() ?? value?.querySelector('.ant-select')?.innerText?.trim() ?? '',
                valueScrollWidth: value?.scrollWidth ?? null,
                valueClientWidth: value?.clientWidth ?? null,
              }
            }),
            horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          }
        })
        const activityR5ChevronGeometry = await page.evaluate(() => [...document.querySelectorAll('.activity-page-actions .analytics-global-filter-toolbar .analytics-filter-card')].map((card) => {
          const monthTrigger = card.querySelector('button.analytics-filter-card__month-trigger')
          const trigger = monthTrigger ?? card.querySelector('.ant-select')
          const control = monthTrigger ?? card.querySelector('.ant-select')
          const accessibleTarget = trigger?.getAttribute('aria-label') ? trigger : trigger?.querySelector('[aria-label]') ?? trigger
          const arrow = trigger?.querySelector('.anticon-down')
          const rect = arrow?.getBoundingClientRect()
          const hitTarget = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null
          return {
            label: card.querySelector('.analytics-filter-card__label')?.innerText.trim() ?? '',
            controlTag: control?.tagName ?? '',
            trigger: trigger ? (() => { const r = trigger.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })() : null,
            arrow: rect ? [rect.x, rect.y, rect.width, rect.height] : null,
            arrowPointerEvents: arrow ? getComputedStyle(arrow).pointerEvents : null,
            hitTargetTag: hitTarget?.tagName ?? '',
            hitTargetClass: hitTarget?.getAttribute?.('class') ?? '',
            hitTestsTrigger: Boolean(trigger && hitTarget && (hitTarget === trigger || trigger.contains(hitTarget))),
            triggerAccessibleName: accessibleTarget?.getAttribute('aria-label') ?? '',
            expanded: accessibleTarget?.getAttribute('aria-expanded') ?? control?.getAttribute('aria-expanded') ?? '',
          }
        }))
        const activityR5IssueBoard = path.join(activityR4Directory, 'UI-ACT-18-ACTIVITY-FILTER-CHEVRON-NATIVE-OPEN-reference-actual.png')
        await captureReferenceActualBoard(page.context(), {
          referencePath: path.resolve('docs/ux/reference-crops/activity-header-filters.png'),
          actualPath: filterActualPath,
          outputPath: activityR5IssueBoard,
          width: viewport.width,
          heading: 'UI-ACT-18 · 活动页筛选箭头可操作 · ' + viewportName,
          note: '视觉构图与 UI-ACT-17 同一真实 Chromium 裁图；月份弹层和统计周期菜单的实际屏幕边界、焦点与提交行为由同目录 interaction-evidence 记录。',
        })
        const activityR5ArrowClickResults = []
        const periodMenuOpenPath = path.join(activityR4Directory, 'UI-ACT-18-statistical-period-pointer-open.png')
        for (let index = 0; index < activityR5ChevronGeometry.length; index += 1) {
          const geometry = activityR5ChevronGeometry[index]
          const arrow = geometry.arrow
          const control = index === 0 ? monthControl : cycleControl
          const trigger = index === 0
            ? page.locator('.activity-page-actions .analytics-filter-card__month-trigger')
            : page.locator('.activity-page-actions .ant-select-suffix')
          if (arrow) await page.mouse.click(arrow[0] + arrow[2] / 2, arrow[1] + arrow[3] / 2)
          if (index === 0) {
            await expect(monthDialog).toBeVisible()
            await expect(trigger).toHaveAttribute('aria-expanded', 'true')
            const bounds = await monthDialog.boundingBox()
            expect(bounds).not.toBeNull()
            expect(bounds.x).toBeGreaterThanOrEqual(0)
            expect(bounds.y).toBeGreaterThanOrEqual(0)
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewportSize.width)
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewportSize.height)
            expect(await page.evaluate(() => document.activeElement?.innerText?.trim())).toBe('10月')
            await page.screenshot({ path: monthPointerOpenPath })
            await page.keyboard.press('Escape')
            await expect(monthDialog).toBeHidden()
            await expect(trigger).toBeFocused()
            activityR5ArrowClickResults.push({ label: geometry.label, arrowCenterHitTargetInsideTrigger: true, popupBounds: bounds, popupInsideViewport: true, focusedSelectedMonth: '10月', closedByEscape: true, focusReturnedToTrigger: true, screenshot: monthPointerOpenPath })
          } else {
            await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
            await expect(page.locator('.ant-select-item-option').filter({ hasText: '本半年度' })).toBeVisible()
            const popupAssociation = await cycleControl.evaluate((input) => {
              const listboxId = input.getAttribute('aria-controls')
              const listbox = listboxId ? document.getElementById(listboxId) : null
              const option = [...document.querySelectorAll('.ant-select-item-option')].find((item) => item.innerText.includes('本半年度'))
              const popup = listbox?.closest('.ant-select-dropdown') ?? option?.closest('.ant-select-dropdown') ?? null
              const periodCard = [...document.querySelectorAll('.activity-page-actions .analytics-filter-card')].find((card) => card.querySelector('.analytics-filter-card__label')?.innerText.trim() === '统计周期')
              const rect = (element) => {
                if (!element) return null
                const { x, y, width, height } = element.getBoundingClientRect()
                return [x, y, width, height]
              }
              const cardSelect = periodCard?.querySelector('.analytics-filter-card__value > .ant-select')
              return { listboxId, periodCard: rect(periodCard), control: rect(cardSelect), focusedInput: rect(input), popup: rect(popup), popupContainer: rect(popup?.parentElement), popupContainerIsPeriodCard: Boolean(periodCard && popup?.parentElement === periodCard), allPeriodCards: [...document.querySelectorAll('.activity-page-actions .analytics-filter-card')].map((card) => ({ text: card.innerText.trim(), bounds: rect(card) })), optionBelongsToPopup: Boolean(popup && option && popup.contains(option)) }
            })
            const bounds = popupAssociation.popup && { x: popupAssociation.popup[0], y: popupAssociation.popup[1], width: popupAssociation.popup[2], height: popupAssociation.popup[3] }
            expect(bounds).not.toBeNull()
            expect(bounds.x).toBeGreaterThanOrEqual(0)
            expect(bounds.y).toBeGreaterThanOrEqual(0)
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewportSize.width)
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewportSize.height)
            expect(popupAssociation.optionBelongsToPopup).toBe(true)
              expect(popupAssociation.popupContainerIsPeriodCard).toBe(true)
            expect(popupAssociation.allPeriodCards.map((card) => card.bounds)).toEqual(activityR4FilterGeometry.cards.map((card) => card.card))
            expect(Math.abs(bounds.x - popupAssociation.control[0])).toBeLessThanOrEqual(8)
            expect(bounds.y).toBeGreaterThanOrEqual(popupAssociation.control[1] + popupAssociation.control[3] - 1)
            expect(bounds.y).toBeLessThanOrEqual(popupAssociation.control[1] + popupAssociation.control[3] + 32)
            await expect(cycleControl).toBeFocused()
            await page.screenshot({ path: periodMenuOpenPath })
            await page.keyboard.press('Escape')
            await expect(cycleControl).toHaveAttribute('aria-expanded', 'false')
            await expect(cycleControl).toBeFocused()
            activityR5ArrowClickResults.push({ label: geometry.label, arrowCenterHitTargetInsideTrigger: true, popupBounds: bounds, popupAssociation, popupInsideViewport: true, focusedControl: '统计周期 combobox', closedByEscape: true, focusRetained: true, screenshot: periodMenuOpenPath })
          }
        }
        expect(activityR5ChevronGeometry.every((control) => control.hitTestsTrigger && control.triggerAccessibleName)).toBe(true)
        expect(activityR5ArrowClickResults).toHaveLength(2)
        const monthUrlAtOctober = page.url()
        const monthRequestAtOctober = requests.slice(monthRequestOffset).filter((request) => request.route === 'activities' && request.path === '/api/data-metrics/overview' && request.query.to_month === '2026-10').at(-1) ?? null
        await Promise.all(irOverviewResponseReads)
        const monthResponseAtOctober = irOverviewResponses.filter((response) => response.route === 'activities' && response.status === 200 && response.query.to_month === '2026-10').at(-1) ?? null
        expect(monthResponseAtOctober?.payload?.period_ids).toContain('2026-10')

        await monthControl.focus()
        const monthFocusedBeforeTab = await monthControl.evaluate((element) => element === document.activeElement)
        const monthTabFocusPath = []
        for (let tab = 0; tab < 6; tab += 1) {
          await page.keyboard.press('Tab')
          monthTabFocusPath.push(await page.evaluate(() => {
            const active = document.activeElement
            return { tag: active?.tagName ?? '', label: active?.getAttribute?.('aria-label') ?? '', text: active?.innerText?.trim?.() ?? '' }
          }))
          if (await cycleControl.evaluate((element) => element === document.activeElement)) break
        }
        const statisticalPeriodFocusedByTab = await cycleControl.evaluate((element) => element === document.activeElement)
        expect(statisticalPeriodFocusedByTab).toBe(true)
        const cycleValue = page.locator('.activity-page-actions .analytics-filter-card__value .ant-select')
        const cycleSection = page.locator('.activity-workspace > .analytics-section:nth-of-type(2)')
        await expect(cycleSection).not.toContainText('…')
        const cycleBeforePointer = await cycleValue.innerText()
        const periodHeadingBeforeKeyboard = await cycleSection.innerText()
        const rawSummaryBeforeKeyboard = await page.locator('.activity-raw-summary-table tbody tr').evaluateAll((rows) => rows.map((row) => [row.cells[0]?.innerText.trim() ?? '', ...[...row.cells].slice(1).map((cell) => cell.innerText.trim())]))
        const cycleRequestOffset = requests.length
        await page.locator('.activity-page-actions .ant-select-suffix').click()
        await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
        await expect(cycleControl).toBeFocused()
        await expect(page.locator('.ant-select-item-option').filter({ hasText: '年度累计' })).toBeVisible()
        await page.locator('.ant-select-item-option').filter({ hasText: '年度累计' }).click()
        await expect(cycleValue).toHaveText('年度累计')
        await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('year')
        await page.waitForLoadState('networkidle')
        const cycleUrlAfterPointer = page.url()
        await expect(cycleSection).not.toContainText('…')
        const periodHeadingAfterPointer = await cycleSection.innerText()
        const rawSummaryAfterPointer = await page.locator('.activity-raw-summary-table tbody tr').evaluateAll((rows) => rows.map((row) => [row.cells[0]?.innerText.trim() ?? '', ...[...row.cells].slice(1).map((cell) => cell.innerText.trim())]))
        const cycleAfterPointer = await cycleValue.innerText()
        expect(cycleBeforePointer).toBe('本半年度')
        expect(periodHeadingAfterPointer).not.toBe(periodHeadingBeforeKeyboard)
        expect(rawSummaryAfterPointer).toEqual(rawSummaryBeforeKeyboard)
        await cycleControl.press('Enter')
        await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
        await cycleControl.press('ArrowUp')
        await expect(page.locator('.ant-select-item-option-active')).toContainText('本半年度')
        await cycleControl.press('Enter')
        await expect(cycleValue).toHaveText('本半年度')
        await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('half')
        await page.waitForLoadState('networkidle')
        await expect.poll(() => cycleSection.innerText(), { timeout: 30_000 }).toBe(periodHeadingBeforeKeyboard)
        const periodHeadingAfterKeyboard = await cycleSection.innerText()
        const rawSummaryAfterKeyboard = await page.locator('.activity-raw-summary-table tbody tr').evaluateAll((rows) => rows.map((row) => [row.cells[0]?.innerText.trim() ?? '', ...[...row.cells].slice(1).map((cell) => cell.innerText.trim())]))
        const cycleRequests = requests.slice(cycleRequestOffset).filter((request) => request.route === 'activities')
        const cycleKeyboardFocusStayed = await cycleControl.evaluate((element) => element === document.activeElement)
        expect(periodHeadingAfterKeyboard).toEqual(periodHeadingBeforeKeyboard)
        expect(rawSummaryAfterKeyboard).toEqual(rawSummaryBeforeKeyboard)
        activityR4FilterInteractions = {
          initialUrl: item.url,
          month: {
            selectedBy: 'pointer on visible Month chevron then month button',
            visibleValueAtOctober: '2026年10月',
            urlDuringOctober: monthUrlAtOctober,
            urlMonthParameter: new URL(monthUrlAtOctober).searchParams.get('month'),
            request: monthRequestAtOctober,
            responsePeriodIds: monthResponseAtOctober.payload.period_ids,
            pageHeading: await page.getByRole('heading', { name: '月度核心成效 · 2026-10' }).innerText(),
          },
          keyboardFocus: {
            monthFocusedBeforeTab,
            tabPathFromMonth: monthTabFocusPath,
            tabFromMonthFocusedStatisticalPeriod: statisticalPeriodFocusedByTab,
          },
          statisticalPeriod: {
            pointerSelected: { before: cycleBeforePointer, after: cycleAfterPointer, urlDuringYear: cycleUrlAfterPointer, periodHeadingBefore: periodHeadingBeforeKeyboard, periodHeadingAfter: periodHeadingAfterPointer },
            keyboardSelected: { before: cycleAfterPointer, after: await cycleValue.innerText(), urlRestoredToHalf: new URL(page.url()).searchParams.get('cycle') === 'half',
            periodHeadingBefore: periodHeadingBeforeKeyboard,
            periodHeadingAfter: periodHeadingAfterKeyboard,
            activityRequests: cycleRequests,
            monthlyRawSummaryUnchanged: JSON.stringify(rawSummaryAfterKeyboard) === JSON.stringify(rawSummaryBeforeKeyboard) },
          },
        }
        await writeFile(path.join(activityR4Directory, 'filter-interaction-evidence.json'), JSON.stringify(activityR4FilterInteractions, null, 2), 'utf8')

        await monthControl.focus()
        await monthControl.press('Enter')
        await expect(monthDialog).toBeVisible()
        await expect(monthDialog.getByRole('button', { name: '10月', exact: true })).toBeFocused()
        await page.keyboard.press('ArrowLeft')
        await expect(monthDialog.getByRole('button', { name: '9月', exact: true })).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(monthControl).toContainText('2026年9月')
        await expect(page.getByRole('heading', { name: '月度核心成效 · 2026-09' })).toBeVisible()
        await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBe('2026-09')
        await page.waitForLoadState('networkidle')

        activityR5FilterChevronEvidence = {
          issueId: 'UI-ACT-18-ACTIVITY-FILTER-CHEVRON-NATIVE-OPEN',
          reference: 'docs/ux/reference-crops/activity-header-filters.png',
          viewport: viewportName,
          geometry: activityR5ChevronGeometry,
          pointerClicks: activityR5ArrowClickResults,
          keyboard: {
            month: { openedByEnter: true, movedMonthWithArrowKey: true, selected: '2026-09', focusReturnedToTrigger: await monthControl.evaluate((element) => element === document.activeElement) },
            statisticalPeriod: { openedByEnter: true, movedOptionWithArrowKey: true, selectedByEnter: '本半年度', focusStayedOnCombobox: cycleKeyboardFocusStayed },
          },
          urlRequestAndData: activityR4FilterInteractions,
          screenshots: { monthPickerPointerOpen: monthPointerOpenPath, periodMenuPointerOpen: periodMenuOpenPath, closedReferenceActualBoard: activityR5IssueBoard },
          status: 'IMPLEMENTATION_CANDIDATE_PENDING_INDEPENDENT_REVIEW',
        }
        await writeFile(path.join(activityR4Directory, 'UI-ACT-18-filter-chevron-interaction-evidence.json'), JSON.stringify(activityR5FilterChevronEvidence, null, 2), 'utf8')

        const activityR4TeamChangeCells = page.locator('.activity-team-matrix .team-matrix__table td.team-matrix__change')
        await expect.poll(async () => activityR4TeamChangeCells.evaluateAll((cells) => ({
          cellCount: cells.length,
          hasPositive: cells.some((cell) => cell.classList.contains('team-matrix__change--positive')),
          hasNegative: cells.some((cell) => cell.classList.contains('team-matrix__change--negative')),
        })), { timeout: 30_000 }).toEqual({ cellCount: 20, hasPositive: true, hasNegative: true })

        activityR4Geometry = await page.evaluate((filterLayoutAtOctober) => {
          const rect = (element) => {
            if (!element) return null
            const { x, y, width, height } = element.getBoundingClientRect()
            return [x, y, width, height]
          }
          const textRect = (element) => {
            if (!element) return null
            const range = document.createRange()
            range.selectNodeContents(element)
            const { x, y, width, height } = range.getBoundingClientRect()
            return [x, y, width, height]
          }
          const matrix = document.querySelector('.activity-team-matrix .team-matrix__table')
          const groupHeaders = [...(matrix?.querySelectorAll('thead tr:first-child th[colspan="2"]') ?? [])].map((cell) => {
            const label = cell.querySelector('span')
            const cellBox = cell.getBoundingClientRect()
            const labelBox = label?.getBoundingClientRect()
            const textBox = textRect(label)
            const style = getComputedStyle(cell)
            return {
              label: label?.innerText.trim() ?? '', box: rect(cell), text: textBox,
              fontSizePx: parseFloat(style.fontSize), lineHeightPx: parseFloat(style.lineHeight),
              textAlign: style.textAlign,
              textFitsCell: Boolean(labelBox && textBox && textBox[1] >= cellBox.top && textBox[1] + textBox[3] <= cellBox.bottom && labelBox.width <= cellBox.width),
            }
          })
          const subheaders = [...(matrix?.querySelectorAll('thead tr:nth-child(2) th') ?? [])].map((cell) => {
            const style = getComputedStyle(cell)
            return { label: cell.innerText.trim(), box: rect(cell), fontSizePx: parseFloat(style.fontSize), lineHeightPx: parseFloat(style.lineHeight), textAlign: style.textAlign }
          })
          const teamValues = [...(matrix?.querySelectorAll('tbody td.team-matrix__value') ?? [])].map((cell) => ({ text: cell.innerText.trim(), textAlign: getComputedStyle(cell).textAlign, fontSizePx: parseFloat(getComputedStyle(cell).fontSize) }))
          const teamChanges = [...(matrix?.querySelectorAll('tbody td.team-matrix__change') ?? [])].map((cell) => ({
            text: cell.innerText.trim(), textAlign: getComputedStyle(cell).textAlign, fontSizePx: parseFloat(getComputedStyle(cell).fontSize),
            tone: [...cell.classList].find((name) => name.startsWith('team-matrix__change--'))?.replace('team-matrix__change--', '') ?? 'unstyled',
            color: getComputedStyle(cell).color,
          }))
          const toneColor = (tone) => {
            const sample = document.createElement('span')
            sample.className = `team-matrix__change team-matrix__change--${tone}`
            document.body.appendChild(sample)
            const color = getComputedStyle(sample).color
            sample.remove()
            return color
          }
          const rawTable = document.querySelector('.activity-raw-summary-table')
          const rawVisibleText = [
            ...(rawTable?.querySelectorAll('thead th, tbody th, tbody td') ?? []),
          ].map((cell) => ({ text: cell.innerText.trim(), fontSizePx: parseFloat(getComputedStyle(cell).fontSize), textAlign: getComputedStyle(cell).textAlign }))
          const rawDataCells = [...(rawTable?.querySelectorAll('tbody tr') ?? [])].flatMap((row) => [...row.cells].slice(1).map((cell) => ({ text: cell.innerText.trim(), textAlign: getComputedStyle(cell).textAlign })))
          return {
            viewport: [innerWidth, innerHeight],
            teamGroupHeaders: groupHeaders,
            teamSubheaders: subheaders,
            teamValues,
            teamChanges,
            toneRuleColors: { positive: toneColor('positive'), negative: toneColor('negative'), neutral: toneColor('neutral') },
            rawVisibleText,
            rawDataCells,
            filterLayoutAtOctober,
            horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          }
        }, activityR4FilterGeometry)
        await writeFile(path.join(activityR4Directory, 'geometry.json'), JSON.stringify(activityR4Geometry, null, 2), 'utf8')
        await writeFile(path.join(activityR4Directory, 'filter-geometry.json'), JSON.stringify(activityR4FilterGeometry, null, 2), 'utf8')
        expect.soft(activityR4Geometry.teamGroupHeaders.every((header) => header.fontSizePx >= 13 && header.textFitsCell)).toBe(true)
        expect.soft(activityR4Geometry.teamSubheaders.every((header) => header.fontSizePx >= 12 && header.textAlign === 'center')).toBe(true)
        expect.soft(activityR4Geometry.teamValues.every((cell) => cell.textAlign === 'center')).toBe(true)
        expect.soft(activityR4Geometry.teamChanges.every((cell) => cell.textAlign === 'center')).toBe(true)
        expect.soft(activityR4Geometry.teamChanges.some((cell) => cell.tone === 'positive')).toBe(true)
        expect.soft(activityR4Geometry.teamChanges.some((cell) => cell.tone === 'negative')).toBe(true)
        expect.soft(activityR4Geometry.teamChanges.filter((cell) => cell.tone === 'positive').every((cell) => cell.color === activityR4Geometry.toneRuleColors.positive)).toBe(true)
        expect.soft(activityR4Geometry.teamChanges.filter((cell) => cell.tone === 'negative').every((cell) => cell.color === activityR4Geometry.toneRuleColors.negative)).toBe(true)
        expect.soft(activityR4Geometry.rawVisibleText.every((cell) => cell.fontSizePx >= 12)).toBe(true)
        expect.soft(activityR4Geometry.rawDataCells.every((cell) => cell.textAlign === 'center')).toBe(true)
        expect.soft(activityR4FilterGeometry.cards).toHaveLength(2)
        expect.soft(activityR4FilterGeometry.scrollY).toBe(0)
        expect.soft(activityR4FilterGeometry.cards.every((card) => card.flexDirection === 'row' && card.card[1] >= -1 && card.valueStartsAfterLabel && card.rowCenterDelta <= 1 && card.card[3] <= 48 && card.valueScrollWidth <= card.valueClientWidth + 1)).toBe(true)
        expect.soft(activityR4FilterGeometry.horizontalOverflowPx).toBe(0)
        expect.soft(activityR4Geometry.horizontalOverflowPx).toBe(0)
        await page.evaluate(() => window.scrollTo(0, 0))
      }
      const geometry = await page.evaluate(() => {
        const box = (element) => {
          if (!element) return null
          const { x, y, width, height } = element.getBoundingClientRect()
          return [x, y, width, height]
        }
        const rects = (selector) => [...document.querySelectorAll(selector)].map(box)
        const plotBoxes = (selector) => [...document.querySelectorAll(selector)].map((element) => {
          const bounds = element.dataset.plotBounds?.split(',').map(Number)
          if (!bounds || bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) return null
          const host = element.getBoundingClientRect()
          return [host.x + bounds[0], host.y + bounds[1], bounds[2], bounds[3]]
        })
        const type = (element) => {
          if (!element) return null
          const style = getComputedStyle(element)
          return { fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight }
        }
        const filterSelector = '.analytics-filter-card, .overview-filter-card'
        return {
          viewport: [innerWidth, innerHeight],
          document: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
          horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          pageHeader: box(document.querySelector('.analytics-page-head, .drilldown-page-head')),
          pageRoot: box(document.querySelector('.analytics-page, .drilldown-shell')),
          filters: rects(filterSelector),
          filterLabels: [...document.querySelectorAll('.analytics-filter-card__label, .overview-filter-card__copy small')].map((element) => element.innerText.trim()),
          sections: rects('.analytics-section, .analytics-panel'),
          charts: rects('.overview-chart, .analytics-chart-card__plot-state'),
          chartPlots: plotBoxes('.activity-trend-grid [data-plot-bounds], .activity-lower-grid [data-plot-bounds]'),
          tables: rects('.team-matrix__table, .maturity-matrix__table'),
          activityBlocks: {
            filterActions: box(document.querySelector('.activity-page-actions')),
            upperGrid: box(document.querySelector('.activity-upper-grid')),
            directory: box(document.querySelector('.activity-directory')),
            directoryBottom: document.querySelector('.activity-directory') ? document.querySelector('.activity-directory').getBoundingClientRect().bottom : null,
            coreTrendsBottom: document.querySelector('.activity-workspace > .analytics-section:nth-of-type(3)') ? document.querySelector('.activity-workspace > .analytics-section:nth-of-type(3)').getBoundingClientRect().bottom : null,
            directoryItems: [...document.querySelectorAll('.activity-directory .analytics-directory__item')].map((element) => ({
              label: element.querySelector('.analytics-directory__label-text')?.textContent.trim() ?? '',
              buttonAccessibleName: element.getAttribute('aria-label'),
              iconCount: element.querySelectorAll('.analytics-directory__icon[aria-hidden="true"] svg').length,
              iconAriaHidden: element.querySelector('.analytics-directory__icon')?.getAttribute('aria-hidden') ?? null,
              selected: element.getAttribute('aria-pressed') === 'true',
            })),
            workspace: box(document.querySelector('.activity-workspace')),
            outcomeRows: rects('.activity-outcome-grid'),
            trends: box(document.querySelector('.activity-trend-grid')),
            pageSummary: box(document.querySelector('.activity-page-summary')),
            lowerPanels: rects('.activity-lower-grid > .analytics-panel'),
            lowerPanelHeights: rects('.activity-lower-grid > .analytics-panel').map((bounds) => bounds?.[3] ?? null),
            lowerChartHosts: rects('.activity-lower-grid .overview-chart'),
            workloadChartLabel: document.querySelector('.activity-lower-grid > .analytics-panel:nth-child(2) .overview-chart')?.getAttribute('aria-label') ?? null,
            rawSummaryTable: box(document.querySelector('.activity-raw-summary-table')),
            rawSummaryRows: [...(document.querySelector('.activity-raw-summary-table')?.tBodies?.[0]?.rows ?? [])].map((row) => ({ box: box(row), label: row.cells[0]?.innerText.trim() ?? '', value: row.cells[1]?.innerText.trim(), source: row.cells[0]?.dataset.source ?? '' })),
            teamDifferenceSurface: box(document.querySelector('.activity-team-matrix__surface')),
            teamDifferenceTable: box(document.querySelector('.activity-team-matrix .team-matrix__table')),
            teamDifferenceRows: rects('.activity-team-matrix .team-matrix__table tr'),
            teamDifference: box(document.querySelector('.activity-team-matrix')),
            lowerGrid: box(document.querySelector('.activity-lower-grid')),
            lowerPanels: rects('.activity-lower-grid > .analytics-panel'),
            pageTitleType: type(document.querySelector('.analytics-page-head h1')),
            sectionTitleTypes: [...document.querySelectorAll('.activity-workspace .analytics-section__header h2, .activity-workspace .analytics-panel__header h2')].map(type),
          },
          capabilityBlocks: {
            filterActions: box(document.querySelector('.capability-page-actions')),
            directory: box(document.querySelector('.capability-directory-workspace > .analytics-directory')),
            directoryClassName: document.querySelector('.capability-directory-workspace > .analytics-directory')?.className ?? null,
            directoryItemCount: document.querySelectorAll('.capability-directory-workspace > .analytics-directory .analytics-directory__item').length,
            directoryIconCount: document.querySelectorAll('.capability-directory-workspace > .analytics-directory .analytics-directory__icon').length,
            workspace: box(document.querySelector('.capability-directory-workspace > .analytics-workspace')),
            statusSection: box(document.querySelector('.capability-kpi-grid')?.closest('.analytics-section')),
            statusGrid: box(document.querySelector('.capability-kpi-grid')),
            statusCards: rects('.capability-kpi-grid > .metric-card'),
            statusMetricLabels: [...document.querySelectorAll('.capability-kpi-grid .metric-card__label')].map((element) => element.innerText.trim()),
            evolutionSection: box(document.querySelector('.capability-evolution-grid')?.closest('.analytics-section')),
            evolutionGrid: box(document.querySelector('.capability-evolution-grid')),
            evolutionCards: rects('.capability-evolution-grid > *'),
            evolutionHosts: rects('.capability-evolution-grid .analytics-chart-card__plot-state'),
            evolutionTitles: [...document.querySelectorAll('.capability-evolution-grid h2, .capability-evolution-grid h3')].map((element) => element.innerText.trim()),
            evolutionPlots: plotBoxes('.capability-evolution-grid [data-plot-bounds]'),
            comparisonGrid: box(document.querySelector('.capability-comparison-grid')),
            teamDifference: box(document.querySelector('.capability-comparison-grid > .analytics-panel')),
            teamTable: box(document.querySelector('.capability-comparison-grid .team-matrix__table')),
            teamMatrixClassName: document.querySelector('.capability-comparison-grid .team-matrix')?.className ?? null,
            teamDifferenceHeaders: [...document.querySelectorAll('.capability-comparison-grid .team-matrix__table thead th')].map((element) => element.innerText.trim()),
            teamHeatmapCells: [...document.querySelectorAll('.capability-comparison-grid .team-matrix__table tbody td')].map((element) => ({ columnLabel: element.closest('table')?.tHead?.rows[0]?.cells[element.cellIndex]?.innerText.trim() ?? null, text: element.innerText.trim(), level: element.dataset.heatmapLevel ?? null, background: getComputedStyle(element).backgroundColor, className: element.className })),
            evidenceGrid: box(document.querySelector('.capability-evidence-grid')),
            evidenceCards: rects('.capability-evidence-card'),
            maturitySection: box(document.querySelector('.analytics-maturity-summary')?.closest('.analytics-section')),
            pageEndGapPx: (() => {
              const section = document.querySelector('.analytics-maturity-summary')?.closest('.analytics-section')
              if (!section) return null
              return Number((document.documentElement.scrollHeight - (section.getBoundingClientRect().bottom + window.scrollY)).toFixed(2))
            })(),
            maturitySummary: box(document.querySelector('.analytics-maturity-summary')),
            maturityMatrix: box(document.querySelector('.analytics-maturity-summary__matrix')),
            maturityTable: box(document.querySelector('.analytics-maturity-summary__matrix .maturity-matrix__table')),
            maturityRows: rects('.analytics-maturity-summary__matrix .maturity-matrix__table tbody tr'),
            maturityAxes: [...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table tbody th[scope="row"]')].map((element) => element.innerText.trim()),
            maturityColumns: [...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table thead th')].map((element) => element.innerText.trim()).slice(1),
            maturityCells: [...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table tbody td')].map((element) => ({ text: element.innerText.trim(), className: element.className, background: getComputedStyle(element).backgroundColor })),
            maturityCellColors: [...new Set([...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table tbody td')].map((element) => getComputedStyle(element).backgroundColor))],
            maturityCellEvidence: [...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table tbody td')].map((element) => ({ text: element.innerText.trim(), className: element.className, background: getComputedStyle(element).backgroundColor })),
            maturityRadarPanel: box(document.querySelector('.analytics-maturity-summary__radar')),
            maturityRadar: box(document.querySelector('.analytics-maturity-summary__radar .maturity-radar')),
            maturityRadarSvg: box(document.querySelector('.analytics-maturity-summary__radar .maturity-radar svg')),
            maturityRadarSeriesBounds: [...document.querySelectorAll('.analytics-maturity-summary__radar .maturity-radar__series')].map((element) => {
              const bounds = element.getBBox()
              return [bounds.x, bounds.y, bounds.width, bounds.height]
            }),
            maturityRadarSeriesBoundsPx: [...document.querySelectorAll('.analytics-maturity-summary__radar .maturity-radar__series')].map((element) => {
              const bounds = element.getBBox()
              const svg = element.ownerSVGElement
              const svgBounds = svg.getBoundingClientRect()
              const viewBox = svg.viewBox.baseVal
              return [bounds.width * svgBounds.width / viewBox.width, bounds.height * svgBounds.height / viewBox.height]
            }),
            maturityRadarAxisLabelBounds: [...document.querySelectorAll('.analytics-maturity-summary__radar .maturity-radar__axes text')].map((element) => {
              const bounds = element.getBoundingClientRect()
              return { label: element.textContent.trim(), x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, fontSize: getComputedStyle(element).fontSize }
            }),
            maturityRadarViewBox: document.querySelector('.analytics-maturity-summary__radar .maturity-radar svg')?.getAttribute('viewBox') ?? null,
            maturityRadarSeries: [...document.querySelectorAll('.analytics-maturity-summary__radar .maturity-radar__series')].map((element) => ({ name: element.dataset.seriesName, complete: element.dataset.seriesComplete, points: element.querySelectorAll('circle').length })),
            versionControlCount: document.querySelectorAll('.capability-page-actions [aria-label="版本"]').length,
          },
          pageTitle: document.querySelector('h1')?.innerText ?? null,
        }
      })
      const interactions = {}
      let activityStateEvidence = []
      let activityTransientStateEvidence = {}
      let capabilityStateEvidence = []
      let capabilityTransientStateEvidence = {}
      if (item.id === 'activities') {
        await writeFile(path.join(actualDir, 'geometry.json'), JSON.stringify(geometry, null, 2), 'utf8')
        const lowerGrid = geometry.activityBlocks.lowerGrid
        const expectedPanelHeight = geometry.viewport[1] === 1440 ? 313 : 226
        const panelHeightTolerance = 4
        expect(geometry.activityBlocks.lowerPanelHeights).toHaveLength(3)
        expect(geometry.activityBlocks.lowerPanelHeights.every((height) => Math.abs(height - expectedPanelHeight) <= panelHeightTolerance)).toBe(true)
        expect(geometry.activityBlocks.directoryItems).toHaveLength(8)
        expect(geometry.activityBlocks.directoryItems.every((item) => item.iconCount === 1)).toBe(true)
        expect(geometry.activityBlocks.directoryItems.every((item) => item.iconAriaHidden === 'true')).toBe(true)
        expect(geometry.activityBlocks.directoryItems.every((item) => item.buttonAccessibleName === `选择活动：${item.label}`)).toBe(true)
        expect(Math.abs(geometry.activityBlocks.directoryBottom - geometry.activityBlocks.coreTrendsBottom)).toBeLessThanOrEqual(8)
        expect(geometry.activityBlocks.rawSummaryRows.map((row) => row.label)).toEqual([
          'AI覆盖IR需求数', 'AI覆盖AR需求数', 'SE设计文档生成数', '开发详细设计生成数', '测试用例生成数', '测试用例执行数',
        ])
        expect(geometry.activityBlocks.rawSummaryRows).toHaveLength(6)
        expect(geometry.activityBlocks.rawSummaryRows.slice(1, 4).every((row) => row.value === '未配置')).toBe(true)
        expect(geometry.activityBlocks.rawSummaryRows[4].source).toContain('tcg-rate')
        expect(geometry.activityBlocks.rawSummaryRows[5].source).toContain('tce-count')
        expect(geometry.activityBlocks.workloadChartLabel).toContain('蓝色柱状图和同比增幅绿色曲线')
        expect(geometry.activityBlocks.workloadChartLabel).toContain('2026-07 工作量 20，同比 缺失')
        expect(geometry.activityBlocks.workloadChartLabel).toContain('2026-09 工作量 20，同比 缺失')
        expect(geometry.activityBlocks.workloadChartLabel).toMatch(/2026-08 工作量 15，同比 -?\d/)
        await Promise.all(irOverviewResponseReads)
        const activityIrReads = irOverviewResponses.filter((item) => item.route === 'activities' && item.status === 200)
        const currentIrRead = activityIrReads.find((item) => item.query.from_month === '2026-04' && item.query.to_month === '2026-09')
        const priorIrRead = activityIrReads.find((item) => item.query.from_month === '2025-04' && item.query.to_month === '2025-09')
        expect(currentIrRead).toBeTruthy()
        expect(priorIrRead).toBeTruthy()
        const priorDomain = priorIrRead.payload.domain_summary ?? []
        const priorZeroMonth = priorDomain.find((point) => point.period_id === '2025-07')
        const priorMissingMonth = priorDomain.find((point) => point.period_id === '2025-09')
        expect(priorZeroMonth?.ai_workload_count).toBeGreaterThan(0)
        expect(priorZeroMonth?.ai_estimated_workload).toBe(priorZeroMonth?.ai_actual_workload)
        expect(priorMissingMonth?.ai_workload_count ?? 0).toBe(0)
        interactions.activityWorkloadYoY = {
          currentRequest: { fromMonth: currentIrRead.query.from_month, toMonth: currentIrRead.query.to_month },
          priorYearRequest: { fromMonth: priorIrRead.query.from_month, toMonth: priorIrRead.query.to_month },
          zeroPriorMonth: { period: '2025-07', workloadCount: priorZeroMonth.ai_workload_count, estimated: priorZeroMonth.ai_estimated_workload, actual: priorZeroMonth.ai_actual_workload, displayedAt: '2026-07同比缺失' },
          missingPriorMonth: { period: '2025-09', workloadCount: priorMissingMonth?.ai_workload_count ?? 0, displayedAt: '2026-09同比缺失' },
          populatedComparisonMonth: '2026-08',
        }
        if (geometry.viewport[1] === 1440) {
          const pageEndSpace = geometry.document[2] - lowerGrid[1] - lowerGrid[3]
          expect(pageEndSpace).toBeLessThanOrEqual(43.2)
        }
        const plottedBounds = (geometry.chartPlots ?? []).filter((bounds) => bounds && bounds[2] > 0 && bounds[3] > 0)
        expect(plottedBounds.length).toBeGreaterThanOrEqual(3)
        expect((geometry.chartPlots ?? []).filter(Boolean).every((bounds) => bounds[2] > 0 && bounds[3] > 0)).toBe(true)
        const versionControlCount = await page.getByRole('combobox', { name: '版本' }).count()
        const advanced = page.locator('.activity-page-actions details')
        if (!await advanced.evaluate((element) => element.open)) await advanced.locator('summary').click()
        const dimensionGroupCount = await page.getByRole('group', { name: '统计维度' }).count()
        const iterationButtonCount = await page.getByRole('button', { name: '按版本/迭代' }).count()
        const normalizedUrl = new URL(page.url())
        const activityRequests = requests.slice(pageRequestStart).filter((request) => request.route === 'activities')
        const forbiddenVersionRequests = activityRequests.filter((request) => request.query.version_id && request.query.version_id !== 'all')
        const iterationRequests = activityRequests.filter((request) => request.query.dimension === 'iteration' || request.query.dim === 'iteration')
        expect(versionControlCount).toBe(0)
        expect(dimensionGroupCount).toBe(0)
        expect(iterationButtonCount).toBe(0)
        expect(normalizedUrl.searchParams.has('version')).toBe(false)
        expect(normalizedUrl.searchParams.get('dimension')).not.toBe('iteration')
        expect(forbiddenVersionRequests).toHaveLength(0)
        expect(iterationRequests).toHaveLength(0)
        const activityPlots = (geometry.chartPlots ?? []).filter((plot) => plot && plot[2] > 0 && plot[3] > 0)
        expect(activityPlots.length).toBeGreaterThanOrEqual(3)
        expect((geometry.chartPlots ?? []).filter(Boolean).every((plot) => plot[2] > 0 && plot[3] > 0)).toBe(true)
        interactions.activityLegacyFilterMigration = {
          initialUrl: item.url,
          normalizedUrl: page.url(),
          hiddenVersionControlCount: versionControlCount,
          hiddenDimensionGroupCount: dimensionGroupCount,
          forbiddenVersionRequests,
          iterationRequests,
        }

        const previouslySelectedActivity = page.locator('.activity-directory .analytics-directory__item[aria-pressed="true"]')
        const previouslySelectedName = await previouslySelectedActivity.locator('.analytics-directory__label-text').innerText()
        const keyActivities = catalog.filter((activity) => activity.kind === 'key')
        const seActivity = keyActivities.find((activity) => activity.name === 'SE设计' && activity.name !== previouslySelectedName)
          ?? keyActivities.find((activity) => activity.name !== previouslySelectedName)
        expect(seActivity).toBeTruthy()
        const fixedSummaryMetricIds = new Set(catalog.flatMap((activity) => activity.metrics)
          .filter((metric) => ['tcg-rate', 'tce-count'].includes(metric.code))
          .map((metric) => String(metric.id)))
        const lowerSnapshot = async () => page.evaluate(() => ({
          teamDifference: document.querySelector('.activity-team-matrix')?.innerText ?? '',
          lowerPanels: [...document.querySelectorAll('.activity-lower-grid > .analytics-panel')].map((panel) => panel.innerText),
          workloadLabel: document.querySelector('.activity-lower-grid > .analytics-panel:nth-child(2) .overview-chart')?.getAttribute('aria-label') ?? '',
          rawSummaryLabels: [...document.querySelectorAll('.activity-raw-summary-table tbody th')].map((element) => element.innerText.trim()),
        }))
        let lowerBeforeSelection = await lowerSnapshot()
        await Promise.all(apiResponseReads)
        await Promise.all(irOverviewResponseReads)
        const currentMonthForRaw = new URL(page.url()).searchParams.get('month') ?? '2026-09'
        const previousMonthDate = new Date(currentMonthForRaw + '-01T00:00:00Z')
        previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1)
        const previousMonthForRaw = previousMonthDate.toISOString().slice(0, 7)
        const toExpectedCount = (value) => value === null || value === undefined || !Number.isFinite(value) ? null : Number(value)
        const parseDisplayedCount = (value) => value === '—' ? null : value === '未配置' ? 'unconfigured' : Number(value.replaceAll(',', '').trim())
        const expectedDelta = (current, previous) => Number.isFinite(current) && Number.isFinite(previous) ? current - previous : null
        const currentIrReadForRaw = irOverviewResponses.filter((entry) => entry.route === 'activities' && entry.status === 200 && entry.payload?.period_ids?.includes(currentMonthForRaw)).at(-1)
        expect(currentIrReadForRaw).toBeTruthy()
        const irRawPoint = (periodId) => currentIrReadForRaw.payload.domain_summary?.find((point) => String(point.period_id) === periodId)
        const irCountAt = (periodId) => {
          const point = irRawPoint(periodId)
          return point?.known_ai_count > 0 && Number.isFinite(point.ai_assisted_count) ? point.ai_assisted_count : null
        }
        const rawSourceMetric = (code) => catalog.flatMap((activity) => activity.metrics).find((metric) => metric.code === code)
        const computeRecordForMetric = async (metric) => {
          const params = new URLSearchParams({ metric_id: String(metric.id), dim: 'time', gran: 'month' })
          const response = await page.request.get('/api/compute?' + params.toString())
          expect(response.ok()).toBe(true)
          const payload = await response.json()
          return {
            periods: (payload.periods ?? []).map((period) => String(period.id)).filter((periodId) => periodId <= currentMonthForRaw).slice(-6),
            domainSummary: payload.domain_summary ?? [],
          }
        }
        const computeCountAt = (record, periodId, valueKey) => {
          const point = record?.domainSummary?.find((item) => String(item.period_id) === periodId)
          return point?.fact_count > 0 && Number.isFinite(point[valueKey]) ? point[valueKey] : null
        }
        const expectedTrend = (periodIds, valueAt) => periodIds.map((periodId) => valueAt(periodId))
        const irPeriods = currentIrReadForRaw.payload.period_ids.map(String).filter((periodId) => periodId <= currentMonthForRaw).slice(-6)
        const generatedMetric = rawSourceMetric('tcg-rate')
        const executedMetric = rawSourceMetric('tce-count')
        const generatedRecord = await computeRecordForMetric(generatedMetric)
        const executedRecord = await computeRecordForMetric(executedMetric)
        expect(generatedRecord).toBeTruthy()
        expect(executedRecord).toBeTruthy()
        const configuredRawRows = [
          { index: 0, source: 'IR 总览 · AI覆盖需求数', periods: irPeriods, at: irCountAt },
          { index: 4, source: 'tcg-rate · AI生成用例数', periods: generatedRecord.periods.map(String), at: (periodId) => computeCountAt(generatedRecord, periodId, 'numerator') },
          { index: 5, source: 'tce-count · 执行用例数', periods: executedRecord.periods.map(String), at: (periodId) => computeCountAt(executedRecord, periodId, 'value') },
        ]
        const formatRawNumber = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })
        for (const source of configuredRawRows) {
          const row = activityR3Geometry.rawRows[source.index]
          expect(row.source).toBe(source.source)
          const currentValue = toExpectedCount(source.at(currentMonthForRaw))
          const previousValue = toExpectedCount(source.at(previousMonthForRaw))
          expect(parseDisplayedCount(row.cells[0])).toBe(currentValue)
          expect(parseDisplayedCount(row.cells[1])).toBe(previousValue)
          expect(parseDisplayedCount(row.cells[2])).toBe(expectedDelta(currentValue, previousValue))
          const trendValues = expectedTrend(source.periods, source.at)
          const trendText = row.trendLabel?.split('数值：')[1]?.trim() ?? null
          expect(trendText).toBe(trendValues.map((value) => Number.isFinite(value) ? formatRawNumber(value) : '缺失').join('、'))
        }
        for (const row of activityR3Geometry.rawRows.slice(1, 4)) {
          expect(row.cells.slice(0, 3)).toEqual(['未配置', '未配置', '未配置'])
          expect(row.cells[3]).toBe('未配置')
        }
        const rawBeforeCycle = activityR3Geometry.rawRows.map((row) => ({ label: row.label, cells: row.cells, trendLabel: row.trendLabel }))
        const cycleSelect = page.getByRole('combobox', { name: '统计周期' })
        const cycleValue = page.locator('.activity-page-actions .analytics-filter-card__value .ant-select')
        const cycleRequestStart = requests.length
        const targetCycle = new URL(page.url()).searchParams.get('cycle') === 'year' ? 'half' : 'year'
        await cycleSelect.press('Enter')
        await expect(cycleSelect).toHaveAttribute('aria-expanded', 'true')
        await page.locator('.ant-select-item-option').filter({ hasText: targetCycle === 'half' ? '本半年度' : '年度累计' }).click()
        await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe(targetCycle)
        await expect(cycleValue).toContainText(targetCycle === 'half' ? '本半年度' : '年度累计')
        await page.waitForLoadState('networkidle')
        await expect(page.locator('.activity-raw-summary-table')).not.toContainText('加载中')
        const rawAfterCycle = await page.locator('.activity-raw-summary-table tbody tr').evaluateAll((rows) => rows.map((row) => ({
          label: row.cells[0]?.innerText.trim() ?? '',
          cells: [...row.cells].slice(1).map((cell) => cell.innerText.trim()),
          trendLabel: row.cells[4]?.querySelector('[aria-label]')?.getAttribute('aria-label') ?? null,
        })))
        expect(rawAfterCycle).toEqual(rawBeforeCycle)
        const cycleSelectionRequests = requests.slice(cycleRequestStart).filter((request) => request.route === 'activities')
        expect(cycleSelectionRequests.filter((request) => request.path === '/api/compute'
          && fixedSummaryMetricIds.has(String(request.query.metric_id)))).toHaveLength(0)
        interactions.activityRawSummaryMonthly = {
          month: currentMonthForRaw,
          previousMonth: previousMonthForRaw,
          configuredSources: configuredRawRows.map((source) => ({ row: activityR3Geometry.rawRows[source.index].label, source: source.source, current: source.at(currentMonthForRaw), previous: source.at(previousMonthForRaw) })),
          exactHeaders: activityR3Geometry.rawHeaders,
          exactLabels: activityR3Geometry.rawRows.map((row) => row.label),
          unconfiguredSlots: activityR3Geometry.rawRows.slice(1, 4).map((row) => row.label),
          beforeCycle: rawBeforeCycle,
          afterCycle: rawAfterCycle,
          cycleSelectionRequests,
        }
        lowerBeforeSelection = await lowerSnapshot()
        const upperSnapshot = async () => page.evaluate(() => ({
          title: document.querySelector('.analytics-page-head h1')?.innerText ?? '',
          monthKpis: document.querySelector('.activity-workspace > .analytics-section:nth-of-type(1)')?.innerText ?? '',
          cycleKpis: document.querySelector('.activity-workspace > .analytics-section:nth-of-type(2)')?.innerText ?? '',
          trends: document.querySelector('.activity-workspace > .analytics-section:nth-of-type(3)')?.innerText ?? '',
          selectedActivity: document.querySelector('.activity-directory .analytics-directory__item[aria-pressed="true"] .analytics-directory__label-text')?.innerText.trim() ?? '',
          metricKpiCount: document.querySelectorAll('.activity-outcome-grid .metric-card').length,
          trendCardCount: document.querySelectorAll('.activity-trend-grid > *').length,
        }))
        const upperBeforeSelection = await upperSnapshot()
        const selectionRequestStart = requests.length
        const selectedMetricIds = new Set(seActivity.metrics.map((metric) => String(metric.id)))
        let delayedSelectionResponses = 0
        await page.route('**/api/compute?*', async (route) => {
          const metricId = new URL(route.request().url()).searchParams.get('metric_id')
          if (!selectedMetricIds.has(String(metricId))) return route.continue()
          delayedSelectionResponses += 1
          try {
            const response = await route.fetch()
            await new Promise((resolve) => setTimeout(resolve, 2500))
            await route.fulfill({ response })
          } finally {
            delayedSelectionResponses -= 1
          }
        })
        const seActivityButton = page.getByRole('button', { name: '选择活动：' + seActivity.name })
        await seActivityButton.click()
        await expect(seActivityButton).toHaveAttribute('aria-busy', 'true')
        await expect(seActivityButton.getByRole('status')).toHaveText('切换中')
        await expect.poll(() => delayedSelectionResponses).toBeGreaterThan(0)
        await expect(page.locator('.analytics-page-head h1')).toContainText(previouslySelectedName)
        await expect(previouslySelectedActivity).toHaveAttribute('aria-pressed', 'true')
        await expect(seActivityButton).toHaveAttribute('aria-pressed', 'false')
        await expect(page.locator('.activity-workspace .metric-card--loading')).toHaveCount(0)
        await page.waitForTimeout(100)
        const upperDuringPending = await upperSnapshot()
        expect(upperDuringPending).toEqual(upperBeforeSelection)
        const pendingFocusPreserved = await seActivityButton.evaluate((element) => element === document.activeElement)
        expect(pendingFocusPreserved).toBe(true)
        const selectionActuals = {}
        const selectionBoards = {}
        const selectionReferences = {
          directory: ['docs/ux/reference-crops/activity-directory.png', '.activity-directory'],
          monthKpis: ['docs/ux/reference-crops/activity-month-kpis.png', '.activity-workspace > .analytics-section:nth-of-type(1)'],
          cycleKpis: ['docs/ux/reference-crops/activity-cycle-kpis.png', '.activity-workspace > .analytics-section:nth-of-type(2)'],
          trends: ['docs/ux/reference-crops/activity-dual-trends.png', '.activity-workspace > .analytics-section:nth-of-type(3)'],
        }
        for (const [name, [referencePath, selector]] of Object.entries(selectionReferences)) {
          const actualPath = path.join(activityR3Directory, 'UI-ACT-11-pending-' + name + '-actual.png')
          const boardPath = path.join(activityR3Directory, 'UI-ACT-11-pending-' + name + '-reference-actual.png')
          await page.locator(selector).screenshot({ path: actualPath })
          await captureReferenceActualBoard(page.context(), {
            referencePath: path.resolve(referencePath),
            actualPath,
            outputPath: boardPath,
            width: viewport.width,
            heading: 'UI-ACT-11-ACTIVITY-SELECTION-FLASH · ' + name + ' · ' + viewportName,
            note: '请求等待期间保留当前已提交活动的标题、KPI 与趋势；目录单独显示待切换状态。',
          })
          selectionActuals[name] = actualPath
          selectionBoards[name] = boardPath
        }
        await expect(seActivityButton).toHaveAttribute('aria-pressed', 'true')
        await expect(seActivityButton).not.toHaveAttribute('aria-busy', 'true')
        await expect(page.locator('.analytics-page-head h1')).toContainText(seActivity.name)
        await expect.poll(() => delayedSelectionResponses).toBe(0)
        await page.unroute('**/api/compute?*')
        await page.waitForLoadState('networkidle')
        const upperAfterSelection = await upperSnapshot()
        const lowerAfterSelection = await lowerSnapshot()
        expect(lowerAfterSelection).toEqual(lowerBeforeSelection)
        expect(upperAfterSelection.title).toContain(seActivity.name)
        expect(upperAfterSelection.selectedActivity).toBe(seActivity.name)
        expect(upperAfterSelection.metricKpiCount).toBe(8)
        expect(upperAfterSelection.trendCardCount).toBe(2)
        const focusPreservedAfterCommit = await seActivityButton.evaluate((element) => element === document.activeElement)
        expect(focusPreservedAfterCommit).toBe(true)
        const selectionRequests = requests.slice(selectionRequestStart).filter((request) => request.route === 'activities')
        expect(selectionRequests.some((request) => request.path === '/api/data-metrics/overview')).toBe(false)
        expect(selectionRequests.filter((request) => request.path === '/api/compute')
          .every((request) => !fixedSummaryMetricIds.has(String(request.query.metric_id)))).toBe(true)
        activityR3IssueBoards['UI-ACT-11-ACTIVITY-SELECTION-FLASH'] = {
          references: Object.fromEntries(Object.entries(selectionReferences).map(([name, [referencePath]]) => [name, referencePath])),
          actual: selectionActuals,
          boards: selectionBoards,
        }
        interactions.activitySelectionTransition = {
          action: 'pointer click on the ' + seActivity.name + ' directory button',
          previousActivity: previouslySelectedName,
          requestedActivity: seActivity.name,
          requestMetricIds: [...selectedMetricIds],
          oldWorkspaceStayedVisible: JSON.stringify(upperDuringPending) === JSON.stringify(upperBeforeSelection),
          oldLabelRetainedWhilePending: upperDuringPending.title.includes(previouslySelectedName),
          noKpiLoadingPlaceholder: true,
          focusPreservedWhilePending: pendingFocusPreserved,
          focusPreservedAfterCommit,
          committedWorkspace: upperAfterSelection,
          referenceActualEvidence: activityR3IssueBoards['UI-ACT-11-ACTIVITY-SELECTION-FLASH'],
        }
        interactions.activitySelectionIsolation = {
          action: 'pointer click on the ' + seActivity.name + ' directory button',
          selectedActivity: seActivity.name,
          lowerBeforeSelection,
          lowerAfterSelection,
          lowerSummaryRequestsAfterSelection: selectionRequests.filter((request) => request.path === '/api/data-metrics/overview' || fixedSummaryMetricIds.has(String(request.query.metric_id))),
          upperRequestsAfterSelection: selectionRequests.filter((request) => request.path === '/api/compute'),
        }

        const keyboardTarget = keyActivities.find((activity) => activity.name !== seActivity.name)
        const keyboardTargetButton = page.getByRole('button', { name: '选择活动：' + keyboardTarget.name })
        const keyboardUpperBefore = await upperSnapshot()
        const keyboardRequestIds = new Set(keyboardTarget.metrics.map((metric) => String(metric.id)))
        let delayedKeyboardResponses = 0
        await page.route('**/api/compute?*', async (route) => {
          const metricId = new URL(route.request().url()).searchParams.get('metric_id')
          if (!keyboardRequestIds.has(String(metricId))) return route.continue()
          delayedKeyboardResponses += 1
          try {
            const response = await route.fetch()
            await new Promise((resolve) => setTimeout(resolve, 1200))
            await route.fulfill({ response })
          } finally {
            delayedKeyboardResponses -= 1
          }
        })
        await keyboardTargetButton.focus()
        await page.keyboard.press('Enter')
        await expect(keyboardTargetButton).toHaveAttribute('aria-busy', 'true')
        await expect(keyboardTargetButton.getByRole('status')).toHaveText('切换中')
        await expect.poll(() => delayedKeyboardResponses).toBeGreaterThan(0)
        await expect(page.locator('.analytics-page-head h1')).toContainText(seActivity.name)
        await expect(seActivityButton).toHaveAttribute('aria-pressed', 'true')
        await page.waitForTimeout(100)
        const keyboardUpperDuringPending = await upperSnapshot()
        expect(keyboardUpperDuringPending).toEqual(keyboardUpperBefore)
        const keyboardFocusPreserved = await keyboardTargetButton.evaluate((element) => element === document.activeElement)
        await expect(page.locator('.analytics-page-head h1')).toContainText(keyboardTarget.name)
        await expect(keyboardTargetButton).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(() => delayedKeyboardResponses).toBe(0)
        await page.unroute('**/api/compute?*')
        await page.waitForLoadState('networkidle')
        const keyboardUpperAfter = await upperSnapshot()
        expect(keyboardFocusPreserved).toBe(true)
        expect(await keyboardTargetButton.evaluate((element) => element === document.activeElement)).toBe(true)
        expect(keyboardUpperAfter.title).toContain(keyboardTarget.name)
        expect(keyboardUpperAfter.selectedActivity).toBe(keyboardTarget.name)
        expect(keyboardUpperAfter.metricKpiCount).toBe(8)
        expect(keyboardUpperAfter.trendCardCount).toBe(2)
        interactions.activitySelectionKeyboard = {
          action: 'keyboard Enter on the ' + keyboardTarget.name + ' directory button',
          previousActivity: seActivity.name,
          requestedActivity: keyboardTarget.name,
          requestMetricIds: [...keyboardRequestIds],
          oldWorkspaceStayedVisible: JSON.stringify(keyboardUpperDuringPending) === JSON.stringify(keyboardUpperBefore),
          focusPreservedWhilePending: keyboardFocusPreserved,
          focusPreservedAfterCommit: await keyboardTargetButton.evaluate((element) => element === document.activeElement),
          committedWorkspace: keyboardUpperAfter,
        }

        if (!await advanced.evaluate((element) => element.open)) await advanced.locator('summary').click()
        const granularityGroup = page.getByRole('group', { name: '时间粒度' })
        const weekButton = granularityGroup.getByRole('button', { name: '周', exact: true })
        const weekRequestStart = requests.length
        await weekButton.focus()
        await page.keyboard.press('Enter')
        await expect(weekButton).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(() => new URL(page.url()).searchParams.get('granularity')).toBe('week')
        await page.waitForLoadState('networkidle')
        await expect.poll(() => new URL(page.url()).searchParams.get('period')).toMatch(/^2026-W/)
        const weekRequests = requests.slice(weekRequestStart).filter((request) => request.route === 'activities')
        expect(weekRequests.some((request) => request.path.endsWith('/api/compute') && request.query.gran === 'week' && request.query.dim === 'time')).toBe(true)
        expect(weekRequests.every((request) => !request.query.version_id || request.query.version_id === 'all')).toBe(true)
        interactions.activityTimeGranularityKeyboard = { url: page.url(), requests: weekRequests, ariaPressed: await weekButton.getAttribute('aria-pressed') }
        const selectedPath = path.join(actualDir, 'activity-week-filter-selected.png')
        await page.screenshot({ path: selectedPath, fullPage: true })
        interactions.activitySelectedScreenshot = selectedPath

        const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight))
        await page.mouse.wheel(0, maxScroll + 300)
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(maxScroll)
        const reachedEnd = await page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight)
        const activityHorizontalOverflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
        const bottomPath = path.join(actualDir, 'activity-scrolled-bottom.png')
        await page.screenshot({ path: bottomPath })
        await page.mouse.wheel(0, -maxScroll - 300)
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
        interactions.activityScroll = {
          maxScroll,
          reachedEnd,
          returnedToTop: await page.evaluate(() => window.scrollY === 0),
          horizontalOverflowPx: activityHorizontalOverflowPx,
          bottomScreenshot: bottomPath,
        }

        for (const [state, month] of [['full', '2026-09'], ['partial', '2026-08'], ['empty', '2025-01']]) {
          activeRoute = `activities-${state}`
          await page.goto(`/analytics/activities?month=${month}&cycle=half`)
          await expect(page.locator('.activity-workspace')).toBeVisible()
          await page.waitForLoadState('networkidle')
          const stateGeometry = await page.evaluate(() => {
            const box = (element) => {
              if (!element) return null
              const { x, y, width, height } = element.getBoundingClientRect()
              return [x, y, width, height]
            }
            const rects = (selector) => [...document.querySelectorAll(selector)].map(box)
            return {
              page: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
              upperGrid: box(document.querySelector('.activity-upper-grid')),
              directory: box(document.querySelector('.activity-directory')),
              outcomeRows: rects('.activity-outcome-grid'),
              trendRegion: box(document.querySelector('.activity-trend-grid')),
              trendCards: rects('.activity-trend-grid > *'),
              trendSurfaces: rects('.activity-trend-grid .overview-chart, .activity-trend-grid .analytics-chart-card__plot-state'),
              trendHosts: rects('.activity-trend-grid .analytics-chart-card__plot-state'),
              teamDifference: box(document.querySelector('.activity-team-matrix')),
              teamTable: rects('.activity-team-matrix .team-matrix__table'),
              pageSummary: box(document.querySelector('.activity-page-summary')),
              lowerGrid: box(document.querySelector('.activity-lower-grid')),
              lowerPanels: rects('.activity-lower-grid > .analytics-panel'),
              lowerPanelHeaders: rects('.activity-lower-grid .analytics-panel__header'),
              volumeBreakdown: box(document.querySelector('.activity-volume-breakdown')),
              volumeEmptyMessage: box(document.querySelector('.activity-lower-grid > .analytics-panel:first-child .analytics-empty')),
              lowerChartHosts: rects('.activity-lower-grid .overview-chart'),
              rawSummaryTable: box(document.querySelector('.activity-raw-summary-table')),
              rawSummaryRows: rects('.activity-raw-summary-table tbody tr'),
              rawSummaryLabels: [...document.querySelectorAll('.activity-raw-summary-table tbody th')].map((element) => element.innerText.trim()),
            }
          })
          const statePath = path.join(actualDir, `activity-${state}-state.png`)
          await page.screenshot({ path: statePath, fullPage: true })
          activityStateEvidence.push({ state, month, url: page.url(), geometry: stateGeometry, screenshot: statePath })
        }
        const fullStateGeometry = activityStateEvidence[0].geometry
        for (const stateEvidence of activityStateEvidence) {
          const stateGeometry = stateEvidence.geometry
          expect(stateGeometry.page).toEqual(fullStateGeometry.page)
          expect(stateGeometry.upperGrid).toEqual(fullStateGeometry.upperGrid)
          expect(stateGeometry.directory).toEqual(fullStateGeometry.directory)
          expect(stateGeometry.outcomeRows).toEqual(fullStateGeometry.outcomeRows)
          expect(stateGeometry.trendRegion).toEqual(fullStateGeometry.trendRegion)
          expect(stateGeometry.trendCards).toEqual(fullStateGeometry.trendCards)
          expect(stateGeometry.trendHosts).toEqual(fullStateGeometry.trendHosts)
          expect(stateGeometry.teamDifference).toEqual(fullStateGeometry.teamDifference)
          expect(stateGeometry.teamTable).toEqual(fullStateGeometry.teamTable)
          expect(stateGeometry.pageSummary).toEqual(fullStateGeometry.pageSummary)
          expect(stateGeometry.lowerGrid).toEqual(fullStateGeometry.lowerGrid)
          expect(stateGeometry.lowerPanels).toEqual(fullStateGeometry.lowerPanels)
          expect(stateGeometry.lowerChartHosts).toEqual(fullStateGeometry.lowerChartHosts)
          expect(stateGeometry.rawSummaryTable).toEqual(fullStateGeometry.rawSummaryTable)
          expect(stateGeometry.rawSummaryRows).toEqual(fullStateGeometry.rawSummaryRows)
          expect(stateGeometry.rawSummaryLabels).toEqual(fullStateGeometry.rawSummaryLabels)
        }

        let delayedSummaryRequests = 0
        const delayAnalyticsResponse = async (route) => {
          delayedSummaryRequests += 1
          try {
            const response = await route.fetch()
            await new Promise((resolve) => setTimeout(resolve, 1500))
            await route.fulfill({ response })
          } finally {
            delayedSummaryRequests -= 1
          }
        }
        await page.route('**/api/compute?*', delayAnalyticsResponse)
        await page.route('**/api/data-metrics/overview?*', delayAnalyticsResponse)
        activeRoute = 'activities-loading'
        await page.goto('/analytics/activities?month=2026-09&cycle=half')
        await expect(page.locator('.activity-workspace')).toBeVisible()
        await expect(page.locator('.activity-lower-grid .activity-summary-chart-state[role="status"]').first()).toBeVisible()
        const loadingGeometry = await page.evaluate(() => ({
          page: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
          upperGrid: (() => { const r = document.querySelector('.activity-upper-grid').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          directory: (() => { const r = document.querySelector('.activity-directory').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          outcomeRows: [...document.querySelectorAll('.activity-outcome-grid')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          trendRegion: (() => { const r = document.querySelector('.activity-trend-grid').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          trendCards: [...document.querySelectorAll('.activity-trend-grid > *')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          trendHosts: [...document.querySelectorAll('.activity-trend-grid .analytics-chart-card__plot-state')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          teamDifference: (() => { const r = document.querySelector('.activity-team-matrix').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          teamTable: [...document.querySelectorAll('.activity-team-matrix .team-matrix__table')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          pageSummary: (() => { const r = document.querySelector('.activity-page-summary').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          lowerGrid: (() => { const r = document.querySelector('.activity-lower-grid').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          lowerPanels: [...document.querySelectorAll('.activity-lower-grid > .analytics-panel')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          rawSummaryTable: (() => { const r = document.querySelector('.activity-raw-summary-table').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          rawSummaryRows: [...document.querySelectorAll('.activity-raw-summary-table tbody tr')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          lowerChartHosts: [...document.querySelectorAll('.activity-lower-grid .overview-chart')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
        }))
        const loadingPath = path.join(actualDir, 'activity-loading-state.png')
        await page.screenshot({ path: loadingPath, fullPage: true })
        activityTransientStateEvidence.loading = { geometry: loadingGeometry, screenshot: loadingPath }
        await expect.poll(() => delayedSummaryRequests).toBe(0)
        await page.unroute('**/api/compute?*')
        await page.unroute('**/api/data-metrics/overview?*')
        await page.waitForLoadState('networkidle')

        await page.route('**/api/compute?*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'fixed visual error state' }) }))
        await page.route('**/api/data-metrics/overview?*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'fixed visual error state' }) }))
        activeRoute = 'activities-error'
        await page.goto('/analytics/activities?month=2026-09&cycle=half')
        await expect(page.locator('.activity-workspace')).toBeVisible()
        await page.waitForLoadState('networkidle')
        await expect(page.getByRole('alert').first()).toBeVisible()
        const errorGeometry = await page.evaluate(() => ({
          page: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
          upperGrid: (() => { const r = document.querySelector('.activity-upper-grid').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          directory: (() => { const r = document.querySelector('.activity-directory').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          outcomeRows: [...document.querySelectorAll('.activity-outcome-grid')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          trendRegion: (() => { const r = document.querySelector('.activity-trend-grid').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          trendCards: [...document.querySelectorAll('.activity-trend-grid > *')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          trendHosts: [...document.querySelectorAll('.activity-trend-grid .analytics-chart-card__plot-state')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          teamDifference: (() => { const r = document.querySelector('.activity-team-matrix').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          teamTable: [...document.querySelectorAll('.activity-team-matrix .team-matrix__table')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          pageSummary: (() => { const r = document.querySelector('.activity-page-summary').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          lowerGrid: (() => { const r = document.querySelector('.activity-lower-grid').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          lowerPanels: [...document.querySelectorAll('.activity-lower-grid > .analytics-panel')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          rawSummaryTable: (() => { const r = document.querySelector('.activity-raw-summary-table').getBoundingClientRect(); return [r.x,r.y,r.width,r.height] })(),
          rawSummaryRows: [...document.querySelectorAll('.activity-raw-summary-table tbody tr')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
          lowerChartHosts: [...document.querySelectorAll('.activity-lower-grid .overview-chart')].map((element) => { const r = element.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }),
        }))
        const errorPath = path.join(actualDir, 'activity-error-state.png')
        await page.screenshot({ path: errorPath, fullPage: true })
        await expect(page.getByText('指标暂不可用，请稍后重试。').first()).toBeVisible()
        await expect(page.getByText('fixed visual error state', { exact: false })).toHaveCount(0)
        const errorCropDir = path.join(actualDir, 'blocks')
        await mkdir(errorCropDir, { recursive: true })
        const errorActualCrops = {}
        const errorReferencePaths = {
          monthKpis: 'docs/ux/reference-crops/activity-month-kpis.png',
          cycleKpis: 'docs/ux/reference-crops/activity-cycle-kpis.png',
          trends: 'docs/ux/reference-crops/activity-dual-trends.png',
        }
        const errorSelectors = {
          monthKpis: '.activity-workspace > .analytics-section:nth-of-type(1)',
          cycleKpis: '.activity-workspace > .analytics-section:nth-of-type(2)',
          trends: '.activity-trend-grid',
        }
        const errorComparisonBoards = {}
        for (const [name, selector] of Object.entries(errorSelectors)) {
          const actualPath = path.join(errorCropDir, `error-${name}.png`)
          await page.locator(selector).screenshot({ path: actualPath })
          errorActualCrops[name] = actualPath
          const boardPath = path.join(baselineDir, 'activity-r2-issues', viewportName, `UI-ACT-10-ERROR-COPY-${name}-reference-actual.png`)
          await captureReferenceActualBoard(page.context(), {
            referencePath: path.resolve(errorReferencePaths[name]),
            actualPath,
            outputPath: boardPath,
            width: viewport.width,
            heading: `UI-ACT-10-ERROR-COPY · ${name} · ${viewportName}`,
            note: '批准 Activity Reference 与注入 API Error 状态的真实 Chromium 裁图；用户文案应保持通用且不泄漏 detail。',
          })
          errorComparisonBoards[name] = boardPath
        }
        activityR2IssueBoards['UI-ACT-10-ERROR-COPY'] = {
          reference: errorReferencePaths,
          actual: errorActualCrops,
          boards: errorComparisonBoards,
        }
        activityTransientStateEvidence.error = { geometry: errorGeometry, screenshot: errorPath, alertCount: await page.getByRole('alert').count() }
        activityTransientStateEvidence.error.crops = errorActualCrops
        activityTransientStateEvidence.error.comparisonBoards = errorComparisonBoards
        interactions.activityErrorCopy = {
          expectedMessage: '指标暂不可用，请稍后重试。',
          genericMessageVisible: true,
          fixtureDetailVisible: false,
          alertCount: activityTransientStateEvidence.error.alertCount,
          comparisons: errorComparisonBoards,
        }
        await writeFile(path.join(baselineDir, 'activity-transient-state-geometry.json'), JSON.stringify({ viewport: viewportName, fullStateGeometry, loadingGeometry, errorGeometry, alertCount: activityTransientStateEvidence.error.alertCount }, null, 2), 'utf8')
        for (const transient of [loadingGeometry, errorGeometry]) {
          expect(transient.page).toEqual(fullStateGeometry.page)
          expect(transient.upperGrid).toEqual(fullStateGeometry.upperGrid)
          expect(transient.directory).toEqual(fullStateGeometry.directory)
          expect(transient.outcomeRows).toEqual(fullStateGeometry.outcomeRows)
          expect(transient.trendRegion).toEqual(fullStateGeometry.trendRegion)
          expect(transient.trendCards).toEqual(fullStateGeometry.trendCards)
          expect(transient.trendHosts).toEqual(fullStateGeometry.trendHosts)
          expect(transient.teamDifference).toEqual(fullStateGeometry.teamDifference)
          expect(transient.teamTable).toEqual(fullStateGeometry.teamTable)
          expect(transient.pageSummary).toEqual(fullStateGeometry.pageSummary)
          expect(transient.lowerGrid).toEqual(fullStateGeometry.lowerGrid)
          expect(transient.lowerPanels).toEqual(fullStateGeometry.lowerPanels)
          expect(transient.rawSummaryTable).toEqual(fullStateGeometry.rawSummaryTable)
          expect(transient.rawSummaryRows).toEqual(fullStateGeometry.rawSummaryRows)
          expect(transient.lowerChartHosts).toEqual(fullStateGeometry.lowerChartHosts)
        }
        await page.unroute('**/api/compute?*')
        await page.unroute('**/api/data-metrics/overview?*')
      }
      if (item.id === 'capabilities') {
        await writeFile(path.join(actualDir, 'geometry.json'), JSON.stringify(geometry, null, 2), 'utf8')
        const versionSelect = page.locator('.capability-page-actions [aria-label="版本"]')
        expect(await versionSelect.count()).toBe(0)
        expect(new URL(page.url()).searchParams.has('version')).toBe(false)
        expect(geometry.capabilityBlocks.versionControlCount).toBe(0)
        expect(geometry.capabilityBlocks.directoryClassName).toContain('analytics-directory--panel')
        expect(geometry.capabilityBlocks.directoryItemCount).toBe(7)
        expect(geometry.capabilityBlocks.directoryIconCount).toBe(7)
        expect(geometry.capabilityBlocks.maturityAxes).toHaveLength(7)
        expect(geometry.capabilityBlocks.maturityAxes).toEqual(['MR代码检视', 'MR-E2E能力', 'CodeCheck问题修复', '三方件治理', '漏洞修复', '自动化构建部署', '白盒安全问题修复'])
        expect(geometry.capabilityBlocks.maturityColumns).toEqual(['领域平均', ...teams.map((team) => team.name)])
        expect(geometry.capabilityBlocks.maturityRadarSeries.length).toBeGreaterThan(0)
        expect(geometry.capabilityBlocks.maturityRadarSeriesBoundsPx.every((bounds) => bounds[0] > 0 && bounds[1] > 0)).toBe(true)
        expect(geometry.capabilityBlocks.evolutionPlots.every((bounds) => bounds && bounds[2] > 0 && bounds[3] > 0)).toBe(true)
        expect(Math.abs(geometry.capabilityBlocks.directory[3] - geometry.capabilityBlocks.workspace[3])).toBeLessThanOrEqual(1)
        const radarTarget = geometry.viewport[1] === 1440 ? { bounds: [182, 187], tolerance: 13, svgHeight: 300, labelHeight: 16 } : { bounds: [126, 129], tolerance: 9, svgHeight: 205, labelHeight: 11 }
        expect(geometry.capabilityBlocks.maturityRadarViewBox).toBe('0 0 670 460')
        if (geometry.viewport[1] === 1440) expect(geometry.capabilityBlocks.pageEndGapPx).toBeLessThanOrEqual(43.2)
        expect(geometry.capabilityBlocks.maturityRadarSvg[3]).toBeCloseTo(radarTarget.svgHeight, 0)
        const currentRadarBounds = geometry.capabilityBlocks.maturityRadarSeriesBoundsPx[0]
        expect(Math.abs(currentRadarBounds[0] - radarTarget.bounds[0])).toBeLessThanOrEqual(radarTarget.tolerance)
        expect(Math.abs(currentRadarBounds[1] - radarTarget.bounds[1])).toBeLessThanOrEqual(radarTarget.tolerance)
        expect(geometry.capabilityBlocks.maturityRadarAxisLabelBounds).toHaveLength(7)
        expect(geometry.capabilityBlocks.maturityRadarAxisLabelBounds.every((label) => label.height >= radarTarget.labelHeight)).toBe(true)
        const axisLabels = geometry.capabilityBlocks.maturityRadarAxisLabelBounds
        for (let left = 0; left < axisLabels.length; left += 1) {
          for (let right = left + 1; right < axisLabels.length; right += 1) {
            const horizontalOverlap = Math.min(axisLabels[left].x + axisLabels[left].width, axisLabels[right].x + axisLabels[right].width) - Math.max(axisLabels[left].x, axisLabels[right].x)
            const verticalOverlap = Math.min(axisLabels[left].y + axisLabels[left].height, axisLabels[right].y + axisLabels[right].height) - Math.max(axisLabels[left].y, axisLabels[right].y)
            expect(horizontalOverlap > 1 && verticalOverlap > 1).toBe(false)
          }
        }
        const levelOneCell = geometry.capabilityBlocks.maturityCellEvidence.find((cell) => cell.className === 'maturity-matrix__cell--level-1')
        expect(levelOneCell).toBeTruthy()
        expect(levelOneCell.background).toBe('rgb(255, 242, 181)')
        const selectedCapability = generalCapabilities.find((entry) => entry.name === 'MR代码检视')
        const selectedMetricLabels = selectedCapability.metrics.filter((metric) => metric.type !== 'boolean').map((metric) => metric.name)
        const selectedCardLabels = await page.locator('.capability-kpi-grid .metric-card__label').allInnerTexts()
        expect(selectedCardLabels.slice().sort()).toEqual(selectedMetricLabels.slice().sort())
        expect(selectedCardLabels).not.toContain('成熟度评分')
        expect(selectedCardLabels).not.toContain('评估覆盖团队')
        expect(geometry.capabilityBlocks.evolutionTitles).toEqual(expect.arrayContaining(['AI检视意见数趋势', 'AI检视率趋势', 'AI有效检视率趋势', 'AI有效检视意见数趋势']))
        expect(geometry.capabilityBlocks.teamDifferenceHeaders).toEqual(expect.arrayContaining(['AI检视意见数', 'AI检视率', 'AI有效检视数', 'AI检视有效率']))
        expect(geometry.capabilityBlocks.teamDifferenceHeaders).not.toContain('问题闭环率')
        expect(geometry.capabilityBlocks.teamDifferenceHeaders).not.toContain('覆盖情况')
        expect(geometry.capabilityBlocks.teamMatrixClassName).toContain('team-matrix--heatmap')
        expect(geometry.capabilityBlocks.teamHeatmapCells.some((cell) => cell.level !== null)).toBe(true)
        expect(geometry.capabilityBlocks.teamHeatmapCells.some((cell) => cell.text === '未配置')).toBe(false)
        interactions.capabilityMetricSlots = { capability: selectedCapability.name, definedMetricLabels: selectedMetricLabels, renderedLabels: selectedCardLabels }
        const previousMaturitySnapshot = await page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table').innerText()
        const otherCapabilityButton = page.locator('.capability-directory-workspace .analytics-directory__item').filter({ hasText: 'MR-E2E能力' })
        await otherCapabilityButton.focus()
        await page.keyboard.press('Enter')
        await expect(otherCapabilityButton).toHaveAttribute('aria-pressed', 'true')
        await expect(page.locator('.capability-kpi-grid')).toContainText('AI-MR数量')
        expect(await page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table').innerText()).toBe(previousMaturitySnapshot)
        const effectiveMetricsRequestStart = requests.length
        const effectiveMetricsResponseStart = apiResponses.length
        const mrCapabilityButton = page.locator('.capability-directory-workspace .analytics-directory__item').filter({ hasText: 'MR代码检视' })
        await mrCapabilityButton.click()
        await expect(mrCapabilityButton).toHaveAttribute('aria-pressed', 'true')
        expect((await page.locator('.capability-kpi-grid .metric-card__label').allInnerTexts()).sort()).toEqual([...selectedMetricLabels].sort())
        const effectiveMetricIds = selectedCapability.metrics.map((metric) => String(metric.id))
        await expect.poll(() => new Set(requests.slice(effectiveMetricsRequestStart)
          .filter((request) => request.route === 'capabilities' && request.path === '/api/compute' && effectiveMetricIds.includes(String(request.query.metric_id)))
          .map((request) => String(request.query.metric_id))).size).toBe(effectiveMetricIds.length)
        await expect.poll(() => new Set(apiResponses.slice(effectiveMetricsResponseStart)
          .filter((response) => response.route === 'capabilities' && response.status === 200 && effectiveMetricIds.includes(String(response.query.metric_id)))
          .map((response) => String(response.query.metric_id))).size).toBe(effectiveMetricIds.length)
        const effectiveCountMetric = selectedCapability.metrics.find((metric) => metric.code === 'mrr-effective-count')
        const effectiveRateMetric = selectedCapability.metrics.find((metric) => metric.code === 'mrr-effective-rate')
        const effectiveCountResponse = apiResponses.find((response) => response.route === 'capabilities' && response.query.metric_id === String(effectiveCountMetric.id))
        const effectiveRateResponse = apiResponses.find((response) => response.route === 'capabilities' && response.query.metric_id === String(effectiveRateMetric.id))
        const septemberCount = effectiveCountResponse?.domainSummary.find((point) => point.period_id === '2026-09')
        const septemberRate = effectiveRateResponse?.domainSummary.find((point) => point.period_id === '2026-09')
        expect(septemberCount?.value).toBeGreaterThan(0)
        expect(septemberCount?.sample_count).toBe(32)
        expect(septemberRate?.value).toBeGreaterThan(0)
        expect(septemberRate?.value).toBeLessThanOrEqual(1)
        await page.waitForLoadState('networkidle')
        interactions.capabilityEffectiveMetricSlots = {
          tableColumns: geometry.capabilityBlocks.teamDifferenceHeaders,
          effectiveMetricCells: geometry.capabilityBlocks.teamHeatmapCells.filter((cell) => ['AI有效检视数', 'AI检视有效率'].includes(cell.columnLabel)),
          trendTitles: geometry.capabilityBlocks.evolutionTitles,
          keyboardSelection: 'MR-E2E能力 updates its metric cards while maturity matrix remains unchanged',
          pointerSelection: 'MR代码检视 returns to the approved four catalog metrics',
          metricResponses: [effectiveCountResponse, effectiveRateResponse],
          status: 'derived from local AI review-opinion source; existing mrr-count/mrr-rate remain unchanged',
        }
        const capabilityRequests = requests.slice(pageRequestStart).filter((request) => request.route === 'capabilities')
        expect(capabilityRequests.filter((request) => request.query.version_id && request.query.version_id !== 'all')).toHaveLength(0)
        interactions.capabilityScope = { url: page.url(), versionControl: 'not-present-general-capabilities-have-no-version-scope', nonAllVersionRequests: capabilityRequests.filter((request) => request.query.version_id && request.query.version_id !== 'all') }

        const readCapabilityStateGeometry = () => page.evaluate(() => {
          const box = (element) => {
            if (!element) return null
            const { x, y, width, height } = element.getBoundingClientRect()
            return [x, y, width, height]
          }
          const rects = (selector) => [...document.querySelectorAll(selector)].map(box)
          return {
            page: [document.documentElement.clientWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight],
            horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            header: box(document.querySelector('.analytics-page-head')),
            directory: box(document.querySelector('.capability-directory-workspace > .analytics-directory')),
            workspace: box(document.querySelector('.capability-directory-workspace > .analytics-workspace')),
            statusSection: box(document.querySelector('.capability-kpi-grid')?.closest('.analytics-section')),
            statusCards: rects('.capability-kpi-grid > .metric-card'),
            evolutionSection: box(document.querySelector('.capability-evolution-grid')?.closest('.analytics-section')),
            evolutionCards: rects('.capability-evolution-grid > *'),
            evolutionHosts: rects('.capability-evolution-grid .analytics-chart-card__plot-state'),
            comparisonGrid: box(document.querySelector('.capability-comparison-grid')),
            teamDifference: box(document.querySelector('.capability-comparison-grid > .analytics-panel')),
            teamTable: box(document.querySelector('.capability-comparison-grid .team-matrix__table')),
            evidenceGrid: box(document.querySelector('.capability-evidence-grid')),
            evidenceCards: rects('.capability-evidence-card'),
            maturitySection: box(document.querySelector('.analytics-maturity-summary')?.closest('.analytics-section')),
        pageEndGapPx: (() => {
          const section = document.querySelector('.analytics-maturity-summary')?.closest('.analytics-section')
          if (!section) return null
          return Number((document.documentElement.scrollHeight - (section.getBoundingClientRect().bottom + window.scrollY)).toFixed(2))
        })(),
            maturitySummary: box(document.querySelector('.analytics-maturity-summary')),
            maturityMatrix: box(document.querySelector('.analytics-maturity-summary__matrix')),
            maturityTable: box(document.querySelector('.analytics-maturity-summary__matrix .maturity-matrix__table')),
            maturityRows: rects('.analytics-maturity-summary__matrix .maturity-matrix__table tbody tr'),
            maturityAxes: [...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table tbody th[scope="row"]')].map((element) => element.innerText.trim()),
            maturityColumns: [...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table thead th')].map((element) => element.innerText.trim()).slice(1),
            maturityCells: [...document.querySelectorAll('.analytics-maturity-summary__matrix .maturity-matrix__table tbody td')].map((element) => ({ text: element.innerText.trim(), className: element.className, background: getComputedStyle(element).backgroundColor })),
            maturityRadarPanel: box(document.querySelector('.analytics-maturity-summary__radar')),
            maturityRadar: box(document.querySelector('.analytics-maturity-summary__radar .maturity-radar')),
          }
        })
        for (const [state, month] of [['full', '2026-09'], ['partial', '2026-08'], ['empty', '2025-01']]) {
          activeRoute = `capabilities-${state}`
          await page.goto(`/analytics/capabilities?month=${month}&granularity=month`)
          await expect(page.locator('.capability-directory-workspace')).toBeVisible()
          await page.waitForLoadState('networkidle')
          const stateGeometry = await readCapabilityStateGeometry()
          const screenshot = path.join(actualDir, `capability-${state}-state.png`)
          await page.screenshot({ path: screenshot, fullPage: true })
          capabilityStateEvidence.push({ state, month, url: page.url(), geometry: stateGeometry, screenshot })
        }
        await writeFile(path.join(actualDir, 'capability-state-geometry.json'), JSON.stringify(capabilityStateEvidence, null, 2), 'utf8')

        const stateBaseline = capabilityStateEvidence[0].geometry
        const stableKeys = ['page', 'horizontalOverflowPx', 'directory', 'workspace', 'statusSection', 'statusCards', 'evolutionSection', 'evolutionCards', 'evolutionHosts', 'comparisonGrid', 'teamDifference', 'teamTable', 'evidenceGrid', 'evidenceCards', 'maturitySection', 'pageEndGapPx', 'maturitySummary', 'maturityMatrix', 'maturityTable', 'maturityRows', 'maturityAxes', 'maturityColumns', 'maturityRadarPanel', 'maturityRadar']
        const stateGeometryDiffs = capabilityStateEvidence.slice(1).map((state) => ({ state: state.state, differences: stableKeys.filter((key) => JSON.stringify(state.geometry[key]) !== JSON.stringify(stateBaseline[key])).map((key) => ({ key, full: stateBaseline[key], state: state.geometry[key] })) }))
        interactions.capabilityDataStateGeometry = { stable: stateGeometryDiffs.every((state) => state.differences.length === 0), diffs: stateGeometryDiffs }
        await writeFile(path.join(actualDir, 'capability-state-geometry-diffs.json'), JSON.stringify(interactions.capabilityDataStateGeometry, null, 2), 'utf8')
        expect(interactions.capabilityDataStateGeometry.stable).toBe(true)
        expect(stateGeometryDiffs.every((state) => state.differences.length === 0)).toBe(true)
        expect(stateBaseline.horizontalOverflowPx).toBe(0)
        if (viewport.width === 2560) expect(stateBaseline.pageEndGapPx).toBeLessThanOrEqual(43.2)
        const emptyMaturityCells = capabilityStateEvidence.find((state) => state.state === 'empty').geometry.maturityCells
        expect(emptyMaturityCells.length).toBeGreaterThan(0)
        expect(emptyMaturityCells.every((cell) => cell.className === 'maturity-matrix__cell--missing')).toBe(true)
        expect(emptyMaturityCells.every((cell) => cell.background !== levelOneCell.background)).toBe(true)

        let delayedCapabilityRequests = 0
        const delayCapabilityResponse = async (route) => {
          delayedCapabilityRequests += 1
          try {
            const response = await route.fetch()
            await new Promise((resolve) => setTimeout(resolve, 1500))
            await route.fulfill({ response })
          } finally {
            delayedCapabilityRequests -= 1
          }
        }
        await page.route('**/api/compute?*', delayCapabilityResponse)
        await page.route('**/api/maturity/overview?*', delayCapabilityResponse)
        activeRoute = 'capabilities-loading'
        await page.goto('/analytics/capabilities?month=2026-07&granularity=month')
        await expect(page.locator('.capability-evidence-card [role="status"]').first()).toBeVisible()
        await expect(page.locator('.analytics-maturity-summary__matrix [role="status"]')).toBeVisible()
        const capabilityLoadingGeometry = await readCapabilityStateGeometry()
        const capabilityLoadingScreenshot = path.join(actualDir, 'capability-loading-state.png')
        await page.screenshot({ path: capabilityLoadingScreenshot, fullPage: true })
        await expect.poll(() => delayedCapabilityRequests).toBe(0)
        await page.unroute('**/api/compute?*')
        await page.unroute('**/api/maturity/overview?*')
        await page.waitForLoadState('networkidle')

        await page.route('**/api/compute?*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'fixed visual error state' }) }))
        await page.route('**/api/maturity/overview?*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'fixed visual error state' }) }))
        activeRoute = 'capabilities-error'
        await page.goto('/analytics/capabilities?month=2026-06&granularity=month')
        await expect(page.locator('.analytics-maturity-summary__matrix [role="alert"]')).toBeVisible()
        await expect(page.locator('.capability-evidence-card [role="alert"]').first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        const capabilityErrorGeometry = await readCapabilityStateGeometry()
        const capabilityErrorScreenshot = path.join(actualDir, 'capability-error-state.png')
        await page.screenshot({ path: capabilityErrorScreenshot, fullPage: true })
        await page.unroute('**/api/compute?*')
        await page.unroute('**/api/maturity/overview?*')
        capabilityTransientStateEvidence = {
          loading: { geometry: capabilityLoadingGeometry, screenshot: capabilityLoadingScreenshot },
          error: { geometry: capabilityErrorGeometry, screenshot: capabilityErrorScreenshot, alerts: await page.getByRole('alert').count() },
        }
        await writeFile(path.join(actualDir, 'capability-transient-state-geometry.json'), JSON.stringify({ full: stateBaseline, ...capabilityTransientStateEvidence }, null, 2), 'utf8')
        for (const transientGeometry of [capabilityLoadingGeometry, capabilityErrorGeometry]) {
          for (const key of stableKeys) expect(transientGeometry[key]).toEqual(stateBaseline[key])
          expect(transientGeometry.horizontalOverflowPx).toBe(0)
        }

        activeRoute = 'capabilities-interactions'
        await page.goto('/analytics/capabilities?month=2026-09&granularity=month')
        await expect(page.locator('.capability-directory-workspace')).toBeVisible()
        await page.waitForLoadState('networkidle')
        const maturityTable = page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table')
        const maturityRadarSvg = page.locator('.analytics-maturity-summary__radar .maturity-radar svg')
        await expect(maturityTable.locator('tbody tr')).toHaveCount(7)
        await expect.poll(() => maturityTable.innerText()).toContain('3.34')
        const maturityBeforeSelection = await maturityTable.innerText()
        const maturityRadarBeforeSelection = await maturityRadarSvg.evaluate((element) => element.innerHTML)
        const maturityBoundsBeforeSelection = await maturityTable.evaluate((element) => {
          const { x, width, height } = element.getBoundingClientRect()
          return [x, width, height]
        })
        const maturityYBeforeSelection = await maturityTable.evaluate((element) => element.getBoundingClientRect().y)
        const e2eCapability = generalCapabilities.find((entry) => entry.name === 'MR-E2E能力')
        const e2eButton = page.getByRole('button', { name: '查看能力：MR-E2E能力' })
        const pointerSelectionRequestStart = requests.length
        await e2eButton.click()
        await expect(e2eButton).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByRole('heading', { name: '研发能力 / MR-E2E能力' })).toBeVisible()
        await page.waitForLoadState('networkidle')
        const e2eMetricLabels = e2eCapability.metrics.filter((metric) => metric.type !== 'boolean').map((metric) => metric.name).sort()
        const e2eRenderedMetricLabels = (await page.locator('.capability-kpi-grid .metric-card__label').allInnerTexts()).sort()
        expect(e2eRenderedMetricLabels).toEqual(e2eMetricLabels)
        const e2eTableHeaders = await page.locator('.capability-comparison-grid .team-matrix__table thead th').allInnerTexts()
        for (const label of e2eMetricLabels) expect(e2eTableHeaders).toContain(label)
        expect(e2eTableHeaders).not.toContain('AI有效检视数')
        const maturityAfterPointer = await maturityTable.innerText()
        const maturityRadarAfterPointer = await maturityRadarSvg.evaluate((element) => element.innerHTML)
        const maturityBoundsAfterPointer = await maturityTable.evaluate((element) => {
          const { x, width, height } = element.getBoundingClientRect()
          return [x, width, height]
        })
        expect(maturityAfterPointer).toBe(maturityBeforeSelection)
        expect(maturityRadarAfterPointer).toBe(maturityRadarBeforeSelection)
        expect(maturityBoundsAfterPointer).toEqual(maturityBoundsBeforeSelection)
        await page.screenshot({ path: path.join(actualDir, 'capability-selection-pointer-mr-e2e.png'), fullPage: true })
        const maturityAfterPointerScreenshot = await maturityTable.innerText()
        const maturityRadarAfterPointerScreenshot = await maturityRadarSvg.evaluate((element) => element.innerHTML)
        expect(maturityAfterPointerScreenshot).toBe(maturityAfterPointer)
        expect(maturityRadarAfterPointerScreenshot).toBe(maturityRadarAfterPointer)
        interactions.capabilityDirectoryPointer = {
          selected: e2eCapability.name,
          expectedMetricLabels: e2eMetricLabels,
          renderedMetricLabels: e2eRenderedMetricLabels,
          teamDifferenceHeaders: e2eTableHeaders,
          maturityUnchanged: maturityAfterPointer === maturityBeforeSelection && maturityRadarAfterPointer === maturityRadarBeforeSelection,
          maturityScreenshotStateUnchanged: maturityAfterPointerScreenshot === maturityAfterPointer && maturityRadarAfterPointerScreenshot === maturityRadarAfterPointer,
          maturityBounds: maturityBoundsBeforeSelection,
          maturitySnapshot: { before: maturityBeforeSelection, pointer: maturityAfterPointer, pointerAfterScreenshot: maturityAfterPointerScreenshot },
          maturityYBeforeSelection,
          maturityYAfterSelection: await maturityTable.evaluate((element) => element.getBoundingClientRect().y),
          requests: requests.slice(pointerSelectionRequestStart).filter((request) => request.route === 'capabilities-interactions'),
        }
        const automationCapability = generalCapabilities.find((entry) => entry.name === '自动化构建部署')
        expect(automationCapability).toBeTruthy()
        const automationButton = page.getByRole('button', { name: '查看能力：自动化构建部署' })
        const selectionRequestStart = requests.length
        await automationButton.focus()
        await page.keyboard.press('Enter')
        await expect(automationButton).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByRole('heading', { name: '研发能力 / 自动化构建部署' })).toBeVisible()
        await page.waitForLoadState('networkidle')
        const expectedMetricLabels = automationCapability.metrics.filter((metric) => metric.type !== 'boolean').map((metric) => metric.name).sort()
        const renderedMetricLabels = (await page.locator('.capability-kpi-grid .metric-card__label').allInnerTexts()).sort()
        expect(renderedMetricLabels).toEqual(expectedMetricLabels)
        expect(renderedMetricLabels).not.toContain('成熟度评分')
        expect(renderedMetricLabels).not.toContain('评估覆盖团队')
        expect(await page.locator('.capability-boolean-status').count()).toBeGreaterThan(0)
        const maturityAfterKeyboard = await maturityTable.innerText()
        const maturityRadarAfterKeyboard = await maturityRadarSvg.evaluate((element) => element.innerHTML)
        const maturityBoundsAfterKeyboard = await maturityTable.evaluate((element) => {
          const { x, width, height } = element.getBoundingClientRect()
          return [x, width, height]
        })
        expect(maturityAfterKeyboard).toBe(maturityBeforeSelection)
        expect(maturityRadarAfterKeyboard).toBe(maturityRadarBeforeSelection)
        expect(maturityBoundsAfterKeyboard).toEqual(maturityBoundsBeforeSelection)
        await page.screenshot({ path: path.join(actualDir, 'capability-selection-keyboard-automation.png'), fullPage: true })
        const maturityAfterKeyboardScreenshot = await maturityTable.innerText()
        const maturityRadarAfterKeyboardScreenshot = await maturityRadarSvg.evaluate((element) => element.innerHTML)
        expect(maturityAfterKeyboardScreenshot).toBe(maturityAfterKeyboard)
        expect(maturityRadarAfterKeyboardScreenshot).toBe(maturityRadarAfterKeyboard)
        const selectionRequests = requests.slice(selectionRequestStart).filter((request) => request.route === 'capabilities-interactions')
        expect(selectionRequests.filter((request) => request.query.version_id && request.query.version_id !== 'all')).toHaveLength(0)
        const monthInput = page.getByRole('button', { name: '月份', exact: true })
        const monthDialog = page.getByRole('dialog', { name: '选择月份' })
        await monthInput.press('Enter')
        await expect(monthDialog).toBeVisible()
        await monthDialog.getByRole('button', { name: '8月', exact: true }).click()
        await expect(monthDialog).toBeHidden()
        await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBe('2026-08')
        await page.waitForLoadState('networkidle')
        const granularitySelect = page.getByRole('combobox', { name: '时间粒度', exact: true })
        const granularityValue = page.locator('.capability-page-actions .analytics-filter-card__value .ant-select')
        const weekRequestStart = requests.length
        await granularitySelect.press('Enter')
        await expect(granularitySelect).toHaveAttribute('aria-expanded', 'true')
        await granularitySelect.press('ArrowDown')
        await expect(page.locator('.ant-select-item-option-active')).toContainText('周')
        await granularitySelect.press('Enter')
        await expect(granularityValue).toContainText('周')
        await expect.poll(() => new URL(page.url()).searchParams.get('granularity')).toBe('week')
        await page.waitForLoadState('networkidle')
        const weekRequests = requests.slice(weekRequestStart).filter((request) => request.route === 'capabilities-interactions')
        expect(weekRequests.some((request) => request.path.endsWith('/api/compute') && request.query.dim === 'time' && request.query.gran === 'week')).toBe(true)
        expect(weekRequests.filter((request) => request.query.version_id && request.query.version_id !== 'all')).toHaveLength(0)
        const noScopedVersionRequests = requests.slice(pageRequestStart).filter((request) => request.route.startsWith('capabilities') && request.query.version_id && request.query.version_id !== 'all')
        expect(noScopedVersionRequests).toHaveLength(0)
        interactions.capabilityDirectoryKeyboard = {
          selected: automationCapability.name,
          expectedMetricLabels,
          renderedMetricLabels,
          maturityUnchanged: maturityAfterKeyboard === maturityBeforeSelection && maturityRadarAfterKeyboard === maturityRadarBeforeSelection,
          maturityScreenshotStateUnchanged: maturityAfterKeyboardScreenshot === maturityAfterKeyboard && maturityRadarAfterKeyboardScreenshot === maturityRadarAfterKeyboard,
          maturityBounds: maturityBoundsBeforeSelection,
          maturitySnapshot: { before: maturityBeforeSelection, keyboard: maturityAfterKeyboard, keyboardAfterScreenshot: maturityAfterKeyboardScreenshot },
          maturityYBeforeSelection,
          maturityYAfterSelection: await maturityTable.evaluate((element) => element.getBoundingClientRect().y),
          requests: selectionRequests,
        }
        interactions.capabilityMonthAndGranularity = { url: page.url(), month: await monthInput.innerText(), requests: weekRequests, granularity: await granularityValue.innerText(), focusedAfterSelection: await granularitySelect.evaluate((element) => element === document.activeElement) }
        const radarDetails = page.locator('.capability-page .analytics-maturity-summary__radar .maturity-radar__data')
        const radarDetailsSummary = radarDetails.locator('summary')
        await radarDetailsSummary.click()
        await expect(radarDetails).toHaveAttribute('open', '')
        await expect(radarDetails.getByRole('table').locator('tbody tr')).toHaveCount(7)
        const pointerOpened = await radarDetails.evaluate((element) => element.open)
        const radarTableOpenPath = path.join(actualDir, 'capability-radar-data-table-open.png')
        await page.screenshot({ path: radarTableOpenPath, fullPage: true })
        await radarDetailsSummary.click()
        await expect(radarDetails).not.toHaveAttribute('open', '')
        const pointerClosed = !(await radarDetails.evaluate((element) => element.open))
        await radarDetailsSummary.focus()
        await page.keyboard.press('Enter')
        await expect(radarDetails).toHaveAttribute('open', '')
        await expect(radarDetailsSummary).toBeFocused()
        const keyboardOpened = await radarDetails.evaluate((element) => element.open)
        const focusStayedAfterOpen = await radarDetailsSummary.evaluate((element) => element === document.activeElement)
        await page.keyboard.press('Enter')
        await expect(radarDetails).not.toHaveAttribute('open', '')
        await expect(radarDetailsSummary).toBeFocused()
        const keyboardClosed = !(await radarDetails.evaluate((element) => element.open))
        const focusStayedAfterClose = await radarDetailsSummary.evaluate((element) => element === document.activeElement)
        const radarTableClosedPath = path.join(actualDir, 'capability-radar-data-table-closed.png')
        await page.screenshot({ path: radarTableClosedPath, fullPage: true })
        interactions.capabilityRadarDataTable = {
          pointerOpened,
          pointerClosed,
          keyboardOpened,
          keyboardClosed,
          focusStayedAfterOpen,
          focusStayedAfterClose,
          axisRows: 7,
          openScreenshot: radarTableOpenPath,
          closedScreenshot: radarTableClosedPath,
        }
        expect(interactions.capabilityRadarDataTable.pointerClosed).toBe(true)
        expect(interactions.capabilityRadarDataTable.keyboardClosed).toBe(true)
        expect(interactions.capabilityRadarDataTable.focusStayedAfterClose).toBe(true)
      }
      if (item.id === 'team-detail' && foreignVersion && ownedVersion) {
        const versionControl = page.locator('.drilldown-page-actions select[aria-label="版本"]')
        interactions.teamVersionOptions = await versionControl.locator('option').evaluateAll((options) => options.map((option) => ({ value: option.value, label: option.textContent?.trim() })))
        const productlessVersionCandidatePresent = interactions.teamVersionOptions.some((option) => option.value === String(legacyVersion.id))
        const foreignVersionCandidatePresent = interactions.teamVersionOptions.some((option) => option.value === String(foreignVersion.id))
        const versionHeaderCrop = path.join(actualDir, 'team-version-candidates-header.png')
        const pageHeaderBounds = await page.locator('.drilldown-page-head').boundingBox()
        const sectionNavigationBounds = await page.locator('.drilldown-section-nav').boundingBox()
        await page.screenshot({
          path: versionHeaderCrop,
          clip: {
            x: Math.min(pageHeaderBounds.x, sectionNavigationBounds.x),
            y: pageHeaderBounds.y,
            width: Math.max(pageHeaderBounds.x + pageHeaderBounds.width, sectionNavigationBounds.x + sectionNavigationBounds.width) - Math.min(pageHeaderBounds.x, sectionNavigationBounds.x),
            height: sectionNavigationBounds.y + sectionNavigationBounds.height - pageHeaderBounds.y,
          },
        })
        await versionControl.click()
        const versionOptionsOpenScreenshot = path.join(actualDir, 'team-version-candidates-open.png')
        await page.screenshot({ path: versionOptionsOpenScreenshot })
        await versionControl.press('Escape')
        await expect(versionControl).toBeFocused()
        const issueBoardDirectory = path.join(baselineDir, 'comparisons', 'team-detail', 'issue-evidence')
        await mkdir(issueBoardDirectory, { recursive: true })
        const versionScopeBoard = path.join(issueBoardDirectory, `UI-TD-01-version-candidates-${viewportName}-reference-actual.png`)
        await captureReferenceActualBoard(page.context(), {
          referencePath: path.resolve('docs/ux/reference-crops/team-detail-header.png'),
          actualPath: versionHeaderCrop,
          outputPath: versionScopeBoard,
          width: viewport.width,
          heading: 'UI-TD-01 · 团队版本候选范围',
          note: '裁图按栏宽等比缩放；选择器交互、URL 与请求以原始浏览器记录为准。',
        })
        interactions.teamVersionCandidateEvidence = { actualHeaderCrop: versionHeaderCrop, referenceActualBoard: versionScopeBoard, optionsOpenScreenshot: versionOptionsOpenScreenshot, focusReturnedAfterEscape: await versionControl.evaluate((element) => element === document.activeElement) }
        interactions.productlessVersions = productlessVersions
        interactions.productlessVersion = { id: legacyVersion.id, name: legacyVersion.name, product_id: legacyVersion.product_id, candidatePresent: productlessVersionCandidatePresent }
        interactions.foreignVersion = { id: foreignVersion.id, name: foreignVersion.name, team_id: foreignVersion.team_id, product_id: foreignVersion.product_id, candidatePresent: foreignVersionCandidatePresent }
        expect(productlessVersionCandidatePresent).toBe(false)
        expect(foreignVersionCandidatePresent).toBe(false)

        await expect.poll(() => apiResponses.some((response) => (
          response.route === 'team-detail'
          && response.query.dim === 'iteration'
          && !response.query.version_id
          && response.query.metric_id === String(legacyMetric.id)
          && response.productlessHistoryPoint?.period_id === legacyIteration.id
        ))).toBe(true)
        interactions.allVersionsProductlessHistory = apiResponses.find((response) => (
          response.route === 'team-detail'
          && response.query.dim === 'iteration'
          && !response.query.version_id
          && response.query.metric_id === String(legacyMetric.id)
          && response.productlessHistoryPoint?.period_id === legacyIteration.id
        ))
        expect(interactions.allVersionsProductlessHistory.productlessHistoryPoint).toMatchObject({
          team_id: baselineTeamId,
          period_id: legacyIteration.id,
          fact_count: 1,
          numerator: visualDataset.productlessVersion.numerator,
          denominator: visualDataset.productlessVersion.denominator,
          value: visualDataset.productlessVersion.numerator / visualDataset.productlessVersion.denominator,
        })

        const invalidVersionUrl = `/analytics/teams/${baselineTeamId}?month=2026-09&cycle=half&version=${foreignVersion.id}`
        const invalidVersionRequestStart = requests.length
        activeRoute = 'team-detail-invalid-version-url'
        await page.goto(invalidVersionUrl)
        await expect(page.locator(item.root)).toBeVisible()
        await expect.poll(() => new URL(page.url()).searchParams.get('version')).toBeNull()
        await page.waitForLoadState('networkidle')
        const normalizedVersionRequests = requests.slice(invalidVersionRequestStart).filter((request) => request.route === 'team-detail-invalid-version-url')
        expect(normalizedVersionRequests.some((request) => String(request.query.version_id) === String(foreignVersion.id))).toBe(false)
        interactions.invalidForeignVersionUrl = { requestedUrl: invalidVersionUrl, normalizedUrl: page.url(), requests: normalizedVersionRequests }
        activeRoute = 'team-detail'
        await page.goto(item.url)
        await expect(page.locator(item.root)).toBeVisible()
        await page.waitForLoadState('networkidle')
        const keyMetricIds = new Set(catalog.filter((activity) => activity.kind === 'key').flatMap((activity) => activity.metrics.map((metric) => String(metric.id))))
        const lifecycleFilters = page.locator('.drilldown-lifecycle-section')
        const advancedFilters = lifecycleFilters.locator('details')
        if (!await advancedFilters.evaluate((element) => element.open)) await advancedFilters.locator('summary').click()
        const timePeriod = lifecycleFilters.getByRole('combobox', { name: '周期' })
        await expect(timePeriod).toBeEnabled()
        await timePeriod.selectOption('2026-09')
        await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('2026-09')
        const versionRequestStart = requests.length
        const scopedVersionControl = page.locator('.drilldown-page-actions select[aria-label="版本"]')
        const allVersionKpiValues = await page.locator('#team-overall .drilldown-kpi-sections .metric-card__value').allTextContents()
        const ownedOptionIndex = await scopedVersionControl.locator('option').evaluateAll(
          (options, versionId) => options.findIndex((option) => option.value === versionId),
          String(ownedVersion.id),
        )
        expect(ownedOptionIndex).toBeGreaterThan(0)
        await scopedVersionControl.click()
        const focusedAfterPointerOpen = await scopedVersionControl.evaluate((element) => element === document.activeElement)
        await scopedVersionControl.press('Home')
        for (let index = 0; index < ownedOptionIndex; index += 1) await scopedVersionControl.press('ArrowDown')
        await scopedVersionControl.press('Enter')
        await expect(page).toHaveURL(new RegExp(`version=${ownedVersion.id}`))
        await expect(page).toHaveURL(new RegExp('period=2026-09'))
        await expect(scopedVersionControl).toBeFocused()
        await page.waitForLoadState('networkidle')
        await expect(timePeriod).toHaveValue('2026-09')
        const ownedVersionKpiValues = await page.locator('#team-overall .drilldown-kpi-sections .metric-card__value').allTextContents()
        expect(ownedVersionKpiValues).not.toEqual(allVersionKpiValues)
        await expect(page.locator('#team-overall')).toContainText('领域参照')
        await expect(lifecycleFilters).toContainText('所有团队且不限版本')
        const selectedVersionRequests = requests.slice(versionRequestStart).filter((request) => request.route === 'team-detail')
        const scopedIrRequest = selectedVersionRequests.find((request) => request.path.endsWith('/api/data-metrics/overview') && request.query.version_id === String(ownedVersion.id))
        const referenceIrRequest = selectedVersionRequests.find((request) => request.path.endsWith('/api/data-metrics/overview') && request.query.version_id === 'all')
        expect(scopedIrRequest).toBeTruthy()
        expect(referenceIrRequest).toBeTruthy()
        expect(referenceIrRequest.query.from_month).toBe(scopedIrRequest.query.from_month)
        expect(referenceIrRequest.query.to_month).toBe(scopedIrRequest.query.to_month)
        const scopedTimeMetrics = selectedVersionRequests.filter((request) => request.path.endsWith('/api/compute')
          && request.query.dim === 'time' && keyMetricIds.has(String(request.query.metric_id))
          && request.query.version_id === String(ownedVersion.id))
        const unversionedTimeMetrics = selectedVersionRequests.filter((request) => request.path.endsWith('/api/compute')
          && request.query.dim === 'time' && keyMetricIds.has(String(request.query.metric_id))
          && !request.query.version_id)
        expect(new Set(scopedTimeMetrics.map((request) => request.query.metric_id)).size).toBe(keyMetricIds.size)
        expect(new Set(unversionedTimeMetrics.map((request) => request.query.metric_id)).size).toBe(keyMetricIds.size)
        for (const metricId of keyMetricIds) {
          const scoped = scopedTimeMetrics.find((request) => request.query.metric_id === metricId)
          const reference = unversionedTimeMetrics.find((request) => request.query.metric_id === metricId)
          expect(reference.query.gran).toBe(scoped.query.gran)
        }
        interactions.teamVersionSelection = {
          pointerOpened: focusedAfterPointerOpen,
          keyboardSelection: ['Home', ...Array.from({ length: ownedOptionIndex }, () => 'ArrowDown'), 'Enter'],
          focusedAfterSelection: await scopedVersionControl.evaluate((element) => element === document.activeElement),
          selectedPeriodBeforeAndAfter: { before: '2026-09', after: await timePeriod.inputValue() },
          allVersionKpiValues,
          ownedVersionKpiValues,
          valuesChanged: true,
        }
        const ownedVersionScreenshot = path.join(actualDir, 'team-owned-version-selected.png')
        await page.screenshot({ path: ownedVersionScreenshot, fullPage: true })
        const ownedVersionCrops = {}
        for (const [name, selector] of Object.entries({ overall: '#team-overall', lifecycle: '#team-lifecycle' })) {
          const crop = path.join(actualDir, `team-owned-version-${name}.png`)
          await page.locator(selector).screenshot({ path: crop })
          ownedVersionCrops[name] = crop
        }
        const versionReferenceActualBoard = path.join(issueBoardDirectory, `UI-TD-02-versionless-reference-${viewportName}-reference-actual.png`)
        await captureReferenceActualBoard(page.context(), {
          referencePath: path.resolve('docs/ux/reference-crops/team-detail-overall-performance.png'),
          actualPath: ownedVersionCrops.overall,
          outputPath: versionReferenceActualBoard,
          width: viewport.width,
          heading: 'UI-TD-02 · 版本筛选后的整体表现与领域参照',
          note: '比较选中版本后的当前团队 KPI 和核心趋势；选项值、无版本请求与缺失值状态见交互证据。',
        })
        const selectedVersionPeriodBounds = await timePeriod.boundingBox()
        const selectedVersionTrendGeometry = await page.locator('#team-lifecycle .overview-chart').evaluateAll((charts) => charts.map((chart) => ({
          label: chart.getAttribute('aria-label'),
          bounds: (() => { const rect = chart.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height].map((value) => Number(value.toFixed(2))) })(),
          plotBounds: chart.dataset.plotBounds?.split(',').map(Number) ?? null,
        })))
        interactions.teamOwnedVersionSelection = {
          id: ownedVersion.id,
          name: ownedVersion.name,
          team_id: ownedVersion.team_id,
          product_id: ownedVersion.product_id,
          url: page.url(),
          screenshot: ownedVersionScreenshot,
          crops: ownedVersionCrops,
          referenceActualBoard: versionReferenceActualBoard,
          periodControlBounds: selectedVersionPeriodBounds,
          trendGeometry: selectedVersionTrendGeometry,
          requests: selectedVersionRequests,
        }

        await expect(advancedFilters).toHaveAttribute('open', '')
        const iterationButton = lifecycleFilters.getByRole('group', { name: '统计维度' }).getByRole('button', { name: '按版本/迭代' })
        const iterationPeriod = lifecycleFilters.getByRole('combobox', { name: '周期' })
        await expect(iterationButton).toBeVisible()
        const iterationRequestStart = requests.length
        const iterationResponseStart = apiResponses.length
        const iterationResponseReadStart = apiResponseReads.length
        await iterationButton.focus()
        await iterationButton.press('Enter')
        await expect(iterationButton).toHaveAttribute('aria-pressed', 'true')
        const iterationControlFocusRetained = await iterationButton.evaluate((element) => element === document.activeElement)
        await expect.poll(() => new URL(page.url()).searchParams.get('dimension')).toBe('iteration')
        await expect.poll(() => new Set(apiResponses.slice(iterationResponseStart)
          .filter((response) => response.route === 'team-detail' && response.query.dim === 'iteration' && String(response.query.version_id) === String(ownedVersion.id))
          .map((response) => String(response.query.metric_id))).size).toBe(keyMetricIds.size)
        await page.waitForLoadState('networkidle')
        await Promise.all(apiResponseReads.slice(iterationResponseReadStart))
        const iterationRequests = requests.slice(iterationRequestStart).filter((request) => request.route === 'team-detail')
        const keyMetricRequests = iterationRequests.filter((request) => request.path.endsWith('/api/compute') && keyMetricIds.has(String(request.query.metric_id)))
        const versionedIterationRequests = keyMetricRequests.filter((request) => request.query.dim === 'iteration' && String(request.query.version_id) === String(ownedVersion.id))
        const dailyReferenceRequests = keyMetricRequests.filter((request) => request.query.dim === 'time' && request.query.gran === 'day' && !request.query.version_id)
        expect(new Set(versionedIterationRequests.map((request) => String(request.query.metric_id))).size).toBe(keyMetricIds.size)
        expect(new Set(dailyReferenceRequests.map((request) => String(request.query.metric_id))).size).toBe(keyMetricIds.size)
        await expect.poll(() => new Set(apiResponses.filter((response) => response.route === 'team-detail' && response.status === 200
          && response.query.dim === 'time' && response.query.gran === 'day' && !response.query.version_id
          && keyMetricIds.has(String(response.query.metric_id))).map((response) => String(response.query.metric_id))).size, { timeout: 30_000 }).toBe(keyMetricIds.size)
        await page.waitForLoadState('networkidle')
        const selectedIterationId = await iterationPeriod.inputValue()
        const selectedIteration = ownedVersion.iterations.find((iteration) => String(iteration.id) === String(selectedIterationId))
        expect(selectedIteration?.start_date).toBeTruthy()
        expect(selectedIteration?.end_date).toBeTruthy()
        const dateRangeReferences = [...keyMetricIds].map((metricId) => {
          const metric = catalog.flatMap((activity) => activity.metrics).find((entry) => String(entry.id) === metricId)
          const matchingDailyResponses = apiResponses.filter((entry) => entry.route === 'team-detail'
            && entry.query.metric_id === metricId && entry.query.dim === 'time' && entry.query.gran === 'day'
            && !entry.query.version_id)
          const response = matchingDailyResponses.find((entry) => entry.status === 200 && entry.dailyReferenceData)
          expect(response, `missing unversioned daily reference for metric ${metricId}: ${JSON.stringify(matchingDailyResponses)}`).toBeTruthy()
          const periodsById = new Map(response.dailyReferenceData.periods.map((period) => [String(period.id), period]))
          const dateRangePeriods = response.dailyReferenceData.periods.filter((period) => (
            period.start_date >= selectedIteration.start_date && period.end_date <= selectedIteration.end_date
          ))
          const teamContributions = response.dailyReferenceData.series.map((team) => {
            const points = (team.values ?? []).filter((point) => {
              if (point.fact_count === 0) return false
              const period = periodsById.get(String(point.period_id))
              return period?.start_date >= selectedIteration.start_date && period?.end_date <= selectedIteration.end_date
            })
            const sum = (field, fallback) => points.reduce((total, point) => {
              const value = point[field] ?? (fallback ? point[fallback] : null) ?? 0
              return total + (Number.isFinite(value) ? value : 0)
            }, 0)
            return {
              teamId: team.team_id,
              factDays: points.length,
              factCount: points.reduce((total, point) => total + (Number.isFinite(point.fact_count) ? point.fact_count : 0), 0),
              dailyFactDates: points.map((point) => String(point.period_id)),
              rawTotals: {
                numerator: sum('numerator'),
                denominator: sum('denominator'),
                estimated: sum('estimated', 'numerator'),
                actual: sum('actual', 'denominator'),
              },
              derivedMetricValue: valueFromSums(metric, points),
            }
          })
          const validTeamValues = teamContributions.map((team) => team.derivedMetricValue).filter(Number.isFinite)
          const equalTeamAverage = validTeamValues.length
            ? validTeamValues.reduce((total, value) => total + value, 0) / validTeamValues.length
            : null
          const implementationAverage = iterationReferenceAverage(response.dailyReferenceData, [selectedIteration], metric)[0]?.value ?? null
          expect(Math.abs((equalTeamAverage ?? 0) - (implementationAverage ?? 0))).toBeLessThan(1e-10)
          const axisDates = dateRangePeriods.map((period) => period.start_date)
          return {
            metricId,
            metric: metric.name,
            metricType: metric.type,
            formula: metric.type === 'penetration' || metric.type === 'ratio' ? 'per-team sum(numerator)/sum(denominator), then equal mean'
              : metric.type === 'efficiency' ? 'per-team existing efficiency formula over summed estimated/actual, then equal mean'
                : metric.type === 'count' ? 'per-team sum(numerator), then equal mean' : 'unsupported for an arithmetic reference',
            selectedIteration: selectedIteration.id,
            startDate: selectedIteration.start_date,
            endDate: selectedIteration.end_date,
            dateAxis: { periodCount: dateRangePeriods.length, firstDate: axisDates[0] ?? null, lastDate: axisDates.at(-1) ?? null, coversStart: axisDates.includes(selectedIteration.start_date), coversEnd: axisDates.includes(selectedIteration.end_date) },
            referenceTeamCount: response.dailyReferenceData.series.length,
            teamContributions,
            validTeamCount: validTeamValues.length,
            equalTeamAverage,
          }
        })
        await expect(lifecycleFilters.getByText('正在更新指标数据…')).toHaveCount(0, { timeout: 30_000 })
        const referenceStage = lifecycleFilters.getByRole('button', { name: /开发设计/ }).first()
        await referenceStage.click()
        await expect(referenceStage).toHaveAttribute('aria-pressed', 'true')
        const referenceStageCatalogEntry = catalog.find((activity) => activity.name === '开发设计')
        const referenceStageMetricIds = new Set(referenceStageCatalogEntry?.metrics.map((metric) => String(metric.id)) ?? [])
        expect(referenceStageMetricIds.size).toBeGreaterThan(0)
        const mainChartLabels = await page.locator('#team-lifecycle .overview-chart').evaluateAll((charts) => charts.map((chart) => chart.getAttribute('aria-label')))
        expect(mainChartLabels.some((label) => label?.includes('领域参照（所有团队，不限版本）'))).toBe(true)
        const iterationScreenshot = path.join(actualDir, 'team-owned-version-iteration-selected.png')
        await page.screenshot({ path: iterationScreenshot, fullPage: true })
        const iterationLifecycleCrop = path.join(actualDir, 'team-owned-version-iteration-lifecycle.png')
        await page.locator('#team-lifecycle').screenshot({ path: iterationLifecycleCrop })
        const iterationReferenceActualBoard = path.join(issueBoardDirectory, `UI-TD-04-iteration-reference-${viewportName}-reference-actual.png`)
        await captureReferenceActualBoard(page.context(), {
          referencePath: path.resolve('docs/ux/reference-crops/team-detail-lifecycle.png'),
          actualPath: iterationLifecycleCrop,
          outputPath: iterationReferenceActualBoard,
          width: viewport.width,
          heading: 'UI-TD-04 · 版本迭代的同日期范围领域参照',
          note: '当前团队按版本迭代读取；领域参照按迭代起止日期从所有团队、全部版本的 FactRecord 重算。',
        })
        const iterationPanelBounds = await page.locator('#team-lifecycle').boundingBox()
        const iterationChartGeometry = await page.locator('#team-lifecycle .overview-chart').evaluateAll((charts) => charts.map((chart) => ({
          label: chart.getAttribute('aria-label'),
          bounds: (() => { const rect = chart.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height].map((value) => Number(value.toFixed(2))) })(),
          plotBounds: chart.dataset.plotBounds?.split(',').map(Number) ?? null,
        })))
        const detailButton = lifecycleFilters.getByRole('button', { name: '详细数据' }).first()
        await detailButton.click()
        await expect(lifecycleFilters.locator('.drilldown-detail-section').first()).toBeVisible()
        await expect(lifecycleFilters.locator('.drilldown-detail-section').first()).toContainText('相同起止日期、所有团队不限版本重算')
        const iterationDetailOpenScreenshot = path.join(actualDir, 'team-owned-version-iteration-detail-open.png')
        await page.screenshot({ path: iterationDetailOpenScreenshot, fullPage: true })
        const iterationDetailOpenCrop = path.join(actualDir, 'team-owned-version-iteration-detail-open-lifecycle.png')
        await page.locator('#team-lifecycle').screenshot({ path: iterationDetailOpenCrop })
        const iterationDetailChartGeometry = await page.locator('#team-lifecycle .overview-chart').evaluateAll((charts) => charts.map((chart) => ({
          label: chart.getAttribute('aria-label'),
          bounds: (() => { const rect = chart.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height].map((value) => Number(value.toFixed(2))) })(),
          plotBounds: chart.dataset.plotBounds?.split(',').map(Number) ?? null,
        })))
        interactions.teamIterationSelection = {
          action: { control: '按版本/迭代', method: 'keyboard Enter', selected: true, focusRetained: iterationControlFocusRetained, stageSelection: '开发设计', detailAction: 'pointer click on 详细数据' },
          url: page.url(),
          dimension: new URL(page.url()).searchParams.get('dimension'),
          selectedVersion: new URL(page.url()).searchParams.get('version'),
          selectedVersionOwnerTeamId: ownedVersion.team_id,
          selectedPeriodId: await iterationPeriod.inputValue(),
          selectedPeriodLabel: await iterationPeriod.locator('option:checked').textContent(),
          requests: iterationRequests,
          keyMetricRequests,
          versionedIterationMetricCount: new Set(versionedIterationRequests.map((request) => String(request.query.metric_id))).size,
          unversionedDailyReferenceMetricCount: new Set(dailyReferenceRequests.map((request) => String(request.query.metric_id))).size,
          dateRangeReferences,
          selectedStageMetrics: { stage: referenceStageCatalogEntry.name, metricIds: [...referenceStageMetricIds], calculations: dateRangeReferences.filter((item) => referenceStageMetricIds.has(String(item.metricId))) },
          chartLabels: mainChartLabels,
          panelBounds: iterationPanelBounds,
          chartGeometry: iterationChartGeometry,
          detailChartGeometry: iterationDetailChartGeometry,
          referenceActualBoard: iterationReferenceActualBoard,
          screenshot: iterationScreenshot,
          lifecycleCrop: iterationLifecycleCrop,
          detailOpenScreenshot: iterationDetailOpenScreenshot,
          detailOpenLifecycleCrop: iterationDetailOpenCrop,
        }
      }
      let teamStateEvidence = []
      let teamTransientStateEvidence = {}
      let teamPageScrollEvidence = null
      let teamTDFindingsEvidence = null
      if (item.id === 'team-detail') {
        for (const [state, month] of [['full', '2026-09'], ['partial', '2026-08'], ['empty', '2025-01']]) {
          const emptyDataRoutes = ['**/api/compute?*', '**/api/data-metrics/overview?*', '**/api/facts?*', '**/api/maturity/records?*', '**/api/maturity/overview?*']
          if (state === 'empty') for (const route of emptyDataRoutes) await page.route(route, emptyTeamVisualData)
          activeRoute = `team-detail-${state}`
          await page.goto(`/analytics/teams/${item.teamId}?month=${month}&period=${month}&cycle=half`)
          await expect(page.locator(item.root)).toBeVisible()
          await page.waitForLoadState('networkidle')
          const advancedFilters = page.locator('#team-lifecycle details.activity-filter-groups__advanced')
          if (await advancedFilters.evaluate((node) => node.open)) await advancedFilters.locator('summary').click()
          if (state === 'empty') {
            const emptyKpiValues = await page.locator('#team-overall .metric-card__value').allTextContents()
            const emptyLifecycleValues = await page.locator('#team-lifecycle .drilldown-lifecycle-metric b').allTextContents()
            const emptyLifecycleStates = await page.locator('#team-lifecycle .drilldown-activity-plot [role="status"]').allTextContents()
            const emptyMaturityCells = await page.locator('#team-maturity .maturity-matrix__cell--missing').allTextContents()
            expect(emptyKpiValues).toHaveLength(8)
            expect(emptyKpiValues.every((text) => text.trim().startsWith('—'))).toBe(true)
            expect(emptyLifecycleValues.length).toBeGreaterThan(0)
            expect(emptyLifecycleValues.every((text) => text.trim() === '—')).toBe(true)
            expect(emptyLifecycleStates.length).toBeGreaterThan(0)
            expect(emptyLifecycleStates.every((text) => text.includes('暂无数据'))).toBe(true)
            expect(emptyMaturityCells.length).toBeGreaterThan(0)
            expect(emptyMaturityCells.every((text) => text.trim() === '未评估')).toBe(true)
          }
          const stateGeometry = await measureTeamDetailState(page)
          const screenshot = path.join(actualDir, `team-${state}-state.png`)
          await page.screenshot({ path: screenshot, fullPage: true })
          const crops = {}
          for (const [area, selector] of Object.entries({ overall: '#team-overall', lifecycle: '#team-lifecycle', maturity: '#team-maturity' })) {
            const crop = path.join(actualDir, `team-${state}-${area}.png`)
            await page.locator(selector).screenshot({ path: crop })
            crops[area] = crop
          }
          const comparisonBoards = state === 'empty'
            ? await captureTeamStateBoards(page.context(), { issueId: 'UI-TD-05', state, viewportName, width: viewport.width, actualCrops: crops, outputDirectory: path.join(baselineDir, 'comparisons', 'team-detail', 'issue-evidence') })
            : undefined
          if (state === 'full') {
            const issueBoardDirectory = path.join(baselineDir, 'comparisons', 'team-detail', 'issue-evidence')
            const actualCrop = path.join(actualDir, 'team-key-findings-composition.png')
            const comparisonBoard = path.join(issueBoardDirectory, `UI-TD-03-key-findings-${viewportName}-reference-actual.png`)
            await page.locator('#team-maturity').screenshot({ path: actualCrop })
            const actualText = await page.locator('#team-maturity').innerText()
            const findingsLabelCount = await page.locator('#team-maturity').getByText('关键发现', { exact: true }).count()
            await captureReferenceActualBoard(page.context(), {
              referencePath: path.resolve('docs/ux/reference-crops/team-detail-maturity-reference-edge.png'),
              actualPath: actualCrop,
              outputPath: comparisonBoard,
              width: viewport.width,
              heading: `UI-TD-03 · 团队详情成熟度与关键发现构图 · ${viewportName}`,
              note: 'Reference 的关键发现示例不定义业务内容。实际仅显示已有成熟度矩阵/雷达；当前无获批的关键发现数据或文案合同，保留差异待用户处置。',
            })
            teamTDFindingsEvidence = {
              issueId: 'UI-TD-03-KEY-FINDINGS-COMPOSITION',
              status: 'USER_DISPOSITION_PENDING',
              reference: 'docs/ux/reference-crops/team-detail-maturity-reference-edge.png',
              actualCrop,
              comparisonBoard,
              actualMaturityPanelBounds: stateGeometry.maturityPanel,
              actualMaturityModuleBounds: stateGeometry.maturityModules,
              actualContainsKeyFindingsLabel: findingsLabelCount > 0,
              actualMaturityText: actualText,
              disposition: 'Do not copy Reference example claims or derive new findings without an approved data/copy contract.',
            }
            await writeFile(path.join(actualDir, 'team-key-findings-evidence.json'), JSON.stringify(teamTDFindingsEvidence, null, 2), 'utf8')
          }
          teamStateEvidence.push({
            state,
            month,
            url: page.url(),
            dataStateMode: state === 'empty' ? 'Golden API response facts cleared while period axes, activity catalog, matrix, and radar geometry remain' : 'Golden backend response',
            emptyAssertions: state === 'empty' ? ['8 KPI values missing', 'lifecycle values missing', 'lifecycle trend hosts announce no data', 'maturity cells say 未评估'] : undefined,
            geometry: stateGeometry,
            screenshot,
            crops,
            comparisonBoards,
          })
          if (state === 'full') {
            const scrollBounds = await page.evaluate(() => ({
              scrollHeight: document.documentElement.scrollHeight,
              viewportHeight: window.innerHeight,
              horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            }))
            const maxScrollY = Math.max(0, scrollBounds.scrollHeight - scrollBounds.viewportHeight)
            await page.mouse.move(420, Math.min(viewport.height - 40, 820))
            await page.mouse.wheel(0, maxScrollY + viewport.height)
            await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(maxScrollY)
            const bottomScreenshot = path.join(actualDir, 'team-scrolled-to-bottom.png')
            await page.screenshot({ path: bottomScreenshot })
            const bottomScrollY = await page.evaluate(() => window.scrollY)
            await page.mouse.wheel(0, -(maxScrollY + viewport.height))
            await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
            teamPageScrollEvidence = {
              viewport: viewportName,
              scrollHeight: scrollBounds.scrollHeight,
              viewportHeight: scrollBounds.viewportHeight,
              maxScrollY,
              bottomScrollY,
              reachedDocumentEnd: bottomScrollY + scrollBounds.viewportHeight >= scrollBounds.scrollHeight - 1,
              returnedToTop: await page.evaluate(() => window.scrollY === 0),
              horizontalOverflowPx: scrollBounds.horizontalOverflowPx,
              bottomScreenshot,
            }
            expect(teamPageScrollEvidence.reachedDocumentEnd).toBe(true)
            expect(teamPageScrollEvidence.returnedToTop).toBe(true)
            expect(teamPageScrollEvidence.horizontalOverflowPx).toBe(0)
            teamStateEvidence.at(-1).pageScroll = teamPageScrollEvidence
            await writeFile(path.join(actualDir, 'team-page-scroll-evidence.json'), JSON.stringify(teamPageScrollEvidence, null, 2), 'utf8')
          }
          if (state === 'empty') for (const route of emptyDataRoutes) await page.unroute(route, emptyTeamVisualData)
        }
        const stableKeys = ['pageRoot', 'header', 'storySections', 'overallKpiRows', 'overallKpiCards', 'overallTrendCards', 'overallPlotHosts', 'lifecycleCards', 'lifecycleTrendCards', 'lifecyclePlotHosts', 'maturityPanel', 'maturityCategories', 'maturityModules', 'maturityTable', 'maturityRadar']
        const fullGeometry = teamStateEvidence[0].geometry
        const differences = teamStateEvidence.slice(1).map((state) => ({
          state: state.state,
          differences: stableKeys.filter((key) => JSON.stringify(state.geometry[key]) !== JSON.stringify(fullGeometry[key])).map((key) => ({ key, full: fullGeometry[key], state: state.geometry[key] })),
        }))
        interactions.teamDataStateGeometry = { stable: differences.every((state) => state.differences.length === 0), differences }
        await writeFile(path.join(actualDir, 'team-state-geometry.json'), JSON.stringify({ fixture: 'overview-golden-2026-09-v1', viewports: [viewport.width, viewport.height], states: teamStateEvidence, geometryComparison: interactions.teamDataStateGeometry }, null, 2), 'utf8')
        const maturityEntryTarget = viewport.height - 40
        expect(fullGeometry.maturityPanel[1]).toBeLessThanOrEqual(maturityEntryTarget)
        expect(fullGeometry.overallKpiCards.every((bounds) => bounds[3] === 90)).toBe(true)
        expect(fullGeometry.lifecycleCards.every((bounds) => bounds[3] === 88)).toBe(true)
        const lifecyclePlotHeights = fullGeometry.lifecycleEffectivePlots.map((plot) => plot.effectivePlot?.[3] ?? 0)
        const overallPlotHeights = fullGeometry.overallEffectivePlots.map((plot) => plot.effectivePlot?.[3] ?? 0)
        expect(overallPlotHeights).toHaveLength(2)
        expect(overallPlotHeights.every((height) => height >= 80)).toBe(true)
        expect(fullGeometry.overallEffectivePlots.every((plot) => Array.isArray(plot.effectivePlot) && plot.effectivePlot[3] >= 80)).toBe(true)
        expect(lifecyclePlotHeights).toHaveLength(2)
        expect(lifecyclePlotHeights.every((height) => height >= 70)).toBe(true)
        expect(interactions.teamDataStateGeometry.stable).toBe(true)
        expect(teamStateEvidence.every((state) => state.geometry.horizontalOverflowPx === 0)).toBe(true)

        const teamDataRoutes = ['**/api/compute?*', '**/api/data-metrics/overview?*', '**/api/facts?*', '**/api/maturity/records?*', '**/api/maturity/overview?*']
        const delayTeamData = async (route) => {
          const response = await route.fetch()
          await new Promise((resolve) => setTimeout(resolve, 1200))
          await route.fulfill({ response })
        }
        for (const route of teamDataRoutes) await page.route(route, delayTeamData)
        activeRoute = 'team-detail-loading'
        await page.goto(`/analytics/teams/${item.teamId}?month=2026-07&cycle=half`)
        await expect(page.locator('.drilldown-overall-section .metric-card--loading').first()).toBeVisible()
        await expect(page.locator('#team-maturity .drilldown-maturity__feedback')).toHaveText('正在加载成熟度画像…')
        const maturityLoadingCells = await page.locator('#team-maturity .drilldown-maturity__module:first-child .maturity-matrix__cell--missing').allTextContents()
        expect(maturityLoadingCells.length).toBeGreaterThan(0)
        expect(maturityLoadingCells.every((text) => text.trim() === '…')).toBe(true)
        const loadingGeometry = await measureTeamDetailState(page)
        const loadingScreenshot = path.join(actualDir, 'team-loading-state.png')
        await page.screenshot({ path: loadingScreenshot, fullPage: true })
        const loadingCrops = {}
        for (const [area, selector] of Object.entries({ overall: '#team-overall', lifecycle: '#team-lifecycle', maturity: '#team-maturity' })) {
          const crop = path.join(actualDir, `team-loading-${area}.png`)
          await page.locator(selector).screenshot({ path: crop })
          loadingCrops[area] = crop
        }
        const loadingComparisonBoards = await captureTeamStateBoards(page.context(), {
          issueId: 'UI-TD-06', state: 'loading', viewportName, width: viewport.width,
          actualCrops: loadingCrops, outputDirectory: path.join(baselineDir, 'comparisons', 'team-detail', 'issue-evidence'),
        })
        teamTransientStateEvidence.loading = { url: page.url(), geometry: loadingGeometry, screenshot: loadingScreenshot, crops: loadingCrops, comparisonBoards: loadingComparisonBoards }
        await page.waitForLoadState('networkidle')
        for (const route of teamDataRoutes) await page.unroute(route, delayTeamData)

        const failTeamData = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Visual error fixture' }) })
        for (const route of teamDataRoutes) await page.route(route, failTeamData)
        activeRoute = 'team-detail-error'
        await page.goto(`/analytics/teams/${item.teamId}?month=2026-07&cycle=half`)
        await expect(page.locator('#team-maturity [role="alert"]')).toBeVisible()
        await expect(page.locator('.drilldown-overall-section [role="alert"]').first()).toBeVisible()
        await expect(page.locator('.drilldown-overall-section .drilldown-team-note')).toContainText('当前团队值与领域参照均暂不可用。')
        await expect(page.locator('.drilldown-overall-section')).toContainText('本团队与领域参照数据暂时无法加载，请重试。')
        await expect(page.locator('.drilldown-shell')).not.toContainText('Visual error fixture')
        await expect(page.locator('.drilldown-error').first()).toContainText('本团队与领域参照数据暂时无法加载，请重试。')
        await expect(page.getByRole('button', { name: '重试' }).first()).toBeVisible()
        const errorTitles = await page.locator('.drilldown-shell [title]').evaluateAll((elements) => elements.map((element) => element.getAttribute('title') ?? '').filter((title) => title.includes('Visual error fixture')))
        expect(errorTitles).toEqual([])
        const errorGeometry = await measureTeamDetailState(page)
        const errorScreenshot = path.join(actualDir, 'team-error-state.png')
        await page.screenshot({ path: errorScreenshot, fullPage: true })
        const errorCrops = {}
        for (const [area, selector] of Object.entries({ overall: '#team-overall', lifecycle: '#team-lifecycle', maturity: '#team-maturity' })) {
          const crop = path.join(actualDir, `team-error-${area}.png`)
          await page.locator(selector).screenshot({ path: crop })
          errorCrops[area] = crop
        }
        const errorComparisonBoards = await captureTeamStateBoards(page.context(), {
          issueId: 'UI-TD-06', state: 'error', viewportName, width: viewport.width,
          actualCrops: errorCrops, outputDirectory: path.join(baselineDir, 'comparisons', 'team-detail', 'issue-evidence'),
        })
        teamTransientStateEvidence.error = { url: page.url(), geometry: errorGeometry, screenshot: errorScreenshot, crops: errorCrops, comparisonBoards: errorComparisonBoards }
        const retryUrl = page.url()
        const retryRequestStart = requests.length
        const retryNavigation = page.waitForNavigation({ waitUntil: 'networkidle' })
        await page.getByRole('button', { name: '重试' }).first().click()
        await retryNavigation
        expect(page.url()).toBe(retryUrl)
        await expect(page.locator('.drilldown-shell')).toContainText('本团队与领域参照数据暂时无法加载，请重试。')
        const retryGeometry = await measureTeamDetailState(page)
        expect(retryGeometry).toEqual(errorGeometry)
        const retryRequests = requests.slice(retryRequestStart).filter((request) => request.route === 'team-detail-error')
        expect(retryRequests.length).toBeGreaterThan(0)
        teamTransientStateEvidence.error.retry = { action: '重试', requests: retryRequests.length, currentUrlPreserved: true, geometryStable: true }
        await page.waitForLoadState('networkidle')
        for (const route of teamDataRoutes) await page.unroute(route, failTeamData)
        const transientDifferences = ['loading', 'error'].map((state) => ({
          state,
          differences: stableKeys.filter((key) => JSON.stringify(teamTransientStateEvidence[state].geometry[key]) !== JSON.stringify(fullGeometry[key])).map((key) => ({ key, full: fullGeometry[key], state: teamTransientStateEvidence[state].geometry[key] })),
        }))
        teamTransientStateEvidence.geometryComparison = { stable: transientDifferences.every((state) => state.differences.length === 0), differences: transientDifferences }
        expect(teamTransientStateEvidence.geometryComparison.stable).toBe(true)
        expect(teamTransientStateEvidence.loading.geometry.horizontalOverflowPx).toBe(0)
        expect(teamTransientStateEvidence.error.geometry.horizontalOverflowPx).toBe(0)
        await writeFile(path.join(actualDir, 'team-transient-state-geometry.json'), JSON.stringify(teamTransientStateEvidence, null, 2), 'utf8')
      }
      const record = {
        route: item.id,
        initialUrl,
        finalUrl: page.url(),
        viewport: viewportName,
        title: await page.title(),
        geometry,
        interactions,
        activityR2IssueBoards,
        activityR3IssueBoards,
        activityR3Geometry,
        activityR4IssueBoards,
        activityR4Geometry,
        activityR4FilterInteractions,
        activityR5FilterChevronEvidence,
        activityReferenceState,
        activityStateEvidence,
        activityTransientStateEvidence,
        capabilityStateEvidence,
        capabilityTransientStateEvidence,
        teamStateEvidence,
        teamTransientStateEvidence,
        teamPlotGeometryEvidence: item.id === 'team-detail' && teamStateEvidence[0] ? {
          referenceViewport: viewportName,
          overallPlotHosts: teamStateEvidence[0].geometry.overallPlotHosts,
          overallEffectivePlots: teamStateEvidence[0].geometry.overallEffectivePlots,
          overallEffectivePlotHeights: teamStateEvidence[0].geometry.overallEffectivePlots.map((plot) => plot.effectivePlot?.[3] ?? null),
          lifecyclePlotHosts: teamStateEvidence[0].geometry.lifecyclePlotHosts,
          lifecycleEffectivePlots: teamStateEvidence[0].geometry.lifecycleEffectivePlots,
          lifecycleEffectivePlotHeights: teamStateEvidence[0].geometry.lifecycleEffectivePlots.map((plot) => plot.effectivePlot?.[3] ?? null),
          minima: { overallPx: 80, lifecyclePx: 70 },
        } : undefined,
        teamPageScrollEvidence,
        teamTDFindingsEvidence,
        screenshots: { viewport: viewportScreenshot, fullPage: fullPageScreenshot },
        viewportReferenceActualBoard,
        fullPageReferenceActualBoard,
      }
      evidence.push(record)
      await writeFile(path.join(actualDir, 'geometry.json'), JSON.stringify(record, null, 2), 'utf8')
    }
  }
  await Promise.all(apiResponseReads)
  const activityFullResponseEvidence = apiResponses.filter((response) => response.route === 'activities-full' && response.query.dim === 'time')
  expect(activityFullResponseEvidence.some((response) => response.numericTeamPoints > 0 && response.numericMeanPoints > 0)).toBe(true)
  await writeFile(path.join(baselineDir, 'candidate-evidence.json'), JSON.stringify({ fixture: 'overview-golden-2026-09-v1', note: 'Activity and Capability issue candidates are independently reviewed; Team Detail version scoping is implemented and browser-probed while other Team Detail issues remain open. The Team empty visual state clears Golden API response facts while retaining catalog, period-axis and geometry structure. Geometry records are not independent-review results.', baselineTeam: teams[0], productlessVersions, versions: versions.map(({ id, name, product_id, team_id }) => ({ id, name, product_id, team_id })), pages: evidence, requests, apiResponses }, null, 2), 'utf8')
})

test('UI-ACT-18 opens Activity Month and Statistical Period pickers visibly by pointer and keyboard', async ({ page }) => {
  test.setTimeout(120_000)
  const issueDir = path.join(outputDir, 'UI-ACT-18-ACTIVITY-FILTER-CHEVRON-NATIVE-OPEN')
  await mkdir(issueDir, { recursive: true })
  const requests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) requests.push({ method: request.method(), path: url.pathname, query: Object.fromEntries(url.searchParams) })
  })
  await login(page)
  const viewportEvidence = []

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const viewportName = `${viewport.width}x${viewport.height}`
    await page.goto('/analytics/activities?month=2026-09&cycle=half')
    await expect(page.locator('.activity-workspace')).toBeVisible()
    await page.waitForLoadState('networkidle')

    const monthTrigger = page.getByRole('button', { name: '月份', exact: true })
    const monthDialog = page.getByRole('dialog', { name: '选择月份' })
    const cycleControl = page.getByRole('combobox', { name: '统计周期', exact: true })
    const cycleArrow = page.locator('.activity-page-actions .ant-select-suffix')
    const monthArrow = monthTrigger.locator('.anticon-down')
    const viewportSize = page.viewportSize()

    await monthTrigger.focus()
    await monthTrigger.press('Enter')
    await expect(monthDialog).toBeVisible()
    const monthCardBoundsAtOpen = await page.locator('.activity-page-actions .analytics-filter-card--month').boundingBox()
    const monthTriggerBoundsAtOpen = await monthTrigger.boundingBox()
    const keyboardMonthBounds = await monthDialog.boundingBox()
    expect(keyboardMonthBounds).not.toBeNull()
    expect(monthCardBoundsAtOpen).not.toBeNull()
    expect(monthTriggerBoundsAtOpen).not.toBeNull()
    expect(keyboardMonthBounds.x).toBeGreaterThanOrEqual(0)
    expect(keyboardMonthBounds.y).toBeGreaterThanOrEqual(0)
    expect(keyboardMonthBounds.x + keyboardMonthBounds.width).toBeLessThanOrEqual(viewportSize.width)
    expect(keyboardMonthBounds.y + keyboardMonthBounds.height).toBeLessThanOrEqual(viewportSize.height)
    expect(Math.abs(keyboardMonthBounds.x + keyboardMonthBounds.width - monthCardBoundsAtOpen.x - monthCardBoundsAtOpen.width)).toBeLessThanOrEqual(2)
    expect(keyboardMonthBounds.y - monthCardBoundsAtOpen.y - monthCardBoundsAtOpen.height).toBeGreaterThanOrEqual(6)
    expect(keyboardMonthBounds.y - monthCardBoundsAtOpen.y - monthCardBoundsAtOpen.height).toBeLessThanOrEqual(10)
    await expect(monthDialog.getByRole('button', { name: '9月', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(monthDialog).toBeHidden()
    await expect(monthTrigger).toBeFocused()

    const monthRequestOffset = requests.length
    const monthArrowBounds = await monthArrow.boundingBox()
    await page.mouse.click(monthArrowBounds.x + monthArrowBounds.width / 2, monthArrowBounds.y + monthArrowBounds.height / 2)
    await expect(monthDialog).toBeVisible()
    const monthPointerBounds = await monthDialog.boundingBox()
    expect(monthPointerBounds).not.toBeNull()
    expect(monthPointerBounds.x).toBeGreaterThanOrEqual(0)
    expect(monthPointerBounds.y).toBeGreaterThanOrEqual(0)
    expect(monthPointerBounds.x + monthPointerBounds.width).toBeLessThanOrEqual(viewportSize.width)
    expect(monthPointerBounds.y + monthPointerBounds.height).toBeLessThanOrEqual(viewportSize.height)
    const monthOpenScreenshot = path.join(issueDir, `${viewportName}-month-picker-open.png`)
    await page.screenshot({ path: monthOpenScreenshot })
    await monthDialog.getByRole('button', { name: '10月', exact: true }).click()
    await expect(monthTrigger).toContainText('2026年10月')
    await expect(page.getByRole('heading', { name: '月度核心成效 · 2026-10' })).toBeVisible()
    await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBeNull()
    expect(new URL(page.url()).searchParams.get('period')).toBe('2026-09')
    await page.waitForLoadState('networkidle')
    const monthRequest = requests.slice(monthRequestOffset).find((request) => request.path === '/api/data-metrics/overview' && request.query.to_month === '2026-10') ?? null
    expect(monthRequest).not.toBeNull()

    const filterActualPath = path.join(issueDir, `${viewportName}-closed-filter-actual.png`)
    const referenceActualPath = path.join(issueDir, `${viewportName}-reference-actual.png`)
    await page.locator('.activity-page-actions .analytics-global-filter-toolbar').screenshot({ path: filterActualPath })
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/activity-header-filters.png'),
      actualPath: filterActualPath,
      outputPath: referenceActualPath,
      width: viewport.width,
      heading: `UI-ACT-18 · 活动筛选弹层修正 · ${viewportName}`,
      note: '闭合状态按批准 Reference 对照；月份和周期弹层的打开位置另以同视口实际截图与 DOM 矩形记录。',
    })

    const periodSection = page.locator('.activity-workspace > .analytics-section:nth-of-type(2)')
    const periodHeadingBefore = await periodSection.innerText()
    const monthlySummaryBefore = await page.locator('.activity-raw-summary-table').innerText()
    const headerGeometryBeforePeriodOpen = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return [x, y, width, height]
      }
      return {
        actions: rect(document.querySelector('.activity-page-actions')),
        toolbar: rect(document.querySelector('.activity-page-actions .analytics-global-filter-toolbar')),
        filters: rect(document.querySelector('.activity-page-actions .analytics-global-filter-toolbar .filter-toolbar__filters')),
        cards: [...document.querySelectorAll('.activity-page-actions .analytics-filter-card')].map(rect),
      }
    })
    const cycleRequestOffset = requests.length
    await cycleArrow.click()
    await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
    await expect(cycleControl).toBeFocused()
    await expect(page.locator('.ant-select-item-option').filter({ hasText: '年度累计' })).toBeVisible()
    const periodPopupAssociation = await cycleControl.evaluate((input) => {
      const box = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return [x, y, width, height]
      }
      const listboxId = input.getAttribute('aria-controls')
      const controlledListbox = listboxId ? document.getElementById(listboxId) : null
      const yearOption = [...document.querySelectorAll('.ant-select-item-option')].find((item) => item.innerText.includes('年度累计'))
      const popup = controlledListbox?.closest('.ant-select-dropdown') ?? yearOption?.closest('.ant-select-dropdown') ?? null
      const periodCard = [...document.querySelectorAll('.activity-page-actions .analytics-filter-card')].find((card) => card.querySelector('.analytics-filter-card__label')?.innerText.trim() === '统计周期')
      const cardSelect = periodCard?.querySelector('.analytics-filter-card__value > .ant-select')
      return { listboxId, listboxBounds: box(controlledListbox), periodCardBounds: box(periodCard), controlBounds: box(cardSelect), focusedInputBounds: box(input), popupBounds: box(popup), popupClass: popup?.className ?? '', popupContainerBounds: box(popup?.parentElement), popupContainerIsPeriodCard: Boolean(periodCard && popup?.parentElement === periodCard), actionsBounds: box(document.querySelector('.activity-page-actions')), toolbarBounds: box(document.querySelector('.activity-page-actions .analytics-global-filter-toolbar')), filterRowBounds: box(document.querySelector('.activity-page-actions .analytics-global-filter-toolbar .filter-toolbar__filters')), allPeriodCards: [...document.querySelectorAll('.activity-page-actions .analytics-filter-card')].map((card) => ({ text: card.innerText.trim(), bounds: box(card) })), optionBelongsToPopup: Boolean(popup && yearOption && popup.contains(yearOption)) }
    })
    const periodDropdownBounds = periodPopupAssociation.popupBounds && {
      x: periodPopupAssociation.popupBounds[0], y: periodPopupAssociation.popupBounds[1], width: periodPopupAssociation.popupBounds[2], height: periodPopupAssociation.popupBounds[3],
    }
    expect(periodDropdownBounds).not.toBeNull()
    expect(periodDropdownBounds.x).toBeGreaterThanOrEqual(0)
    expect(periodDropdownBounds.y).toBeGreaterThanOrEqual(0)
    expect(periodDropdownBounds.x + periodDropdownBounds.width).toBeLessThanOrEqual(viewportSize.width)
    expect(periodDropdownBounds.y + periodDropdownBounds.height).toBeLessThanOrEqual(viewportSize.height)
    expect(periodPopupAssociation.optionBelongsToPopup).toBe(true)
    expect(periodPopupAssociation.popupContainerIsPeriodCard).toBe(true)
    expect(periodPopupAssociation.actionsBounds).toEqual(headerGeometryBeforePeriodOpen.actions)
    expect(periodPopupAssociation.toolbarBounds).toEqual(headerGeometryBeforePeriodOpen.toolbar)
    expect(periodPopupAssociation.allPeriodCards.map((card) => card.bounds)).toEqual(headerGeometryBeforePeriodOpen.cards)
    expect(Math.abs(periodDropdownBounds.x - periodPopupAssociation.controlBounds[0])).toBeLessThanOrEqual(8)
    expect(periodDropdownBounds.y).toBeGreaterThanOrEqual(periodPopupAssociation.controlBounds[1] + periodPopupAssociation.controlBounds[3] - 1)
    expect(periodDropdownBounds.y).toBeLessThanOrEqual(periodPopupAssociation.controlBounds[1] + periodPopupAssociation.controlBounds[3] + 32)
    const periodOpenScreenshot = path.join(issueDir, `${viewportName}-period-menu-open.png`)
    await page.screenshot({ path: periodOpenScreenshot })
    await page.locator('.ant-select-item-option').filter({ hasText: '年度累计' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('year')
    const cycleValue = page.locator('.activity-page-actions .analytics-filter-card__value .ant-select')
    await expect(cycleValue).toContainText('年度累计')
    await page.waitForLoadState('networkidle')
    const periodHeadingAfterPointer = await periodSection.innerText()
    const monthlySummaryAfterPointer = await page.locator('.activity-raw-summary-table').innerText()
    const cycleUrlAfterPointer = page.url()
    expect(periodHeadingAfterPointer).not.toBe(periodHeadingBefore)
    expect(monthlySummaryAfterPointer).toBe(monthlySummaryBefore)

    await cycleControl.press('Enter')
    await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
    await cycleControl.press('ArrowUp')
    await expect(page.locator('.ant-select-item-option-active')).toContainText('本半年度')
    await cycleControl.press('Enter')
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('half')
    await expect(cycleValue).toContainText('本半年度')
    await page.waitForLoadState('networkidle')
    await monthTrigger.focus()
    await monthTrigger.press('Enter')
    await expect(monthDialog).toBeVisible()
    await expect(monthDialog.getByRole('button', { name: '10月', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(monthDialog.getByRole('button', { name: '9月', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(monthTrigger).toContainText('2026年9月')
    await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBe('2026-09')
    await expect(page.getByRole('heading', { name: '月度核心成效 · 2026-09' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    const finalGeometry = await page.evaluate(() => {
      const box = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return [x, y, width, height]
      }
      const cards = [...document.querySelectorAll('.activity-page-actions .analytics-global-filter-toolbar .analytics-filter-card')]
      return {
        cards: cards.map((card) => ({ label: card.querySelector('.analytics-filter-card__label')?.innerText.trim(), bounds: box(card), labelBounds: box(card.querySelector('.analytics-filter-card__label')), valueBounds: box(card.querySelector('.analytics-filter-card__value')) })),
        monthTrigger: box(document.querySelector('.activity-page-actions .analytics-filter-card__month-trigger')),
        cycleControl: box(document.querySelector('.activity-page-actions .ant-select')),
        monthTriggerBorderWidth: getComputedStyle(document.querySelector('.activity-page-actions .analytics-filter-card__month-trigger')).borderTopWidth,
        monthTriggerScrollFits: document.querySelector('.activity-page-actions .analytics-filter-card__month-trigger').scrollWidth <= document.querySelector('.activity-page-actions .analytics-filter-card__month-trigger').clientWidth + 1,
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      }
    })
    expect(finalGeometry.cards[0].bounds[2]).toBe(199)
    expect(finalGeometry.cards[0].bounds[3]).toBeCloseTo(42, 0)
    expect(finalGeometry.cards[1].bounds[2]).toBe(180)
    expect(finalGeometry.monthTriggerBorderWidth).toBe('0px')
    expect(finalGeometry.monthTriggerScrollFits).toBe(true)
    expect(finalGeometry.horizontalOverflowPx).toBe(0)
    viewportEvidence.push({
      viewport: viewportName,
      geometry: finalGeometry,
      month: { cardBoundsAtOpen: monthCardBoundsAtOpen, triggerBoundsAtOpen: monthTriggerBoundsAtOpen, keyboardOpenBounds: keyboardMonthBounds, pointerOpenBounds: monthPointerBounds, screenshot: monthOpenScreenshot, selectedValue: '2026年10月', url: '?period=2026-09', request: monthRequest, keyboardRestoredTo: '2026-09' },
      statisticalPeriod: { pointerOpenBounds: periodDropdownBounds, popupAssociation: periodPopupAssociation, screenshot: periodOpenScreenshot, keyboardSelectedFromYearToHalf: true, urlDuringYear: cycleUrlAfterPointer, headingBefore: periodHeadingBefore, headingAfterPointer: periodHeadingAfterPointer, monthlySummaryUnchanged: monthlySummaryAfterPointer === monthlySummaryBefore, keyboardRestoredTo: 'half', requests: requests.slice(cycleRequestOffset) },
      headerGeometryBeforePeriodOpen,
      screenshots: { closedFilterActual: filterActualPath, referenceActual: referenceActualPath },
      finalUrl: page.url(),
    })
  }

  await writeFile(path.join(issueDir, 'interaction-evidence.json'), JSON.stringify({ issueId: 'UI-ACT-18-ACTIVITY-FILTER-CHEVRON-NATIVE-OPEN', reference: 'docs/ux/reference-crops/activity-header-filters.png', viewportEvidence }, null, 2), 'utf8')
})

test('UI-ACT-19 opens Statistical Period from its visible arrow without moving the filter card', async ({ page }) => {
  test.setTimeout(120_000)
  const issueDir = path.join(outputDir, 'UI-ACT-19-PERIOD-ARROW-HIT-TARGET')
  await mkdir(issueDir, { recursive: true })
  const requests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) requests.push({ method: request.method(), path: url.pathname, query: Object.fromEntries(url.searchParams) })
  })
  await login(page)
  const viewportEvidence = []

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const viewportName = `${viewport.width}x${viewport.height}`
    await page.goto('/analytics/activities?month=2026-09&cycle=half')
    await expect(page.getByRole('heading', { name: '月度核心成效 · 2026-09' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    const cycleControl = page.getByRole('combobox', { name: '统计周期', exact: true })
    const cycleArrow = page.locator('.activity-page-actions .ant-select-suffix')
    const cycleSelect = page.locator('.activity-page-actions .analytics-filter-card__value .ant-select')
    const cycleCard = page.locator('.activity-page-actions .analytics-filter-card').filter({ has: page.getByText('统计周期', { exact: true }) })
    const toolbar = page.locator('.activity-page-actions .analytics-global-filter-toolbar')
    const viewportSize = page.viewportSize()
    const actualPath = path.join(issueDir, `${viewportName}-toolbar-actual.png`)
    const boardPath = path.join(issueDir, `${viewportName}-reference-actual.png`)
    const openedPath = path.join(issueDir, `${viewportName}-period-arrow-open.png`)
    await toolbar.screenshot({ path: actualPath })
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/activity-header-filters.png'),
      actualPath,
      outputPath: boardPath,
      width: viewport.width,
      heading: `UI-ACT-19 · 统计周期箭头命中区域 · ${viewportName}`,
      note: '按批准 Reference 比较闭合态筛选器；打开位置和 hit target 另由同视口 DOM/交互证据记录。',
    })

    const geometryBefore = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return [x, y, width, height]
      }
      const card = [...document.querySelectorAll('.activity-page-actions .analytics-filter-card')].find((element) => element.querySelector('.analytics-filter-card__label')?.innerText.includes('统计周期'))
      return {
        card: rect(card),
        toolbar: rect(document.querySelector('.activity-page-actions .analytics-global-filter-toolbar')),
        control: rect(card?.querySelector('.ant-select')),
        arrow: rect(card?.querySelector('.ant-select-suffix')),
      }
    })
    await expect(cycleArrow).toBeVisible()
    const arrowBounds = await cycleArrow.boundingBox()
    const activationTargetBounds = await page.locator('.activity-page-actions .ant-select').boundingBox()
    expect(arrowBounds).not.toBeNull()
    expect(activationTargetBounds).not.toBeNull()
    expect(activationTargetBounds.width).toBeGreaterThanOrEqual(24)
    expect(activationTargetBounds.height).toBeGreaterThanOrEqual(24)
    const selectedPeriodBefore = await cycleSelect.innerText()
    const periodKpiGrid = page.locator('.activity-outcome-grid').nth(1)
    await expect(periodKpiGrid).not.toContainText('…')
    const periodKpisBefore = await periodKpiGrid.innerText()
    const urlBeforeOpen = page.url()
    await page.mouse.click(arrowBounds.x + arrowBounds.width / 2, arrowBounds.y + arrowBounds.height / 2)
    await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.ant-select-item-option').filter({ hasText: '年度累计' })).toBeVisible()
    expect(page.url()).toBe(urlBeforeOpen)
    await expect(cycleSelect).toContainText(selectedPeriodBefore)
    expect(await page.locator('.activity-outcome-grid').nth(1).innerText()).toBe(periodKpisBefore)
    const periodKpisWhileOpen = await page.locator('.activity-outcome-grid').nth(1).innerText()
    expect(periodKpisWhileOpen).toBe(periodKpisBefore)
    const requestOffsetAfterOpen = requests.length

    const popupBounds = await page.locator('.ant-select-dropdown:visible').boundingBox()
    const geometryAfterOpen = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return [x, y, width, height]
      }
      const card = [...document.querySelectorAll('.activity-page-actions .analytics-filter-card')].find((element) => element.querySelector('.analytics-filter-card__label')?.innerText.includes('统计周期'))
      return {
        card: rect(card),
        toolbar: rect(document.querySelector('.activity-page-actions .analytics-global-filter-toolbar')),
        control: rect(card?.querySelector('.ant-select')),
      }
    })
    expect(geometryAfterOpen.card).toEqual(geometryBefore.card)
    expect(geometryAfterOpen.toolbar).toEqual(geometryBefore.toolbar)
    expect(geometryAfterOpen.control).toEqual(geometryBefore.control)
    expect(popupBounds).not.toBeNull()
    expect(popupBounds.x).toBeGreaterThanOrEqual(0)
    expect(popupBounds.y).toBeGreaterThanOrEqual(0)
    expect(popupBounds.x + popupBounds.width).toBeLessThanOrEqual(viewportSize.width)
    expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(viewportSize.height)
    await page.screenshot({ path: openedPath })
    await page.locator('.ant-select-item-option').filter({ hasText: '年度累计' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('year')
    await expect(page.getByRole('heading', { name: /周期整体成效 · 2026年度/ })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(periodKpiGrid).not.toContainText('…')
    const urlAfterPointerSelection = page.url()
    const periodKpisAfter = await periodKpiGrid.innerText()
    expect(periodKpisAfter).not.toBe(periodKpisBefore)
    const horizontalOverflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
    expect(horizontalOverflowPx).toBe(0)
    expect(requests.length).toBeGreaterThan(requestOffsetAfterOpen)
    const requestEvidence = requests.slice(requestOffsetAfterOpen)
    expect(requestEvidence.some((request) => request.path === '/api/data-metrics/overview' && request.query.from_month === '2026-01' && request.query.to_month === '2026-09')).toBe(true)

    const keyboardRequestOffset = requests.length
    await cycleControl.focus()
    await cycleControl.press('Enter')
    await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
    await cycleControl.press('ArrowUp')
    await expect(page.locator('.ant-select-item-option-active')).toContainText('本半年度')
    await cycleControl.press('Enter')
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('half')
    await expect(cycleSelect).toContainText('本半年度')
    await page.waitForLoadState('networkidle')
    await expect.poll(() => periodKpiGrid.innerText(), { timeout: 30_000 }).toBe(periodKpisBefore)
    const keyboardRequestEvidence = requests.slice(keyboardRequestOffset)
    await cycleControl.press('Enter')
    await expect(cycleControl).toHaveAttribute('aria-expanded', 'true')
    await cycleControl.press('Escape')
    await expect(cycleControl).toHaveAttribute('aria-expanded', 'false')
    await expect(cycleControl).toBeFocused()

    viewportEvidence.push({
      viewport: viewportName,
      selectedBeforeOpen: selectedPeriodBefore,
      urlBeforeOpen,
      geometryBefore,
      arrowBounds: [arrowBounds.x, arrowBounds.y, arrowBounds.width, arrowBounds.height],
      activationTargetBounds: [activationTargetBounds.x, activationTargetBounds.y, activationTargetBounds.width, activationTargetBounds.height],
      geometryAfterOpen,
      popupBounds: [popupBounds.x, popupBounds.y, popupBounds.width, popupBounds.height],
      openDoesNotChangeSelectionOrUrl: true,
      periodKpisWhileOpen,
      periodKpisBefore,
      periodKpisAfter,
      urlAfterPointerSelection,
      requestEvidence,
      keyboard: {
        openedByEnter: true,
        highlightedAndSelected: '本半年度 by ArrowUp + Enter',
        urlAfterSelection: page.url(),
        requestEvidence: keyboardRequestEvidence,
        kpisRestoredToOriginalCycle: true,
        reopenedByEnter: true,
        closedByEscape: true,
        focusReturnedToCombobox: true,
      },
      horizontalOverflowPx,
      screenshots: { closedActual: actualPath, referenceActual: boardPath, arrowOpen: openedPath },
      status: 'IMPLEMENTATION_CANDIDATE_PENDING_INDEPENDENT_REVIEW',
    })
  }

  await writeFile(path.join(issueDir, 'interaction-and-geometry-evidence.json'), JSON.stringify({ issueId: 'UI-ACT-19-PERIOD-ARROW-HIT-TARGET', reference: 'docs/ux/reference-crops/activity-header-filters.png', viewportEvidence }, null, 2), 'utf8')
})

test('Capability refinement captures both accepted Desktop sizes and proves ability selection keeps maturity independent', async ({ page }) => {
  test.setTimeout(240_000)
  const evidenceDirectory = path.join(outputDir, 'capability-refinement-2026-10-10')
  await mkdir(evidenceDirectory, { recursive: true })
  const requestUrls = []
  page.on('request', (request) => {
    if (request.url().includes('/api/compute')) requestUrls.push(request.url())
  })
  await login(page)
  const viewportEvidence = []

  for (const viewport of viewports) {
    const viewportName = `${viewport.width}x${viewport.height}`
    const viewportDirectory = path.join(evidenceDirectory, viewportName)
    await mkdir(viewportDirectory, { recursive: true })
    await page.setViewportSize(viewport)
    const requestStart = requestUrls.length
    await page.goto('/analytics/capabilities?month=2026-09&granularity=month&cycle=half&dimension=iteration&version=3&period=legacy-period&metric=901')
    await expect(page.locator('.capability-directory-workspace')).toBeVisible()
    await page.waitForLoadState('networkidle')
    const normalizedCapabilityUrl = new URL(page.url())
    expect(normalizedCapabilityUrl.searchParams.has('version')).toBe(false)
    expect(normalizedCapabilityUrl.searchParams.has('dimension')).toBe(false)
    expect(normalizedCapabilityUrl.searchParams.has('period')).toBe(false)
    expect(normalizedCapabilityUrl.searchParams.has('metric')).toBe(false)
    const initialCapabilityRequests = requestUrls.slice(requestStart)
    expect(initialCapabilityRequests.every((url) => !new URL(url).searchParams.has('version_id'))).toBe(true)

    const geometry = await page.evaluate(() => {
      const box = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      const text = (selector) => document.querySelector(selector)?.innerText ?? ''
      const heatmap = [...document.querySelectorAll('.capability-comparison-grid .team-matrix__table tbody td')]
      const teamTable = document.querySelector('.capability-comparison-grid .team-matrix__table')
      const teamHeaders = [...(teamTable?.tHead?.rows?.[0]?.cells ?? [])]
      return {
        viewport: { width: innerWidth, height: innerHeight },
        document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) },
        pageHeader: box(document.querySelector('.analytics-page-head')),
        versionControlCount: document.querySelectorAll('.capability-page-actions [aria-label="版本"]').length,
        directory: box(document.querySelector('.capability-directory')),
        directoryBottomDeltaPx: (() => {
          const directory = document.querySelector('.capability-directory')?.getBoundingClientRect()
          const comparison = document.querySelector('.capability-comparison-grid')?.getBoundingClientRect()
          return directory && comparison ? Number(Math.abs(directory.bottom - comparison.bottom).toFixed(2)) : null
        })(),
        directoryClassName: document.querySelector('.capability-directory')?.className ?? '',
        directoryItems: document.querySelectorAll('.capability-directory .analytics-directory__item').length,
        directoryIcons: document.querySelectorAll('.capability-directory .analytics-directory__icon').length,
        directoryMetadata: document.querySelectorAll('.capability-directory .analytics-directory__item small').length,
        directoryRows: [...document.querySelectorAll('.capability-directory .analytics-directory__item')].map(box),
        directoryLabelsFit: [...document.querySelectorAll('.capability-directory .analytics-directory__label-text')].every((element) => element.scrollWidth <= element.clientWidth),
        statusSection: box(document.querySelector('.capability-kpi-grid')?.closest('.analytics-section')),
        statusCards: [...document.querySelectorAll('.capability-kpi-grid > .metric-card')].map(box),
        evolutionSection: box(document.querySelector('.capability-evolution-grid')?.closest('.analytics-section')),
        evolutionCards: [...document.querySelectorAll('.capability-evolution-grid > *')].map(box),
        teamDifference: box(document.querySelector('.capability-comparison-grid')),
        teamTable: box(teamTable),
        teamHeaders: teamHeaders.map((element) => element.innerText.trim()),
        teamHeaderGeometry: teamHeaders.map((element) => {
          const cell = element.getBoundingClientRect()
          const textRange = document.createRange()
          textRange.selectNodeContents(element)
          const text = textRange.getBoundingClientRect()
          return {
            label: element.innerText.trim(),
            textAlign: getComputedStyle(element).textAlign,
            centerErrorPx: Number(Math.abs((text.left + text.right) / 2 - (cell.left + cell.right) / 2).toFixed(2)),
            borderLeftWidth: getComputedStyle(element).borderLeftWidth,
          }
        }),
        teamCellDividerWidths: [...(teamTable?.tBodies?.[0]?.rows ?? [])].flatMap((row) => [...row.cells].slice(1).map((cell) => getComputedStyle(cell).borderLeftWidth)),
        teamRows: [...document.querySelectorAll('.capability-comparison-grid .team-matrix__table tbody tr')].map((row) => [...row.cells].map((cell) => cell.innerText.trim())),
        heatmap: heatmap.map((element) => ({ text: element.innerText.trim(), level: element.dataset.heatmapLevel ?? null, background: getComputedStyle(element).backgroundColor, className: element.className })),
        trendTitles: [...document.querySelectorAll('.capability-evolution-grid h2, .capability-evolution-grid h3')].map((element) => element.innerText.trim()),
        maturityTable: box(document.querySelector('.analytics-maturity-summary__matrix .maturity-matrix__table')),
        pageEndGapPx: (() => {
          const section = document.querySelector('.analytics-maturity-summary')?.closest('.analytics-section')
          if (!section) return null
          return Number((document.documentElement.scrollHeight - (section.getBoundingClientRect().bottom + window.scrollY)).toFixed(2))
        })(),
        maturityText: text('.analytics-maturity-summary__matrix .maturity-matrix__table'),
        maturityRadarSeriesGeometry: [...document.querySelectorAll('.analytics-maturity-summary__radar .maturity-radar__series')].map((group) => ({
          name: group.dataset.seriesName,
          complete: group.dataset.seriesComplete === 'true',
          segments: [...group.querySelectorAll('polyline')].map((polyline) => {
            const points = (polyline.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean)
            return { pointCount: points.length, firstPoint: points[0] ?? null, lastPoint: points.at(-1) ?? null, closed: points.length > 1 && points[0] === points.at(-1) }
          }),
        })),
        maturityRadarSvg: document.querySelector('.analytics-maturity-summary__radar .maturity-radar svg')?.innerHTML ?? '',
      }
    })
    expect(geometry.directoryClassName).toContain('analytics-directory--panel')
    expect(geometry.directoryItems).toBe(7)
    expect(geometry.directoryIcons).toBe(7)
    expect(geometry.directoryMetadata).toBe(0)
    expect(geometry.directoryLabelsFit).toBe(true)
    expect(geometry.directoryRows.every((row) => row.height === 36)).toBe(true)
    expect(geometry.directoryBottomDeltaPx).toBeLessThanOrEqual(4)
    expect(geometry.versionControlCount).toBe(0)
    expect(geometry.teamHeaders).toEqual(expect.arrayContaining(['AI有效检视数', 'AI检视有效率']))
    expect(geometry.teamHeaders).not.toContain('问题闭环率')
    expect(geometry.teamHeaders).not.toContain('覆盖情况')
    expect(geometry.teamHeaderGeometry.every((header) => header.textAlign === 'center' && header.centerErrorPx <= 2)).toBe(true)
    expect(geometry.teamHeaderGeometry.slice(1).every((header) => header.borderLeftWidth === '1px')).toBe(true)
    expect(geometry.teamCellDividerWidths.length).toBeGreaterThan(0)
    expect(geometry.teamCellDividerWidths.every((width) => width === '1px')).toBe(true)
    expect(geometry.trendTitles).toEqual(expect.arrayContaining(['AI有效检视率趋势', 'AI有效检视意见数趋势']))
    expect(geometry.trendTitles).not.toContain('AI检视有效意见数趋势')
    expect(geometry.heatmap.some((cell) => cell.level !== null)).toBe(true)
    expect(geometry.heatmap.some((cell) => cell.text === '未配置')).toBe(false)
    const completeCapabilityRadarSeries = geometry.maturityRadarSeriesGeometry.filter((series) => series.complete)
    expect(completeCapabilityRadarSeries).toHaveLength(2)
    expect(completeCapabilityRadarSeries.every((series) => series.segments.length === 1 && series.segments[0].closed)).toBe(true)
    expect(geometry.document.horizontalOverflowPx).toBe(0)
    if (viewport.width === 2560) expect(geometry.pageEndGapPx).toBeLessThanOrEqual(43.2)

    const actualDirectory = path.join(viewportDirectory, 'actual-directory.png')
    const directoryBox = geometry.directory
    await page.screenshot({ path: actualDirectory, clip: { x: directoryBox.x, y: directoryBox.y, width: directoryBox.width, height: Math.min(900, viewport.height - directoryBox.y - 8) } })
    const directoryBoard = path.join(viewportDirectory, 'CAP-REF-01-directory-reference-actual.png')
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-directory.png'),
      actualPath: actualDirectory,
      outputPath: directoryBoard,
      width: viewport.width,
      heading: `CAP-REF-01 · 能力目录 · ${viewportName}`,
      note: '批准 Reference 只用于侧栏构图/样式；能力名称和数据以当前目录为准。',
    })

    const headerActual = path.join(viewportDirectory, 'actual-header-filters.png')
    await page.locator('.analytics-page-head').screenshot({ path: headerActual })
    const headerBoard = path.join(viewportDirectory, 'CAP-REF-07-header-filters-reference-actual.png')
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-header-filters.png'),
      actualPath: headerActual,
      outputPath: headerBoard,
      width: viewport.width,
      heading: `CAP-REF-07 · 能力页头筛选 · ${viewportName}`,
      note: '通用能力没有版本/迭代范围；仅保留月份与时间粒度控件，忽略旧版本/迭代 URL 状态。',
    })

    const teamActual = path.join(viewportDirectory, 'actual-team-difference-and-evidence.png')
    await page.locator('.capability-comparison-grid').screenshot({ path: teamActual })
    const teamBoard = path.join(viewportDirectory, 'CAP-REF-03-team-heatmap-reference-actual.png')
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-team-differences-and-evidence.png'),
      actualPath: teamActual,
      outputPath: teamBoard,
      width: viewport.width,
      heading: `CAP-REF-03 · 团队差异热力图 · ${viewportName}`,
      note: 'Reference 的示例指标/数值不作为业务定义；有效检视值来自已确认的本地意见源公式。',
    })

    const statusAndTrends = await page.evaluate(() => {
      window.scrollTo(0, 0)
      const status = document.querySelector('.capability-kpi-grid')?.closest('.analytics-section')
      const trends = document.querySelector('.capability-evolution-grid')?.closest('.analytics-section')
      if (!status || !trends) return null
      const start = status.getBoundingClientRect()
      const end = trends.getBoundingClientRect()
      return { x: start.x, y: start.y, width: start.width, height: end.bottom - start.top }
    })
    expect(statusAndTrends).toBeTruthy()
    const statusTrendsActual = path.join(viewportDirectory, 'actual-status-and-trends.png')
    await page.screenshot({ path: statusTrendsActual, clip: statusAndTrends })
    const statusTrendsBoard = path.join(viewportDirectory, 'CAP-REF-02-status-and-trends-reference-actual.png')
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-status-and-trends.png'),
      actualPath: statusTrendsActual,
      outputPath: statusTrendsBoard,
      width: viewport.width,
      heading: `CAP-REF-02 · 能力状态与演进 · ${viewportName}`,
      note: '状态/趋势随所选能力；成熟度画像固定在其独立区块。未定义指标不替换现有指标。',
    })

    const actualMaturity = path.join(viewportDirectory, 'actual-overall-maturity.png')
    await page.locator('.analytics-maturity-summary').screenshot({ path: actualMaturity })
    const maturityBoard = path.join(viewportDirectory, 'CAP-REF-05-maturity-reference-actual.png')
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-maturity-matrix-radar.png'),
      actualPath: actualMaturity,
      outputPath: maturityBoard,
      width: viewport.width,
      heading: `CAP-REF-05 · 整体成熟度画像 · ${viewportName}`,
      note: '七项成熟度矩阵/雷达是整体评估，不跟随能力目录选择。',
    })

    const fullPageActual = path.join(viewportDirectory, 'capability-full-page.png')
    await page.screenshot({
      path: fullPageActual,
      fullPage: true,
      style: '.app-topbar { position: static !important; } .app-sidebar { position: absolute !important; } .analytics-directory--vertical, .analytics-directory--horizontal, .maturity-matrix__table tbody th, .team-matrix__table tbody th { position: static !important; }',
    })
    const fullPageBoard = path.join(viewportDirectory, 'CAP-REF-06-full-page-reference-actual.png')
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference/03-capability.png'),
      actualPath: fullPageActual,
      outputPath: fullPageBoard,
      width: viewport.width,
      heading: `CAP-REF-06 · 研发能力整页 · ${viewportName}`,
      note: '整页候选图用于复核构图；能力数据和成熟度范围按当前已确认业务规则。',
    })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const bottom = await page.evaluate(() => ({ scrollY, scrollHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight, horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) }))
    expect(bottom.scrollY + bottom.viewportHeight).toBeGreaterThanOrEqual(bottom.scrollHeight - 1)
    expect(bottom.horizontalOverflowPx).toBe(0)
    await page.evaluate(() => window.scrollTo(0, 0))

    const maturityBeforeSelection = await page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table').innerText()
    const maturityBoundsBefore = await page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table').evaluate((element) => {
      const { x, width, height } = element.getBoundingClientRect()
      return [x, width, height]
    })
    const maturityRadarBefore = await page.locator('.analytics-maturity-summary__radar .maturity-radar svg').evaluate((element) => element.innerHTML)
    const mrE2E = page.getByRole('button', { name: '查看能力：MR-E2E能力' })
    const pointerRequestStart = requestUrls.length
    await mrE2E.click()
    await expect(mrE2E).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: '研发能力 / MR-E2E能力' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const selectedMetricNames = (await page.locator('.capability-kpi-grid .metric-card__label').allInnerTexts()).sort()
    const expectedMetricNames = ['AI-MR构建率', 'AI-MR数量'].sort()
    expect(selectedMetricNames).toEqual(expectedMetricNames)
    const selectedTeamTable = page.locator('.capability-comparison-grid .team-matrix__table')
    const readSelectedTeamDifference = () => selectedTeamTable.evaluate((table) => {
      const rect = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return [x, y, width, height]
      }
      return {
        bounds: rect(table),
        headers: [...table.tHead.querySelectorAll('th')].map((cell) => cell.innerText.trim()),
        rows: [...table.tBodies[0].rows].map((row) => [...row.cells].map((cell) => cell.innerText.trim())),
        heatmapLevels: [...table.tBodies[0].querySelectorAll('td')].map((cell) => cell.dataset.heatmapLevel ?? null),
      }
    })
    const expectedGoldenRows = [
      ['全公司均值', '325', '37%'],
      ['团队A', '375+50', '51%+14pp'],
      ['团队B', '472+147', '42%+5pp'],
      ['团队C', '290-35', '31%-5pp'],
      ['团队D', '163-162', '22%-14pp'],
    ]
    await expect.poll(async () => (await readSelectedTeamDifference()).rows, { timeout: 10_000 }).toEqual(expectedGoldenRows)
    const selectedTeamDifference = await readSelectedTeamDifference()
    expect(selectedTeamDifference.headers).toEqual(['团队', 'AI-MR数量', 'AI-MR构建率'])
    expect(selectedTeamDifference.headers).not.toContain('AI检视意见数')
    expect(selectedTeamDifference.headers).not.toContain('AI检视率')
    expect(selectedTeamDifference.rows).toEqual(expectedGoldenRows)
    expect(selectedTeamDifference.heatmapLevels).toEqual(['3', '3', '4', '5', '5', '4', '3', '2', '1', '1'])
    expect(selectedTeamDifference.rows).not.toEqual(geometry.teamRows)
    const selectedTeamTableActual = path.join(viewportDirectory, 'actual-team-difference-MR-E2E.png')
    const selectedTeamTableBoard = path.join(viewportDirectory, 'CAP-REF-08-selected-MR-E2E-team-difference-reference-actual.png')
    await selectedTeamTable.screenshot({ path: selectedTeamTableActual })
    const tableAfterScreenshot = await readSelectedTeamDifference()
    expect(tableAfterScreenshot.headers).toEqual(selectedTeamDifference.headers)
    expect(tableAfterScreenshot.rows).toEqual(selectedTeamDifference.rows)
    expect(tableAfterScreenshot.heatmapLevels).toEqual(selectedTeamDifference.heatmapLevels)
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-team-differences-and-evidence.png'),
      actualPath: selectedTeamTableActual,
      outputPath: selectedTeamTableBoard,
      width: viewport.width,
      heading: `CAP-REF-08 · 选中 MR-E2E 能力后的团队差异 · ${viewportName}`,
      note: '仅比较团队热力表的布局/样式；实际列由 MR-E2E 能力已定义指标决定，Reference 样例字段和数值不作为业务定义。',
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    expect(await page.locator('.capability-evolution-grid h2, .capability-evolution-grid h3').allInnerTexts()).toEqual(expect.arrayContaining(selectedMetricNames.map((label) => `${label}趋势`)))
    await expect(page.locator('.capability-evidence-grid')).toContainText('AI-MR数量分布')
    await expect(page.locator('.capability-evidence-grid')).toContainText('AI-MR构建率趋势')
    const pointerEvidenceText = await page.locator('.capability-evidence-grid').innerText()
    expect(pointerEvidenceText).toContain('AI-MR数量分布')
    expect(pointerEvidenceText).toContain('AI-MR构建率趋势')
    expect(await page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table').innerText()).toBe(maturityBeforeSelection)
    expect(await page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table').evaluate((element) => {
      const { x, width, height } = element.getBoundingClientRect()
      return [x, width, height]
    })).toEqual(maturityBoundsBefore)
    expect(await page.locator('.analytics-maturity-summary__radar .maturity-radar svg').evaluate((element) => element.innerHTML)).toBe(maturityRadarBefore)

    const automation = page.getByRole('button', { name: '查看能力：自动化构建部署' })
    await automation.focus()
    await page.keyboard.press('Enter')
    await expect(automation).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: '研发能力 / 自动化构建部署' })).toBeVisible()
    await expect(page.locator('.capability-boolean-status')).toBeVisible()
    const keyboardEvidenceText = await page.locator('.capability-evidence-grid').innerText()
    expect(keyboardEvidenceText).not.toContain('AI-MR')
    expect(await page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table').innerText()).toBe(maturityBeforeSelection)
    expect(await page.locator('.analytics-maturity-summary__radar .maturity-radar svg').evaluate((element) => element.innerHTML)).toBe(maturityRadarBefore)

    const requestsAfterPointer = requestUrls.slice(pointerRequestStart)
    viewportEvidence.push({
      viewport: viewportName,
      references: { headerBoard, directoryBoard, statusTrendsBoard, teamBoard, maturityBoard, fullPageBoard },
      screenshots: { fullPage: fullPageActual, header: headerActual, directory: actualDirectory, statusAndTrends: statusTrendsActual, teamAndEvidence: teamActual, maturity: actualMaturity },
      geometry,
      scope: { inputUrl: '/analytics/capabilities?month=2026-09&granularity=month&cycle=half&dimension=iteration&version=3&period=legacy-period&metric=901', normalizedUrl: page.url(), versionControlCount: geometry.versionControlCount, computeRequests: initialCapabilityRequests },
      selectedCapability: { pointer: 'MR-E2E能力', metricNames: selectedMetricNames, teamDifference: selectedTeamDifference, tableSnapshotMatchesScreenshotState: true, teamDifferenceScreenshot: selectedTeamTableActual, teamDifferenceReferenceActualBoard: selectedTeamTableBoard, teamDifferenceDiffersFromInitial: true, evidenceText: pointerEvidenceText, requests: requestsAfterPointer },
      keyboardCapability: { selected: '自动化构建部署', booleanStatusVisible: true, evidenceText: keyboardEvidenceText, maturityContentUnchanged: true, maturityBoundsUnchanged: true },
      maturity: { contentUnchangedAcrossSelections: true, geometry: maturityBoundsBefore },
      scroll: { reachedBottom: true, horizontalOverflowPx: bottom.horizontalOverflowPx, scrollHeight: bottom.scrollHeight, viewportHeight: bottom.viewportHeight },
    })
  }

  await writeFile(path.join(evidenceDirectory, 'interaction-and-geometry-evidence.json'), JSON.stringify({
    id: 'CAP-REFINEMENT-2026-10-10',
    status: 'IMPLEMENTED_PENDING_INDEPENDENT_REVIEW',
    reference: 'docs/ux/reference/03-capability.png',
    referenceCrops: {
      header: 'docs/ux/reference-crops/capability-header-filters.png',
      directory: 'docs/ux/reference-crops/capability-directory.png',
      statusAndTrends: 'docs/ux/reference-crops/capability-status-and-trends.png',
      teamDifference: 'docs/ux/reference-crops/capability-team-differences-and-evidence.png',
      maturity: 'docs/ux/reference-crops/capability-maturity-matrix-radar.png',
    },
    issues: [
      { id: 'UI-CAP-01-VERSION-NOT-APPLICABLE-CONTROL', status: 'IMPLEMENTED_PENDING_INDEPENDENT_REVIEW' },
      { id: 'UI-CAP-07-DIRECTORY-STYLE', status: 'IMPLEMENTED_PENDING_INDEPENDENT_REVIEW' },
      { id: 'UI-CAP-08-SELECTION-SCOPE', status: 'IMPLEMENTED_PENDING_INDEPENDENT_REVIEW' },
      { id: 'UI-CAP-09-TEAM-HEATMAP', status: 'IMPLEMENTED_PENDING_INDEPENDENT_REVIEW' },
      { id: 'UI-CAP-10-EFFECTIVE-REVIEW-TABLE-METRICS', status: 'OPEN_DEFINITION_REQUIRED' },
      { id: 'UI-CAP-11-EFFECTIVE-REVIEW-TRENDS', status: 'OPEN_DEFINITION_REQUIRED' },
      { id: 'UI-CAP-12-MATURITY-INDEPENDENCE', status: 'IMPLEMENTED_PENDING_INDEPENDENT_REVIEW' },
    ],
    viewportEvidence,
  }, null, 2), 'utf8')
})

test('Capability maturity radar leaves a single missing Golden axis open', async ({ page }) => {
  test.setTimeout(180_000)
  const evidenceDirectory = path.join(outputDir, 'capability-radar-missing-axis-2026-10-10')
  await mkdir(evidenceDirectory, { recursive: true })
  const goldenDataset = JSON.parse(await readFile(path.resolve('e2e/support/overview-visual-dataset.json'), 'utf8'))
  const missingAxisState = goldenDataset.states.capabilityRadarSingleMissingAxis
  const fixtureOverrides = []

  await page.route('**/api/maturity/overview**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('month') !== missingAxisState.month || url.searchParams.get('kind') !== missingAxisState.kind) {
      await route.continue()
      return
    }

    const response = await route.fetch()
    const payload = await response.json()
    const target = payload.activities.find((activity) => activity.activity_name === missingAxisState.missingActivity)
    if (!target) throw new Error(`Golden maturity activity is missing: ${missingAxisState.missingActivity}`)
    const otherActivities = payload.activities.filter((activity) => activity.activity_id !== target.activity_id)
    if (!Number.isFinite(target.score) || otherActivities.length !== missingAxisState.assessedAxes || otherActivities.some((activity) => !Number.isFinite(activity.score))) {
      throw new Error('Single-axis gap state requires six other assessed Capability maturity axes')
    }

    const originalAssessedTeamCount = target.assessed_team_count
    const omittedTeamCells = payload.teams.flatMap((team) => team.cells).filter((cell) => cell.activity_id === target.activity_id && Number.isFinite(cell.score)).length
    const missingValues = { record_id: null, score: null, score_raw: null, score_display: null, grade: null, level: null, note: null, maintained_by: null, updated_at: null }
    Object.assign(target, {
      score: null,
      score_raw: null,
      score_display: null,
      average_raw: null,
      grade: null,
      level: null,
      assessed_team_count: 0,
      grade_distribution: Object.fromEntries(Object.keys(target.grade_distribution ?? {}).map((key) => [key, 0])),
    })
    for (const team of payload.teams) {
      const cell = team.cells.find((entry) => entry.activity_id === target.activity_id)
      if (cell) Object.assign(cell, missingValues)
    }
    payload.assessed_cell_count = payload.activities.reduce((total, activity) => total + activity.assessed_team_count, 0)
    payload.coverage_rate = payload.total_cell_count ? payload.assessed_cell_count / payload.total_cell_count : 0
    fixtureOverrides.push({
      month: missingAxisState.month,
      kind: missingAxisState.kind,
      missingActivity: target.activity_name,
      missingActivityId: target.activity_id,
      originalAssessedTeamCount,
      omittedTeamCells,
      remainingAssessedAxes: otherActivities.length,
      overrideScope: 'E2E response only; persisted Golden records are unchanged',
    })
    await route.fulfill({ response, json: payload })
  })

  await login(page)
  const viewportEvidence = []
  for (const viewport of viewports) {
    const viewportName = `${viewport.width}x${viewport.height}`
    const viewportDirectory = path.join(evidenceDirectory, viewportName)
    await mkdir(viewportDirectory, { recursive: true })
    await page.setViewportSize(viewport)
    await page.goto(`/analytics/capabilities?month=${missingAxisState.month}&granularity=month&cycle=half`)
    await expect(page.locator('.analytics-maturity-summary__radar .maturity-radar__series')).toHaveCount(2)
    await page.waitForLoadState('networkidle')
    expect(fixtureOverrides.filter((entry) => entry.month === missingAxisState.month)).toHaveLength(viewportEvidence.length + 1)

    const radarPanel = page.locator('.analytics-maturity-summary')
    await radarPanel.scrollIntoViewIfNeeded()
    const readRadarEvidence = () => page.evaluate(() => {
      const box = (element) => {
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      const svg = document.querySelector('.analytics-maturity-summary__radar .maturity-radar svg')
      return {
        viewport: { width: innerWidth, height: innerHeight },
        document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        maturityPanel: box(document.querySelector('.analytics-maturity-summary')),
        radarPanel: box(document.querySelector('.analytics-maturity-summary__radar')),
        svg: box(svg),
        axes: [...(svg?.querySelectorAll('.maturity-radar__axes text') ?? [])].map((label) => label.textContent.trim()),
        series: [...(svg?.querySelectorAll('.maturity-radar__series') ?? [])].map((group) => ({
          name: group.dataset.seriesName,
          complete: group.dataset.seriesComplete === 'true',
          segments: [...group.querySelectorAll('polyline')].map((polyline) => {
            const points = (polyline.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean)
            return { pointCount: points.length, firstPoint: points[0] ?? null, lastPoint: points.at(-1) ?? null, closed: points.length > 1 && points[0] === points.at(-1) }
          }),
          markerCount: group.querySelectorAll('circle').length,
        })),
      }
    })
    const beforeScreenshot = await readRadarEvidence()
    const currentSeries = beforeScreenshot.series.find((series) => series.name.startsWith('本期领域平均'))
    const previousSeries = beforeScreenshot.series.find((series) => series.name.startsWith('上期领域平均'))
    expect(beforeScreenshot.axes).toHaveLength(7)
    expect(beforeScreenshot.axes).toContain(missingAxisState.missingActivity)
    expect(currentSeries.complete).toBe(false)
    expect(currentSeries.segments).toHaveLength(2)
    expect(currentSeries.segments.every((segment) => !segment.closed)).toBe(true)
    expect(currentSeries.markerCount).toBe(missingAxisState.assessedAxes)
    expect(previousSeries.complete).toBe(true)
    expect(previousSeries.segments).toHaveLength(1)
    expect(previousSeries.segments[0].closed).toBe(true)
    expect(beforeScreenshot.horizontalOverflowPx).toBe(0)

    const actual = path.join(viewportDirectory, 'actual-single-axis-gap-maturity.png')
    await radarPanel.screenshot({ path: actual })
    const afterScreenshot = await readRadarEvidence()
    expect(afterScreenshot).toEqual(beforeScreenshot)
    const comparison = path.join(viewportDirectory, 'CAP-REF-09-single-axis-gap-reference-actual.png')
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-maturity-matrix-radar.png'),
      actualPath: actual,
      outputPath: comparison,
      width: viewport.width,
      heading: `CAP-REF-09 · 单轴缺失时的能力成熟度雷达 · ${viewportName}`,
      note: `E2E 固定 Golden 状态：${missingAxisState.missingActivity} 未评估，其余六轴有值；Reference 只评视觉样式，缺失不补零。`,
    })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const bottom = await page.evaluate(() => ({ reachedBottom: Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 2, horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) }))
    expect(bottom.reachedBottom).toBe(true)
    expect(bottom.horizontalOverflowPx).toBe(0)
    viewportEvidence.push({
      viewport: viewportName,
      referenceCrop: 'docs/ux/reference-crops/capability-maturity-matrix-radar.png',
      actualScreenshot: actual,
      referenceActualComparison: comparison,
      geometryAndSvg: beforeScreenshot,
      missingAxis: { activity: missingAxisState.missingActivity, index: beforeScreenshot.axes.indexOf(missingAxisState.missingActivity), currentSeriesHasGap: true, currentSeriesClosed: false, previousCompleteSeriesClosed: true },
      screenshotMatchesMeasuredState: true,
      scroll: bottom,
    })
  }

  expect(fixtureOverrides).toHaveLength(viewports.length)
  await writeFile(path.join(evidenceDirectory, 'ui-cap-16-single-axis-gap-evidence.json'), JSON.stringify({
    issueId: 'UI-CAP-16-CAPABILITY-RADAR-CLOSE-COMPLETE-SERIES',
    status: 'IMPLEMENTED_PENDING_INDEPENDENT_REVIEW',
    priorSameCandidateReview: { run: '01-07-30-730Z-31068', verdict: 'PARTIAL_BOTH_VIEWPORTS', reason: 'Prior partial/empty states did not isolate one missing maturity axis.' },
    goldenDatasetState: missingAxisState,
    referenceCrop: 'docs/ux/reference-crops/capability-maturity-matrix-radar.png',
    fixtureOverrides,
    viewportEvidence,
  }, null, 2), 'utf8')
})

test('UI-CHART-RESIZE-01 shared chart hosts track Capability card widths across desktop viewport changes', async ({ page }) => {
  test.setTimeout(120_000)
  const evidenceDirectory = path.join(outputDir, 'ui-chart-resize-01')
  await mkdir(evidenceDirectory, { recursive: true })
  await login(page)

  const measure = () => page.evaluate(() => {
    const box = (element) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { x: rect.x, right: rect.right, width: rect.width, height: rect.height }
    }
    const cards = [...document.querySelectorAll('.capability-evolution-grid > .analytics-analysis-card')]
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
      charts: cards.map((card) => ({ card: box(card), host: box(card.querySelector('.overview-chart')) })),
    }
  })
  const waitForResizeFrame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const screenshotPath = (viewport, state) => path.join(evidenceDirectory, `${viewport}-${state}-full-page.png`)
  const captureTrendReferenceActual = async (width, state) => {
    const viewportName = width === 1920 ? '1920x1080' : `${width}x1440`
    const actualPath = path.join(evidenceDirectory, `${viewportName}-${state}-trend-row-actual.png`)
    const outputPath = path.join(evidenceDirectory, `${viewportName}-${state}-trend-row-reference-actual.png`)
    const clip = await page.evaluate(() => {
      const grid = document.querySelector('.capability-evolution-grid')
      const cards = [...(grid?.children ?? [])].filter((element) => element.matches('.analytics-analysis-card')).slice(0, 2)
      if (!grid || cards.length !== 2) return null
      const gridRect = grid.getBoundingClientRect()
      const firstCardRect = cards[0].getBoundingClientRect()
      return { x: gridRect.x, y: firstCardRect.y, width: gridRect.width, height: firstCardRect.height }
    })
    expect(clip).not.toBeNull()
    await page.screenshot({ path: actualPath, clip })
    await captureReferenceActualBoard(page.context(), {
      referencePath: path.resolve('docs/ux/reference-crops/capability-trends-only.png'),
      actualPath,
      outputPath,
      width,
      heading: `UI-CHART-RESIZE-01 · ${viewportName} · ${state}`,
      note: state === 'after-shrink' ? '1920×1080 same-page resize from 2560×1440; chart hosts must remain within their trend cards.' : '2560×1440 after same-page resize back; chart hosts must remain within their trend cards.',
      boardHeight: 520,
    })
    return { actualPath, referenceActualBoard: outputPath, clip }
  }

  await page.setViewportSize({ width: 2560, height: 1440 })
  await page.goto('/analytics/capabilities?month=2026-10&granularity=month')
  await expect(page.locator('.capability-directory-workspace')).toBeVisible()
  await expect(page.locator('.capability-evolution-grid .overview-chart')).toHaveCount(4)
  await page.waitForLoadState('networkidle')
  await waitForResizeFrame()
  const before = await measure()
  await page.screenshot({ path: screenshotPath('2560x1440', 'fresh') , fullPage: true })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await waitForResizeFrame()
  const afterShrink = await measure()
  await page.screenshot({ path: screenshotPath('1920x1080', 'after-shrink'), fullPage: true })
  const afterShrinkBoard = await captureTrendReferenceActual(1920, 'after-shrink')

  await page.setViewportSize({ width: 2560, height: 1440 })
  await waitForResizeFrame()
  const afterExpand = await measure()
  await page.screenshot({ path: screenshotPath('2560x1440', 'after-expand'), fullPage: true })
  const afterExpandBoard = await captureTrendReferenceActual(2560, 'after-expand')

  const fits = (sample) => sample.charts.length === 4 && sample.charts.every(({ card, host }) => host && host.x >= card.x - 1 && host.right <= card.right + 1 && host.width >= card.width * 0.9)
  const evidence = {
    issueId: 'UI-CHART-RESIZE-01',
    status: 'IMPLEMENTATION_CANDIDATE_PENDING_INDEPENDENT_REVIEW',
    reference: 'docs/ux/reference-crops/capability-status-and-trends.png',
    transition: ['2560x1440 fresh load', '1920x1080 same-page shrink without reload', '2560x1440 same-page expand without reload'],
    before,
    afterShrink,
    afterExpand,
    hostFitsCard: { before: fits(before), afterShrink: fits(afterShrink), afterExpand: fits(afterExpand) },
    referenceActualBoards: { afterShrink: afterShrinkBoard, afterExpand: afterExpandBoard },
    screenshots: {
      before: screenshotPath('2560x1440', 'fresh'),
      afterShrink: screenshotPath('1920x1080', 'after-shrink'),
      afterExpand: screenshotPath('2560x1440', 'after-expand'),
    },
  }
  await writeFile(path.join(evidenceDirectory, 'geometry.json'), JSON.stringify(evidence, null, 2), 'utf8')

  expect(fits(before)).toBe(true)
  expect(fits(afterShrink)).toBe(true)
  expect(fits(afterExpand)).toBe(true)
  expect(afterShrink.document.scrollWidth).toBeLessThanOrEqual(afterShrink.document.clientWidth)
})
