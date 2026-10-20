# IR 数据工作台与 Excel 导入重构

## Status
Completed

## Background

当前 IR 源数据由旧字段模型、旧表头导入和只读表格组成：导入只认字段 ID 或旧中文表头，命中已有需求编号时只补空字段；页面只有只读 Ant Table 和编辑抽屉，无法承载用户提供的 21 列 IR 模板。用户需要按模板直接导入 Excel，并在数据管理页以更接近 Excel、但具备筛选、校验、列分组和批量编辑能力的方式维护同一批字段。

本次变化覆盖 IR 源数据的字段模型、导入链路、数据管理页交互和后端校验，属于 medium/large 变更。自动采集链路保留，只做字段兼容，不改变 Gateway 协议。

## Requirement

- 以用户提供的 IR 模板为准：第一行是列名，下面每行一条 IR 需求。
- 模板列：需求类型、需求编号、需求标题、所属功能、进展、归属组、PI、迭代、SA、SE、预估工作量(SA)、实际工作量(SA)、预估工作量(SE)、实际工作量(SE)、AI质检等级、AI适用性、SA是否使用AI、SE是否使用AI、AI研发模式、设计时间、备注。
- 不再保留“开始时间/结束时间”两列；只保留一个“设计时间”列。
- Excel 导入支持预览、逐行校验、整批确认；文件内任意错误行阻止整批写入。
- 重复导入提供两种显式模式：“更新（覆盖非空）”与“仅补充空值”；Excel 导入默认前者，自动采集固定后者。
- 归属组、PI、迭代必须匹配现有主数据；缺失时严格报错并给出可操作提示，不自动创建。
- 数据管理页按同一套列展示，支持常用/高级筛选、排序、列显隐、密度、列分组、内联编辑和批量保存。
- 保留现有 AI 指标口径；新模板字段通过兼容规则进入现有指标。
- 保留 admin/maintainer/viewer 权限边界和 maintainer 团队锁定。

## Current Behavior

- 存储与字段见 [models.py](../../../backend/app/models.py) 的 `IRRequirement`。
- 规范化、表头别名和文件解析见 [data_management.py](../../../backend/app/data_management.py)。
- 导入批次校验、差异和确认见 [ir_imports.py](../../../backend/app/ir_imports.py) 与 [data_api.py](../../../backend/app/data_api.py)。
- 当前页面见 [DataManagementPage.jsx](../../../frontend/src/dataManagement/DataManagementPage.jsx)。
- 当前导入与字段合并决策见 [ADR-0004](../../adr/0004-staged-import-and-field-merge.md)；当前业务语义见 [Data Management](../../business/data-management.md)。

当前模型只有需求编号、需求名称、责任人、父需求、产品/版本/迭代、完成时间、业务模块、需求场景、总/SA/SE 工作量、`ai_assisted`。导入只补空字段，不支持模板表头、名称解析、Excel 日期序列号、文件内查重和覆盖更新。页面只读表格承载 8 列，新增/编辑在抽屉中完成。

## Target Behavior

### 字段模型

模板列与系统字段的映射：

| 模板列 | 系统字段 | 说明 |
|---|---|---|
| 需求类型 | `requirement_type` | 新字段，默认 `IR`；本期只接受 IR |
| 需求编号 | `requirement_no` | 唯一键；编辑时不可改 |
| 需求标题 | `requirement_name` | 复用旧字段，显示名改为“需求标题” |
| 所属功能 | `business_module` | 复用旧字段，显示名改为“所属功能” |
| 进展 | `progress` | 新字段；未开始/进行中/完成/已关闭 |
| 归属组 | 团队（经产品关联） | 按名称精确匹配团队；不新增 IR.team_id |
| PI | `version_id` | 按名称精确匹配产品版本，并校验属于该团队 |
| 迭代 | `iteration_id` | 按名称精确匹配，并校验属于该 PI |
| SA | `sa_owner_name` + `sa_employee_id` | 新字段；解析“姓名 工号”；可选 |
| SE | `se_owner_name` + `se_employee_id` | 新字段；解析“姓名 工号”；必填 |
| 预估/实际工作量(SA/SE) | 现有四个工作量字段 | 直接复用 |
| AI质检等级 | `ai_quality_level` | 新字段；优秀/良好/合格/空 |
| AI适用性 | `ai_applicability` | 新字段；是/否/空 |
| SA是否使用AI | `sa_ai_assisted` | 新字段；是/否/空 |
| SE是否使用AI | `se_ai_assisted` | 新字段；是/否/空 |
| AI研发模式 | `ai_dev_mode` | 新字段；自由文本，前端给常用选项 |
| 设计时间 | `completed_at` | 复用现有时间锚点，显示名改为“设计时间”；不新增开始/结束字段 |
| 备注 | `remark` | 新字段 |

