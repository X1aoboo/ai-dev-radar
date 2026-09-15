# Design Knowledge Inventory

盘点日期：2026-09-16。以下基线来自当前仓库文件的静态核对，不代表生产环境验收。

## Existing Documentation

- [README](../README.md)：安装、部署、认证、数据工作台和成熟度入口。
- [CONTEXT](../CONTEXT.md)：单上下文领域语言及统计口径，继续作为术语事实源。
- [设计维护协议](agents/design-maintenance.md)：当前唯一项目机制。
- 初始化时存在的旧 matt 协议 `docs/agents/domain.md`、`docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md` 已退役并删除；这里保留历史路径说明，不作为阅读入口。
- [ADR](adr/README.md)：现有 0001–0006；简版、英文和中文格式并存。
- `.scratch/` 下的需求、原型结论、ticket 仅保留为历史迭代证据，不再用于后续任务追踪，不能替代当前设计；新中大型变更使用 [Change Design](changes/README.md)。

## Business Domains

核心能力为团队级 AI 研发效能分析、月度成熟度评估、IR 源数据维护与导入、组织及权限配置。个人度量、AR/SR/DTS/MR 完整源数据管理和真实平台接入尚未实现。

## Architecture Modules

| 边界 | 实现入口 | 责任 |
|---|---|---|
| 页面与导航 | `frontend/src/App.jsx`、`routing/` | 登录、角色导航、总览、下钻、工作台、系统管理 |
| 事实 API | `backend/app/api.py` | 认证、目录、事实、成熟度及旧看板计算 |
| 源数据 API | `backend/app/data_api.py` | 组织层级、IR、导入批次、源数据指标 |
| 计算 | `compute.py`、`maturity.py`、`data_management.py` | 事实聚合、Decimal 评估、源数据校验与合并 |
| 存储与启动 | `models.py`、`db.py`、`migrations.py`、`main.py` | ORM、session、增量 schema、空目录播种、调度及 SPA 托管 |
| 采集 | `collectors.py`、`scheduler.py` | 预留两类接口；定时任务仍走事实采集注册表 |

## External Integrations

没有已注册的真实内部平台采集器。React/Ant Design/ECharts 为客户端依赖；FastAPI/SQLAlchemy/APScheduler 为服务端依赖。CSV/XLSX 导入使用 Python 标准库解析。MySQL 驱动和连接串路径存在，但本次未验证兼容性。

## Data Stores

SQLite 为默认数据库；容器通过 `/data` 卷持久化。主要实体包括团队、人员、产品、版本、迭代、活动、指标、事实记录、用户、IR、导入批次与行、源数据指标定义、审计日志和成熟度记录。成熟度独立存储；看板事实和 IR 指标尚未统一数据链路。

## Engineering Rules

当前明确规则：CONTEXT 术语、现有 ADR 决策与新的设计维护协议。初始化时的任务标签与本地 tracker 规则已退役。观察到的约定：Pydantic 边界校验、路由编排认证与事务、独立纯计算函数、共用 `fetchJson`、pytest 与 Node/Vitest 测试。未发现 CI、独立 lint、覆盖率阈值、通用分页/错误码或 API 版本规范。

## Existing Architecture Decisions

已有 ADR 记录原始数计算、预留采集、源数据优先、临时态字段合并、团队产品层级及月度成熟度。0002 已声明被 0003 替代。0001、0003–0005 未显式记录状态；不从使用情况推断接受日期或补写历史理由。

## Documentation Gaps

初始化前缺少统一入口、当前业务与架构基线、可复用规范、ADR/Change Design 生命周期及本地文档校验。运行环境、Docker 持久化、MySQL 和真实采集联调尚不能通过静态盘点确认。本次后续验证采用用户指定的侧边栏折叠导航，结果保存在 [独立 Change Design](changes/completed/collapsible-sidebar.md)，不把初始化当成业务 dogfooding。


