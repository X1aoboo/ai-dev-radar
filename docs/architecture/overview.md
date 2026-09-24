# Current Architecture

## 边界与技术栈

一个 React 19 客户端和一个 FastAPI 服务；Ant Design 提供 UI，ECharts 提供图表，React Router 管理页面。SQLAlchemy 2 管理默认 SQLite 存储，Pydantic 校验 HTTP DTO，APScheduler 3 在服务进程内调度。Radar 通过同步 HTTPX 客户端调用 AI 研发数据网关；Gateway 源码不在本仓库，当前实现仅覆盖 IR。双方共同依赖版本化能力协议，Radar Pydantic 模型只是消费端实现。

```mermaid
flowchart LR
    Browser[React Ant Design ECharts] --> API[FastAPI 认证与路由]
    API --> Facts[compute 事实计算]
    API --> Maturity[maturity Decimal 评估]
    API --> Source[data_management 校验 合并 计算]
    API --> ORM[SQLAlchemy models 与 session]
    ORM --> DB[(SQLite)]
    GatewaySettings[数据网关管理页] --> GatewayAPI[Gateway Management API]
    GatewayAPI --> GatewayConfig[Gateway 配置 审计 健康快照]
    GatewayConfig --> ORM
    Scheduler[进程内 APScheduler] --> Registry[旧事实采集注册表]
    Registry --> ORM
    Scheduler --> SourceCollection[IR 源数据采集与暂存]
    Scheduler --> GatewayHealth[Gateway readiness 检查]
    GatewayHealth --> GatewayConfig
    GatewayHealth --> Gateway[AI 研发数据网关]
    Contract[版本化能力协议基线] --> SourceCollection
    Contract --> Gateway
    SourceCollection -->|Bearer HTTPS| Gateway
    Gateway --> SourceCollection
    SourceCollection --> ORM
    Static[Vite dist 静态托管] --> Browser
```

路由查询数据库后交给计算函数，不由图表决定统计口径。源数据 API 编排校验、权限和事务。旧事实采集仍走 FactRecord 注册表；IR 源采集由 `source_collection.py` 读取一次 Active 配置形成不可变快照，经 AI 研发数据网关执行并写入暂存批次，不触碰正式 IR 或旧事实链路。配置、最新健康状态和配置审计由 Gateway 管理模块持久化；健康检查与采集复用同一个进程内 APScheduler。协议工作区保存最新完整基线和逐版本变化，消费者固定发布 tag 或 commit。图中的 Gateway 关系代表 Radar 侧实现，不代表真实内部平台联调已通过。

## 核心模块与依赖方向

| 模块 | 职责 | 约束 |
|---|---|---|
| `main.py` | 组装中间件、路由、lifespan、静态托管 | 启动和关闭调度器 |
| `auth.py` | session、密码及角色/团队权限 | 后端授权，每次加载用户 |
| `api.py` | 认证、目录、事实、成熟度 | 调用纯计算和 ORM |
| `data_api.py` | 组织、IR、批次、源数据指标 | 复用 data_management 规则 |
| `gateway_api.py` / `gateway_config.py` | 管理 Active/Draft、实时激活、配置审计和 CollectionRun runtime snapshot | admin-only；Token 不进入读取响应、审计、run 或日志 |
| `gateway_health.py` | readiness 状态转换、最新状态持久化、stale 判定及立即/周期检查 | 复用 APScheduler；每 30 秒检查 Active；不保留时序 |
| `source_collection.py` / `collector_gateway.py` | IR 周期窗口、按团队运行、显式 runtime snapshot 的 Gateway HTTPS 调用及暂存 | 同一 CollectionRun 所有团队共用一份快照；不自动重试 |
| `gateway_contracts.py` / `collector_contracts.py` | Readiness 与 IR 的严格 Pydantic 消费端模型 | 与版本化 OpenAPI 基线做一致性测试 |
| `ir_imports.py` | 文件导入与采集共用 IR 行校验及批次创建 | 采集批次必须绑定团队 |
| `compute.py` / `maturity.py` | 事实和评估计算 | 不依赖 HTTP 或数据库查询 |
| `data_management.py` | IR 规范化、解析、差异、合并和指标 | 不承担 HTTP 编排 |
| `models.py` / `db.py` / `migrations.py` | 实体、session、现有库增量 schema | 没有通用迁移框架 |
| `collectors.py` / `scheduler.py` | 接口注册、定时事实采集及配置化源数据采集 | Gateway 健康任务沿用同一个 Scheduler；没有真实平台实现 |

