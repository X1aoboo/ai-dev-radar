# 团队人员 Excel 导入导出

## Status

Completed

## Background

团队人员页目前只能逐个新增/行内编辑，缺少批量维护和带走数据的入口。用户要求提供 Excel 模板下载、批量导入和导出，导入后可以直接批量添加团队人员。

## Requirement

- 提供 `.xlsx` 模板下载，列为团队名称、工号、姓名、角色。
- 支持 `.xlsx`/`.csv` 导入；上传后先预览，再整批确认。
- 团队不存在时自动创建；工号不存在时新增成员；工号已存在时更新姓名/角色/所属团队。
- 角色只允许 SA / SE / MDE / 开发 / 测试。
- 任一行错误则整批不写入；预览不写业务数据。
- 导出全部团队人员和团队清单，按页面可见范围：admin/viewer 全部，maintainer 仅绑定团队。
- 模板下载/导出所有已登录角色可用；导入仅 admin。

## Current Behavior

见 [Data Management](../../business/data-management.md) 的“团队与人员”和 [Data Management Module](../../architecture/modules/data-management.md)。

## Target Behavior

团队人员页面提供“下载模板 / 导入 Excel / 导出 Excel”入口。导入 Modal：上传 → 预览（新增/更新/无变化/错误、新建团队、差异）→ 确认；错误行禁用确认。导出为包含“团队成员”和“团队”两个工作表的 `.xlsx`。

## Design

- 后端 `team_excel.py` 生成模板和导出工作簿（标准库，不新增依赖）；`team_imports.py` 负责行分析、团队自动创建、成员 upsert 和整批事务。
- API：`GET /api/teams/import-template`、`GET /api/teams/export`、`POST /api/teams/imports/preview`、`POST /api/teams/imports/confirm`。
- 前端 `TeamImportModal.jsx` 使用宽 Modal + Dragger + 预览表；页面用 `downloadFile` 下载模板/导出。
- 预览返回行级 action、team_action、changes、errors、warnings；确认只提交 team_name/employee_id/name/role，服务端重新校验。
- 不创建团队导入批次表，避免为简单主数据引入额外临时态。

## Business Impact

管理员可一次导入多个团队/成员；已有工号可按文件更新；角色统一校验。导出支持用户离线核对和再编辑。maintainer 只能导出绑定团队，导入仍仅 admin。

## Architecture Impact

新增 `team_excel.py`、`team_imports.py`；`data_api.py` 增加团队 Excel 端点。Team/TeamMember 模型不变；`source_mapping` 仍为后台集成字段。模板/导出使用标准库 XLSX；CSV/XLSX 解析复用 `parse_import_file`。

## API / Contract Changes

新增：

- `GET /api/teams/import-template`
- `GET /api/teams/export`
- `POST /api/teams/imports/preview`（原始文件 body + X-Filename）
- `POST /api/teams/imports/confirm`（JSON rows）

导入预览/确认 admin-only；模板/导出需要登录；导出按角色范围过滤。

## Data Changes

无表结构迁移；导入直接写入 Team/TeamMember。团队不存在时创建，成员按 employee_id upsert。无导入批次持久化。

## Compatibility

不改既有团队/成员 CRUD 和响应结构；页面仍可逐条编辑。导出首行列名与模板一致；CSV/XLSX 支持沿用现有解析器。

## Error & Boundary Handling

- 文件缺少列、空文件、非法角色、工号重复、必填为空均返回行错误；有错误时确认返回 422，整批不写入。
- 模板/导出失败在页面提示；导入 401 走共享 session 失效流程。
- 团队名不存在自动创建；文件内重复工号报错，不会静默覆盖。
- 导出空数据仍返回带表头的工作簿。

## Risks & Trade-offs

- 工号 upsert 会更新既有成员；预览明确显示更新和差异，确认前不写入。
- 团队名拼写错误会自动创建新团队；预览显示“新建团队”，用户可在确认前修正。
- 导出包含成员工号，按现有页面可见范围授权；导入仅 admin。
- 没有导入批次审计；后续如需追踪批量来源，可再引入导入批次/审计。

## Test Strategy

- 后端：模板/导出可解析、预览新增/更新/无变化、确认写入、非法角色/重复工号/空文件、非 admin 403、maintainer 导出范围。
- 前端：模板/导出调用 downloadFile；导入 Modal 上传预览、确认、错误禁用、结果。
- 浏览器：1920/2560 入口、真实模板/导出下载、CSV 预览、确认导入并清理。
- 回归：backend pytest、frontend unit/build、docs checks、gate 边界。

## Documentation Impact

- Business: UPDATE `docs/business/data-management.md` 团队与人员。
- Architecture: UPDATE `docs/architecture/modules/data-management.md` 职责、接口、测试。
- Standards: NONE；沿用现有导入/导出约定。
- ADR: NONE；导入/导出是功能契约，团队/映射边界已由 ADR-0014 记录。
- Change Design: CREATE 本记录；完成后移入 completed 并更新索引。
- DESIGN/UX: UPDATE `DESIGN.md`、`UX-CONTRACT.md` 团队页 Excel 入口和预览 Modal。

## Validation

### Automated

- Backend: `npm test` → 149 passed；新增 `test_team_import_export.py` 覆盖模板/导出可解析、CSV 预览新增/更新、确认写入、非法角色/文件内重复工号、整批 422、非 admin 导入 403、maintainer 导出仅绑定团队。
- Frontend: `npm --prefix frontend run test:unit` → 106 passed；覆盖模板/导出 downloadFile、导入 Modal 上传预览、确认导入、结果展示。
- Frontend build: passed（保留既有大 chunk 警告）。
- Docs: `npm run check:docs`、`npm run test:docs` passed。
- `npm run gate`: backend、frontend、build、Gateway Project E2E 通过；仍在既有 Overview visual E2E 的 3 项 Overview/Team Detail 视觉验收失败处停止，与团队人员 Excel 功能无关。

### Real Browser

- 真实下载模板 `团队人员导入模板.xlsx`；真实导出 `团队人员导出_2026-10-20.xlsx`；模板/导出首行为团队名称/工号/姓名/角色。
- 用 CSV 上传预览：2 行，新增 1 / 更新 1 / 新建团队 1，预览表显示团队、工号、姓名、角色、处理、差异；未确认前没有写入。
- 用临时 CSV 确认导入：真实创建 1 个团队和 1 名成员，Modal 显示“导入完成”，页面出现新团队；验证后已清理。
- 1920/2560 页面入口完整可见，无页面横向溢出。

### Unverified Boundaries

- 导入没有独立的批次表/审计记录；确认即写入 Team/TeamMember，后续若需追踪批量来源需另加导入批次。
- 模板外观未在桌面 Excel/WPS 人工打开验证；标准库生成的工作簿由解析测试和浏览器下载验证。
- 全量 `npm run gate` 仍被既有 Overview/Team Detail 视觉验收项阻断，不把该 suite 记为本次 PASS。
