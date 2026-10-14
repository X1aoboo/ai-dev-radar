# 团队效能分析与成熟度

## 目标和边界

比较多个团队的 AI 研发效能、活动成熟度和短板，提供总览、团队下钻及指标详情。覆盖关键研发活动和通用研发能力；成熟度为人工判断，不是指标推导。研发总览当前的四项全局 KPI、趋势与团队汇总使用临时 IR 需求映射；关键研发活动明细、研发活动页和研发能力页仍基于 FactRecord。IR 变更只影响这组总览临时指标，不会自动替换其他 FactRecord 看板。

## 核心场景

Overview 生命周期小卡片暂不展示代码检视、`dta`（DTS缺陷分析）和 `dtf`（DTS缺陷修复）；它们仍保留在目录、成熟度和适用的专项 FactRecord 页面中。`MR代码检视`属于通用研发能力，其成熟度仅在通用能力模式显示，不并入关键活动矩阵。

洞察拆为三个同级入口：`/` 研发总览面向管理者按“分析筛选 → 月度核心成效 → 周期整体成效 → 核心趋势与研发关键环节并排 → 成熟度矩阵与领域画像、团队表现”阅读。月度和周期各有四张全局 KPI 卡，名称为 AI需求渗透率、AI研发提效、AI覆盖需求数、AI提效工作量；当前数值暂由 IR 需求数据计算，具体临时映射见下文。它们不与活动目录指标互相替代，也不构造综合分。总览研发关键环节固定展示 SA设计、SE设计、开发设计、编码开发、测试用例生成、测试用例执行六张活动卡；不以“需求/测试 + 来源”代替活动真实名称，不追加 DTS 或代码检视。MR代码检视仍是研发能力页中的独立通用能力；DTS 活动继续保留在目录、成熟度和适用的专项页面。六张总览环节卡直接显示目录真实名称，卡片与趋势说明保留来源指标名；目录缺少对应渗透率或提效指标时显示缺失，不跨指标、跨目录填充。总览环节槽位不跨指标或跨目录映射；`dta`/`dtf` 只从总览生命周期隐藏。总览环节卡片还显示所选月相对前月的变化；比例和提效变化以 pp（百分点）表示，缺少比较周期时显示缺失。当前没有业务 Target 或外部行业基准，因此不展示目标达成或外部基准结论。总览非 KPI 模块将说明文字放在模块卡片内；核心趋势与关键环节卡片同排对齐，关键环节活动小卡与两张趋势图同属一张卡，成熟度矩阵与领域画像同属一张卡，团队表现矩阵与选中团队趋势同属一张卡。成熟度矩阵下方区分有效 `0.0` 和 `1.0–5.0` 热力色阶；团队表现每项 KPI 分列展示指标值和变化。`/analytics/activities` 保留八项关键活动的垂直目录；上方所选活动只决定该活动的月度/周期 KPI 和两项同指标 FactRecord 趋势，分子分母、团队事实与 `company_average` 仍限于当前活动，不跨活动平均。下方 Team Difference、IR 覆盖拆解、AI提效工作量趋势和原始指标摘要属于页面级整体汇总，不受活动、活动指标或单周期选择影响，只跟随页面月份/统计周期。Team Difference 复用四项已有全局 IR KPI 及其 per-team 事实，并按各自指标口径比较；IR 拆解按 AI 辅助、已维护但未使用 AI、AI 属性未知三个计数分组；工作量趋势按月显示全局 IR `AI提效工作量`，同比为当前月/去年同月减一。缺少去年同期、去年同期小于等于零或缺少月份时同比点留空。原始指标摘要固定展示用户指定的六项：AI覆盖IR需求数取现有全局 IR count 映射，测试用例生成数取 `tcg-rate` 的 AI生成用例数分子，测试用例执行数取 `tce-count`；AI覆盖AR需求数、SE设计文档生成数、开发详细设计生成数目前无同名、无重复口径的 count source，保留显式缺失，不把 AR 渗透率分子相加、不借用其他指标。`/analytics/capabilities` 使用能力结构目录选择单项通用研发能力，按目录指标类型展示当前状态、演进、团队差异、证据和独立成熟度。

