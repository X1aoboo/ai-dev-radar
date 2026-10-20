# 产品、PI 与迭代层级重构

## Status

Completed

## Background

`/settings/products` 是 1600px 居中的“产品列表 + 选中产品详情”：中间大片空白，产品层级、PI、迭代被拆在左右两块，且右侧只显示选中产品，难以看到全部团队/产品/PI。业务上产品只属于一个团队，PI 即产品版本并对应 IR 需求的 PI 列，每个 PI 下迭代可选。

## Requirement

- 全宽产品层级页，展示团队 → 产品 → PI（产品版本）→ 迭代。
- 产品只归属一个团队；PI 对应 IR 的 PI/`version_id`；迭代可选，允许 PI 没有迭代。
- 新增/编辑使用紧凑弹窗，不再使用选中产品详情面板/抽屉。
- 保留产品、PI、迭代的引用保护与权限；maintainer/viewer 只读，maintainer 只看绑定团队。
- 页面不再有中间大片空白，所有层级在同一工作台可见。

## Current Behavior

见 [Data Management](../../business/data-management.md) 的“产品、PI 与迭代”和 [Data Management Module](../../architecture/modules/data-management.md)；旧页面为 `DataManagementPage` 的 `ProductManagement`。

## Target Behavior

PageHeader（新增产品）→ 四格概览（团队/产品/PI/迭代）→ 搜索 + 团队筛选 → 全宽层级表：团队分组行、产品行、PI 行、迭代行；产品行/PI 行/迭代行内操作；产品/PI/迭代新增编辑 Modal。PI 行显示 0 个迭代为“可选”，不伪造空行。

## Design

- 新组件 `frontend/src/dataManagement/products/ProductHierarchyPage.jsx`、`product-hierarchy.css`。
- `/settings/products` 使用全宽 `management` 内容模式；`/settings/teams` 同模式。
- 层级数据来自现有 `refs.teams/products/versions`，不新增 API 或持久模型。
- Product 行：`新增 PI / 编辑 / 删除`；PI 行：`新增迭代 / 编辑 / 删除`；迭代行：`编辑 / 删除`；团队分组行提供新增产品。
- 术语统一为 PI（产品版本），并说明对应 IR PI 列。

## Business Impact

用户能一次看到全部团队/产品/PI/迭代；产品仍只属于一个团队；PI 与 IR 需求 PI 列的关系明确；迭代可选，不会因 PI 无迭代被误判为错误。产品/PI/迭代的关系和删除约束不变。

## Architecture Impact

前端页面替换 `ProductManagement` 和 Product/Version/Iteration Drawer；后端 `/api/products`、`/api/versions`、`/api/iterations` 不变。Product → ProductVersion → Iteration 聚合和 Team 归属不变；`version_id` 继续是 IR PI 映射。

## API / Contract Changes

NONE：复用现有产品/版本/迭代 API，响应和写入字段不变。

## Data Changes

NONE：不新增/修改表结构；无迁移。

## Compatibility

现有产品/版本/迭代数据、IR PI 映射、看板计算保持兼容；页面仅改变展示和工作台布局。

## Error & Boundary Handling

- 产品、PI、迭代删除继续受引用保护，错误显示中文说明。
- 产品只能选一个团队；PI 必须选产品；迭代必须选 PI 和起止日期。
- PI 无迭代显示“0 个迭代（可选）”；产品无 PI 显示“0 个 PI（可添加）”。
- maintainer 只展示绑定团队，无写控件；401 走共享 session 失效流程。

## Risks & Trade-offs

- 全宽层级表在数据很多时需要内部滚动；表头/团队分组保持可见。
- 术语从“版本”改为“PI（产品版本）”，需要与 IR 模板 PI 列持续保持一致。
- 产品/PI/迭代新增弹窗替代旧抽屉，测试需同步更新。

## Test Strategy

- 前端：层级渲染（团队/产品/PI/迭代、0 迭代可选）、产品/PI/迭代弹窗提交、maintainer 只读/范围、`management` 内容模式。
- 后端：现有产品/版本/迭代与 IR PI 映射回归不变。
- 浏览器：1920/2560 全宽、无中间空白、操作按钮不换行、弹窗。
- 回归：backend pytest、frontend unit/build、docs checks、gate 边界。

## Documentation Impact

- Business: UPDATE `docs/business/data-management.md`、`CONTEXT.md`。
- Architecture: UPDATE `docs/architecture/modules/data-management.md`。
- Standards: NONE。
- ADR: NONE；团队拥有产品层级已由 ADR-0005 记录，本次只改页面与 PI 术语。
- Change Design: CREATE 本记录；完成后移入 completed 并更新索引。
- DESIGN/UX: UPDATE `DESIGN.md`、`UX-CONTRACT.md`，纳入全宽 Product Hierarchy 和 PI 术语。

## Validation

### Automated

- Backend: `npm test` → 149 passed；本次复用现有产品/版本/迭代 API，既有 CRUD、父子约束和 IR PI 映射回归通过。
- Frontend: `npm --prefix frontend run test:unit` → 105 passed；覆盖产品层级渲染、团队/产品/PI/迭代、0 迭代可选、产品/PI/迭代弹窗提交、maintainer 只读/绑定团队范围。
- Frontend build: passed（保留既有大 chunk 警告）。
- Docs: `npm run check:docs`、`npm run test:docs` passed。
- `npm run gate`: backend、frontend、build、Gateway Project E2E 通过；仍在既有 Overview visual E2E 的 3 项 Overview/Team Detail 视觉验收失败处停止，与产品层级页无关。

### Real Browser

- 2560×1440：内容区 2344px，产品层级表约 2340px；团队 A/B/C/D 全部展开，4 个产品、2 个 PI、6 个迭代可见，无中间空面板。
- 1920×1080：内容区 1704px，操作列加宽后产品/PI 三操作单行显示；表头 sticky，表格内部滚动，页面无横向溢出。
- 产品行显示 `2 个 PI`/`0 个 PI（可添加）`；PI 行显示 `3 个迭代`/`0 个迭代（可选）`；迭代行显示起止日期。
- 新增 PI 弹窗默认“团队A / 团队A产品”，PI 标签注明对应 IR 需求 PI 列；新增迭代弹窗默认所属 PI，日期字段可用。
- 通过真实 UI 新增“临时层级产品”成功，验证后已清理。
- maintainer 只看到绑定团队且无新增/编辑操作。

### Unverified Boundaries

- 全宽层级表在大量产品/迭代时依赖内部滚动；当前演示数据量下未做超大数据量性能验证。
- “PI”沿用现有 `ProductVersion` 持久模型和 `/api/versions` 契约，未改数据库字段名；外部 API 仍称为 version。
- 全量 `npm run gate` 仍被既有 Overview/Team Detail 视觉验收项阻断，不把该 suite 记为本次 PASS。
