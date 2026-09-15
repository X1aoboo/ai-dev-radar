import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildIrQuery,
  irFormPayload,
  sectionFromPath,
} from './dataManagementLogic.js'

test('data-management paths resolve to their side navigation section', () => {
  assert.equal(sectionFromPath('/data-management'), 'ir')
  assert.equal(sectionFromPath('/data-management/products'), 'products')
  assert.equal(sectionFromPath('/data-management/metrics'), 'metrics')
})

test('IR query builder omits empty filters and serialises explicit false', () => {
  const query = buildIrQuery({
    team_id: 3,
    business_module: '',
    ai_assisted: false,
    page: 2,
  })
  assert.equal(query.get('team_id'), '3')
  assert.equal(query.get('ai_assisted'), 'false')
  assert.equal(query.get('page'), '2')
})

test('IR form payload turns editable strings into API values', () => {
  assert.deepEqual(irFormPayload({
    requirement_no: ' IR-1 ',
    product_id: '2',
    version_id: '3',
    iteration_id: '4',
    estimated_workload: '10.5',
    actual_workload: '',
    ai_assisted: 'false',
    requirement_name: '需求一',
  }), {
    requirement_no: 'IR-1',
    product_id: 2,
    version_id: 3,
    iteration_id: 4,
    estimated_workload: 10.5,
    actual_workload: null,
    ai_assisted: false,
    requirement_name: '需求一',
  })
})
