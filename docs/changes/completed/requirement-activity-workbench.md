# 需求活动工作台

## Status

Completed

## Validation

实现与验证结果（2026-10-27）：

- 后端：`npm test` → 164 passed，0 failed（2 个既有弃用告警）。
- 前端：`npm --prefix frontend run test:unit` → Node 88 passed、Vitest 127 passed；`npm --prefix frontend run build` 通过。
- Gateway Project E2E：3 passed。
- 文档：`npm run check:docs` 通过；`npm run test:docs` 1 passed。
- 真实浏览器（隔离临时 SQLite，端口 8123，admin/maintainer/viewer）：设计页 21 列 + 操作列、开发页 19 列 + 操作列；两个摘要、类型/高级筛选、抽屉字段、开发导入向导、只读角色无写入口、维护者归属组锁定；1920×1080 与 1280×800 无页面级水平溢出；修复了自定义 Tabs flex 导致非活动活动面板仍占布局的问题，非活动页签保持挂载但 `display:none`，切换草稿不丢失。
- 完整 `npm run gate`：后端、前端测试、构建、Gateway E2E、文档检查通过；Overview visual browser evidence 有 3 项失败（1920 空态 KPI 值 2.48px 几何差、月卡 value/arrow 间距 12.39px、Team Detail 版本选择/能力状态断言）。这些断言与本次数据页/seed 变更无关；在未修改的基线提交 `672d1fa` 上同样复现这 3 项失败，按项目既有记录方式记为既有 Overview 视觉边界。
- 未验证边界：真实 AI 研发数据网关 L4、Docker/MySQL、生产数据库迁移和真实内部平台联调不在本次验证范围；本次不改变 Gateway 协议。


## Background

需求数据管理当前按 IR/AR/SR 页签组织，只有 IR 具备完整字段、导入和统计。用户提供《需求设计度量模板》（SA/SE）和《需求开发度量模板》（实现设计/开发），要求需求统计不再按 IR/SR/AR 粒度，而按设计（SA设计、SE设计）和开发（实现设计、编码开发）两个活动维度维护与统计。

## Requirement

- 需求数据页改为「设计活动 / 开发活动」两个页签，IR/SR/AR 仅作为类型字段和筛选。
- 设计活动使用 21 列设计模板；开发活动使用 19 列开发模板；模板列顺序、标签、枚举与用户模板一致。
- 设计记录沿用现有 IR 数据；开发记录独立存储，同一需求编号可分别出现在两个活动。
- 必填：类型、需求编号、标题、进展、归属组、PI、迭代、责任人、活动时间；设计责任人为 SA+SE，开发责任人为实现设计责任人+开发责任人。
- 设计模板的所属功能可空；AI 质检等级增加「不合格」；AI 研发模式建议值按模板区分。
- 文件导入继续使用临时批次、upsert/fill_empty、整批确认、事务和审计；开发无采集链路。
- 本次只改需求数据管理页；研发总览/研发活动的临时 IR KPI 保持现状，只读取 IR 类型设计记录。

## Current Behavior

- 入口 `/data/requirements/{ir|ar|sr}`，IR 页签连接 `/api/data/ir`；AR/SR 为待定义页。
- `IRRequirement` 保存 SA/SE 设计字段；`ir_fields.py` 是 IR 字段注册表；`ir_imports.py` 负责 IR 导入；`ir_template.py` 生成 21 列 IR 模板。
- 页面组件位于 `frontend/src/dataManagement/ir/`，按需求信息/归属/责任人/工作量/AI 属性/时间/备注分组。
- 总览 `/api/data-metrics/overview` 读取 IR 记录生成临时 KPI。
- IR Gateway 采集只写设计记录。

## Target Behavior

### 页面