页面内容区的 PageHeader 负责标题和描述。Dashboard/Analytics 使用流式内容画布及响应式 gutter；Operational 保留表格/操作密度，Readable 用于可读宽度受限的表单。主文档负责 Analytics 纵向滚动；活动与能力目录固定在内容左侧并只管理当前选择，不创建嵌套纵向滚动区。活动页“分析筛选”保留时间粒度、指标和事实周期；统计维度固定为时间，粒度、周期和所选指标写入 URL。旧 `dimension=iteration` 和 `version` URL 状态会被忽略并移除，不提供跨团队版本/迭代筛选，时间事实仍覆盖各版本。总览仅将 `month` 和 `cycle` 写入 URL；`month` 锚定 IR 与 FactRecord 时间窗口并选择成熟度自然月，周期选项为近六个月、本半年度、年度累计，所有窗口截至用户选定月份。总览月度和周期 KPI 使用临时 IR 映射的域汇总值；总览趋势、团队矩阵和团队预览以有值团队的等权均值作为“全公司均值”。其中渗透率/效率由所选范围内的 IR 原始合计重算，数量显示需求数或人天，不跨团队求和后误称团队平均。关键活动明细继续使用同指标 FactRecord 序列及 `company_average`，成熟度仍按所选自然月独立计算。总览不按版本筛选，旧 `version` URL 参数不得形成不可见过滤。通用研发能力没有版本范围。Team Detail 的版本候选限于当前团队所属产品。能力页原始指标的粒度控制也位于“分析筛选”工具栏中；成熟度写入迁移到数据管理下的 `/data/maturity`。

活动页的上方目录只选择当前八项关键研发活动，所选活动仅驱动其同类型 FactRecord 的 KPI 与两项趋势；不跨活动计算率/效率平均。下方页面级汇总使用现有全局 IR 数据与固定 raw-summary slots，活动选择/活动指标/活动周期不改变这些值或请求；月份与统计周期改变时下方整体汇总同步更新。IR AI 覆盖拆解保留已辅助、已知未辅助、AI 属性未知三类；原始指标摘要缺少目录定义时保留缺失，不补零或借用其他类型。`company_average` 与 `domain_summary` 仍分别表示有效团队均值和合并原始量，不能互换。通用研发能力按目录实际类型显示：数值类指标保留各自单位与事实，布尔能力逐团队显示已具备/不具备/未知状态，不渲染不存在的 0/1 趋势。所选能力只驱动当前能力的状态、已定义指标、趋势、团队差异和证据；成熟度画像是独立的七项通用能力整体评估，不随目录选择变化，也不推导跨能力总分。选定月份没有事实时显示明确空状态，不回退到其他月份；趋势窗口缺失保留断点，不补零。MR代码检视的业务公式于 2026-10-14 获批：`AI有效检视数` 是 `ai_effective=true` 的 AI 检视意见数；`AI检视有效率` 是有效 AI 检视意见数 ÷ AI 检视意见总数，分母为零时缺失。趋势由意见日期按页面所选时间粒度聚合。有效率以 0–1 比率计算并按百分比展示；数量以条数展示。新增 `mrr-effective-count` / `mrr-effective-rate` 指标保持独立，既有 `mrr-count` / `mrr-rate` 语义不变。意见源只保存稳定 source_id、team_id、意见日期和布尔有效性；本地 API 尚未接入真实代码托管平台。

总览核心趋势在四项临时全局 KPI 间切换，展示 IR 团队序列与有值团队等权计算的 `全公司均值`；当前月无 IR 记录时保留历史曲线，并明确显示所选月缺数。关键活动区从实际目录选择一项活动；其两项阶段槽位分别读取活动内 `type=penetration` 与 `type=efficiency` 的 FactRecord 指标，图表说明显示原指标名，缺少匹配指标或事实时保留缺失。选中后，两项指标各自以团队序列和 `company_average` 并排演进，不把不同单位合成阶段分数。团队表现矩阵按四项临时全局 KPI 分组，每组并列指标值与变化，可在本月与统计周期期间切换。本月变化为当前团队值减前月值；统计周期变化沿用 KPI 周期语义：数量/工作量显示当月贡献，比例/提效显示当前累计值减去加入当月前的累计值。缺少比较输入时保留缺失；全公司均值的变化基于矩阵显示的等权团队均值计算。选中团队后预览该团队的 IR 渗透率、效率趋势，并可进入现有 Team Drill-down。成熟度区按关键活动或通用能力切换，分别显示团队矩阵和本期、上期领域平均雷达；未评估仍为空值。成熟度与团队表现使用并列区域呈现。成熟度矩阵下方补充热力色阶：有效 0.0 使用独立中性色块，1.0–5.0 使用与矩阵一致的等级颜色。

