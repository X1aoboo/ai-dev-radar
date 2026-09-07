# 01 项目骨架、数据模型与指标目录种子

Status: ready-for-human

单服务骨架 + 全部核心实体 + 指标目录初始数据 + 演示数据。这是 tracer-bullet 的第一段：后续所有页面开发都以本张票的数据为准，无需等真实联调环境。

## 范围

- 后端骨架：FastAPI + SQLAlchemy + SQLite（`ai-dev-radar.db`），预留 MySQL 迁移路径（连接串配置化即可，不做双实现）
- 前端骨架：React + ECharts + Vite，开发代理到后端
- 实体（spec §4）：`Team`（含数据源映射 JSON）、`MetricCatalog`（活动/指标条目/类型/采集方式标记 `仅补录`）、`ProductVersion` / `Iteration`、`FactRecord`、`User`
- 指标目录种子：spec §2.1 的 15 个活动及全部指标，全部标记 `仅补录`
- 演示数据种子脚本：4 个团队、2 个版本（SCC 27.1.RC1、SCC 27.2.RC1）、各版本 2 个迭代（如 SCC 27.2.RC1-迭代一）、按 spec 口径生成事实记录（含负值效率、实际=0 的样例），种子随机保证刷新稳定（参照原型 seed 20260908 做法）

## 验收

- `docker-less` 本地一条命令起服务（后端+前端 dev）
- 重跑种子脚本幂等（先清后插）
- 目录、团队、版本、迭代、事实记录各有只读 REST 端点可查
- 效率提升的边界样例（实际=0、负值）在演示数据中存在

## 依据

spec §2.1、§4、§8；`CONTEXT.md` 术语表。

## Comments

**2026-09-08 实现完成**（待人工验收）：

- 后端 `backend/`：FastAPI + SQLAlchemy + SQLite，`DATABASE_URL` 环境变量配置化（预留 MySQL）；首次启动空库自动播种，`npm run seed` 先清后插幂等（mulberry32 seed 20260908）
- 实体：Team（source_mapping JSON）、Activity + Metric（目录拆两表，collect_method 全部 `manual_only`）、ProductVersion / Iteration、FactRecord（numerator/denominator 原始数 + 时间字段 + 来源标记，率不落库 ADR-0001）、User
- 指标目录：spec §2.1 的 15 活动 29 指标逐条对齐，测试断言
- 演示数据：4 团队、2 版本（SCC 27.1.RC1 / 27.2.RC1）各 2 迭代、1892 条事实记录（全 manual）；边界样例：团队C 在 27.2.RC1-迭代一 效率类实际=0、团队D 在 27.1.RC1-迭代一 负值效率（实际=1.4×预估）
- 只读端点：/api/catalog、/api/teams、/api/versions、/api/iterations、/api/facts（team/metric/iteration/source 筛选）；/api/users 不暴露（认证未实现，spec §7）
- 补录粒度「团队 × 迭代 × 指标一条」用部分唯一索引落实（仅迭代非空；通用能力按周期多条，不约束）
- 一条命令：根目录 `npm run dev`（concurrently 起 uvicorn :8000 + vite :5173，/api 代理已验证）
- 测试：`npm run test` → 12 passed

**审查遗留（转入后续票）**：spec §5 采集器接口预留、§8 APScheduler 内嵌调度，票面未列，待专门票实现。

**code-review 记录**（2026-09-08）：Standards 轴无硬违规（异味均为 judgement call，已采纳共享 Enum 一项）；Spec 轴 4 项发现中 3 项已修复（唯一约束、users 端点、facts limit），采集器/APScheduler 转后续票。
