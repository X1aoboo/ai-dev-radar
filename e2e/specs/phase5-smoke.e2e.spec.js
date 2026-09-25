import { expect, test } from '@playwright/test'

const RADAR_URL = process.env.E2E_RADAR_URL

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
]

const primaryRoutes = [
  ['/', '研发总览'],
  ['/analytics/activities', '研发活动'],
  ['/analytics/capabilities', '研发能力'],
  ['/analytics/teams/1', '团队下钻'],
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
  await page.getByLabel('密码').fill('e2e-password')
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

  test('captures final QA evidence at the release viewports', async ({ page }, testInfo) => {
    await page.goto(`${RADAR_URL}/login`)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByLabel('账号')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('qa-390-login.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)

    const screenshotPlan = [
      { viewport: viewports[0], routes: ['/', '/analytics/activities', '/analytics/capabilities', '/data/requirements/ir', '/settings/teams', '/settings/collections', '/settings/users'] },
      { viewport: viewports[1], routes: ['/', '/analytics/activities', '/analytics/capabilities', '/data/requirements/ir', '/settings/teams', '/settings/collections', '/settings/users'] },
      { viewport: viewports[2], routes: ['/', '/data/requirements/ir', '/settings/teams'] },
      { viewport: viewports[3], routes: ['/', '/analytics/activities', '/settings/collections'] },
    ]

    for (const { viewport, routes } of screenshotPlan) {
      await page.setViewportSize(viewport)
      for (const path of routes) {
        await page.goto(`${RADAR_URL}${path}`)
        await waitForStablePage(page)
        await assertNoPageOverflow(page)
        const filename = `qa-${viewport.name}-${path === '/' ? 'overview' : path.slice(1).replaceAll('/', '-')}.png`
        await page.screenshot({ path: testInfo.outputPath(filename), fullPage: true })
      }
    }
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

    await page.getByRole('group', { name: '统计维度' }).getByRole('button', { name: '按版本/迭代' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('dimension')).toBe('iteration')
    await page.getByRole('group', { name: '统计维度' }).getByRole('button', { name: '按时间' }).click()
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

    await page.getByLabel('密码').fill('e2e-password')
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