完整团队×能力点矩阵默认收起，展开后包含成熟度领域平均行；桌面固定团队列，移动端保留局部横向滚动提示。活动页按时间筛选，时间事实跨版本/迭代纳入；页面不提供跨团队版本/迭代筛选。时间粒度为月/周/日，周期可选全部或单周期，指标可切换为全部或单项；时间窗口分别为近六个月、近十二周、近三十天，成熟度始终按独立的自然月。通用研发能力原始指标可切换月/周/日，成熟度仍固定按自然月；布尔能力使用团队状态列表，不绘制 0/1 折线或全公司均值。Team Drill-down 以“整体表现 → 研发关键环节 → 成熟度画像”组织单页故事线，并提供 sticky 锚点导航。整体表现的月度与周期两行均展示四项临时全局 IR KPI（AI需求渗透率、AI研发提效、AI覆盖需求数、AI提效工作量），主值取当前团队的 IR 汇总，未选版本时领域比较取有值团队的等权均值；选中版本时当前团队值按版本过滤，领域参照取同时间范围、同指标、所有团队且不限版本的既有等权均值；界面明确标注两个范围，只展示当前团队与参照差异，不称同版本排名。率/效率周期值按原始量重算，数量/工作量周期值为所选周期累计，变化显示当月贡献，不生成跨 KPI 综合值。月份、统计周期和版本位于页面顶部的全局筛选；核心趋势显示当前团队的 IR 需求渗透率与 AI 研发提效，并以同指标领域均值作基准。研发关键环节仍读 FactRecord，每个关键活动固定展示 `penetration` 与 `efficiency` 类型两个槽位，来源指标名保留在说明中；缺失类型不由其他类型替代，真实 DTS 活动仍在团队页展示。团队效率趋势超出图轴 ±100% 时只钳制绘制点，tooltip 保留原始值与比较信息。成熟度画像分别覆盖关键活动和通用能力；矩阵/雷达比较团队本期、团队上期与领域本期平均，团队记录取所选自然月的前后两个月，未评估分值保持为空，0 分保留为有效值。指标详情按 Result → Comparison → Evidence 展示：当前全公司均值、同指标趋势与单指标团队排名/状态，以及按需展开的当前周期原始事实。量化详情分列 `company_average` 与 `domain_summary` 的结果、原始分子/分母；前者为团队结果算术平均，后者合并原始量后重算，不互相替代。目录类型仍决定率、数量或布尔展示。团队、版本、迭代、时间粒度与时间字段影响对应事实查询；通用研发能力不支持迭代维度。

图表按分析任务而非指标存储类型选择：时间演进优先折线，单周期团队排名使用单指标排序，布尔能力使用状态列表；数量指标不因类型被强制改为柱状趋势。

## 指标规则

