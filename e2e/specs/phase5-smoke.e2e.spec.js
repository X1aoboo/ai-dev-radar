import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const RADAR_URL = process.env.E2E_RADAR_URL
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password'

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
]
const wideViewport = { name: '2560', width: 2560, height: 1440 }

const primaryRoutes = [
  ['/', '研发总览'],
  ['/analytics/activities', '研发活动'],
  ['/analytics/capabilities', '研发能力'],
  ['/analytics/teams/1', '团队详情'],
  ['/analytics/metrics/1', '指标详情'],
  ['/data/requirements/design', '设计活动'],
  ['/data/requirements/development', '开发活动'],
  ['/data/maturity', '成熟度评估'],
  ['/data/issues', '问题单数据'],
  ['/data/mr', 'MR数据'],
  ['/data/code-review', '代码检视数据'],
  ['/settings/teams', '团队与人员'],
  ['/settings/products', '产品与版本'],
  ['/settings/metrics', '指标定义'],
  ['/settings/collections', '数据采集'],
  ['/settings/gateway', '数据网关'],
  ['/settings/users', '用户与权限'],
]

const legacyRedirects = [
  ['/data/requirements', '/data/requirements/design'],
  ['/data/requirements/ir', '/data/requirements/design'],
  ['/data/requirements/ar', '/data/requirements/development'],
  ['/data/requirements/sr', '/data/requirements/design'],
  ['/data/ir', '/data/requirements/design'],
  ['/data/ar', '/data/requirements/development'],
  ['/data/sr', '/data/requirements/design'],
  ['/data/dts', '/data/issues'],
  ['/data-management', '/data/requirements/design'],
  ['/data-management/ir', '/data/requirements/design'],
  ['/data-management/ar', '/data/requirements/development'],
  ['/data-management/sr', '/data/requirements/design'],
  ['/team/1', '/analytics/teams/1'],
  ['/metric/1', '/analytics/metrics/1'],
  ['/config', '/settings/teams'],
  ['/manual-entry', '/data/requirements/design'],
  ['/?category=key', '/analytics/activities'],
  ['/?category=general', '/analytics/capabilities'],
]

async function login(page, username = 'admin') {
  await page.context().clearCookies()
  await page.goto(`${RADAR_URL}/login`)
  await expect(page.getByLabel('账号')).toBeVisible()
  await page.getByLabel('账号').fill(username)
  await page.getByLabel('密码').fill(E2E_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('link', { name: '研发总览' })).toBeVisible()
}

async function waitForStablePage(page) {
  await expect(page.locator('#main-content')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe('complete')
  await expect(page.locator('.content-loading')).toHaveCount(0)
  await page.waitForTimeout(250)
}

async function assertNoPageOverflow(page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
    && document.body.scrollWidth <= window.innerWidth
  ))).toBe(true)
}

async function assertOverviewCardComposition(page) {
  await expect(page.locator('.executive-kpi-grid .metric-card')).toHaveCount(8)
  await expect(page.locator('.executive-lifecycle__item')).toHaveCount(6)
  await expect(page.locator('.executive-lifecycle__item').filter({ hasText: '代码检视' })).toHaveCount(0)
  await expect(page.locator('.executive-lifecycle > .analytics-panel__header')).toContainText('研发关键环节')
  await expect(page.locator('#team-performance > .analytics-panel__header')).toContainText('团队表现')
  await expect(page.locator('.executive-maturity-section > .analytics-panel__header')).toContainText('成熟度')
  await expect(page.locator('.executive-overall-trend .analytics-panel__description')).toContainText('暂不可多团队对照')
  await expect(page.locator('.executive-kpi-grid .metric-card__delta').filter({ hasText: '较前累计' })).toHaveCount(2)
  await expect(page.locator('#team-performance .executive-team-preview__charts .analytics-chart-card')).toHaveCount(2)
  await expect(page.locator('#team-performance .team-matrix__table thead')).toContainText('变化')
  await expect(page.locator('.executive-maturity-scale')).toBeVisible()

  const geometry = await page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, height: rect.height }
    }
    return {
      master: box('.executive-overall-trend'),
      lifecycle: box('.executive-lifecycle'),
      maturity: box('.executive-maturity-section'),
      team: box('#team-performance'),
      sidebarWidth: document.querySelector('.app-sidebar').getBoundingClientRect().width,
      topbarHeight: document.querySelector('.app-topbar').getBoundingClientRect().height,
      contentGutter: Number.parseFloat(getComputedStyle(document.querySelector('.app-shell__content')).paddingLeft),
      kpiHeight: document.querySelector('.executive-kpi-grid .metric-card').getBoundingClientRect().height,
      kpiHeights: [...document.querySelectorAll('.executive-kpi-grid .metric-card')].map((card) => card.getBoundingClientRect().height),
      sparklineRatio: (() => { const card = document.querySelector('.executive-kpi-grid .metric-card'); const spark = card.querySelector('.metric-card__sparkline, .metric-card__empty-trend'); return spark.getBoundingClientRect().width / card.getBoundingClientRect().width })(),
      kpiIconSize: Number.parseFloat(getComputedStyle(document.querySelector('.executive-kpi-grid .metric-card__icon .anticon')).fontSize),
      maturityBottomGap: Math.round(
        document.querySelector('.executive-maturity-section').getBoundingClientRect().bottom
        - document.querySelector('.executive-maturity-grid').getBoundingClientRect().bottom,
      ),
      radarPlotRatio: (() => {
        const panel = document.querySelector('.executive-maturity-section').getBoundingClientRect()
        const radar = document.querySelector('.executive-maturity-section .maturity-radar svg')
        const plot = radar.querySelector('.maturity-radar__rings polygon:last-child').getBBox()
        const bounds = radar.getBoundingClientRect()
        const scale = Math.min(bounds.width / 420, bounds.height / 320)
        return plot.height * scale / Math.min(panel.width, panel.height)
      })(),
      teamPreviewChartHeight: Math.max(...[...document.querySelectorAll('#team-performance .executive-team-preview__charts .analytics-chart-card')].map((card) => card.getBoundingClientRect().height)),
    }
  })
  expect(Math.abs(geometry.master.top - geometry.lifecycle.top)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.master.bottom - geometry.lifecycle.bottom)).toBeLessThanOrEqual(1)
  expect(geometry.master.height).toBeGreaterThanOrEqual(300)
  expect(geometry.master.height).toBeLessThanOrEqual(340)
  expect(geometry.kpiHeight).toBeGreaterThanOrEqual(116)
  expect(geometry.kpiHeight).toBeLessThanOrEqual(128)
  expect(Math.max(...geometry.kpiHeights) - Math.min(...geometry.kpiHeights)).toBeLessThanOrEqual(1)
  expect(geometry.sidebarWidth).toBeGreaterThanOrEqual(208)
  expect(geometry.sidebarWidth).toBeLessThanOrEqual(224)
  expect(geometry.topbarHeight).toBeLessThanOrEqual(56)
  expect(geometry.contentGutter).toBeGreaterThanOrEqual(20)
  expect(geometry.contentGutter).toBeLessThanOrEqual(28)
  expect(geometry.sparklineRatio).toBeGreaterThanOrEqual(.35)
  expect(geometry.sparklineRatio).toBeLessThanOrEqual(.45)
  expect(geometry.kpiIconSize).toBeGreaterThanOrEqual(14)
  expect(geometry.kpiIconSize).toBeLessThanOrEqual(20)
  expect(geometry.maturityBottomGap).toBeLessThanOrEqual(32)
  expect(geometry.maturity.height).toBeLessThanOrEqual(320)
  expect(geometry.team.height).toBeLessThanOrEqual(320)
  expect(geometry.radarPlotRatio).toBeGreaterThanOrEqual(.6)
  expect(geometry.radarPlotRatio).toBeLessThanOrEqual(.75)
  expect(geometry.teamPreviewChartHeight).toBeLessThanOrEqual(110)
}

