# Completed Changes

- [需求活动工作台](requirement-activity-workbench.md)：需求数据管理改为设计/开发活动页签，按两份新模板维护、导入和统计；设计沿用 IR 数据，开发独立记录；后端/前端/构建/Gateway E2E/文档检查通过，完整 gate 的既有 Overview 视觉边界另行记录。
- [管理页 UI 与上下文边界重构](admin-management-pages.md)：重构数据网关、数据采集、用户与权限三页，新增 Gateway status/Team options 投影，采集范围改为产品/PI 派生；Gateway E2E 通过，全量 gate 的既有 Overview 视觉边界另行记录。
- [产品、PI 与迭代层级重构](product-pi-hierarchy.md)：产品版本页改为全宽团队 → 产品 → PI → 迭代层级工作台，PI 对应 IR PI 列，迭代可选；前端/构建/文档检查通过，全量 gate 的既有 Overview 视觉边界另行记录。
- [团队人员 Excel 导入导出](team-personnel-excel-io.md)：团队人员页增加模板下载、带预览确认的批量导入和按可见范围导出；后端/前端/构建/文档检查通过，全量 gate 的既有 Overview 视觉边界另行记录。
- [团队人员页面重构](team-personnel-refactor.md)：团队页改为全宽人员目录，角色统一为 SA/SE/MDE/开发/测试，支持行内编辑与紧凑弹窗；移除产品版本/代码仓/映射字段，`source_mapping` 保留为后台集成细节；后端/前端/构建/文档检查通过，全量 gate 的既有 Overview 视觉边界另行记录。
- [指标字典只读重构](metric-dictionary-readonly.md)：把 `/settings/metrics` 从指标配置页改为全宽只读指标字典，删除活动/指标写接口与源数据规则引擎；后端/前端/构建/文档检查通过，全量 gate 的既有 Overview 视觉边界另行记录。
- [IR 数据工作台与 Excel 导入重构](ir-data-workbench-refactor.md)：按用户 21 列模板重构 IR 字段、字段注册表、upsert/fill_empty 导入、全宽工作台、内联编辑与批量保存；IR 范围内自动化/构建/浏览器/文档检查通过，全量 gate 的 Overview 视觉边界另行记录。
- [UX/UI 视觉收敛与验收基线](ux-visual-convergence.md)：四页整页视觉结果均由用户确认，关键 Issue 两档独立复验关闭，完整 `npm run gate` 通过。用户将真实业务数据验证明确延期；该项记录为未验证，不作为本次视觉验收的 PASS。
- [Visual Convergence Round 2 — Geometry & Fidelity Lock](visual-convergence-round-2.md)：完成总览、活动、能力与团队下钻的几何/视觉收敛，通过逐页 Macro/Visual Gate、Global Consistency、浏览器与项目质量 Gate。
- [Visual + UX Convergence](visual-ux-convergence.md)：完成四页逐页视觉收敛、独立评审与全局一致性验收，校准临时 IR KPI 及其文档，并保留一项可接受的基准标签差异。
- [Enterprise Analytics UX/UI 重构 Phase 0–6](enterprise-analytics-ux-redesign.md)：完成全站分析与运营工作台重构，保留指标、API 与权限语义，并通过 1920/2560 浏览器验收及完整项目 gate。
- [Rolling Demo Seed Coverage](rolling-demo-seed.md)：补齐默认月份、近六个月、成熟度与 IR 的演示数据。
- [Phase 5: UX/UI Final Release Gate](phase-5-ux-ui-final-release-gate.md)：完成全站 Route/UX QA Matrix、响应式/滚动/Token 收口、可访问性和 Browser Smoke Release Gate。
- [Phase 4: System Management, Authentication, Global Status, and App Shell](phase-4-system-management-auth-global-shell.md)：完成系统管理、认证反馈、全局状态、App Shell 与响应式收口。
- [Data Workbench Operational Console UX](data-workbench-operational-console.md)：完成 Phase 3 IR、成熟度及待定义数据域的操作型工作台整改。
- [Gateway Runtime Configuration, Readiness and Project E2E Gate](gateway-runtime-configuration.md)：完成数据库托管配置、健康诊断、采集快照与真实 HTTP 浏览器门禁。
- [Analytics UX Gate 整改](analytics-ux-remediation.md)：完成 Design Foundation 与五个 Analytics 页面的滚动、信息层级、响应式布局和真实浏览器 Gate。
- [Dashboard 三页分析重构](dashboard-three-page-analytics.md)：拆分研发总览、研发活动、研发能力与成熟度维护，并增加日粒度事实分析。
- [研发总览 Insight 驾驶舱优化](overview-insight-cockpit.md)：总览趋势卡、关键活动矩阵和 Signal 抽屉优化。
- [研发总览决策工作台重构](overview-decision-workspace.md)：以决策摘要、优先信号、证据和下钻重组总览，不改变指标口径或后端契约。
- [管理者优先的研发总览重设计](executive-dashboard-redesign.md)：统一分析月份、管理者首屏事实比较、关注项和可折叠团队矩阵。
- [AI 研发数据网关版本化能力协议](ai-dev-data-gateway-contract.md)：建立版本化协议，并在首发前完成产品版本联合标识和空业务模块规范化。
- [IR 采集 Gateway 防腐层 v1](ir-collector-gateway.md)：为 IR 增加严格同步 Gateway 契约、团队级采集暂存、可配置调度和人工确认。
- [Design Knowledge Bootstrap](design-knowledge-bootstrap.md)：基线与维护机制 Task 1–9。
- [UX/UI Design System and Phased Rebuild](ui-ux-design-system-rebuild.md)：完成 Design System、全站分析/数据工作台/系统设置分期重构及响应式与无障碍收尾。
- [Collapsible Sidebar](collapsible-sidebar.md)：真实开发验证 Task 10。
- [统一项目设计资产维护机制](unify-design-maintenance.md)：旧项目协议退役，统一新机制入口。

- [Sidebar UI and UX](sidebar-ui-ux.md)：浅色导航、桌面偏好与窄屏抽屉。
- [Dark Sidebar, Motion, and Radar Brand](sidebar-dark-motion-brand.md)：深色导航、稳定折叠动效与共享雷达品牌资产。
- [Data Source Navigation](data-source-navigation.md)：数据管理按业务来源分类，需求内聚 IR/AR/SR，并采用品牌区折叠控制。

生命周期见 [Protocol](../README.md)。
