import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADMIN_ROLES,
  ANALYTICS_ROLES,
  DATA_READ_ROLES,
  DEFAULT_REQUIREMENT_ACTIVITY,
  REQUIREMENT_ACTIVITIES,
  SETTINGS_READ_ROLES,
  canAccess,
  isPendingDomain,
  isRequirementActivity,
  legacyRequirementActivityTarget,
  normalizeRequirementActivity,
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

test('requirement activity routes validate activity names and redirect legacy types', () => {
  assert.deepEqual(REQUIREMENT_ACTIVITIES, ['design', 'development'])
  assert.equal(DEFAULT_REQUIREMENT_ACTIVITY, 'design')
  assert.equal(isRequirementActivity('design'), true)
  assert.equal(isRequirementActivity('Development'), true)
  assert.equal(isRequirementActivity('ir'), false)
  assert.equal(normalizeRequirementActivity('development'), 'development')
  assert.equal(normalizeRequirementActivity('ir'), 'design')
  assert.equal(normalizeRequirementActivity('ar'), 'development')
  assert.equal(normalizeRequirementActivity('sr'), 'design')
  assert.equal(normalizeRequirementActivity('custom'), 'design')
  assert.equal(legacyRequirementActivityTarget('ar'), 'development')
  assert.equal(legacyRequirementActivityTarget('custom'), null)
})