async function assertCanReachBottom(page) {
  await expect.poll(() => page.evaluate(() => {
    const scrollingElement = document.scrollingElement
    scrollingElement.scrollTop = scrollingElement.scrollHeight
    return scrollingElement.scrollTop + window.innerHeight >= scrollingElement.scrollHeight - 1
      && document.documentElement.scrollWidth <= window.innerWidth
  })).toBe(true)
}

test.describe('Phase 5 Browser UI Smoke', () => {
  test('admin route inventory and legacy redirects resolve to the documented targets', async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 1440, height: 900 })

    for (const [path, title] of primaryRoutes) {
      await page.goto(`${RADAR_URL}${path}`)
      await waitForStablePage(page)
      await expect.poll(() => page.title()).toBe(`${title} | ai-dev-radar`)
      await assertNoPageOverflow(page)
    }

    for (const [path, target] of legacyRedirects) {
      await page.goto(`${RADAR_URL}${path}`)
      await expect.poll(() => new URL(page.url()).pathname).toBe(target)
      await waitForStablePage(page)
      await assertNoPageOverflow(page)
    }
  })

  test('representative pages remain usable across the release viewports', async ({ page }) => {
    await login(page)
    const routes = ['/', '/analytics/activities', '/analytics/capabilities', '/data/requirements/design', '/data/requirements/development', '/settings/teams', '/settings/collections']

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      for (const path of routes) {
        await page.goto(`${RADAR_URL}${path}`)
        await waitForStablePage(page)
        await assertNoPageOverflow(page)
        await assertCanReachBottom(page)
      }
    }
  })

  test('team drill-down uses global IR KPIs, paired FactRecord slots, and three-point maturity profiles', async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`${RADAR_URL}/analytics/capabilities?month=2026-09&cycle=half`)
    await waitForStablePage(page)
    await expect(page.getByLabel('时间粒度')).toHaveValue('month')
    await expect(page.locator('.capability-page-actions [aria-label="版本"]')).toHaveCount(0)
    await expect(page.locator('.analytics-page-head .page-header__description')).toContainText('成熟度按自然月')
    await expect(page.locator('.capability-kpi-grid .metric-card')).toHaveCount(4)
    await expect(page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table tbody tr')).toHaveCount(5)
    await expect(page.locator('.analytics-maturity-summary__matrix .maturity-matrix__table thead th')).toHaveCount(8)
    await expect(page.locator('.analytics-maturity-summary__radar .maturity-radar svg')).toBeVisible()
    await page.evaluate(() => { document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    await page.locator('button[aria-label="选择团队：团队A"]').click()
    await expect(page).toHaveURL(/\/analytics\/teams\/1\?month=2026-09.*cycle=half/)
    await expect(page.getByRole('heading', { name: '团队A · 团队下钻' })).toBeVisible()
    await expect(page.locator('.drilldown-page-head')).toContainText('统计范围：全局 KPI 统计周期')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    const cycleSelect = page.getByLabel('统计周期')
    await expect(cycleSelect).toHaveValue('half')
    await cycleSelect.selectOption('year')
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('year')
    await cycleSelect.selectOption('half')
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('half')
    const teamKpiRows = page.locator('#team-overall .drilldown-kpi-row')
    await expect(teamKpiRows).toHaveCount(2)
    const singleTeamBenchmark = page.locator('#team-overall [role="status"]').filter({ hasText: '不可多团队对照' })
    await expect(singleTeamBenchmark).toHaveCount(1)
    await expect(singleTeamBenchmark.nth(0)).toContainText('1/4')
    await expect(singleTeamBenchmark.nth(0)).toContainText('月度、周期')
    const teamKpiHeight = await teamKpiRows.first().locator('.metric-card').first().evaluate((card) => card.getBoundingClientRect().height)
    expect(teamKpiHeight).toBeLessThanOrEqual(140)
    const globalKpiLabels = ['AI需求渗透率', 'AI研发提效', 'AI覆盖需求数', 'AI提效工作量']
    await expect(teamKpiRows.nth(0).locator('.metric-card__label')).toHaveText(globalKpiLabels)
    await expect(teamKpiRows.nth(1).locator('.metric-card__label')).toHaveText(globalKpiLabels)
    await expect(page.locator('#team-overall .drilldown-overall-trends .analytics-chart-card')).toHaveCount(2)
    const lifecycleCards = page.locator('.drilldown-lifecycle-card')
    const lifecycleCount = await lifecycleCards.count()
    await expect(page.locator('.drilldown-lifecycle-card .drilldown-lifecycle-metric')).toHaveCount(lifecycleCount * 2)
    await expect(lifecycleCards.filter({ hasText: 'DTS缺陷分析' })).toHaveCount(1)
    await expect(lifecycleCards.filter({ hasText: 'DTS缺陷修复' })).toHaveCount(1)
    await expect(page.locator('.drilldown-lifecycle-trends .drilldown-activity-card')).toHaveCount(2)
    await expect(page.locator('.drilldown-maturity .maturity-matrix__table tbody tr')).toHaveCount(3)
    await expect(page.locator('.drilldown-maturity .maturity-radar__legend span')).toHaveCount(3)
    await expect(page.locator('.drilldown-maturity').filter({ hasText: '本期' })).toContainText('上期')
    const maturityMode = page.getByRole('group', { name: '成熟度范围' })
    await expect(maturityMode.getByRole('button', { name: '关键研发活动' })).toHaveAttribute('aria-pressed', 'true')
    await maturityMode.getByRole('button', { name: '通用研发能力' }).click()
    await expect(page.locator('#team-maturity .maturity-matrix__table')).toContainText('MR代码检视')
    await expect(page.locator('#team-maturity .maturity-matrix__table tbody tr')).toHaveCount(3)
    await maturityMode.getByRole('button', { name: '关键研发活动' }).click()
    for (const id of ['team-overall', 'team-lifecycle', 'team-maturity']) {
      await expect(page.locator(`#${id}`)).toHaveClass(/analytics-panel/)
    }
    await expect(page.locator('#team-overall .drilldown-kpi-section')).toHaveCount(2)
    await expect(page.locator('#team-overall .drilldown-overall-trends .analytics-chart-card')).toHaveCount(2)
    await expect(page.locator('#team-lifecycle .drilldown-lifecycle-cards')).toBeVisible()
    const radarStroke = await page.locator('.drilldown-maturity .maturity-radar__rings polygon').first().evaluate((element) => getComputedStyle(element).stroke)
    expect(radarStroke).not.toBe('rgb(0, 0, 0)')
    await assertCanReachBottom(page)
    await expect(page.getByRole('link', { name: '团队详情' })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.app-topbar__context')).toContainText('团队详情')
    await expect(page.locator('.app-topbar__context')).toContainText('来自研发能力')
    await expect(page.locator('.app-topbar__context')).not.toContainText('研发总览')
    await page.getByRole('button', { name: '返回研发能力' }).click()
    await expect(page).toHaveURL(/\/analytics\/capabilities\?month=2026-09.*cycle=half/)
    await expect(page.getByRole('heading', { name: '研发能力 / MR代码检视' })).toBeVisible()
  })

  test('captures final QA evidence at the release viewports', async ({ page }, testInfo) => {
    await page.goto(`${RADAR_URL}/login`)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByLabel('账号')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('qa-390-login.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)

    const screenshotPlan = [
      { viewport: viewports[0], routes: ['/', '/analytics/activities', '/analytics/capabilities', '/data/requirements/design', '/data/requirements/development', '/settings/teams', '/settings/collections', '/settings/users'] },
      { viewport: viewports[1], routes: ['/', '/analytics/activities', '/analytics/capabilities', '/analytics/teams/1', '/data/requirements/design', '/settings/teams', '/settings/collections', '/settings/users'] },
      { viewport: wideViewport, routes: ['/', '/analytics/activities', '/analytics/capabilities', '/analytics/teams/1'] },
      { viewport: viewports[2], routes: ['/', '/data/requirements/design', '/settings/teams'] },
      { viewport: viewports[3], routes: ['/', '/analytics/activities', '/settings/collections'] },
    ]

    const overviewEvidence = []
    const activityEvidence = []
    const capabilityEvidence = []
    const teamEvidence = []
    for (const { viewport, routes } of screenshotPlan) {
      await page.setViewportSize(viewport)
      for (const path of routes) {
        await page.goto(`${RADAR_URL}${path}`)
        await waitForStablePage(page)
        if (path === '/analytics/teams/1') {
          await expect(page.locator('.drilldown-overall-trends .overview-chart')).toHaveCount(2)
          await expect(page.locator('.drilldown-lifecycle-trends .overview-chart')).toHaveCount(2)
          await expect(page.locator('.drilldown-lifecycle-trends .drilldown-empty').filter({ hasText: '正在更新指标数据…' })).toHaveCount(0)
        }
        await assertNoPageOverflow(page)
        if (path === '/' && ['1920', '2560'].includes(viewport.name)) {
          await assertOverviewCardComposition(page)
          overviewEvidence.push(await page.evaluate((viewportName) => {
            const box = (selector) => {
              const rect = document.querySelector(selector).getBoundingClientRect()
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) }
            }
            const size = (selector) => {
              const rect = document.querySelector(selector).getBoundingClientRect()
              return { width: Math.round(rect.width), height: Math.round(rect.height) }
            }
            const radar = document.querySelector('.executive-maturity-section .maturity-radar svg')
            const radarPlot = radar?.querySelector('.maturity-radar__rings polygon:last-child')?.getBBox()
            const radarRect = radar?.getBoundingClientRect()
            const radarScale = radarRect ? Math.min(radarRect.width / 420, radarRect.height / 320) : 0
            return {
              viewport: viewportName,
              inner: { width: innerWidth, height: innerHeight },
              document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
              sidebarWidth: Math.round(document.querySelector('.app-sidebar').getBoundingClientRect().width),
              topbarHeight: Math.round(document.querySelector('.app-topbar').getBoundingClientRect().height),
              contentGutter: getComputedStyle(document.querySelector('.app-shell__content')).paddingLeft,
              month: document.querySelector('input[type="month"]')?.value,
              kpiCardHeights: [...document.querySelectorAll('.executive-kpi-grid .metric-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
              kpiSparklineRatios: [...document.querySelectorAll('.executive-kpi-grid .metric-card')].map((card) => {
                const spark = card.querySelector('.metric-card__sparkline')
                return spark ? Math.round(spark.getBoundingClientRect().width / card.getBoundingClientRect().width * 100) : null
              }),
              pairedPanels: { master: box('.executive-overall-trend'), lifecycle: box('.executive-lifecycle') },
              lifecycleStageHeight: Math.round(document.querySelector('.executive-lifecycle__item').getBoundingClientRect().height),
              lifecycleTrendGrid: size('.executive-lifecycle__trend-grid'),
              lifecycleTrendCards: [...document.querySelectorAll('.executive-lifecycle__trend-grid .analytics-chart-card')].map((card) => ({
                height: Math.round(card.getBoundingClientRect().height),
                plotHeight: Math.round(card.querySelector('.overview-chart').getBoundingClientRect().height),
              })),
              lowerPanels: { maturity: box('.executive-maturity-section'), team: box('.executive-team-section') },
              maturityMatrix: size('.executive-maturity-section .maturity-matrix__table'),
              maturityRadar: size('.executive-maturity-section .maturity-radar svg'),
              maturityRadarPlot: radarPlot ? { width: Math.round(radarPlot.width * radarScale), height: Math.round(radarPlot.height * radarScale) } : null,
              maturityRadarPlotPercentOfPanelShortSide: radarPlot ? Math.round(radarPlot.height * radarScale / Math.min(document.querySelector('.executive-maturity-section').getBoundingClientRect().width, document.querySelector('.executive-maturity-section').getBoundingClientRect().height) * 100) : null,
              teamMatrix: size('#team-performance .team-matrix__table'),
              teamPreview: box('#team-performance .executive-team-preview'),
              teamPreviewCharts: [...document.querySelectorAll('#team-performance .executive-team-preview__charts .analytics-chart-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
              lifecycleStages: [...document.querySelectorAll('.executive-lifecycle__item')].map((item) => item.innerText.split('\n')[0]),
              maturityScale: Boolean(document.querySelector('.executive-maturity-scale')),
              teamChangeColumns: document.querySelectorAll('#team-performance .team-matrix__table thead tr:nth-child(2) th').length,
              teamTrendCards: document.querySelectorAll('#team-performance .executive-team-preview__charts .analytics-chart-card').length,
            }
          }, viewport.name))
        }
        const filename = `qa-${viewport.name}-${path === '/' ? 'overview' : path.slice(1).replaceAll('/', '-')}.png`
        if (path === '/' && ['1920', '2560'].includes(viewport.name)) {
          await page.screenshot({ path: testInfo.outputPath(filename.replace('.png', '-viewport.png')) })
        }
        if (path === '/analytics/activities' && ['1920', '2560'].includes(viewport.name)) {
          const evidence = await page.evaluate((viewportName) => {
            const box = (selector) => { const rect = document.querySelector(selector).getBoundingClientRect(); return { x: Math.round(rect.x), width: Math.round(rect.width), height: Math.round(rect.height) } }
            return {
              viewport: viewportName,
              inner: { width: innerWidth, height: innerHeight },
              document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
              sidebarWidth: Math.round(document.querySelector('.app-sidebar').getBoundingClientRect().width),
              topbarHeight: Math.round(document.querySelector('.app-topbar').getBoundingClientRect().height),
              contentGutter: getComputedStyle(document.querySelector('.app-shell__content')).paddingLeft,
              directory: box('.activity-directory'),
              workspace: box('.activity-workspace'),
              kpiHeights: [...document.querySelectorAll('.activity-outcome-grid .metric-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
              kpiSparklineRatios: [...document.querySelectorAll('.activity-outcome-grid .metric-card')].map((card) => {
                const trend = card.querySelector('.metric-card__sparkline, .metric-card__empty-trend')
                const style = getComputedStyle(card)
                const contentWidth = card.getBoundingClientRect().width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
                return trend ? Math.round(trend.getBoundingClientRect().width / contentWidth * 100) : null
              }),
              charts: [...document.querySelectorAll('.activity-trend-grid .analytics-analysis-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
              teamDifferencePanel: box('.activity-team-matrix'),
              teamDifferenceTable: box('.activity-team-matrix .team-matrix__table'),
              teamDifferenceHeader: box('.activity-team-matrix .team-matrix__table thead'),
              teamDifferenceRows: [...document.querySelectorAll('.activity-team-matrix .team-matrix__table tbody tr')].map((row) => Math.round(row.getBoundingClientRect().height)),
              lowerColumns: [...document.querySelectorAll('.activity-lower-grid > *')].map((card) => Math.round(card.getBoundingClientRect().width)),
              lowerColumnHeights: [...document.querySelectorAll('.activity-lower-grid > *')].map((card) => Math.round(card.getBoundingClientRect().height)),
            }
          }, viewport.name)
          activityEvidence.push(evidence)
          expect(evidence.directory.width).toBeGreaterThanOrEqual(210)
          expect(evidence.directory.width).toBeLessThanOrEqual(230)
          expect(Math.max(...evidence.kpiHeights) - Math.min(...evidence.kpiHeights)).toBeLessThanOrEqual(1)
          expect(Math.min(...evidence.kpiHeights)).toBeGreaterThanOrEqual(116)
          expect(Math.max(...evidence.kpiHeights)).toBeLessThanOrEqual(128)
          expect(evidence.kpiSparklineRatios.every((ratio) => ratio >= 35 && ratio <= 45)).toBe(true)
          expect(evidence.charts).toHaveLength(2)
          expect(Math.min(...evidence.charts)).toBeGreaterThanOrEqual(260)
          expect(Math.max(...evidence.charts)).toBeLessThanOrEqual(320)
          expect(evidence.teamDifferencePanel.height).toBeLessThanOrEqual(190)
          expect(evidence.teamDifferenceTable.height).toBeLessThanOrEqual(145)
          expect(Math.max(...evidence.lowerColumns) / Math.min(...evidence.lowerColumns)).toBeLessThanOrEqual(1.2)
          expect(Math.max(...evidence.lowerColumnHeights) - Math.min(...evidence.lowerColumnHeights)).toBeLessThanOrEqual(1)
          expect(Math.max(...evidence.lowerColumnHeights)).toBeLessThanOrEqual(220)
          await page.screenshot({ path: testInfo.outputPath(filename.replace('.png', '-viewport.png')) })
        }
        if (path === '/analytics/teams/1' && ['1920', '2560'].includes(viewport.name)) {
          await page.screenshot({ path: testInfo.outputPath(filename.replace('.png', '-viewport.png')) })
          const evidence = await page.evaluate((viewportName) => ({
            viewport: viewportName,
            inner: { width: innerWidth, height: innerHeight },
            document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
            contentWidth: Math.round(document.querySelector('.drilldown-shell').getBoundingClientRect().width),
            kpiCardHeights: [...document.querySelectorAll('.drilldown-kpi-row .metric-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
            kpiRowWidths: [...document.querySelectorAll('.drilldown-kpi-row')].map((row) => [...row.querySelectorAll('.metric-card')].map((card) => Math.round(card.getBoundingClientRect().width))),
            coreTrendCardHeights: [...document.querySelectorAll('.drilldown-overall-trends .analytics-chart-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
            lifecycleStageHeights: [...document.querySelectorAll('.drilldown-lifecycle-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
            lifecycleStageIconCount: document.querySelectorAll('.drilldown-lifecycle-card__icon').length,
            truncatedLifecycleBenchmarks: [...document.querySelectorAll('.drilldown-lifecycle-metric em')].filter((item) => item.textContent.startsWith('均值') && item.scrollWidth > item.clientWidth).length,
            teamNote: document.querySelector('.drilldown-team-note')?.textContent ?? '',
            storyPanels: ['team-overall', 'team-lifecycle', 'team-maturity'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().height)),
            maturityMatrixRadarWidths: [...document.querySelectorAll('.drilldown-maturity__category-grid')].map((grid) => {
              const matrix = grid.children[0].getBoundingClientRect()
              const radar = grid.children[1].getBoundingClientRect()
              const svg = grid.children[1].querySelector('.maturity-radar svg')
              const svgRect = svg.getBoundingClientRect()
              const polygon = svg.querySelector('.maturity-radar__rings polygon:last-child').getBBox()
              const scale = Math.min(svgRect.width / 420, svgRect.height / 320)
              return {
                matrix: Math.round(matrix.width),
                radar: Math.round(radar.width),
                matrixRatio: Math.round(matrix.width / (matrix.width + radar.width) * 100),
                plotPercentOfPanelShortSide: Math.round(Math.min(polygon.width, polygon.height) * scale / Math.min(radar.width, radar.height) * 100),
              }
            }),
          }), viewport.name)
          teamEvidence.push(evidence)
          expect(evidence.kpiCardHeights).toHaveLength(8)
          expect(Math.max(...evidence.kpiCardHeights) - Math.min(...evidence.kpiCardHeights)).toBeLessThanOrEqual(1)
          expect(evidence.kpiCardHeights.every((height) => height >= 116 && height <= 128)).toBe(true)
          expect(evidence.kpiRowWidths).toHaveLength(2)
          expect(evidence.kpiRowWidths.every((widths) => widths.length === 4 && Math.max(...widths) - Math.min(...widths) <= 1)).toBe(true)
          expect(evidence.teamNote.split('1/4').length - 1).toBe(1)
          expect(evidence.coreTrendCardHeights).toHaveLength(2)
          expect(Math.max(...evidence.coreTrendCardHeights) - Math.min(...evidence.coreTrendCardHeights)).toBeLessThanOrEqual(1)
          expect(evidence.coreTrendCardHeights.every((height) => height >= 160 && height <= 200)).toBe(true)
          expect(evidence.lifecycleStageHeights.length).toBeGreaterThanOrEqual(4)
          expect(evidence.lifecycleStageIconCount).toBe(evidence.lifecycleStageHeights.length)
          expect(evidence.truncatedLifecycleBenchmarks).toBe(0)
          expect(Math.max(...evidence.lifecycleStageHeights) - Math.min(...evidence.lifecycleStageHeights)).toBeLessThanOrEqual(1)
          expect(evidence.lifecycleStageHeights.every((height) => height >= 100 && height <= 128)).toBe(true)
          expect(evidence.maturityMatrixRadarWidths.length).toBeGreaterThan(0)
          expect(evidence.maturityMatrixRadarWidths.every(({ matrixRatio }) => matrixRatio >= 48 && matrixRatio <= 52)).toBe(true)
          expect(evidence.maturityMatrixRadarWidths.every(({ plotPercentOfPanelShortSide }) => plotPercentOfPanelShortSide >= 60 && plotPercentOfPanelShortSide <= 75)).toBe(true)
          if (viewport.name === '2560') expect(evidence.contentWidth).toBeGreaterThan(2160)
        }
        if (path === '/analytics/capabilities' && ['1920', '2560'].includes(viewport.name)) {
          const evidence = await page.evaluate((viewportName) => {
            const box = (selector) => { const rect = document.querySelector(selector).getBoundingClientRect(); return { x: Math.round(rect.x), width: Math.round(rect.width), height: Math.round(rect.height) } }
            const radarElement = document.querySelector('.analytics-maturity-summary__radar .maturity-radar svg')
            const radar = radarElement.getBoundingClientRect()
            const radarPlot = radarElement.querySelector('.maturity-radar__rings polygon:last-child').getBBox()
            const radarScale = Math.min(radar.width / 420, radar.height / 320)
            const matrixPanel = box('.analytics-maturity-summary__matrix')
            const radarPanel = box('.analytics-maturity-summary__radar')
            return {
              viewport: viewportName,
              inner: { width: innerWidth, height: innerHeight },
              document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
              sidebarWidth: Math.round(document.querySelector('.app-sidebar').getBoundingClientRect().width),
              topbarHeight: Math.round(document.querySelector('.app-topbar').getBoundingClientRect().height),
              contentGutter: getComputedStyle(document.querySelector('.app-shell__content')).paddingLeft,
              directory: box('.analytics-directory-workspace > .analytics-directory'),
              workspace: box('.analytics-directory-workspace > .analytics-workspace'),
              workspaceHeader: box('.capability-page .analytics-workspace > .analytics-page-head'),
              kpiHeights: [...document.querySelectorAll('.capability-kpi-grid .metric-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
              evolutionCharts: [...document.querySelectorAll('.capability-evolution-grid .analytics-analysis-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
              comparisonPanels: [...document.querySelectorAll('.capability-comparison-grid > *')].map((panel) => Math.round(panel.getBoundingClientRect().height)),
              teamBenchmarkCells: document.querySelectorAll('.capability-comparison-grid .team-matrix__cell--benchmark-above, .capability-comparison-grid .team-matrix__cell--benchmark-below').length,
              teamBenchmarkDeltas: document.querySelectorAll('.capability-comparison-grid .team-matrix__benchmark-delta').length,
              supportingEvidenceCards: document.querySelectorAll('.capability-evidence-card').length,
              supportingEvidenceCharts: document.querySelectorAll('.capability-evidence-card .overview-chart').length,
              maturityPanels: { matrix: matrixPanel, radar: radarPanel },
              maturityPanelWidthRatio: Math.round(matrixPanel.width / (matrixPanel.width + radarPanel.width) * 100),
              radarPlotPercentOfPanelShortSide: Math.round(radarPlot.height * radarScale / Math.min(radarPanel.width, radarPanel.height) * 100),
              matrixWidth: matrixPanel.width,
              radar: { width: Math.round(radar.width), height: Math.round(radar.height) },
            }
          }, viewport.name)
          capabilityEvidence.push(evidence)
          expect(evidence.directory.width).toBeGreaterThanOrEqual(210)
          expect(evidence.directory.width).toBeLessThanOrEqual(230)
          expect(evidence.workspaceHeader.x).toBeGreaterThanOrEqual(evidence.directory.x + evidence.directory.width)
          expect(evidence.kpiHeights).toHaveLength(4)
          expect(Math.max(...evidence.kpiHeights) - Math.min(...evidence.kpiHeights)).toBeLessThanOrEqual(1)
          expect(Math.min(...evidence.kpiHeights)).toBeGreaterThanOrEqual(116)
          expect(Math.max(...evidence.kpiHeights)).toBeLessThanOrEqual(128)
          expect(evidence.evolutionCharts).toHaveLength(2)
          expect(Math.min(...evidence.evolutionCharts)).toBeGreaterThanOrEqual(260)
          expect(Math.max(...evidence.evolutionCharts)).toBeLessThanOrEqual(320)
          expect(evidence.comparisonPanels).toHaveLength(2)
          expect(Math.max(...evidence.comparisonPanels) - Math.min(...evidence.comparisonPanels)).toBeLessThanOrEqual(8)
          expect(Math.max(...evidence.comparisonPanels)).toBeLessThanOrEqual(240)
          expect(evidence.teamBenchmarkCells).toBeGreaterThan(0)
          expect(evidence.teamBenchmarkDeltas).toBeGreaterThan(0)
          expect(evidence.supportingEvidenceCards).toBe(3)
          expect(evidence.supportingEvidenceCharts).toBe(2)
          expect(Math.abs(evidence.maturityPanels.matrix.height - evidence.maturityPanels.radar.height)).toBeLessThanOrEqual(8)
          expect(Math.max(evidence.maturityPanels.matrix.height, evidence.maturityPanels.radar.height)).toBeLessThanOrEqual(260)
          expect(evidence.maturityPanelWidthRatio).toBeGreaterThanOrEqual(48)
          expect(evidence.maturityPanelWidthRatio).toBeLessThanOrEqual(55)
          expect(evidence.radarPlotPercentOfPanelShortSide).toBeGreaterThanOrEqual(60)
          expect(evidence.radarPlotPercentOfPanelShortSide).toBeLessThanOrEqual(75)
          await page.screenshot({ path: testInfo.outputPath(filename.replace('.png', '-viewport.png')) })
        }
        await page.screenshot({ path: testInfo.outputPath(filename), fullPage: true })
      }
    }

    await page.setViewportSize(viewports[1])
    await page.goto(`${RADAR_URL}/?month=2026-10`)
    await waitForStablePage(page)
    await assertNoPageOverflow(page)
    await assertOverviewCardComposition(page)
    await page.screenshot({ path: testInfo.outputPath('qa-1920-overview-empty-viewport.png') })
    await page.screenshot({ path: testInfo.outputPath('qa-1920-overview-empty.png'), fullPage: true })
    overviewEvidence.push(await page.evaluate(() => ({
      viewport: '1920-empty',
      inner: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      month: document.querySelector('input[type="month"]')?.value,
      emptyKpiCards: [...document.querySelectorAll('.executive-kpi-grid .metric-card')].filter((card) => card.innerText.includes('暂无')).length,
      maturityScale: Boolean(document.querySelector('.executive-maturity-scale')),
    })))
    await page.goto(`${RADAR_URL}/`)
    await waitForStablePage(page)
    await page.getByRole('button', { name: '选择关键环节：测试用例执行' }).click()
    await expect(page.getByRole('heading', { name: '测试用例执行 · AI需求渗透率趋势' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '测试用例执行 · AI研发提效趋势' })).toBeVisible()
    await expect(page.locator('.executive-lifecycle__empty-note')).toHaveCount(1)
    await expect(page.locator('.executive-lifecycle__trend-grid .analytics-chart-card--empty .feedback-state')).toHaveCount(2)
    const emptyLifecycleSlots = page.locator('.executive-lifecycle__trend-grid .analytics-chart-card--empty')
    await expect(emptyLifecycleSlots.nth(0)).toContainText('目录未配置AI需求渗透率类型指标')
    await expect(emptyLifecycleSlots.nth(1)).toContainText('目录未配置AI研发提效类型指标')
    await page.screenshot({ path: testInfo.outputPath('qa-1920-overview-lifecycle-empty-slots.png'), fullPage: true })
    overviewEvidence.push({ viewport: '1920', selectedLifecycleStage: '测试用例执行', emptyMetricSlots: ['AI需求渗透率', 'AI研发提效'] })
    await page.goto(`${RADAR_URL}/analytics/teams/1?month=2026-10&cycle=half`)
    await waitForStablePage(page)
    await assertNoPageOverflow(page)
    const missingMonthKpis = page.locator('#team-overall .drilldown-kpi-row').first()
    const emptyTrendStates = await missingMonthKpis.locator('.metric-card__empty-trend').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).display))
    expect(emptyTrendStates).toEqual(['none', 'none', 'none', 'none'])
    await expect(missingMonthKpis.locator('.metric-card__sparkline')).toHaveCount(0)
    await expect(missingMonthKpis.locator('.metric-card__detail').first()).toContainText('暂无当前团队值')
    await page.screenshot({ path: testInfo.outputPath('qa-1920-team-drilldown-empty.png'), fullPage: true })
    await page.goto(`${RADAR_URL}/`)
    await waitForStablePage(page)
    await page.locator('.executive-maturity-category button').filter({ hasText: '通用研发能力' }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/')
    await expect.poll(() => new URL(page.url()).searchParams.get('maturity_category')).toBe('general')
    await expect(page.locator('.executive-maturity-section .maturity-matrix__table')).toContainText('MR代码检视')
    await page.screenshot({ path: testInfo.outputPath('qa-1920-overview-general-maturity.png'), fullPage: true })
    overviewEvidence.push({ viewport: '1920', maturityCategory: '通用研发能力', generalMaturityIncludesCodeReview: true })

    await page.goto(`${RADAR_URL}/analytics/teams/1?month=2026-09&cycle=half`)
    await waitForStablePage(page)
    await page.locator('#team-lifecycle').scrollIntoViewIfNeeded()
    const sectionNav = page.locator('.drilldown-section-nav')
    await expect(sectionNav).toBeVisible()
    await expect.poll(() => sectionNav.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(64)
    await page.screenshot({ path: testInfo.outputPath('qa-1920-team-nav-scrolled.png') })
    await page.locator('.drilldown-lifecycle-card').filter({ hasText: '编码开发' }).click()
    const efficiencyChart = page.locator('.drilldown-lifecycle-trends .overview-chart').nth(1)
    await expect(efficiencyChart).toBeVisible()
    await efficiencyChart.scrollIntoViewIfNeeded()
    const chartBounds = await efficiencyChart.boundingBox()
    await page.mouse.move(chartBounds.x + chartBounds.width * 0.68, chartBounds.y + chartBounds.height * 0.5)
    await page.waitForTimeout(200)
    await expect(efficiencyChart).toContainText('有事实团队等权均值')
    await expect(efficiencyChart).toContainText('图上值 +100%；原始值 +130%')
    await page.screenshot({ path: testInfo.outputPath('qa-1920-team-efficiency-hover.png') })
    await page.goto(`${RADAR_URL}/analytics/teams/1?month=2026-09&cycle=half`)
    await waitForStablePage(page)
    await page.evaluate(() => {
      const panel = document.getElementById('team-maturity')
      document.scrollingElement.scrollTop = panel.getBoundingClientRect().top + document.scrollingElement.scrollTop - 128
    })
    const generalMaturity = page.getByRole('group', { name: '成熟度范围' }).getByRole('button', { name: '通用研发能力' })
    await generalMaturity.click()
    await expect(generalMaturity).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#team-maturity .maturity-matrix__table')).toContainText('MR代码检视')
    await expect(page.locator('#team-maturity .maturity-radar__legend span')).toHaveCount(3)
    await page.screenshot({ path: testInfo.outputPath('qa-1920-team-general-maturity-viewport.png') })
    await page.screenshot({ path: testInfo.outputPath('qa-1920-team-general-maturity.png'), fullPage: true })
    await writeFile(testInfo.outputPath('overview-browser-evidence.json'), `${JSON.stringify(overviewEvidence, null, 2)}\n`, 'utf8')
    await writeFile(testInfo.outputPath('activity-browser-evidence.json'), `${JSON.stringify(activityEvidence, null, 2)}\n`, 'utf8')
    await writeFile(testInfo.outputPath('capability-browser-evidence.json'), `${JSON.stringify(capabilityEvidence, null, 2)}\n`, 'utf8')
    await writeFile(testInfo.outputPath('team-r3-browser-evidence.json'), `${JSON.stringify(teamEvidence, null, 2)}\n`, 'utf8')
  })

  test('global states and viewer authorization remain explicit', async ({ page }) => {
    await login(page, 'viewer')

    await expect(page.getByRole('link', { name: '数据网关' })).toHaveCount(0)
    await page.goto(`${RADAR_URL}/settings/users`)
    await expect(page.getByRole('heading', { name: '无权访问' })).toBeVisible()

    await page.goto(`${RADAR_URL}/data/issues`)
    await expect(page.getByRole('heading', { name: '问题单数据暂未开放' })).toBeVisible()

    await page.goto(`${RADAR_URL}/route-that-does-not-exist`)
    await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible()
  })

  test('modal Drawers restore focus to the invoking control after Escape', async ({ page }) => {
    await login(page)
    await page.goto(`${RADAR_URL}/data/maturity`)
    await waitForStablePage(page)

    await page.getByRole('combobox', { name: '维护团队' }).click()
    await page.locator('.ant-select-item-option').first().click()
    await expect(page.locator('.maturity-editor__table')).toBeVisible()
    const previewTrigger = page.getByRole('button', { name: '预览保存' })
    await previewTrigger.click()
    await expect(page.locator('.ant-drawer-title', { hasText: '保存预览' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.ant-drawer-title', { hasText: '保存预览' })).toBeHidden()
    await expect(previewTrigger).toBeFocused()

    await page.goto(`${RADAR_URL}/settings/gateway`)
    await waitForStablePage(page)
    const draftTrigger = page.getByRole('button', { name: '编辑草稿', exact: true })
    const configureTrigger = await draftTrigger.count()
      ? draftTrigger
      : page.getByRole('button', { name: /编辑配置|配置 Gateway/ }).first()
    await configureTrigger.click()
    await expect(page.getByLabel('Bearer Token')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByLabel('Bearer Token')).toBeHidden()
    await expect(configureTrigger).toBeFocused()
  })

  test('URL state and destructive confirmations remain explicit in the browser', async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${RADAR_URL}/analytics/activities?month=2026-08`)
    await waitForStablePage(page)

    await page.getByText('原始指标筛选', { exact: true }).click()
    await expect(page.getByRole('group', { name: '统计维度' })).toBeVisible()
    await page.getByRole('group', { name: '统计维度' }).getByRole('button', { name: '按版本/迭代' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('dimension')).toBe('iteration')
    await page.getByRole('group', { name: '统计维度' }).getByRole('button', { name: '按时间' }).click()
    await page.getByText('原始指标筛选', { exact: true }).click()
    await expect(page.getByRole('group', { name: '时间粒度' })).toBeVisible()
    await page.getByRole('group', { name: '时间粒度' }).getByRole('button', { name: '周' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('granularity')).toBe('week')

    await page.goto(`${RADAR_URL}/settings/users`)
    await waitForStablePage(page)
    await expect(page.getByRole('button', { name: '删除账号 admin' })).toHaveCount(0)
    await page.getByRole('button', { name: '删除账号 viewer' }).click()
    await expect(page.getByText('确定删除账号“viewer”？')).toBeVisible()
    await expect(page.getByText('该账号将无法继续登录；删除成功后无法恢复。')).toBeVisible()
    await page.getByRole('button', { name: '取 消' }).click()
    await expect(page.getByRole('button', { name: '取 消' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: '删 除' })).not.toBeVisible()
  })

  test('login validation and mobile navigation preserve keyboard behavior', async ({ page }) => {
    await page.goto(`${RADAR_URL}/login`)
    await page.locator('button[type="submit"]').click()
    await expect(page.getByRole('alert')).toHaveText('请输入账号和密码。')
    await expect(page.getByLabel('账号')).toBeFocused()

    await page.getByLabel('账号').fill('admin')
    await page.getByLabel('密码').fill('wrong-password')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByRole('alert')).toHaveText('账号或密码错误。')

    await page.getByLabel('密码').fill(E2E_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page.getByRole('link', { name: '研发总览' })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    const opener = page.getByRole('button', { name: '打开导航' })
    await opener.click()
    await expect(page.getByRole('dialog', { name: '导航' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '导航' })).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
})