保留但不在模板/页面展示的旧字段：`responsible_employee_id`、`parent_requirement_no`、`requirement_scenario`。它们继续供历史数据和采集链路使用。

### 必填与校验

- 导入必填：需求编号、需求标题、所属功能、进展、归属组、PI、迭代、SE、设计时间；SA 可选。
- 工作量、AI质检等级、AI适用性、SA/SE 是否使用AI、AI研发模式、备注允许空；空值在页面显示“待维护”。
- 需求类型为空时默认 IR；非 IR 报错。
- SE 必须能解析出非空人员文本；SA 为空允许；工号匹配团队成员失败只警告，不阻断整批。
- 设计时间必须是有效日期；接受 `YYYY/M/D`、`YYYY-MM-DD` 和 Excel 日期序列号。
- 文件内需求编号重复、需求编号已属于其他团队、归属组/PI/迭代不匹配、SE 缺失、进展非法：该行错误。
- 记录级有效性（用于指标）只要求需求编号、需求标题、产品/版本/迭代、设计时间；历史记录不会因为缺少新字段被排除。

### 兼容推导

- `ai_assisted`：`sa_ai_assisted` 或 `se_ai_assisted` 任一为真是；两者都为否是否；两者都空或只有一个否时为空。旧记录没有新字段时保留原 `ai_assisted`。
- 总预估/总实际工作量：读取时优先使用旧的总量字段；没有则用 SA 与 SE 对应工作量求和。现有总览指标改用有效总量，新记录不必重复存总工作量。
- AI 字段来源：`ai_attribute_metadata` 按字段记录 `source`、`updated_by`、`updated_at`；导入、页面编辑、批量编辑分别留痕。
- `completed_at` 继续作为时间锚点和月度统计依据，页面和模板统一显示“设计时间”。

### 导入

- 页头提供“下载模板”和“导入 Excel”。
- 模板为 `.xlsx`：第一个工作表是 21 列表头，第二个工作表是填写说明与示例；示例不放在主表，避免误导入。
- 向导：上传 → 预览与校验 → 确认写入。
- 预览显示总行数、新增、更新、无变化、错误、警告；逐行显示动作、变更字段、错误/警告；支持按状态筛选和按编号/标题搜索。
- 更新模式：
  - `upsert`（文件导入默认）：命中需求编号时，非空 Excel 值覆盖正式值，空值保留正式值。
  - `fill_empty`：沿用 ADR-0004 的只补空语义。
  - 自动采集批次固定 `fill_empty`。
- 预览时把模式保存在批次上，确认时按同一模式执行；确认是整批事务，任何错误行阻止确认。
- 引用缺失时列出缺失的归属组/PI/迭代，并给出团队/产品维护入口提示；不自动创建。
- 支持旧 CSV/XLSX 表头和字段 ID，保证已有调用方和测试兼容。
- 解析增强：UTF-8 BOM、GB18030 CSV、Excel 日期序列号、空行跳过、重复表头检测、首个工作表识别。

### 数据管理页

#### 布局：从居中容器改为全宽工作台

