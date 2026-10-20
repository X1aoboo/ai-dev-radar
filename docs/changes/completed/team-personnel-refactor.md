# 团队人员页面重构

## Status

Completed

## Background

`/settings/teams` 当前是 1600px 居中的“团队列表 + 选中团队详情”：右侧只显示当前团队的少量成员，产品版本映射、代码仓地址和数据源映射堆在团队编辑抽屉里。用户要求页面只管理团队和人员，关键人员信息全部以列表呈现，编辑操作更直接，并把产品/版本关系留给「产品与版本」页面。

## Requirement

- 团队人员页面改为全宽 `management` 目录，不再使用 1600px 容器。
- 默认展示全部可见团队的成员列表，支持按团队筛选、姓名/工号搜索、角色筛选。
- 团队成员角色统一为 SA / SE / MDE / 开发 / 测试。
- 人员使用行内编辑：点击编辑后直接修改并保存，不再使用编辑抽屉。
- 团队和新增成员使用紧凑弹窗；表单只包含团队名称或人员字段。
- 团队页不展示产品版本、代码仓地址或数据源映射；产品/版本/迭代由「产品与版本」页面维护。
- `source_mapping` 保留为后台持久化集成字段，不进入团队人员页面前端读写路径。
- 管理员可管理团队和成员；maintainer 只看到绑定团队且只读；viewer 只读。

## Current Behavior

见 [Data Management](../../architecture/modules/data-management.md)、[Data Management Business](../../business/data-management.md)；旧页面实现位于 `DataManagementPage` 的 `TeamManagement`。

## Target Behavior

全宽 People Directory：PageHeader（管理员新增团队/成员，或只读状态）→ 四格概览 → 左侧团队目录（全部团队/团队、成员数、角色分布）→ 右侧全部成员表格（姓名、工号、角色、所属团队、操作）。行点击或编辑按钮进入行内编辑，保存/取消；新增团队、新增成员使用紧凑 Modal。产品版本、仓库、映射不在页面出现。

## Design

- 新组件 `frontend/src/dataManagement/team/TeamPersonnelPage.jsx`、`teamRoles.js`、`team-personnel.css`。
- `App.jsx` 为 `/settings/teams` 分配全宽 `management` 内容模式；`app.css` 增加该模式及短屏回退。
- 团队聚合与成员 API 保持现有 `/api/teams`、`/api/team-members`；`TeamIn.source_mapping` 改为可省略，团队创建只提交名称，更新名称不清除既有映射。
- 角色选项 `SA/SE/MDE/开发/测试`；历史自由文本角色显示为历史值，可在行内编辑改为标准角色。
- 行内编辑使用本地 draft，保存调用成员 PATCH；新增成员/团队使用 Modal + Form。
- 左侧团队目录用客户端过滤，不新增后端分页或聚合接口。

## Business Impact

团队人员页面从混合配置页变为人员主数据管理页。产品/版本/迭代关系只在产品页面维护；团队成员角色具有统一业务含义；管理员可以在一屏内看到全部成员并直接修改，维护者只能读绑定团队。

## Architecture Impact

`Team` 聚合的前端职责收敛为名称和成员；`source_mapping` 保留为 Gateway/采集持久化细节，不进入团队人员页面的读写路径。Product/ProductVersion/Iteration 聚合不变，产品通过 `team_id` 归属团队。`DataManagementPage` 移除旧 `TeamManagement`、`TeamEditorDrawer`、`MemberEditorDrawer`，挂载新页面。

## API / Contract Changes

- `POST /api/teams` 的 `source_mapping` 改为可选，默认空映射；既有发送完整 `source_mapping` 的调用兼容。
- `/api/teams`、`/api/team-members` 的响应结构不变；团队人员页不再发送 `source_mapping`。
- 无新增/删除接口。

## Data Changes

- `seed.py` 演示团队成员角色改为 SA/SE/MDE/开发/测试；`TeamMember.role` 仍为字符串，历史值保留。
- 无表结构迁移；`source_mapping` JSON 字段保留。

## Compatibility

产品版本页、Gateway 采集和既有 `/api/teams` 读取保持兼容；`source_mapping` 仍可被持久化/种子/集成层维护。历史角色不被强制重写，页面上显示为历史值并允许行内修正。

