# 07 总览页与全局筛选条

Status: ready-for-agent
Blocked by: 01, 03

spec §6.1、§6.2。布局与交互**以原型为准**，先看原型代码再动手。

## 范围

- 全局筛选条（单行、内容上方）：统计维度（按时间 | 按版本/迭代）→ 时间粒度（月|周）或版本选择 → 周期选择（含"全部周期"）→ 展示指标；切换维度/粒度/版本时周期自动重置为最新
- 趋势大图矩阵：每活动一张大图卡片（关键/通用两区各一网格）；N 条团队趋势线 + 全公司均值线（灰 de-emphasis）；十字线悬停读出全部团队；点击某条线下钻该团队
- 颜色跟随团队：固定槽位分配（dataviz categorical 槽位 1–4），筛选/增删团队不重排幸存系列颜色
- 卡片头部 pill 切换指标；布尔活动（自动化构建部署）不画图，列各团队具备/不具备
- 迭代维度下：关键研发活动区 X 轴为迭代；通用研发能力区固定近 6 个月月趋势 + badge"无迭代维度"
- 数据全部来自 03 计算层端点；用 01 的演示数据开发验收
- 图表规范按 dataviz（折线 2px、hairline 网格线、文本不穿系列色）

## 原型参照

- 分支 `prototype/ui-layout`：`prototype/src/overview/VariantTrend.jsx`（选定方案）、`components/FilterBar.jsx`、`data/compute.js`
- 被否方案不要复刻：热力图矩阵（`VariantAHeatmap.jsx`）、表格+sparkline（`VariantBTable.jsx`）
- 结论全文：`.scratch/ai-dev-radar/handoff-prototype-ui-conclusions.md`

## 验收

- 演示数据下两区全部活动卡可渲染，筛选条所有组合切换无死区（无数据时显式空态）
- 同一筛选切片下所有卡片数字一致（同源计算）

## 依据

spec §6.1、§6.2、§8。
