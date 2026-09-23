# 源数据、组织与权限管理

## 目标和范围

维护可追溯的研发源数据与 AI 属性，按定义实时计算指标。数据管理按需求、问题单、MR、代码检视四类业务数据源组织；IR、AR、SR 是需求内部分类。当前仅完整实现 IR，支持页面维护、文件导入及经 AI 研发数据网关暂存的采集；AR/SR 及其他数据源仍待定义。真实内部平台/Gateway 联调需部署环境另行验证。

## 组织和角色

归属链为团队 → 产品 → 产品版本 → 开发迭代期。IR 必须引用一致的产品、版本和迭代，团队沿产品归属。人员工号为稳定责任人标识；未匹配工号可入库并显示待匹配，不改变记录归属。

admin 管理全局配置和全部数据；maintainer 维护绑定团队数据；viewer 只读。不同列表的可见范围由后端接口分别控制，不能把导航隐藏当成授权。密码使用 Argon2，签名 cookie session 保存用户 ID；每次请求从数据库重新读取角色。

成熟度评估是数据管理下的独立维护入口 `/data/maturity`。admin 可选择全部团队，maintainer 固定为绑定团队，viewer 只能查看按月的成熟度汇总；维护者在活动表格编辑分值和说明，复制上月只填充草稿，整月预览在 Drawer 中确认保存，清空仍需单独确认。所有写入复用现有成熟度 API，并由后端再次校验团队权限。研发总览、研发活动和研发能力页面只读，不提供成熟度写入口。

采集计划与手动触发仅限 admin。IR 采集批次由 admin 全局查看/确认；maintainer 只能查看/确认所属团队的采集批次。文件批次继续按原创建者权限查看/确认。

## 手工维护场景

需求工作台通过 IR、AR、SR 页签分类；页签路径可直接访问，未知分类回退 IR。IR 使用内容区 PageHeader、常用筛选常驻/高级筛选按需展开的工具栏和以正式数据表为主的操作台；表头固定，横向滚动仅由表格在必要时承接。筛选状态保留在页面内，筛选变化继续自动查询；重置筛选不改变路由。IR 支持筛选、分页、新增和编辑；保存时校验业务字段、层级及权限。页面编辑可显式覆盖已有字段，正式数据变更写入 AuditLog，AI 属性另记字段级来源、维护人及时间。新增/编辑抽屉按基础信息、归属、业务信息、工作量和 AI 属性分组，字段校验及保存流程不变。

待确认采集区只在加载中或存在批次时占用页面；有批次时紧凑列出来源、团队、生成时间及有效/错误行数，并可打开共享批次复核抽屉。文件导入与采集预览都展示暂存状态、来源及文件/团队、生成时间、行数统计、警告和逐行校验；无效行仍阻止整批确认。只读角色在页头看到紧凑只读标记；维护者在 IR 与成熟度范围中的团队筛选都锁定到账号绑定团队，并显示锁定原因。

AR/SR 页面保持需求子类型的待定义状态，问题单、MR、代码检视使用相同的紧凑待定义状态；不提供未定义的字段、表格或编辑行为。成熟度维护继续以 15 项活动表格为主体，维护者只能编辑绑定团队，复制上月只填草稿并由预览抽屉确认整月保存，清空仍需二次确认。Viewer 按关键研发活动和通用研发能力两个分区查看领域平均、等级和覆盖，不显示编辑控件。

## 文件导入流程

```mermaid
flowchart LR
    File[CSV 或 XLSX] --> Preview[解析与逐行校验]
    Preview --> Pending[保存 pending 批次]
    Pending --> Review[查看错误 警告 差异]
    Review --> Confirm[显式确认并重新校验引用与权限]
    Confirm --> Commit[事务写入 IR 与审计日志]
    Commit --> Done[confirmed 批次 applied 行]
```

预览只写临时批次，不参与指标计算。任何无效行阻止整批确认；确认时重新验证引用和写权限。新需求编号新增记录；匹配正式需求编号只补空字段，已有值包括 false 和 0 保留。确认异常回滚整批；已确认批次再次确认返回冲突。未匹配责任人是警告，不是阻断错误。

## Gateway 运行配置与就绪状态

管理员在 `/settings/gateway` 维护 AI 研发数据网关连接；`/settings/collections` 只显示 Gateway 状态摘要并链接到该页面。系统全局最多保存一个 Active 和一个 Draft。保存 Draft 不改变 Active；已有 Active 时 Token 留空表示沿用当前 Active Token，首次配置必须输入 Token。Token 按当前产品决策明文保存在 Radar 数据库，但 API、审计、CollectionRun、日志及浏览器初始化数据都不返回或记录 Token 值。生产 Gateway 地址必须使用 HTTPS。

激活 Draft 时 Radar 必须重新实时请求 readiness；只有服务标识正确、状态为 `ready` 且 SemVer 主版本兼容，才能替换 Active。先前检测成功不能替代这次检查。人工保存、检测、激活和放弃草稿写入 Gateway 配置审计；审计对 Token 只记录 `token_changed`。