## Error & Boundary Handling

- 团队名称/工号/姓名/角色必填校验；API 冲突（团队名或工号重复）显示中文提示。
- 团队删除仍受事实/维护者引用保护，错误显示中文说明。
- 维护者只展示绑定团队，无编辑控件；无团队时新增成员提示先创建团队。
- 行内保存失败保留编辑态，显示错误；401 走共享 session 失效流程。

## Risks & Trade-offs

- `source_mapping` 暂无 UI 管理入口；按用户要求保留后台字段，后续如需要应放到数据网关/集成配置界面。
- 历史角色需要人工统一，前端不强制迁移。
- 全宽页面在成员很少时表格下方仍会有空白；保持表格容器和左栏信息填充，不伪造数据。

## Test Strategy

- 后端：团队仅名称创建、source_mapping 默认值、既有完整映射创建、成员 API 回归。
- 前端：团队页全宽/全部成员/标准角色/无产品版本字段；行内编辑 PATCH；团队/成员创建 Modal；删除约束；maintainer 只读且只看绑定团队；`management` 内容模式。
- 回归：backend pytest、frontend unit/build、docs checks、1920/2560 浏览器检查。

## Documentation Impact

- Business: UPDATE `docs/business/data-management.md`、`CONTEXT.md`。
- Architecture: UPDATE `docs/architecture/modules/data-management.md`、`docs/architecture/overview.md`（如涉及）。
- Standards: 本次未改变通用 API/数据规范；无需更新。
- ADR: CREATE `docs/adr/0014-team-personnel-and-source-mapping-boundary.md`，更新 ADR 索引。
- Change Design: CREATE 本记录；完成后移入 completed 并更新两个索引。
- DESIGN/UX: UPDATE `DESIGN.md`、`UX-CONTRACT.md`，纳入 `management` 模式、People Directory、行内编辑、角色和边界。

## Validation

### Automated

- Backend: `npm test` → 144 passed；新增“仅名称创建团队”用例，覆盖 `TeamIn.source_mapping` 可省略并落为空映射，既有完整映射创建仍通过；成员/团队 CRUD 回归通过。
- Frontend: `npm --prefix frontend run test:unit` → 104 passed；覆盖全宽团队目录、全部成员、标准角色、无产品版本/仓库/映射字段、行内编辑 PATCH、团队/成员创建 Modal、maintainer 只读且仅绑定团队、`management` 内容模式。
- Frontend build: passed（保留既有大 chunk 警告）。
- Docs: `npm run check:docs`、`npm run test:docs` passed。
- `npm run gate`: backend、frontend、build、Gateway Project E2E 通过；仍在既有 Overview visual E2E 的 3 项 Overview/Team Detail 验收失败处停止，与团队人员页无关。

### Real Browser

- 2560×1440：内容区 2344px，团队人员工作区约 1113px 高，表格 1969px；无页面横向溢出。
- 1920×1080：内容区 1704px，工作区约 794px 高，表格 1339px；全部 8 名演示成员和 4 个团队可见。
- 行内编辑：点击“编辑”后姓名/工号/角色/所属团队变为输入，保存后真实 PATCH 成功，回改也成功。
- 新增团队/新增成员弹窗紧凑，字段只有团队名称或所属团队/工号/姓名/角色；新增成员弹窗默认团队正确显示为“团队A”，不再显示裸 ID。通过真实 UI 创建“临时测试团队”成功，验证后已清理。
- maintainer.团队A 登录只看到团队A，无新增/编辑/删除控件；团队B 不在页面。
- 页面不再出现产品版本映射、代码仓地址或数据源映射；角色分布显示 SA/SE/MDE/开发/测试。

### Unverified Boundaries

- `Team.source_mapping` 仍保留在持久化/API 响应中供 Gateway/采集使用，本期没有团队侧管理 UI；未来如需要，应放到数据网关/集成配置界面。
- 历史自由文本角色不强制迁移；页面显示为历史值并允许行内改为标准角色。演示种子和当前演示库已使用标准角色。
- 全量 `npm run gate` 仍被既有 Overview/Team Detail 视觉验收项阻断，不把该 suite 记为本次 PASS。