客户端共用 `api.js` 的 `fetchJson` 携带 cookie 和统一 HTTP 异常；领域页面拆出逻辑和图表配置。当前路径由 `routing/routeMetadata.js` 定义：`/`、`/analytics/activities`、`/analytics/capabilities`、`/analytics/teams/:teamId`、`/analytics/metrics/:metricId`、`/data/requirements/:requirementType`、`/data/maturity`、`/data/{issues|mr|code-review}`、`/settings/*`（含管理员 `/settings/collections` 与 `/settings/gateway`）；旧数据管理路径重定向到新分类，旧 `/?category=key|general` 重定向到活动/能力页。

AppShell 分别持有桌面折叠选择、matchMedia 窄屏状态与抽屉开关。localStorage 的 ai-dev-radar.sidebar-collapsed 只保存桌面布尔偏好；读取失败默认展开，写入失败不影响使用。监听 680px 断点，变化时关闭抽屉并恢复独立桌面选择。桌面 CSS 用同一自定义宽度变量同步 248px/64px 侧栏宽度与正文左偏移，并以 240ms cubic-bezier(.2,0,0,1) 过渡；首屏直接使用保存状态，连续切换由 CSS 从当前动画位置反向过渡，prefers-reduced-motion: reduce 时禁用新增过渡。Topbar 是 56px 的 Breadcrumb 与账户操作区，不承载路由页面标题。

AppShell 在主要内容区内捕获 lazy route 的 Suspense，以 `ContentLoadingState` 加载页面模块时保留导航和 Topbar。`frontend/src/components/StatusPage.jsx` 提供共享 403、404、pending、fatal-error 页面及内容加载状态。`App.jsx` 在认证服务确认用户前独立展示认证加载状态；登录页、401 重新认证和返回中断路径仍由 App 管理，不新增 token refresh。

AppShell 按路由给内容区标记 dashboard、analytics、operational 或 readable 模式。Dashboard/Analytics 使用侧栏后的 fluid canvas 和 24px–40px gutter；Operational 保持表格/工作流宽度策略，Readable 的表单画布上限为 1120px。`.app-shell__content` 只裁切横向溢出（`overflow-x: clip`），不建立纵向滚动容器；Analytics 文档由浏览器负责纵向滚动，活动目录与能力结构导航以 sticky 定位在 Topbar 下方。Sidebar 的固定定位与内部导航滚动仍独立。

`frontend/src/design/tokens.css` 是 light mode 的运行时语义 token 源，`design-system.css` 持有全局滚动条、排版、网格、PageHeader/FilterToolbar 以及系统管理 workspace、settings section 和 run-history 样式；`theme.js` 和 `charts/chartTheme.js` 运行时解析这些 token 供 Ant Design 与 ECharts 使用。应用和页面 CSS 直接消费 canonical semantic tokens，`app.css` 只保留 `--shell-sidebar-width` 这类真实壳层状态，不再提供历史 compatibility aliases。`components/PageHeader.jsx`、`FilterToolbar.jsx`、`MetricCard.jsx`、`AnalyticsPanel.jsx` 和 `StatusPage.jsx` 只负责呈现，不拥有领域/API 状态。图表选项继续拥有各自的业务数据映射。`premium-ui.json` 为 UI 静态审计声明产品配置和已接受的原生 Select/Listbox、Date 控件归属。AnalyticsPages、DataManagement、AppShell 与 TeamDrilldown 的运行时 CSS 都已迁为语义 token 消费者；无导入点的 `overview/overview.css` 已删除，指标详情所需趋势卡样式由 AnalyticsPages 共享。DataManagementPage 的 IR 表把 `FilterToolbar` 放在 Table 之前，并由 Table 自己处理 sticky header/局部横向滚动；团队、产品、指标管理复用 shared settings workspace，成熟度和 IR 的页面布局仍留在 `dataManagement.css`。UsersSettingsPage、CollectionsSettingsPage 和数据管理各主工作区复用 PageHeader；用户权限使用 operational table，采集设置使用摘要、section 和可展开运行历史。登录页继续由 App 拥有认证请求，使用 `noValidate`、字段 ARIA 关联和表单内错误；认证失败不向用户暴露原始服务错误。App 监听路由路径并为登录、洞察、数据管理和系统管理页面设置本地化 `document.title`。