- 每个逻辑键优先最新人工事实，否则取最新自动事实；同时间按 ID 决定顺序。关键活动键为团队/指标/迭代，纯时间键为团队/指标/开始与结束日期。
- 日/周/月按选定开始或结束日期归属，日期采用 Asia/Shanghai；迭代按标签归属，不按日期重新分配。日周期是自然日，空档保留为空周期。
- 渗透率/比率为合计分子除以合计分母，分母非正返回空值。数量为合计分子。效率为 `(合计预估 - 合计实际) / 合计实际`；实际非正时使用 0.5 人天，二者均为 0 时返回空值。
- `company_average` 保留各非空团队指标值的算术平均；`domain_summary` 合并团队原始数再计算，二者不能混用。
- `/api/compute` 每个团队/周期事实点提供 `fact_count`；无事实的数量点保持缺失，已记录的数量事实 0 保持为 0。`company_average` 只平均该周期有事实且结果有效的团队。
- 研发能力页团队差异中的团队名称可进入对应的 Team Drill-down；导航保留当前 URL 中的分析状态并携带来源，Team Detail 入口在侧栏与面包屑中保持明确，返回按钮回到来源页面。直接打开 Team Drill-down 时默认返回总览；新页面从顶部开始。
- Activity 页工作量趋势使用现有全局 IR `AI提效工作量` 原始汇总；柱表示当月预估减实际人天合计，蓝色为柱色。同比线逐月比较去年同月：`(本月工作量 / 去年同月工作量) - 1`；去年值缺失或非正时保留空点，不以零或其他周期替代。数据定义来自既有 IR 工作量映射，不创建 FactRecord 效率综合指标。
- 研发能力页状态区只显示所选能力目录中已定义的指标。FactRecord 数量使用 `domain_summary` 合并总量，比例/效率/渗透率使用同指标 `company_average`；变化与迷你趋势跟随卡片使用的同一序列，证据表继续分列团队均值、合并结果、原始量、事实覆盖和同指标趋势。团队差异使用各指标独立的相对热力色阶，缺失值无色；色阶只表达同列数值大小，不表示质量或绩效好坏。MR代码检视有效意见指标读取本地 AIReviewOpinion 源记录；数量按有效意见数合并，率按各团队比例等权展示，零分母缺失。意见日期按页面时间粒度分组；真实平台采集仍未实现。
- 研发能力成熟度画像使用现有七项通用研发能力作为矩阵维度，按团队展示所选月评分，并用当前/上期领域平均作雷达对比。该整体画像不随能力目录选择变化；每队/能力/月只有一项分值，不推导子维度、不跨能力求总分或补零。能力页统计范围是所选粒度的最新单期快照及近六个月/十二周/三十天趋势；版本筛选不适用，因为通用能力没有迭代归属。
- FactRecord 活动趋势使用同指标 `company_average`；总览临时 IR 卡片使用 `domain_summary` 汇总值，总览趋势和团队表使用 IR 团队序列及有值团队的等权均值。缺少 AI 属性或所需工作量字段时保留空值。
- 未设置单周期的布尔能力当前状态使用最近有效 `snapshot`；明确选择单周期的布尔详情读取该周期 `series.values`。缺失保持未知、不当作 false，也不回退到其他周期；布尔指标不生成全公司均值趋势。数量柱图仅用于指标详情。

Overview 选定单个研发关键活动后，两张 FactRecord 趋势使用该活动同指标、各有事实团队值的等权算术平均作为基准，界面名为“领域平均”。该值对应 `/api/compute` 的 `company_average`；`domain_summary` 是合并原始分子/分母后重算的结果，不用于这两张领域趋势图。缺少团队事实的周期仍为空，不补零。

## 研发总览临时 IR KPI 映射

四个全局 KPI 标签已确认，当前首版数值使用 IR 需求数据；数据源和公式均为临时映射，可在后续业务定义确认后调整，不构成长期统一公式：

- AI需求渗透率：AI 辅助为真的 IR 数 ÷ AI 属性已明确为真或假的 IR 数。未知 AI 属性不进入分母。
- AI研发提效：完整记录 AI 辅助 IR 的预估与实际人天分别合计后，按 `(预估合计 − 实际合计) ÷ 实际合计` 计算；实际值非正时沿用 0.5 人天分母回退，预估和实际均为 0 时结果缺失。
- AI覆盖需求数：AI 属性为真的 IR 数。存在已知 AI 属性但没有 AI 辅助需求时结果为 0；全无已知属性时结果缺失。
- AI提效工作量：仅对 AI 辅助且预估、实际工作量字段完整的 IR 汇总 `预估 − 实际`，单位为人天。已知无 AI 辅助需求时结果为 0；未知 AI 属性或所需工作量缺失时不补零。