- 当前 `/data/*` 沿用 `.app-shell__content--operational` 的 1600px 居中上限；在 2560×1440 下两侧留白约 370px，页面没有撑开。
- 新增 `workbench` 内容模式用于 `/data/*`：`max-width: none`，左右留白使用 `clamp(20px, .75vw + 8px, 28px)`，与 Analytics 的全宽画布一致；`/settings/*` 继续使用现有 1600px/1120px 容器。
- 页头、概览条、筛选区、工作区、分页都占满工作台宽度；只有表格内部允许横向滚动，页面本身不产生横向溢出。
- 表格使用 `scroll={{ x: 'max-content' }}` 或按列宽计算的 min-width；标题、所属功能、备注使用弹性列吸收剩余宽度，避免右侧大片空白。
- 1920×1080 与 2560×1440 都按全宽验收；在 2560 下不出现居中大留白。

#### 视觉：数据工作台层级

- 视觉方向命名为 Engineering Ledger：浅色、精确、台账式，强调信息密度、数字可读性和编辑反馈，不做深色/霓虹/玻璃拟态。
- 页面背景使用 `--color-bg-page`，主工作区使用 `--color-bg-surface` + 1px 边框 + `--radius-lg`，形成“整页工作台”而非多个嵌套卡片。
- 页头：左侧标题/状态，右侧主次操作；标题下用一条细的元信息行显示数据范围与更新时间（有数据时）。
- 概览条：一条横向 summary rail，5 个紧凑指标（需求总数、进行中、完成、AI 使用率、SA/SE 工作量合计），用分隔线而不是 5 张卡片；进展分布用一条 segmented bar。
- 筛选区：搜索框占左侧更宽位置，常用筛选为紧凑下拉，高级筛选展开为浅色区域；已选条件用可换行 chips；右侧放“列设置/密度/重置”。
- 表格：两层列分组表头，组头使用浅色底；行高 44px（紧凑）/52px（标准）；hover 行有轻微底色；需求编号使用等宽字体；进展/AI质检/AI适用性使用语义标签；工作量右对齐等宽数字。
- 内联编辑：可编辑单元格 hover 显示淡色编辑提示；编辑态使用品牌色 focus ring；已修改单元格使用浅蓝底 + 左侧标记；底部保存条为浮动白色条，显示“已修改 N 项”与保存/放弃。
- 动效：160ms hover/focus，保存条 200ms 进入；`prefers-reduced-motion` 下关闭位移动效。
- 不引入深色/霓虹主题；本次“风格重构”是在现有浅色企业设计语言内建立更明确的数据工作台层级。

#### 高度与分页

- 工作台占满视口剩余高度：页头、概览、筛选、chips 固定，表格区域 `flex: 1`，表头吸顶，表体内部滚动，分页 footer 贴底。
- 每页条数提供 10 / 20 / 50 / 100，默认 20；切换页大小时回到第 1 页并重新请求。
- 当前页不足一页时，剩余区域显示台账网格与“本页 N 条 / 共 M 条 / 已到最后一页”，不伪造数据行；分页仍贴底，避免短表格悬空。
- 保存条作为表格与分页之间的一行出现，不覆盖数据；无修改时隐藏。
- 短视口（高度 < 760px）回退为页面整体滚动，避免表格区域被压缩到不可用。

#### 交互

- 页头下增加紧凑概览条：需求总数、进行中、已完成、AI 使用率、SA/SE 工作量合计。
- 筛选：搜索编号/标题、归属组、PI、迭代、进展；高级筛选包含 AI质检等级、AI适用性、SA/SE 是否使用AI、AI研发模式、所属功能、设计时间范围、SA/SE 工号。
- 已启用筛选以可换行 chips 展示，可单个移除；重置不改变路由；筛选变化自动查询。
- 表格使用列分组表头：需求信息、归属、责任人、工作量、AI 属性、时间、备注。
- 冻结需求编号、需求标题和操作列；表头吸顶；横向滚动只发生在表格内。
- 列显示预设：全部模板字段（默认）、标准、工作量、AI 属性；密度支持紧凑/标准。
- 内联编辑：点击单元格进入编辑，Enter/Tab 提交并移动，Esc 取消；修改过的单元格高亮，底部保存条显示修改数量并统一保存。
- 批量保存走整批事务；失败时定位到行/字段，不丢失未保存修改。
- 需求编号、需求类型、总工作量、AI 使用汇总只读。
- 复杂操作仍可打开详情抽屉：完整字段、来源、AI 字段来源、变更记录；批量操作支持设置进展、AI质检等级、AI适用性、SA/SE 是否使用AI。
- 空数据提供“导入 Excel / 新增 IR”；无结果提供“清除筛选”；加载保留页头与筛选结构；错误留在数据域内并提供重试。

