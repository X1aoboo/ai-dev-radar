# 04 采集器接口预留与每日任务骨架

Status: ready-for-human
Blocked by: 01

只定义接口和调度骨架，不实现任何真实采集器（ADR-0002）。

## 范围

- 采集器抽象接口：输入 = 团队的数据源映射 + 时间窗口，输出 = 事实记录列表；获取方式 CLI / MCP / API 由各实现自定，接口不感知
- 采集器注册机制（按指标或指标组注册）
- APScheduler 每日批量任务骨架：遍历已注册采集器 → 落事实记录（source=auto）；当前零实现，任务空跑留日志
- 指标目录的采集方式标记（`仅补录` / `自动`）驱动的执行过滤

## 验收

- 一个 fake 采集器（测试夹具）能通过注册机制被每日任务调用并产出 source=auto 的事实记录
- 全部指标为 `仅补录` 时任务空跑无错误

## 依据

spec §5；ADR-0002；`CONTEXT.md` 的采集器/事实记录词条。

## Comments

**2026-09-08 实现完成**（待人工验收）：

- 新增 `Collector` Protocol、`CollectionWindow`、`CollectedFact` 和进程内 `CollectorRegistry`，支持按指标或活动组注册。
- 新增 APScheduler 3.x 每日 02:00（Asia/Shanghai）任务骨架；只处理目录中 `collect_method=auto` 的指标，全部 `manual_only` 时安全空跑并记录日志。
- 采集结果由调度层补齐 `source=auto` 与录入元数据；重复自动记录更新，已有手动记录保留。
- FastAPI lifespan 负责 scheduler 启停；未实现任何真实平台采集器。
- 新增 fake collector、活动组注册、仅补录过滤、重复执行和 scheduler 配置测试。

验证：`.venv/bin/python -m pytest backend/tests -q` → 41 passed；`.venv/bin/python -m compileall -q backend/app backend/tests` 通过。
