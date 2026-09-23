import path from 'node:path'
import { defineConfig } from '@playwright/test'

const resultsDir = process.env.E2E_RESULTS_DIR
  ? path.join(process.env.E2E_RESULTS_DIR, 'playwright')
  : 'e2e-results/playwright'

export default defineConfig({
  testDir: './e2e/specs',
  outputDir: resultsDir,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    browserName: 'chromium',
    baseURL: process.env.E2E_RADAR_URL,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
})
