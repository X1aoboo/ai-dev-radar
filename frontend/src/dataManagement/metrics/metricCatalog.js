export const METRIC_TYPE_META = {
  penetration: {
    label: '渗透率',
    tone: 'pen',
    formula: (metric) => `${metric.numerator_semantic} ÷ ${metric.denominator_semantic ?? '分母'}`,
    missing: '分母为 0 时显示缺失，不显示 0%。',
    steps: [
      '选取所选团队与时间范围内的有效记录。',
      '分子汇总“使用 AI”的数量。',
      '分母汇总同一范围内的有效记录总数。',
      '分子 ÷ 分母，得到渗透率。',
    ],
  },
  efficiency: {
    label: '效率提升',
    tone: 'eff',
    formula: (metric) => `(${metric.numerator_semantic} − ${metric.denominator_semantic ?? '实际'}) ÷ ${metric.denominator_semantic ?? '实际'}`,
    missing: '实际为 0 或缺失时不计入汇总。',
    steps: [
      '汇总所选范围内的预估工作量。',
      '汇总同一范围内的实际工作量。',
      '用（预估 − 实际）÷ 实际计算效率提升。',
      '实际为 0 或缺失的记录不参与计算。',
    ],
  },
  count: {
    label: '数量',
    tone: 'count',
    formula: (metric) => metric.numerator_semantic,
    missing: '无数据时显示缺失，不显示 0。',
    steps: [
      '选取所选团队与时间范围内的有效记录。',
      '对分子字段求和，得到数量。',
      '没有记录时显示缺失，不推断为 0。',
    ],
  },
  ratio: {
    label: '比率',
    tone: 'ratio',
    formula: (metric) => `${metric.numerator_semantic} ÷ ${metric.denominator_semantic ?? '分母'}`,
    missing: '分母为 0 时显示缺失。',
    steps: [
      '选取所选团队与时间范围内的有效记录。',
      '分子汇总满足条件的数量。',
      '分母汇总同一范围内的总量。',
      '分子 ÷ 分母，得到比率。',
    ],
  },
  boolean: {
    label: '布尔',
    tone: 'bool',
    formula: () => '最新周期状态（是 = 1，否 = 0）',
    missing: '无快照时显示未知，不推断为否。',
    steps: [
      '取最新可用周期的能力状态。',
      '是记为 1，否记为 0。',
      '没有快照时显示未知。',
    ],
  },
}

export function metricTypeMeta(metric) {
  return METRIC_TYPE_META[metric?.type] ?? {
    label: metric?.type ?? '未知',
    tone: 'count',
    formula: () => '—',
    missing: '暂无口径说明。',
    steps: [],
  }
}

export function metricFormula(metric) {
  return metricTypeMeta(metric).formula(metric)
}

export function metricUsage(activity, metric) {
  const kindPage = activity?.kind === 'general' ? '研发能力' : '研发活动'
  if (['dta', 'dtf'].includes(activity?.code)) return [kindPage, '团队详情', '指标详情']
  if (String(metric?.code ?? '').startsWith('mrr-effective-')) return ['总览', '研发能力', '团队详情', '指标详情']
  return ['总览', kindPage, '团队详情', '指标详情']
}

export function metricSource(metric) {
  return String(metric?.code ?? '').startsWith('mrr-effective-')
    ? 'AI 检视意见'
    : '研发事实'
}

export function metricMissingNote(metric) {
  return metricTypeMeta(metric).missing
}

export function metricTypeLabel(metric) {
  return metricTypeMeta(metric).label
}

export const METRIC_TYPE_FILTERS = Object.entries(METRIC_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))