- `/data/requirements/design`（默认）与 `/data/requirements/development`；旧 IR/AR/SR 路径重定向。
- 设计页：页头“设计活动 · SA设计 / SE设计”，21 列表格、SA/SE 工作量摘要、设计模板导入、待确认采集批次条。
- 开发页：页头“开发活动 · 实现设计 / 编码开发”，19 列表格、实现设计/开发工作量摘要、开发模板导入，无采集批次条。
- 分组顺序：需求信息 / 归属 / 责任人 / AI属性 / 工作量 / 时间 / 备注。
- 只读角色无写入口；维护者团队锁定；切换页签保留各自草稿。

### 字段

设计模板：`需求类型, 需求编号, 需求标题, 所属功能, 进展, 归属组, PI, 迭代, SA, SE, AI质检等级, AI适用性, SA是否使用AI, SE是否使用AI, AI研发模式, 预估工作量(SA), 实际工作量(SA), 预估工作量(SE), 实际工作量(SE), 设计时间, 备注`。

开发模板：`类型, 需求编号, 标题, 进展, 归属组, PI, 迭代, 实现设计责任人, 开发责任人, AI适用性, 实现设计是否使用AI, 开发是否使用AI, AI研发模式, 预估工作量(实现设计), 实际工作量(实现设计), 预估工作量(开发), 实际工作量(开发), 开发时间, 备注`。

### 统计

- 设计摘要：需求总数、进行中、已完成、AI 使用率（SA 或 SE）、SA/SE 工作量（含角色分解）。
- 开发摘要：需求总数、进行中、已完成、AI 使用率（实现设计或开发）、实现设计/开发工作量（含角色分解）。
- 类型筛选保留，但不作为统计分组。
- 总览临时 IR KPI 只读取设计记录中的 IR 类型，SR/开发记录不进入。

### 数据与接口

- 设计：沿用 `ir_requirements` 与 `/api/data/ir`；类型扩展 IR/SR；文件导入严格模板必填，采集保留 legacy。
- 开发：新增 `development_requirements` 表与 `/api/data/development` 镜像接口；批次/审计 domain 为 `development`。
- 新接口：schema、模板、列表/摘要、创建、批量/单条更新、审计、导入预览/列表/详情/确认。
- 开发文件导入只允许 `source_kind=import`。

## Design

本变更按后端领域服务、HTTP API、前端活动工作台和数据契约四部分实现；设计与开发共用 profile 驱动的校验/模板/组件，但存储、导入批次和统计相互独立。

### 后端

- 新增 `requirement_fields.py`：通用字段 spec/profile，`DESIGN_PROFILE` 与 `DEVELOPMENT_PROFILE`；`ir_fields.py` 保持设计兼容导出。
- 新增 `requirement_template.py`：标准库生成两份 xlsx；`ir_template.py` 保留设计入口。
- 新增 `requirement_imports.py`：通用逐行校验、owner 解析、引用解析、批次创建；`ir_imports.py` 为设计兼容 wrapper。
- `data_management.py` 的规范化、差异、合并、有效性、AI/工作量派生接受 profile；保留设计 wrapper。
- `models.py` 新增 `DevelopmentRequirement`；`migrations.py` 新增 `ensure_development_schema()`。
- `schemas.py` 新增开发 DTO；设计 DTO 类型扩展 IR/SR、所属功能可空、创建时校验进展/SA/SE。
- `data_api.py` 新增开发镜像路由；设计列表增加 `requirement_type` 筛选；总览查询限定 IR。
- `seed.py` 增加开发演示记录；`main.py` 注册建表；`source_collection.py` 走设计 wrapper。

### 前端

- `frontend/src/dataManagement/requirements/`：`requirementProfiles.js` + 通用 Workbench/DataGrid/FilterBar/RecordDrawer/ImportWizard/SummaryStrip。
- `DataManagementPage.jsx` 组合活动页签；`App.jsx`/`routing` 更新 activity 路由、重定向、面包屑、常用入口。
- 保留现有 `ir-workbench.css` 与 `.ir-*` 视觉层，避免大范围 CSS 改名。

## Business Impact

- 需求数据维护从类型导航转为活动维度；IR/SR/AR 变为类型字段。
- 设计统计增加 SR；开发统计支持 AR/SR/IR 类型。
- 新建/导入必填更严格；历史记录不追溯判无效。
- 总览指标口径保持不变。

