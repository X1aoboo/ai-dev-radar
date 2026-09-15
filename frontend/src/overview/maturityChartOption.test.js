import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMaturityBarOption, maturityLevelColor, sortMaturityActivities } from './maturityChartOption.js'

const activities = [
  { activity_id: 1, activity_name: '活动一', order: 0, score: null, score_display: null, level: null, grade: null, assessed_team_count: 0 },
  { activity_id: 2, activity_name: '活动二', order: 1, score: 4.1, score_display: '4.10', level: 'L4 规模使用', grade: 4, assessed_team_count: 2 },
  { activity_id: 3, activity_name: '活动三', order: 2, score: 2.9, score_display: '2.90', level: 'L2 试点中', grade: 2, assessed_team_count: 1 },
]

test('maturity bars preserve catalog order by default and place missing values last when sorted', () => {
  assert.deepEqual(sortMaturityActivities(activities).map((item) => item.activity_id), [1, 2, 3])
  assert.deepEqual(sortMaturityActivities(activities, 'score').map((item) => item.activity_id), [2, 3, 1])
  const option = buildMaturityBarOption({ activities, sort: 'score' })
  assert.deepEqual(option.yAxis.data, ['活动二', '活动三', '活动一'])
  assert.equal(option.series[0].data[2].value, null)
  assert.equal(option.series[0].data[2].label.formatter, '— 未评估')
})

test('maturity level colors are shared by the level index', () => {
  assert.notEqual(maturityLevelColor(0), maturityLevelColor(4))
  assert.equal(maturityLevelColor(9), '#98a2b3')
})