## Design

后端以字段注册表统一字段元数据、校验、模板和 API schema；前端以字段注册表驱动列分组、筛选、表单与内联编辑。导入批次保存更新模式，确认时按模式执行整批事务。

### 后端

- 新增 `backend/app/ir_fields.py`：字段注册表，包含 key、中文标签、分组、类型、必填、表头别名、枚举、模板顺序和可编辑性。
- `IR_FIELDS`、`IR_FIELD_LABELS`、表头别名、数字/日期/布尔解析、模板表头均从注册表派生。
- 新增 `GET /api/data/ir/schema` 返回字段元数据；前端用它渲染筛选、表单、列分组和模板说明。
- 新增 `GET /api/data/ir/import-template` 生成 `.xlsx` 模板，不引入第三方 Excel 库。
- `GET /api/data/ir` 增加进展、AI 属性、设计时间范围、人员等筛选和排序，并在响应中返回筛选范围汇总。
- 新增 `PATCH /api/data/ir/bulk` 批量保存内联编辑，整批事务、逐行权限校验和审计。
- `POST /api/data/ir/imports/preview` 增加更新模式，批次保存模式；`confirm` 按批次模式执行。
- 拆分 `data_management.py` 的字段/解析职责与 `ir_imports.py` 的校验/批次职责；保持现有 HTTP 路由分层。

### 前端

- 将 957 行的 `DataManagementPage.jsx` 中 IR 部分拆为 `frontend/src/dataManagement/ir/`：
  - `IRManagementPage.jsx`：页面布局、请求、状态。
  - `IRSummaryStrip.jsx`：概览条。
  - `IRFilterBar.jsx`：常用/高级筛选与 chips。
  - `IRDataGrid.jsx`：列分组、列显隐、密度、内联编辑。
  - `IRCellEditor.jsx`：文本/数字/日期/下拉/人员编辑器。
  - `IRRecordDrawer.jsx`：完整字段、审计、AI 来源。
  - `IRImportWizard.jsx`：上传、预览、确认。
  - `irFields.js`、`irLogic.js`：字段回退元数据、查询/载荷/差异逻辑。
- 保留现有 `PageHeader`、`FilterToolbar`、`FocusRestoringDrawer`、`StatusPage`、`.operational-table` 和设计 token；不引入深色/霓虹主题。
- 在 `frontend/src/app.css` 增加 `workbench` 内容模式（`/data/*` 全宽、流体 gutter），`/settings/*` 保持现有 operational/readable 宽度。
- 在 `frontend/src/dataManagement/ir/ir-workbench.css` 建立数据工作台页面级样式：summary rail、列分组表头、行 hover、内联编辑高亮、浮动保存条、筛选 chips；只消费语义 token，不新增硬编码颜色。
- 全宽不等于所有列无限拉伸：需求编号/日期/工作量/状态列固定宽度，标题/所属功能/备注弹性；表格内部横向滚动承接 21 列，页面不横向溢出。

## Business Impact

IR 成为可批量导入、可内联维护的正式源数据。新字段补齐人员、进展和 AI 研发属性；导入从“只补空”扩展为可显式覆盖；指标继续使用现有口径。AR/SR、问题单、MR、代码检视不在本期范围。

## Architecture Impact

新增字段注册表和批量更新接口；IR 规范化从“字段散落”改为“注册表驱动”。导入批次保存更新模式，确认路径按模式执行。自动采集协议不变，采集写入仍走同一批次/校验/确认链路。前端 IR 工作台从单文件拆分为按职责组织的组件。

## API / Contract Changes

