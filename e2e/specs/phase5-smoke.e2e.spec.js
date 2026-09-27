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
  ['/data/requirements/ir', 'IR 需求'],
  ['/data/requirements/ar', 'AR 需求'],
  ['/data/requirements/sr', 'SR 需求'],
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
  ['/data/requirements', '/data/requirements/ir'],
  ['/data/ir', '/data/requirements/ir'],
  ['/data/ar', '/data/requirements/ar'],
  ['/data/sr', '/data/requirements/sr'],
  ['/data/dts', '/data/issues'],
  ['/data-management', '/data/requirements/ir'],
  ['/data-management/ir', '/data/requirements/ir'],
  ['/team/1', '/analytics/teams/1'],
  ['/metric/1', '/analytics/metrics/1'],
  ['/config', '/settings/teams'],
  ['/manual-entry', '/data/requirements/ir'],
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
  await expect(page.locator('.executive-overall-trend .analytics-panel__description')).toContainText('多团队对照暂不可用')
  await expect(page.locator('.executive-kpi-grid .metric-card__delta').filter({ hasText: '较纳入本月前累计' })).toHaveCount(2)
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
      kpiHeight: document.querySelector('.executive-kpi-grid .metric-card').getBoundingClientRect().height,
      kpiIconSize: Number.parseFloat(getComputedStyle(document.querySelector('.executive-kpi-grid .metric-card__icon .anticon')).fontSize),
      maturityBottomGap: Math.round(
        document.querySelector('.executive-maturity-section').getBoundingClientRect().bottom
        - document.querySelector('.executive-maturity-grid').getBoundingClientRect().bottom,
      ),
    }
  })
  expect(Math.abs(geometry.master.top - geometry.lifecycle.top)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.master.bottom - geometry.lifecycle.bottom)).toBeLessThanOrEqual(1)
  expect(geometry.kpiHeight).toBeGreaterThanOrEqual(136)
  expect(geometry.kpiIconSize).toBeGreaterThanOrEqual(24)
  expect(geometry.maturityBottomGap).toBeLessThanOrEqual(32)
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
    const routes = ['/', '/analytics/activities', '/analytics/capabilities', '/data/requirements/ir', '/settings/teams', '/settings/collections']

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
    await expect(page.locator('.analytics-filter-scope-note')).toContainText('统计周期：近6个月趋势')
    await expect(page.locator('.analytics-filter-scope-note')).toContainText('版本：不适用')
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
    await expect(page.getByRole('group', { name: '统计周期' })).toHaveCount(1)
    await expect(page.getByRole('group', { name: '统计周期' }).getByRole('button', { name: '本半年度' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('group', { name: '统计周期' }).getByRole('button', { name: '年度累计' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('year')
    await page.getByRole('group', { name: '统计周期' }).getByRole('button', { name: '本半年度' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('cycle')).toBe('half')
    const teamKpiRows = page.locator('#team-overall .drilldown-kpi-row')
    await expect(teamKpiRows).toHaveCount(2)
    const singleTeamBenchmark = page.locator('#team-overall [role="status"]').filter({ hasText: '暂不可进行多团队对照' })
    await expect(singleTeamBenchmark).toHaveCount(2)
    await expect(singleTeamBenchmark.nth(0)).toContainText('1/4')
    await expect(singleTeamBenchmark.nth(0)).toContainText('各自的等权均值')
    await expect(singleTeamBenchmark.nth(1)).toContainText('1/4')
    await expect(singleTeamBenchmark.nth(1)).toContainText('各自的等权均值')
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
      { viewport: viewports[0], routes: ['/', '/analytics/activities', '/analytics/capabilities', '/data/requirements/ir', '/settings/teams', '/settings/collections', '/settings/users'] },
      { viewport: viewports[1], routes: ['/', '/analytics/activities', '/analytics/capabilities', '/analytics/teams/1', '/data/requirements/ir', '/settings/teams', '/settings/collections', '/settings/users'] },
      { viewport: wideViewport, routes: ['/', '/analytics/activities', '/analytics/capabilities', '/analytics/teams/1'] },
      { viewport: viewports[2], routes: ['/', '/data/requirements/ir', '/settings/teams'] },
      { viewport: viewports[3], routes: ['/', '/analytics/activities', '/settings/collections'] },
    ]

    const overviewEvidence = []
    const teamEvidence = []
    for (const { viewport, routes } of screenshotPlan) {
      await page.setViewportSize(viewport)
      for (const path of routes) {
        await page.goto(`${RADAR_URL}${path}`)
        await waitForStablePage(page)
        await assertNoPageOverflow(page)
        if (path === '/' && ['1920', '2560'].includes(viewport.name)) {
          await assertOverviewCardComposition(page)
          overviewEvidence.push(await page.evaluate((viewportName) => {
            const box = (selector) => {
              const rect = document.querySelector(selector).getBoundingClientRect()
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) }
            }
            return {
              viewport: viewportName,
              inner: { width: innerWidth, height: innerHeight },
              document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
              month: document.querySelector('input[type="month"]')?.value,
              kpiCardHeights: [...document.querySelectorAll('.executive-kpi-grid .metric-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
              pairedPanels: { master: box('.executive-overall-trend'), lifecycle: box('.executive-lifecycle') },
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
        if (path === '/analytics/teams/1' && ['1920', '2560'].includes(viewport.name)) {
          await page.screenshot({ path: testInfo.outputPath(filename.replace('.png', '-viewport.png')) })
          const evidence = await page.evaluate((viewportName) => ({
            viewport: viewportName,
            inner: { width: innerWidth, height: innerHeight },
            document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
            contentWidth: Math.round(document.querySelector('.drilldown-shell').getBoundingClientRect().width),
            kpiCardHeights: [...document.querySelectorAll('.drilldown-kpi-row .metric-card')].map((card) => Math.round(card.getBoundingClientRect().height)),
            storyPanels: ['team-overall', 'team-lifecycle', 'team-maturity'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().height)),
          }), viewport.name)
          teamEvidence.push(evidence)
          if (viewport.name === '2560') expect(evidence.contentWidth).toBeLessThanOrEqual(2160)
        }
        if (path === '/analytics/capabilities' && ['1920', '2560'].includes(viewport.name)) {
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