Radar 只保留 Active 和 Draft 各自的最新健康观察，不建可用率历史。状态为 `UNCONFIGURED`、`UNKNOWN`、`CONNECTED`、`DEGRADED`、`UNREACHABLE`、`AUTH_FAILED`、`SERVICE_MISMATCH` 或 `PROTOCOL_INCOMPATIBLE`。认证、服务身份和协议错误一次生效；readiness 503 为 `DEGRADED`；网络连续失败 1–2 次为 `DEGRADED`，第 3 次为 `UNREACHABLE`。健康结果 90 秒后显示为过期；Radar 重启后先显示 `UNKNOWN` 和上次状态，直到即时检测完成。30 秒 Active 健康检查复用现有 APScheduler，周期检查不写审计。

## IR Gateway 采集

IR 采集由 Radar 按团队独立编排 AI 研发数据网关调用，但线协议不发送团队名称。Radar 根据团队版本配置与本地产品层级生成产品名称和版本名称组合；版本化能力协议是双方共同消费的实现中立事实源。Radar 负责调度、字段/层级校验、暂存、人工确认和审计，Gateway 负责内部平台认证、按产品版本组合查询和字段翻译。每个团队有独立运行结果和暂存批次，团队失败不会阻断其他团队；版本映射为空时跳过，Gateway 返回空结果时不创建空批次。

Gateway 同步返回最多 10000 行，窗口为带时区的半开区间 `[start_at, end_at)`。首版不分页、不异步轮询或自动重试；超限时管理员缩短窗口，失败按返回的 retryable 信息手动重跑。Radar 按产品名与版本名联合核对归属当前团队，再按该版本解析迭代名；响应超出请求产品版本范围时该行无效。Gateway 的 `business_module` 为 `null`、空字符串或纯空白时，Radar 在暂存前统一转换为 `通用模块`。任何无效行都阻止该团队批次整批确认。采集确认沿用导入的事务、只补空字段和 AI 字段来源记录，审计动作记为 `collector_confirm`。

每次 CollectionRun 开始时读取一次 Active 配置，生成不可变 `GatewayRuntimeConfig` 并供所有团队共用；运行记录可以保存配置 ID 和 base URL，不保存 Token。无 Active 时运行失败并在 CollectionRun 记录一条全局错误，不向每个团队重复写相同错误。最新且未过期的认证、服务身份或协议错误可以 fail-fast；`UNKNOWN`、过期、`DEGRADED` 和 `UNREACHABLE` 仍尝试实际 IR 请求，以允许刚恢复的 Gateway 继续采集。

调度按 `Asia/Shanghai` 配置为每小时、每日、每周或每月；IR 默认禁用。每小时、每日、每周和每月分别使用上一个完整小时、自然日、自然周和自然月。管理员可以不传窗口使用上一个完整配置周期，也可以手动指定带时区的合法窗口。

完整能力语义与线协议见 [AI 研发数据网关能力协议](../contracts/ai-dev-data-gateway/README.md)。Admin-only 管理 API 与配置审计不替代源数据审计。真实内部 Gateway 及 GDEMate、CodeHub、DTS 联调仍需部署环境另行验证；项目的 Mock Gateway E2E 只覆盖 L3。

## 指标与数据边界

源数据指标定义指定数据域、类型、分子/分母字段和筛选；只计算有效正式 IR，结果不落库。可支持渗透率、效率、数量和比率，不能把事实目录的布尔能力推断为 IR 计算也已支持。工作台与旧 FactRecord 看板保持两条链路，统一适配尚未实现。

组织删除存在引用保护，不是统一软删除机制；具体实体需核对接口。种子重建为破坏性操作，不属于日常维护。

## 实现与相关决策

HTTP 编排见 `backend/app/data_api.py` 和 `gateway_api.py`，采集运行见 `source_collection.py`，配置生命周期与 readiness 分别见 `gateway_config.py`、`gateway_health.py`；页面见 `frontend/src/dataManagement/` 和 `frontend/src/settings/`。Gateway 页面为 `/settings/gateway`，采集计划仍在 `/settings/collections`。规范前端入口为 `/data/requirements/{ir|ar|sr}`、`/data/maturity`、`/data/issues`、`/data/mr` 和 `/data/code-review`；旧 IR/AR/SR/DTS/MR 路径重定向到新分类。测试分层见 [Testing Standards](../standards/testing.md)。

相关决策：[ADR-0003](../adr/0003-source-data-first-metrics.md)、[ADR-0004](../adr/0004-staged-import-and-field-merge.md)、[ADR-0005](../adr/0005-team-owned-product-hierarchy.md)、[ADR-0007](../adr/0007-business-source-navigation.md)、[ADR-0009](../adr/0009-versioned-ai-engineering-data-gateway-protocol.md)、[ADR-0010](../adr/0010-database-managed-gateway-runtime.md)。详细实现见 [源数据模块](../architecture/modules/data-management.md)。
