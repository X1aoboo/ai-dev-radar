# Data Management Module

## 职责与接口

`data_api.py` 负责组织层级、正式 IR、临时导入批次、审计查询和源数据指标的 HTTP 编排；`data_management.py` 提供规范化、CSV/XLSX 标准库解析、差异、空字段合并、有效记录筛选和计算。`schemas.py` 定义 DTO，`models.py` 定义存储；本模块复用 `auth.py` 与 `db.py`。

主要接口为 `/api/data/ir`、`/api/data/ir/imports/preview`、`/api/data/ir/imports/{batch_id}/confirm`、`/api/data/ir/{record_id}/audit-logs`、`/api/data-metrics` 及 `/api/data-metrics/compute`。方法和参数以路由、DTO 与运行时 OpenAPI 为准。

## 临时态与事务

ImportBatch 保存 domain、source_kind、created_by、pending/confirmed；ImportRow 保存规范化 payload、差异、错误、警告、目标及 valid/invalid/applied 状态。预览持久化临时数据，计算函数不读取它们。

确认先检查批次所有权、pending 状态和无效行，再逐行重新校验 DTO、层级引用和团队写权限。按 requirement_no 查询正式记录：不存在则新增，存在则调用 `merge_empty_fields`。更新正式记录、AI 字段元数据、AuditLog、行 applied 及批次 confirmed 在一次事务提交；异常 rollback。页面 PATCH 是显式覆盖，不能复用补空合并语义。

## 数据与计算边界

IR 保存需求标识、产品/版本/迭代、完成日期、责任工号、业务模块与场景、AI 属性和 SA/SE 工作量。全局需求编号唯一，人员匹配不决定归属。DataMetricDefinition 声明字段与筛选，查询有效正式 IR 后实时计算，不持久化指标结果。

SourceCollectorRegistry 预留标准化源数据接口，但没有生产采集器；默认定时任务仍使用 CollectorRegistry 的事实链路。ADR-0003 表达源数据优先方向，不意味着旧 `/api/compute` 已切换到 IR。后续适配应作为独立真实需求设计及验证。

## 失败和验证

引用不一致、无效文件/字段或批次错误返回验证失败；越权拒绝；重复资源和重复确认返回冲突。文件解析能力以现有标准库实现为限，不宣称支持任意 Excel 工作簿特性。

核对 `backend/tests/test_data_management.py` 的预览、确认、字段保留、权限、审计、指标及层级案例。业务语义见 [Data Management](../../business/data-management.md)；决策见 [ADR-0004](../../adr/0004-staged-import-and-field-merge.md)。
