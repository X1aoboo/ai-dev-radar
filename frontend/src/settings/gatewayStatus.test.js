import test from 'node:test'
import assert from 'node:assert/strict'

import { formatGatewayDate, gatewayStatusInfo } from './gatewayStatus.js'

test('Gateway readiness states have explicit localized labels and tones', () => {
  assert.deepEqual(gatewayStatusInfo('CONNECTED'), { label: '已连接', color: 'green' })
  assert.deepEqual(gatewayStatusInfo('AUTH_FAILED'), { label: '认证失败', color: 'red' })
  assert.deepEqual(gatewayStatusInfo('UNKNOWN'), { label: '状态未知', color: 'default' })
  assert.deepEqual(gatewayStatusInfo('unexpected'), { label: '状态未知', color: 'default' })
})

test('Gateway timestamps use the product timezone and handle missing values', () => {
  assert.equal(formatGatewayDate(null), '—')
  assert.match(formatGatewayDate('2026-09-24T00:00:00'), /2026/)
})
