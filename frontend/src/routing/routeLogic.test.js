import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADMIN_ROLES,
  ANALYTICS_ROLES,
  DATA_READ_ROLES,
  SETTINGS_READ_ROLES,
  canAccess,
  isPendingDomain,
} from './routeLogic.js'

test('role access matches the application route contract', () => {
  assert.equal(canAccess(ANALYTICS_ROLES, 'viewer'), true)
  assert.equal(canAccess(DATA_READ_ROLES, 'maintainer'), true)
  assert.equal(canAccess(DATA_READ_ROLES, 'viewer'), true)
  assert.equal(canAccess(SETTINGS_READ_ROLES, 'maintainer'), true)
  assert.equal(canAccess(SETTINGS_READ_ROLES, 'viewer'), true)
  assert.equal(canAccess(ADMIN_ROLES, 'maintainer'), false)
})

test('only supported pending domains render a pending state', () => {
  assert.equal(isPendingDomain('issues'), true)
  assert.equal(isPendingDomain('MR'), true)
  assert.equal(isPendingDomain('custom'), false)
})