- 新增 `GET /api/data/ir/schema`。
- 新增 `GET /api/data/ir/import-template`。
- 新增 `PATCH /api/data/ir/bulk`。
- `GET /api/data/ir` 增加筛选、排序和汇总字段。
- `POST /api/data/ir/imports/preview` 增加更新模式参数；`ImportBatchOut` 增加 `update_mode`。
- `POST /api/data/ir/imports/{id}/confirm` 按批次模式执行。
- 现有单条 CRUD、审计、采集和指标接口保持兼容。

## Data Changes

`ir_requirements` 新增可空列：

- `requirement_type`
- `progress`
- `sa_owner_name`、`sa_employee_id`
- `se_owner_name`、`se_employee_id`
- `ai_quality_level`、`ai_applicability`
- `sa_ai_assisted`、`se_ai_assisted`
- `ai_dev_mode`
- `remark`

`import_batches` 新增 `update_mode`。不新增 `start_date` 或 `end_date`；设计时间复用 `completed_at`。旧数据保留，`requirement_type` 回填 `IR`，其他新字段留空。使用 `ensure_ir_schema()` 做 SQLite/MySQL 兼容的增量迁移，不重建表。

## Compatibility

- 旧 CSV/XLSX 表头、字段 ID、`fill_empty` 语义继续可用。
- 自动采集的 `CollectorIRRecord` 和线协议不变；采集批次固定 `fill_empty`。
- 旧记录 `ai_assisted`、总量工作量继续参与指标；新记录通过推导进入同一口径。
- API 输出保留旧字段，新增字段可选；前端逐步迁移到新字段。
- 现有导入批次历史保留，`update_mode` 为空时按 `fill_empty` 处理。

## Error & Boundary Handling

- 文件内重复编号、引用不匹配、必填缺失、日期非法、枚举非法、SE 缺失：行错误，整批禁止确认。
- 工号未匹配、SA/SE 无法解析工号：警告，不阻断。
- 归属组/PI/迭代缺失：预览列出缺失项并提示维护入口。
- 批量保存任一行动失败：整批回滚，返回行/字段错误，前端保留修改。
- 权限：admin 全量；maintainer 仅绑定团队；viewer 只读；越权返回 403。
- 并发：本期采用最后写入胜出，保留审计；不引入乐观锁。
- 大文件：沿用单批最多 10000 行限制；预览按页展示，不一次渲染全部行。

## Risks & Trade-offs

- 覆盖非空会改变已有值；通过显式模式、预览差异、整批确认和审计降低风险。
- 严格引用校验会增加首次导入前置工作；本期以明确错误和缺失项提示换取数据一致性，不自动创建主数据。
- 复用 `completed_at` 表示设计时间，内部命名与页面语义不完全一致；通过字段注册表、文档和模型注释统一，避免同一时间存两份。
- 内联批量保存引入并发和事务复杂度；通过整批事务、行级权限、错误定位和测试控制。
- 无第三方 Excel 库，模板生成和日期解析需自行实现；通过解析/模板契约测试覆盖。
- 全宽工作台在 2560 下可能使 21 列过度拉伸或仍显空；通过固定/弹性列、列显隐和 `max-content` 控制，验收表格填充率与可读性。
- `/data/*` 从 1600px 上限改为全宽会影响其他数据管理页面；通过新增 `workbench` 内容模式、`/settings/*` 保持原宽度来限制影响。
- 表格内部滚动与项目现有“文档拥有纵向滚动”的约定不同；仅在 IR 工作台使用，短视口回退为页面滚动，并在 DESIGN/UX 中记录例外。
- 最后一页不足一页时仍有留白；用台账网格和“已到最后一页”提示表达边界，不伪造空白数据行，避免被误解为可编辑记录。

## Test Strategy

- 后端：字段注册表/模板表头一致性、旧/新表头解析、名称引用、日期序列号、SA/SE 解析、重复编号、两种更新模式、批量保存权限/事务/审计、迁移、指标兼容。
- 前端：`irLogic` 查询/载荷/差异、列分组/列显隐/内联编辑/保存条、导入向导步骤与错误态、只读角色。
- 回归：现有 `test_data_management.py`、`test_collection_api.py`、`test_source_collection.py`、前端渲染测试。
- 浏览器：1920×1080 与 2560×1440 检查列分组、横向滚动、内联编辑、保存条、筛选 chips、导入向导；断言工作台左右留白不超过 28px、`document.scrollWidth === viewport`、表格宽度等于工作区宽度；检查每页 10/20/50/100、表体内部滚动、分页贴底、最后一页台账提示。
- 质量门禁：`npm test`、`npm run test:unit`、`npm --prefix frontend run build`、`npm run gate`、`npm run check:docs`、`npm run test:docs`。

