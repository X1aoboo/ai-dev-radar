// 指标目录：活动 × 指标 × 类型（渗透率/效率提升/数量/布尔/比率），与 handoff 原始清单一致

export const TEAMS = [
  { id: 't1', name: '平台工程部' },
  { id: 't2', name: '终端应用部' },
  { id: 't3', name: '网络系统部' },
  { id: 't4', name: '智能运维部' },
]

const P = (id, name, numLabel, denLabel) => ({ id, name, type: 'penetration', numLabel, denLabel })
const E = (id, name) => ({ id, name, type: 'efficiency', numLabel: '预估人天', denLabel: '实际人天' })
const C = (id, name, numLabel) => ({ id, name, type: 'count', numLabel })
const R = (id, name, numLabel, denLabel) => ({ id, name, type: 'ratio', numLabel, denLabel })
const B = (id, name) => ({ id, name, type: 'bool' })

export const ACTIVITIES = [
  // ---- 关键研发活动（有版本/迭代维度）----
  {
    id: 'sa', name: 'SA设计', kind: 'key',
    metrics: [P('sa-ir', 'IR需求渗透率', 'AI设计需求数', 'IR需求总数'), E('sa-eff', 'SA设计效率')],
  },
  {
    id: 'se', name: 'SE设计', kind: 'key',
    metrics: [P('se-ir', 'IR需求渗透率', 'AI设计需求数', 'IR需求总数'), E('se-eff', 'SE设计效率')],
  },
  {
    id: 'dd', name: '开发设计', kind: 'key',
    metrics: [P('dd-ar', 'AR需求渗透率', 'AI设计需求数', 'AR需求总数'), E('dd-eff', '开发设计效率')],
  },
  {
    id: 'cd', name: '编码开发', kind: 'key',
    metrics: [P('cd-ar', 'AR需求渗透率', 'AI编码需求数', 'AR需求总数'), E('cd-eff', '编码效率')],
  },
  {
    id: 'tcg', name: '测试用例生成', kind: 'key',
    metrics: [P('tcg-sr', 'SR需求渗透率', 'AI生成用例的需求数', 'SR需求总数'), R('tcg-rate', '测试用例生成率', 'AI生成用例数', '用例总数')],
  },
  {
    id: 'tce', name: '测试用例执行', kind: 'key',
    metrics: [C('tce-n', '用例执行数', 'AI执行用例数'), R('tce-rate', '用例执行率', 'AI执行用例数', '执行用例总数')],
  },
  {
    id: 'dta', name: 'DTS缺陷分析', kind: 'key',
    metrics: [C('dta-n', 'DTS分析数', 'AI分析缺陷数'), P('dta-rate', 'DTS渗透率', 'AI分析缺陷数', '缺陷总数')],
  },
  {
    id: 'dtf', name: 'DTS缺陷修复', kind: 'key',
    metrics: [C('dtf-n', 'DTS修复数', 'AI修复缺陷数'), P('dtf-rate', 'DTS渗透率', 'AI修复缺陷数', '缺陷总数')],
  },
  // ---- 通用研发能力（只有时间维度）----
  {
    id: 'mrr', name: 'MR代码检视', kind: 'general',
    metrics: [C('mrr-n', 'AI检视意见数', 'AI检视意见数'), R('mrr-rate', 'AI检视率', 'AI检视MR数', 'MR总数')],
  },
  {
    id: 'e2e', name: 'MR-E2E能力', kind: 'general',
    metrics: [C('e2e-n', 'AI-MR数量', 'AI-MR数量'), R('e2e-rate', 'AI-MR构建率', 'AI-MR数量', 'MR总数')],
  },
  {
    id: 'cc', name: 'CodeCheck问题修复', kind: 'general',
    metrics: [C('cc-n', 'AI修复数量', 'AI修复问题数'), R('cc-rate', 'AI修复率', 'AI修复问题数', '问题总数')],
  },
  {
    id: 'third', name: '三方件治理', kind: 'general',
    metrics: [C('third-n', '治理数量', '治理三方件数'), R('third-rate', '治理率', '治理三方件数', '三方件总数')],
  },
  {
    id: 'vul', name: '漏洞修复', kind: 'general',
    metrics: [C('vul-n', 'AI修复数量', 'AI修复漏洞数'), R('vul-rate', 'AI修复率', 'AI修复漏洞数', '漏洞总数')],
  },
  {
    id: 'ad', name: '自动化构建部署', kind: 'general',
    metrics: [B('ad-bool', '能力是否具备')],
  },
  {
    id: 'wb', name: '白盒安全问题修复', kind: 'general',
    metrics: [C('wb-n', 'AI修复数量', 'AI修复问题数'), R('wb-rate', 'AI修复率', 'AI修复问题数', '问题总数')],
  },
]

export const ACT_BY_ID = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]))

// 指标查表 key：`${activityId}/${metricId}`
export const METRIC_BY_ID = {}
ACTIVITIES.forEach((a) => a.metrics.forEach((m) => { METRIC_BY_ID[`${a.id}/${m.id}`] = m }))
