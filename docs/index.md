# Project Design Knowledge

## System Overview

ai-dev-radar 管理和展示团队级 AI 研发效能。React 客户端调用单个 FastAPI 服务；SQLite 保存组织、事实、源数据及独立的月度成熟度。当前无真实平台采集接入，IR 源数据工作台与事实看板并行运行。

代码提供当前实现事实，设计文档提供设计意图与结构；冲突需要依据需求和实现证据判断。初始化依据见 [Design Knowledge Inventory](design-knowledge-inventory.md)。

视觉系统与跨页面交互契约见 [Design System](../DESIGN.md) 和 [UX Contract](../UX-CONTRACT.md)；运行时 token、Ant Design 适配和共享视觉模式位于 `frontend/src/design/`。
UX 重构目标与已评审的参考效果图见 [UX Redesign Specification](ux/UX-REDESIGN-SPEC.md)。

## Business Design

| Domain | Document | Description |
|---|---|---|
| 核心能力导航 | [Business](business/index.md) | 业务边界与阅读路径 |
| 团队效能与成熟度 | [Analytics](business/analytics.md) | 口径、评估及缺失值 |
| 源数据与组织配置 | [Data Management](business/data-management.md) | IR、导入、权限和层级 |
| 领域语言 | [Glossary](glossary.md) | 导航至根 CONTEXT，避免术语双写 |

## Architecture

| Area | Document | Description |
|---|---|---|
| 系统 | [Overview](architecture/overview.md) | 边界、依赖、运行和部署 |
| 源数据模块 | [Data Management](architecture/modules/data-management.md) | 校验、批次、事务及计算链路 |

## Engineering Standards

| Area | Document |
|---|---|
| 工程 | [Engineering](standards/engineering.md) |
| API | [API](standards/api.md) |
| 数据 | [Data](standards/data.md) |
| 测试 | [Testing](standards/testing.md) |
| 设计维护流程 | [Design Maintenance](agents/design-maintenance.md) |

## Integration Contracts

| Contract | Document | Description |
|---|---|---|
| AI 研发数据网关 | [Capability Protocol](contracts/ai-dev-data-gateway/README.md) | 最新全量基线、OpenAPI 与逐版本变更 |

## Architecture Decisions

See [ADR Index and Protocol](adr/README.md)。

## Active Changes

See [Change Design Protocol](changes/README.md) 和 [Active Changes](changes/active/README.md)；归档见 [Completed Changes](changes/completed/README.md)。

## Validation

运行 `npm run check:docs` 和 `npm run test:docs`。它们校验结构、文件链接、ADR 基本格式与变更状态；语义一致性通过代码核对及相关测试确认，不由静态检查保证。
