import { expect, test } from '@playwright/test'

const RADAR_URL = process.env.E2E_RADAR_URL
const GATEWAY_URL = process.env.E2E_GATEWAY_URL
const VALID_TOKEN = 'e2e-valid-token'
const browserLogs = new Map()

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page, request }, testInfo) => {
  const messages = []
  browserLogs.set(testInfo.id, messages)
  page.on('console', (message) => messages.push(`console.${message.type()}: ${message.text()}`))
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`))
  const reset = await request.post(`${GATEWAY_URL}/_mock/reset`)
  expect(reset.ok()).toBeTruthy()
})

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach('browser-console.txt', {
      body: browserLogs.get(testInfo.id)?.join('\n') || 'No browser console output captured.',
      contentType: 'text/plain',
    })
  }
  browserLogs.delete(testInfo.id)
})

async function loginAsAdmin(page) {
  await page.goto(`${RADAR_URL}/login`)
  await page.getByLabel('账号').fill('admin')
  await page.getByLabel('密码').fill('e2e-password')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page.getByRole('link', { name: '数据网关' })).toBeVisible()
}

async function loginAsViewer(page) {
  await page.goto(`${RADAR_URL}/login`)
  await page.getByLabel('账号').fill('viewer')
  await page.getByLabel('密码').fill('e2e-password')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page.getByRole('link', { name: '研发总览' })).toBeVisible()
}

async function openGateway(page) {
  await page.getByRole('link', { name: '数据网关' }).click()
  await expect(page.getByRole('heading', { name: '数据网关' })).toBeVisible()
}

async function saveDraft(page, { url, token, timeout = '5', beforeSave }) {
  const editDraft = page.getByRole('button', { name: '编辑草稿' })
  if (await editDraft.count()) await editDraft.click()
  else await page.getByRole('button', { name: /编辑配置|配置 Gateway/ }).first().click()

  await page.getByLabel('Gateway 地址').fill(url)
  await page.getByLabel('Bearer Token').fill(token)
  await page.getByLabel('请求超时（秒）').fill(timeout)
  if (beforeSave) await beforeSave()
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('待启用配置', { exact: true })).toBeVisible()
}

async function checkDraft(page, statusLabel) {
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByTestId('gateway-draft-status')).toHaveText(statusLabel)
}

async function assertNoHorizontalOverflow(page, width) {
  await page.setViewportSize({ width, height: 900 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test('admin configures and activates Gateway, then stages IR through real HTTP', async ({ page, request }, testInfo) => {
  await loginAsAdmin(page)
  await openGateway(page)
  await expect(page.getByText('尚未配置 AI 研发数据网关。')).toBeVisible()

  for (const width of [1920, 1440, 1024, 390]) {
    await assertNoHorizontalOverflow(page, width)
    if (width === 1440 || width === 390) {
      await page.screenshot({
        path: testInfo.outputPath(`gateway-unconfigured-${width}.png`),
        fullPage: true,
      })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const sidebarToggle = page.locator('.app-sidebar__toggle')
  const transitionDuration = await sidebarToggle.evaluate((element) => getComputedStyle(element).transitionDuration)
  const longestTransitionSeconds = Math.max(...transitionDuration.split(',').map((value) => {
    const duration = value.trim()
    const amount = Number.parseFloat(duration)
    return duration.endsWith('ms') ? amount / 1000 : amount
  }))
  expect(longestTransitionSeconds).toBeLessThanOrEqual(0.01)

  await assertNoHorizontalOverflow(page, 390)
  await saveDraft(page, {
    url: GATEWAY_URL,
    token: VALID_TOKEN,
    beforeSave: async () => {
      await assertNoHorizontalOverflow(page, 390)
      const drawer = page.locator('.gateway-editor-drawer .ant-drawer-content-wrapper')
      const viewportWidth = page.viewportSize()?.width ?? 390
      await expect.poll(async () => {
        const bounds = await drawer.boundingBox()
        return bounds ? bounds.x + bounds.width : Number.POSITIVE_INFINITY
      }, {
        message: await page.evaluate(() => JSON.stringify({
          innerWidth: window.innerWidth,
          clientWidth: document.documentElement.clientWidth,
          drawer: document.querySelector('.ant-drawer-content-wrapper')?.getAttribute('style'),
          root: document.querySelector('.ant-drawer')?.getBoundingClientRect().toJSON(),
        })),
      }).toBeLessThanOrEqual(viewportWidth)
      const drawerBounds = await drawer.boundingBox()
      expect(drawerBounds.x).toBeGreaterThanOrEqual(0)
      expect(drawerBounds.x + drawerBounds.width).toBeLessThanOrEqual(viewportWidth)
      await page.screenshot({ path: testInfo.outputPath('gateway-editor-mobile.png'), fullPage: true })
      const tokenInput = page.getByLabel('Bearer Token')
      await expect(tokenInput).toHaveAttribute('type', 'password')
      const revealToken = page.getByRole('button', { name: '显示' })
      await tokenInput.focus()
      await page.keyboard.press('Tab')
      await expect(revealToken).toBeFocused()
      await expect.poll(() => revealToken.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
      await page.keyboard.press('Enter')
      await expect(tokenInput).toHaveAttribute('type', 'text')
      await page.getByRole('button', { name: '隐藏' }).press('Enter')
      await expect(tokenInput).toHaveAttribute('type', 'password')
    },
  })
  await assertNoHorizontalOverflow(page, 1440)

  await checkDraft(page, '已连接')
  await expect(page.getByText('1.0.0')).toBeVisible()
  await page.getByRole('button', { name: '启用配置' }).click()
  await expect(page.getByTestId('gateway-active-status')).toHaveText('已连接')
  await expect(page.getByText('待启用配置', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('gateway-active-desktop.png'), fullPage: true })

  await page.getByRole('link', { name: '数据采集' }).click()
  await expect(page.locator('.gateway-summary')).toContainText('已连接')
  await expect(page.getByRole('link', { name: '查看数据网关' })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑配置' })).toHaveCount(0)
  for (const width of [1440, 1024, 390]) {
    await assertNoHorizontalOverflow(page, width)
    if (width === 390) await page.screenshot({ path: testInfo.outputPath('collections-mobile.png'), fullPage: true })
  }
  await page.getByRole('button', { name: '立即采集' }).click()
  await expect(page.getByText('手动采集完成：成功。')).toBeVisible()

  const mockState = await (await request.get(`${GATEWAY_URL}/_mock/state`)).json()
  expect(mockState.collection_requests).toHaveLength(1)
  expect(mockState.collection_requests[0].product_versions).toEqual([
    { product_name: '团队A产品', version_name: 'SCC 27.1.RC1' },
  ])
  expect(mockState.collection_requests[0]).not.toHaveProperty('team_name')

  const batchesResponse = await page.request.get(`${RADAR_URL}/api/data/ir/imports?source_kind=collector&status=pending`)
  expect(batchesResponse.ok()).toBeTruthy()
  const batches = await batchesResponse.json()
  expect(batches).toHaveLength(1)
  const batch = await (await page.request.get(`${RADAR_URL}/api/data/ir/imports/${batches[0].id}`)).json()
  expect(batch.rows[0].source_id).toBe('IR-E2E-001')

  const state = await (await page.request.get(`${RADAR_URL}/api/gateway`)).json()
  expect(JSON.stringify(state)).not.toContain(VALID_TOKEN)
  expect(JSON.stringify(state)).not.toContain('bearer_token')
})

test('failed Draft diagnostics preserve Active collection', async ({ page, request }) => {
  await loginAsAdmin(page)
  await openGateway(page)
  await expect(page.getByTestId('gateway-active-status')).toHaveText('已连接')

  await saveDraft(page, { url: GATEWAY_URL, token: 'wrong-e2e-token' })
  await checkDraft(page, '认证失败')
  await expect(page.getByTestId('gateway-active-status')).toHaveText('已连接')

  await request.put(`${GATEWAY_URL}/_mock/scenario`, { data: { readiness: 'service_mismatch' } })
  await saveDraft(page, { url: GATEWAY_URL, token: VALID_TOKEN })
  await checkDraft(page, '服务身份不匹配')

  await request.put(`${GATEWAY_URL}/_mock/scenario`, { data: { readiness: 'protocol_incompatible' } })
  await saveDraft(page, { url: GATEWAY_URL, token: VALID_TOKEN })
  await checkDraft(page, '协议不兼容')

  await request.put(`${GATEWAY_URL}/_mock/scenario`, { data: { readiness: 'not_ready' } })
  await saveDraft(page, { url: GATEWAY_URL, token: VALID_TOKEN })
  await checkDraft(page, '连接降级')

  await request.put(`${GATEWAY_URL}/_mock/scenario`, { data: { readiness: 'malformed_readiness' } })
  await saveDraft(page, { url: GATEWAY_URL, token: VALID_TOKEN })
  await checkDraft(page, '协议不兼容')

  await request.put(`${GATEWAY_URL}/_mock/scenario`, { data: { readiness: 'delayed_readiness' } })
  await saveDraft(page, { url: GATEWAY_URL, token: VALID_TOKEN, timeout: '0.2' })
  await checkDraft(page, '连接降级')

  await request.put(`${GATEWAY_URL}/_mock/scenario`, { data: { readiness: 'ready' } })
  await saveDraft(page, { url: 'http://127.0.0.1:1', token: VALID_TOKEN, timeout: '0.2' })
  await checkDraft(page, '连接降级')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByTestId('gateway-draft-status')).toHaveText('连接降级')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByTestId('gateway-draft-status')).toHaveText('无法连接')

  await expect(page.getByTestId('gateway-active-status')).toHaveText('已连接')
  await page.getByRole('link', { name: '数据采集' }).click()
  await page.getByRole('button', { name: '立即采集' }).click()
  await expect(page.getByText('手动采集完成：成功。')).toBeVisible()

  const mockState = await (await request.get(`${GATEWAY_URL}/_mock/state`)).json()
  expect(mockState.collection_requests).toHaveLength(1)
})

test('viewer cannot discover or open Gateway administration', async ({ page }) => {
  await loginAsViewer(page)
  await expect(page.getByRole('link', { name: '数据网关' })).toHaveCount(0)
  await page.goto(`${RADAR_URL}/settings/gateway`)
  await expect(page.getByText('无权访问')).toBeVisible()
})
