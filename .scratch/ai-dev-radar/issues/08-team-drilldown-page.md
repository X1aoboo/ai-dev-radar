# 08 团队下钻页

Status: ready-for-agent
Blocked by: 07

spec §6.3。复用 07 的筛选条与趋势卡组件，原型选定 A+B 结合方案。

## 范围

- 顶部 KPI 行：平均渗透率（关键活动）、平均效率提升（关键活动）、AI检视率、自动化构建部署状态；每 tile = 值 + 环比 delta + 迷你趋势（delta 用红/绿表方向，注意负值提升是绿色还是红色——效率提升为负是红色）
- 左侧 sticky 活动目录（关键/通用两组，锚点平滑滚动）
- 单列活动趋势卡：本团队 accent 色 vs 全公司均值灰；卡头切指标
- 「详细数据」就地展开：迭代分片对比条形（本团队 vs 均值）+ 分子/分母事实记录表（tabular-nums，标来源 auto/manual）
- 布尔活动显示状态而非趋势

## 原型参照

- 分支 `prototype/ui-layout`：`prototype/src/drilldown/DrillAFlow.jsx`（选定）、`DrillBFocus.jsx`（复用其 `IterCompare`/`FactTable`）
- 结论全文：`.scratch/ai-dev-radar/handoff-prototype-ui-conclusions.md`

## 验收

- 15 个活动全量展示时页面可用（锚点可达、展开交互不丢筛选状态）
- KPI 数值与对应活动卡数值口径一致

## 依据

spec §6.3。
