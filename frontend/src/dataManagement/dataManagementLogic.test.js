import test from 'node:test'
import assert from 'node:assert/strict'

import {
  metricValueLabel,
  sectionFromPath,
} from './dataManagementLogic.js'

test('data-management paths resolve to their side navigation section', () => {
  assert.equal(sectionFromPath('/data-management'), 'requirements')
  assert.equal(sectionFromPath('/data-management/products'), 'products')
  assert.equal(sectionFromPath('/data-management/metrics'), 'metrics')
  assert.equal(sectionFromPath('/data/requirements'), 'requirements')
  assert.equal(sectionFromPath('/data/requirements/design'), 'requirements')
  assert.equal(sectionFromPath('/data/requirements/development'), 'requirements')
  assert.equal(sectionFromPath('/data/requirements/ar'), 'requirements')
  assert.equal(sectionFromPath('/settings/teams'), 'teams')
})

test('metric labels keep the business wording used by the dictionary', () => {
  assert.equal(metricValueLabel('penetration'), '渗透率')
  assert.equal(metricValueLabel('manual_only'), '仅补录')
  assert.equal(metricValueLabel('custom'), 'custom')
})
