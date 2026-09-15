# 团队效能分析与成熟度

## 目标和边界

比较多个团队的 AI 研发效能、活动成熟度和短板，提供总览、团队下钻及指标详情。覆盖关键研发活动和通用研发能力；成熟度为人工判断，不是指标推导。当前看板仍基于 FactRecord，不能将 IR 工作台的更新描述为已自动影响看板。

## 核心场景

总览默认展示当前月成熟度，可切换活动类别、领域视角或团队矩阵。指标比较区默认收起，展开后支持事实指标比较。团队下钻查看团队趋势；指标详情按目录类型展示率、数量柱图或布尔状态。团队、版本、迭代、时间粒度与时间字段影响对应事实查询；通用研发能力不支持迭代维度。

## 指标规则

- 每个逻辑键优先最新人工事实，否则取最新自动事实；同时间按 ID 决定顺序。关键活动键为团队/指标/迭代，纯时间键为团队/指标/开始与结束日期。
- 周/月按选定开始或结束日期归属，日期采用 Asia/Shanghai；迭代按标签归属，不按日期重新分配。
- 渗透率/比率为合计分子除以合计分母，分母非正返回空值。数量为合计分子。效率为 `(合计预估 - 合计实际) / 合计实际`；实际非正时使用 0.5 人天，二者均为 0 时返回空值。
- `company_average` 保留各非空团队指标值的算术平均；`domain_summary` 合并团队原始数再计算，二者不能混用。
- 布尔指标使用最近有效状态，空值不当作 false；不生成全公司均值趋势。数量柱图仅用于指标详情。

## 成熟度规则与生命周期

记录唯一粒度是团队/活动/评估月。分值 0–5，最多两位小数；保存规范化十进制字符串，使用 Decimal 计算。团队等级为 floor；领域按已评估团队等权平均后 floor，展示四舍五入不影响等级。未评估不等于 0，部分评估需要保留覆盖信息。

新月份不自动继承。维护者可显式预览并复制上月，确认后保存；清空删除对应月记录，恢复未评估。admin 可维护全部团队，maintainer 仅绑定团队，viewer 只读；后端再次校验权限。

## 数据与实现映射

目录 Activity/Metric、FactRecord、Team、ProductVersion/Iteration 支持事实查询；MaturityRecord 独立支持评估。

| 行为 | 实现 | 验证入口 |
|---|---|---|
| 事实计算 | `backend/app/compute.py`、`api.py` `/api/compute` | `test_compute.py`、`test_compute_api.py` |
| 成熟度 | `backend/app/maturity.py`、`api.py` `/api/maturity/*` | `test_maturity.py` |
| 页面 | `frontend/src/overview/`、`drilldown/`、`metricDetail/` | 对应逻辑及渲染测试 |

相关决策：[ADR-0001](../adr/0001-store-raw-counts-compute-rates-in-dashboard.md)、[ADR-0006](../adr/0006-monthly-maturity-assessment.md)。