月度与周期卡片采用 IR 原始记录合计口径；趋势和团队矩阵中的“全公司均值”按有值团队等权。总工作量字段已经代表总值，不再重复累加 SA/SE 分项；临时 IR KPI 不推导 AR、SR 或其他活动结果。

Team Drill-down 未选版本时，IR KPI 与趋势基准使用相同的有值团队等权口径，界面标为“有数据团队等权均值”；选中具体版本时，当前团队数据按版本过滤，参照仍按相同时间范围、相同指标、所有团队且不限版本计算，并分别标明两类数据范围。时间趋势直接对照同粒度的版本化团队结果和无版本领域均值；迭代趋势以所选迭代的起止日期（含首尾）切取无版本日事实，按既有指标公式先在团队内汇总，再对有有效结果的团队等权平均。参照不使用其他团队的版本排名。FactRecord 环节趋势未选具体版本时仅在有事实团队中等权，标为“有事实团队等权均值”。只有一支团队有 IR 值时，提示多团队对照不可用；缺失团队仍为空值。版本筛选不得改变用户选定时间范围；无匹配事实保持缺失。

## 成熟度规则与生命周期

记录唯一粒度是团队/活动/评估月。分值 0–5，最多两位小数；保存规范化十进制字符串，使用 Decimal 计算。团队等级为 floor；领域按已评估团队等权平均后 floor，展示四舍五入不影响等级。未评估不等于 0，部分评估需要保留覆盖信息。

新月份不自动继承。维护者可显式预览并复制上月，确认后保存；清空删除对应月记录，恢复未评估。admin 可维护全部团队，maintainer 仅绑定团队，viewer 只读；后端再次校验权限。

## 数据与实现映射

目录 Activity/Metric、FactRecord、Team、ProductVersion/Iteration 支持事实查询；MaturityRecord 独立支持评估。

本地演示种子按执行时的 Asia/Shanghai 当前月生成近六个月事实与独立的成熟度模拟评估，覆盖四个团队及目录中全部活动和指标；当前月的事实落在执行当天。演示评估只用于界面预览，不由事实指标推导，也不改变正式评估的人工维护规则。跨入新月份后须重跑种子才覆盖新的默认月份；该命令会重建业务数据。

| 行为 | 实现 | 验证入口 |
|---|---|---|
| 研发总览临时 IR KPI | `backend/app/data_api.py` `/api/data-metrics/overview`、`data_management.py`，`frontend/src/overview/irKpiData.js` | `test_data_management.py`、`irKpiData.test.js`、Overview 浏览器证据 |
| 事实计算 | `backend/app/compute.py`、`api.py` `/api/compute` | `test_compute.py`、`test_compute_api.py` |
| 成熟度 | `backend/app/maturity.py`、`api.py` `/api/maturity/*` | `test_maturity.py` |
| 页面 | `frontend/src/analytics/`、`overview/`、`drilldown/`、`metricDetail/`、`dataManagement/` | 对应逻辑及渲染测试 |

相关决策：[ADR-0001](../adr/0001-store-raw-counts-compute-rates-in-dashboard.md)、[ADR-0006](../adr/0006-monthly-maturity-assessment.md)。

### Activity selection and monthly raw-summary behavior

The Activity page commits a new directory selection only after the new Activity's metric requests settle. During the request, its previous upper workspace remains visible with a pending announcement; title, selected item, KPI rows and trends switch together. Failure uses the selected Activity's own error state. Page-wide lower summaries are independent of Activity selection: Team Difference and coverage breakdown follow the selected statistics cycle, while the raw metric summary follows only the selected month. The raw summary has six fixed source slots and columns `本月数值`, `上月数值`, `环比变化`, `趋势`. For configured count sources, month-over-month change is current minus previous only when both points have facts; the trend uses the same source over six months and leaves missing periods blank. Existing unconfigured AR coverage, SE document and detailed-design slots remain missing.

Activity raw-summary presentation: keep metric provenance on each row's accessible name and title; the visible data columns remain exactly `本月数值`、`上月数值`、`环比变化`、`趋势` in addition to the metric-name column. The six rows retain equal geometry for full, partial, empty, loading and error states.