## Architecture Impact

- 新增独立开发记录数据域和 API 前缀；设计域保留现有表/API 作为兼容。
- 数据管理从 IR 专用字段注册表/导入服务演进为活动 profile 驱动的通用服务。
- 前端从 IR 专用组件演进为活动 profile 驱动的通用工作台。
- 无 Gateway 协议变化；开发记录不进入采集链路。

## API / Contract Changes

- 新增 `/api/data/development/*` 本地 API；请求/响应沿用现有 DTO/HTTP 约定。
- `/api/data/ir/*` 行为变化：类型允许 IR/SR；创建必填类型/进展/SA/SE；所属功能可空；模板列顺序变化。
- `GET /api/data/ir` 新增 `requirement_type` 筛选。
- `/api/data-metrics/overview` 响应不变，只读取 `requirement_type=IR` 的设计记录。
- Gateway 能力协议：NONE。

## Data Changes

- 新增表 `development_requirements` 及模型；无 `ir_requirements` 加列、无数据迁移。
- `ImportBatch.domain`、`AuditLog.domain` 增加 `development` 取值。
- 设计模板新增「不合格」枚举值；不新增设计表列。
- 旧设计记录不回填 SA/SE/进展/所属功能；不回填开发记录。

## Compatibility

- 设计现有数据、`/api/data/ir` 路径、IR Gateway 采集和总览保持可用。
- 旧 `/data/requirements/{ir|ar|sr}`、`/data/{ir|ar|sr}`、`/data-management/*` 路径重定向。
- 旧 pending 文件批次确认时按新模板重新校验；采集批次保留 legacy。
- 旧设计记录缺少新必填字段仍可展示和原样导入更新；新建/导入严格要求。

## Error & Boundary Handling

- 非法/缺失类型、缺失必填、非法日期/数值、重复编号、跨团队编号、引用缺失或层级不一致、非法枚举均产生行错误；任一行错误阻止整批确认。
- 未知工号只警告；owner 为空为错误。
- 权限、重复确认、资源冲突、未认证按 401/403/404/409/422 处理；写事务失败回滚。
- 统计和工作量缺失不补 0；0 是有效值；AI 未知不进入分母。

## Risks & Trade-offs

- 设计与开发公共字段重复存储，不自动同步。
- 设计 API 仍叫 `/api/data/ir`，调用者需理解兼容映射。
- 新必填可能阻断旧文件导入；已通过历史数据保留、采集例外和确认重校验缓解。
- 通用前端组件重构范围较大；保留 CSS 层并补渲染/浏览器验证。
- 总览暂不按活动改造，后续需独立变更。

## Test Strategy

- 后端：设计模板/必填/类型/所属功能可空/不合格/owner 更新；开发模板/创建/导入/摘要/筛选/权限/审计/原子性/迁移/seed；总览 SR 隔离；旧采集用例。
- 前端：活动页签/重定向、设计 21 列、开发 19 列、摘要/筛选/内联编辑/抽屉/导入/只读/维护者锁定、profile 单测。
- 文档：`npm run check:docs`、`npm run test:docs`。
- 浏览器：隔离数据库，验证两个活动页、模板下载、导入预览、内联保存、权限；1920×1080 与 1280×800。
- 完成门禁：`npm run gate`。

## Documentation Impact

- Business：`docs/business/data-management.md`、`docs/business/analytics.md`、`docs/business/index.md`。
- Architecture：`docs/architecture/modules/data-management.md`、`docs/architecture/overview.md`、`docs/design-knowledge-inventory.md`。
- Standards：`docs/standards/api.md`、`docs/standards/data.md`。
- ADR：`docs/adr/0016-requirement-design-and-development-activity-records.md`、ADR 索引。
- UX/术语：`UX-CONTRACT.md`、`DESIGN.md`、`CONTEXT.md`、`README.md`。
- Change Design：本记录，完成后移入 `docs/changes/completed/` 并更新索引。