AppSidebar 的品牌区放共享的 frontend/public/favicon.svg 雷达 Logo 和折叠按钮：展开时水平分列，折叠后垂直居中；展开态使用 MenuFoldOutlined 收起侧栏，折叠态使用 MenuOutlined，按钮保留 Tooltip、ARIA 标签及键盘焦点反馈。按钮为 40×40px，hover 缩放 1.06、active 缩放 0.94，颜色/背景/缩放过渡 160ms；prefers-reduced-motion: reduce 时关闭按钮过渡和缩放。共享 SVG 为蓝色圆形雷达环、实色青色扫描线和三个数据点，供侧栏、抽屉、登录页和 favicon 使用。中间 app-nav 独立滚动，文字使用透明度与最大宽度裁切保持单行。窄屏使用现有 Ant Design Drawer，抽屉和侧栏共用 #F8FAFD 浅色表面，不保留折叠图标栏，关闭后由 AppShell 恢复顶栏打开按钮焦点，避免过渡期间与 Ant Design 默认恢复时机竞争。AppSidebar 复用角色过滤与路由元数据，数据管理直接提供四类来源链接，需求子路由共享所属入口样式；总览及其下钻同样使用所属入口样式，精确匹配才使用 aria-current=page。折叠切换不发业务请求、不改变权限。

`AnalyticsPages` 将研发总览、研发活动和研发能力拆成三个同级只读页面，以 `month` URL 参数作为共同分析月份。总览并行使用成熟度近六个月序列和按月窗口的既有 `/api/compute` 结果：`buildMetricRows` 只统计可用事实覆盖，`executiveLogic.js` 只在同一个真实数值指标内排序团队，并按显式阶段映射挑选研发生命周期的目录指标。总体趋势仅展示一个可切换指标的 `company_average`，并与单指标团队排名组合呈现；不显示所有团队多线或跨领域成熟度合成序列，不使用 `domain_summary` 作事实基线，也不跨指标归一、加权或创建 Target。Signal 排在生命周期、成熟度和下钻摘要之后。活动页复用 `overview/FilterBar.jsx` 与 App 的 URL 筛选 owner：`dimension`、`granularity`、`version` 提供既有 `useComputedMetrics` 查询条件；`period` 从已返回序列中定位当前事实和趋势焦点，`metric` 选择展示的目录项，均不新增 API 参数。活动导航以当前八项关键活动目录锚定分节。选定单周期时展示其当前事实与同指标团队比较；“全部周期”仅显示完整趋势，不显示单周期快照。事实趋势仍保留多团队系列和同指标 `company_average`，成熟度仍由独立的 `month` 参数按自然月读取。量化详情将 `company_average` 的全公司均值与 `domain_summary` 的合并原始量结果及分子/分母分开呈现，成熟度聚合继续标作领域平均。能力页用能力结构目录选择单项能力，并在当前状态与演进区展示其成熟度和原始指标；原始指标按月/周/日窗口请求，成熟度不随粒度改变。布尔能力不绘制 0/1 趋势或均值；无单周期时读取最新有效 `snapshot`，显式选周期时读取该期 `series.values`，缺失仍保持未知。标题与筛选工具栏由共享 `PageHeader` 和 `FilterToolbar` 提供。

`overviewLogic.js` 为选定月份生成以该月为终点的完整窗口，当前周期无事实时保留断点并显示空状态，不回退到最近事实。主体从每个指标的团队序列和 `company_average` 派生有效团队数、事实完整度、横向比较和 Signal，不使用 `domain_summary` 作为事实基线；不新增阈值、目标或外部基准。图表和 Signal 共用只读右侧 Drawer，成熟度写入集中在 `/data/maturity`。成熟度 overview 对选定月及前五个月并行读取现有 `/api/maturity/overview`，当前月响应继续作为维护与矩阵数据。成熟度仍使用后端领域平均；矩阵使用精确文本值、环比和微型趋势，并保留原生 `details/summary` 的团队比较与领域基线。布尔指标在保留跨月 `snapshot` 的同时使用已有 `series.values` 返回按月状态，保证月度选择不回退。