## Documentation Impact

- Business Design: UPDATE `docs/business/data-management.md`，同步字段、必填、导入模式、AI 属性和导入向导。
- Architecture: UPDATE `docs/architecture/modules/data-management.md`，同步字段注册表、接口、迁移、解析边界和批量更新。
- Standards: UPDATE `docs/standards/api.md`、`docs/standards/data.md`，补充批量更新、模板下载和导入模式约定（如现有规范未覆盖）。
- ADR: CREATE `docs/adr/0012-ir-excel-import-upsert-and-field-registry.md`，记录覆盖模式和字段注册表决策；明确对 ADR-0004 文件导入部分的 supersede 范围。
- Change Design: CREATE 本记录；完成实现与验证后移入 completed，并更新两个目录索引。
- CONTEXT: UPDATE `CONTEXT.md`，补充 PI、归属组、进展、AI质检等级、AI适用性、AI研发模式、SA/SE 是否使用AI、设计时间。
- DESIGN/UX: UPDATE `DESIGN.md`、`UX-CONTRACT.md`，把 `/data/*` 全宽工作台、视口高度填充、表体内部滚动、分页贴底、summary rail、列分组、内联编辑、保存条和导入向导纳入 Operational Console 模式；`/settings/*` 保持现有 1600px/1120px 宽度。

## Validation

### Automated

- `npm test`（backend）：156 passed。
- `npm run test:unit`（frontend）：103 passed；覆盖字段注册表、模板解析、两种更新模式、SE 必填/SA 可选、查重、批量保存、筛选、内联编辑、导入向导、采集批次、只读与 maintainer 团队锁定。
- `npm --prefix frontend run build`：passed（保留既有大 chunk 警告）。
- Gateway Project E2E：3 passed。
- `npm run check:docs`、`npm run test:docs`：passed。
- `npm run gate`：后端、前端、构建、Gateway E2E 通过；在 Overview visual E2E 阶段停止，失败项为既有 Overview/Team Detail 视觉验收检查（`1920 empty monthValue[2]` 2.48px 偏差、Month value-arrow gap 12.39px < 16px、Team Detail version URL 未更新）。这些文件在本次变更中只增加了 `import React`，未改 CSS 或交互逻辑；单独重跑 Overview 套件得到相同 3 项失败，判定为本次 IR 变更之外的既有视觉验收边界。

### Real Browser

- 1920×1080 与 2560×1440：`/data/requirements/ir` 内容区分别 1704px/2344px，左右 gutter 约 24px；2560 下工作台 1242px、工作区 958px，页面不产生横向溢出。
- 2560 下 21 列模板全部可见；1920 下表格内部横向滚动。表头吸顶、表体内部滚动、分页贴底，每页 20 默认；最后一页显示台账网格和“已到最后一页”提示。
- 内联编辑进展 → 保存条出现 → 批量保存 → 行值与 summary 更新；详情抽屉编辑标题并写审计；导入向导用模板 CSV 完成上传 → 预览（新增 1）→ 整批确认 → 表格出现新行；采集批次 compact strip → 复核抽屉 → 确认。
- 导入模板下载返回 `.xlsx`，`_xlsx_rows` 校验 21 列表头与字段注册表一致；模板解析/预览/确认路径通过后端测试和浏览器验证。

### Unverified Boundaries

- 真实桌面 Excel/WPS 打开模板的外观未自动化验证；模板结构、表头和工作表内容由标准库解析测试覆盖。
- MySQL 增量迁移未在本机验证；本次只验证 SQLite `ensure_ir_schema`。
- 全量 `npm run gate` 仍被上述既有 Overview/Team Detail 视觉验收项阻断；IR 范围内的自动化、构建、浏览器与文档检查均通过。
