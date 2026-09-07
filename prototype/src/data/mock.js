// 一次性 mock 数据：种子随机（固定 seed，刷新不变）。
// 口径对齐 CONTEXT.md：事实记录 = 团队 × 指标 × 迭代（关键活动）/ 纯时间（通用能力），
// 只存分子/分母（或预估/实际人天）原始数 + 时间字段 + 来源标记，不存现成比率。
import { ACTIVITIES, TEAMS } from './catalog'

function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260908)
const rr = (lo, hi) => lo + rnd() * (hi - lo)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

// ---- 时间轴：2026 年 W1–W34（1–8 月）----
export const WEEKS = Array.from({ length: 34 }, (_, i) => ({
  n: i + 1, id: 'w' + (i + 1), label: 'W' + String(i + 1).padStart(2, '0'),
}))

const MONTH_BUCKETS = [5, 4, 4, 4, 5, 4, 4, 4] // 1–8 月各覆盖的周数，合计 34
export const MONTHS = []
{
  let w = 1
  MONTH_BUCKETS.forEach((cnt, i) => {
    const weeks = Array.from({ length: cnt }, () => w++)
    MONTHS.push({ id: 'm' + (i + 1), label: `2026-${String(i + 1).padStart(2, '0')}`, weeks })
  })
}

export const VERSIONS = [
  {
    id: 'v271', name: 'SCC 27.1.RC1',
    iterations: [
      { id: 'i1', name: 'SCC 27.1.RC1-迭代一', short: '27.1-迭代一', weeks: range(1, 9) },
      { id: 'i2', name: 'SCC 27.1.RC1-迭代二', short: '27.1-迭代二', weeks: range(10, 18) },
      { id: 'i3', name: 'SCC 27.1.RC1-迭代三', short: '27.1-迭代三', weeks: range(19, 26) },
    ],
  },
  {
    id: 'v272', name: 'SCC 27.2.RC1',
    iterations: [
      { id: 'i4', name: 'SCC 27.2.RC1-迭代一', short: '27.2-迭代一', weeks: range(27, 31) },
      { id: 'i5', name: 'SCC 27.2.RC1-迭代二（进行中）', short: '27.2-迭代二', weeks: range(32, 34) },
    ],
  },
]
export const ALL_ITERATIONS = VERSIONS.flatMap((v) => v.iterations)
export const ITER_BY_ID = Object.fromEntries(ALL_ITERATIONS.map((i) => [i.id, i]))

// ---- 团队画像（mock 假设）：m = AI 成熟度基线，size = 规模（分母量级）----
const TEAM_META = {
  t1: { m: 0.82, size: 1.0 },
  t2: { m: 0.63, size: 1.3 },
  t3: { m: 0.47, size: 0.85 },
  t4: { m: 0.27, size: 0.6 },
}

// 每个活动的采纳系数（编码/检视类高，白盒/三方件类低）
const ACT_FACTOR = {
  sa: 0.6, se: 0.7, dd: 0.8, cd: 1.0, tcg: 0.85, tce: 0.7, dta: 0.55, dtf: 0.75,
  mrr: 0.9, e2e: 0.5, cc: 0.8, third: 0.45, vul: 0.6, ad: 1, wb: 0.4,
}

export const KEY_FACTS = [] // 关键研发活动：团队 × 活动 × 指标 × 迭代
for (const t of TEAMS) {
  for (const a of ACTIVITIES.filter((x) => x.kind === 'key')) {
    for (const it of ALL_ITERATIONS) {
      const meta = TEAM_META[t.id]
      const grow = (it.weeks[0] - 1) / 34 * 0.12 // 随时间缓慢爬升
      const rate = clamp(meta.m * ACT_FACTOR[a.id] + grow + rr(-0.07, 0.07), 0.02, 0.98)
      const eff = clamp(meta.m * 0.7 - 0.15 + grow * 0.8 + rr(-0.16, 0.16), -0.35, 0.8)
      const week = it.weeks[Math.floor(rr(0, it.weeks.length))]
      const source = rnd() < 0.12 ? 'manual' : 'auto'
      for (const m of a.metrics) {
        const rec = { teamId: t.id, activityId: a.id, metricId: m.id, iterationId: it.id, week, source }
        if (m.type === 'penetration' || m.type === 'ratio') {
          rec.den = Math.round(rr(15, 70) * meta.size)
          rec.num = Math.round(rec.den * rate)
        } else if (m.type === 'count') {
          rec.num = Math.round(rr(30, 180) * meta.size * (0.3 + rate))
        } else if (m.type === 'efficiency') {
          const items = Math.round(rr(8, 26) * meta.size)
          rec.est = +(items * rr(2, 8)).toFixed(1)
          rec.act = +(rec.est * (1 - eff)).toFixed(1)
        }
        KEY_FACTS.push(rec)
      }
    }
  }
}

export const GEN_FACTS = [] // 通用研发能力：团队 × 活动 × 指标 × 周（只有时间维度）
for (const t of TEAMS) {
  for (const a of ACTIVITIES.filter((x) => x.kind === 'general')) {
    for (const w of WEEKS) {
      const meta = TEAM_META[t.id]
      const rate = clamp(meta.m * ACT_FACTOR[a.id] + (w.n / 34) * 0.12 + rr(-0.09, 0.09), 0.01, 0.98)
      for (const m of a.metrics) {
        if (m.type === 'bool') continue
        const rec = { teamId: t.id, activityId: a.id, metricId: m.id, week: w.n, source: rnd() < 0.1 ? 'manual' : 'auto' }
        if (m.type === 'penetration' || m.type === 'ratio') {
          rec.den = Math.round(rr(8, 45) * meta.size)
          rec.num = Math.round(rec.den * rate)
        } else {
          rec.num = Math.round(rr(4, 30) * meta.size * (0.3 + rate))
        }
        GEN_FACTS.push(rec)
      }
    }
  }
}

// 布尔型：一次性事实（自动化构建部署能力是否具备）——t4 不具备
export const BOOL_FACTS = TEAMS.map((t) => ({
  teamId: t.id, activityId: 'ad', metricId: 'ad-bool', value: t.id !== 't4', source: 'manual',
}))