TeamDrilldown 的 KPI 分别使用现有目录单指标（`cd-ar-pen`、`cd-eff`、`mrr-rate`）和布尔状态 `ad-bool`，不跨指标求平均；随后显示 sticky 活动目录、趋势卡和按需事实详情，末尾并列展示关键研发活动与通用研发能力成熟度雷达。页面用选定自然月的 `/api/maturity/records?team_id=…` 获取当前团队人工记录，并各调用一次 `/api/maturity/overview?kind=key|general` 获取后端领域平均。`maturityProfileSeries` 只映射当前分值，缺失值保持 null，零分仍是有效分值；团队色沿用稳定团队槽位，领域平均使用中性虚线。周期为迭代时成熟度仍采用当前自然月，不随迭代维度伪造评估。Metric Detail 在单周期下排序同一指标的团队值；全部周期只展示趋势，不声称当前值或当前周期原始事实。

## 数据流和模型

事实链路：FactRecord → 当前有效事实选择 → 日/周/月或迭代切片 → 团队序列、全公司均值和领域合并值。日周期按 `Asia/Shanghai` 自然日生成，中间无事实日期保留为空周期。总览按月复用团队序列与 `company_average`，不把 `domain_summary` 当作展示基线。IR 链路：页面/文件或 Gateway → 共享行校验 → 带团队的临时批次 → 人工确认事务与审计 → 正式 IR → `/api/data-metrics/compute`。成熟度链路：团队月度维护 → MaturityRecord → Decimal 领域聚合。三者独立，IR 不自动替换看板事实。

`seed.py` 在空库初始化或显式重建时以 Asia/Shanghai 的执行日期为锚，写入近六个月的演示版本/迭代、全部目录事实、每月独立模拟成熟度评估及正式 IR 示例。关键活动每个团队/指标/迭代只写一条事实；通用能力覆盖六个月的周采样及近三十天的日采样；布尔状态按月写入。`npm run seed` 与 `npm run dev` 均从项目根目录解析默认 SQLite 路径，并遵循显式 `DATABASE_URL`。生成过程使用固定随机种子，同一日期重跑结果稳定；业务数据清空重建仍是破坏性操作，测试使用隔离数据库。

团队产品层级支持源数据归属；人员关联责任工号。旧 ProductVersion 可无 product_id 是兼容形态，新管理版本必须绑定产品。更多模块细节见 [源数据模块](modules/data-management.md)。

## 运行与部署

lifespan 依次建表、增量 schema、检查活动目录并在为空时播种，确保 IR 默认禁用的调度配置存在，把已有 Active 健康状态标记为 `UNKNOWN`，再加载启用的源数据调度任务和立即执行的 `gateway-health-check`，最后启动同一个 APScheduler；Gateway 检查之后每 30 秒运行一次。关闭时等待调度器退出。旧 `COLLECTION_CRON` 任务继续处理 FactRecord。播种是否执行由目录是否为空决定，不能据此宣称所有缺失数据都会自动补齐。

本地 Vite 将 `/api` 代理到 8000 后端。Docker 多阶段构建 Vite，FastAPI 同源托管 dist，以单个 Uvicorn 进程启动，SQLite 放在 `/data` 卷。SPA fallback 仅处理无扩展名 GET 客户端路径，显式排除 `/api`，保留 API 404/405 语义。Gateway URL、Bearer Token 和 timeout 通过 admin-only 数据网关页面管理并存于 Radar 数据库；Token 按决策明文存储但绝不返回或写入审计/run/log。生产 Gateway URL 必须使用 HTTPS。E2E 测试资产由 `.dockerignore` 排除且 Dockerfile 不复制到生产镜像。环境变量详见 [README](../../README.md)。

进程内调度约束意味着扩展多 worker 会重复调度；当前部署采用单进程。生产配置拒绝默认密钥和种子密码，HTTPS 场景需启用 secure cookie。L3 Project E2E 只验证 Radar 与独立 Mock Gateway 的真实本机 HTTP 链路，不代表真实 Gateway 或内部平台联调通过。Docker 镜像、卷重启持久化、MySQL 与 L4 内网联调需部署验证，不从项目门禁推断。

侧栏与抽屉使用 #F8FAFD 浅色表面及 #E0E3E7 边框；正文文字为 #3C4043，辅助文字为 #5F6368，选中项使用 #D3E3FD 背景和深蓝文字。导航明确 overflow-x: hidden、overflow-y: auto，并允许网格及导航项收缩；折叠链接移除文字间距和横向留白，在最多 40px 的导航行内居中，避免横向滚动导致图标偏移。纵向使用细滚动条，短视口保持导航滚动能力，折叠控制固定在非滚动品牌区。
