import { DATAVIZ_COLORS } from './overviewLogic.js'
import { chartTheme } from '../charts/chartTheme.js'

export const MATURITY_LEVEL_COLORS = chartTheme.maturity

function scoreValue(summary) {
  return typeof summary?.score === 'number' && Number.isFinite(summary.score)
    ? summary.score
    : null
}

export function maturityLevelColor(grade) {
  return Number.isInteger(grade) && grade >= 0 && grade < MATURITY_LEVEL_COLORS.length
    ? MATURITY_LEVEL_COLORS[grade]
    : DATAVIZ_COLORS.companyAverage
}

export function sortMaturityActivities(activities = [], sort = 'order') {
  return [...activities].sort((left, right) => {
    if (sort !== 'score') return (left.order ?? 0) - (right.order ?? 0)
    const leftScore = scoreValue(left)
    const rightScore = scoreValue(right)
    if (leftScore === null && rightScore !== null) return 1
    if (leftScore !== null && rightScore === null) return -1
    if (leftScore !== null && rightScore !== null && rightScore !== leftScore) return rightScore - leftScore
    return (left.order ?? 0) - (right.order ?? 0)
  })
}

export function buildMaturityBarOption({ activities = [], sort = 'order' }) {
  const ordered = sortMaturityActivities(activities, sort)
  return {
    animationDuration: 180,
    grid: { left: 8, right: 76, top: 8, bottom: 12, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params
        const summary = item?.data?.summary
        if (!summary) return item?.name ?? ''
        const score = summary.score_display ?? '—'
        const level = summary.level ?? '未评估'
        return `${summary.activity_name}<br/>领域平均：${score} · ${level}<br/>已评估团队：${summary.assessed_team_count}`
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 5,
      interval: 1,
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: ordered.map((activity) => activity.activity_name),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.inkSecondary, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 20,
      data: ordered.map((summary) => ({
        value: scoreValue(summary),
        summary,
        itemStyle: {
          color: maturityLevelColor(summary.grade),
          borderRadius: [0, 4, 4, 0],
          opacity: scoreValue(summary) === null ? 0.18 : 1,
        },
        label: {
          show: true,
          position: 'right',
          color: DATAVIZ_COLORS.inkSecondary,
          formatter: summary.score_display ? `${summary.score_display} · ${summary.level}` : '— 未评估',
        },
      })),
    }],
  }
}
