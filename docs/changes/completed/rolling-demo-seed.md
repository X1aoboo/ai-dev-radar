# Rolling Demo Seed Coverage

## Status
Completed

## Background
现有事实停在 2026 年 8 月，成熟度无记录；页面默认查看当前月，造成已实现图表空白。

## Requirement
`npm run seed` 重建演示库后，已实现的事实、成熟度和 IR 数据视图在默认月份及近六个月有可展示数据。AR/SR、问题单、MR 与代码检视待定义页面不纳入。

## Current Behavior
见 [团队效能分析](../../business/analytics.md) 与 [当前架构](../../architecture/overview.md)。种子使用固定 2026 年周序列，只生成少量 IR，不生成成熟度。

## Target Behavior
以执行 seed 时的本地月份为锚，确定性地生成近六个月的全部团队、活动和指标演示数据；保留负效率与实际投入为零的样例。新月份需重新运行 seed。

## Design
在现有 `backend/app/seed.py` 内注入基准日期，生成覆盖六个月的迭代和每个迭代唯一的关键活动事实、通用能力时间事实、独立成熟度评估和 IR 源记录。`npm run seed` 从项目根目录运行 Python 模块，使默认 SQLite 指向与开发服务相同的文件。维持清空再插入及一次事务提交。

## Business Impact
默认月与近六个月的既有图表可展示演示值；演示成熟度为独立模拟判断，不由事实指标推导。

## Architecture Impact
仅调整种子数据生成；既有 FactRecord、MaturityRecord、IR 与计算链路保持独立。

## API / Contract Changes
NONE；现有 API 和客户端查询不变。

## Data Changes
仅改变重建后的演示记录及时间分布；模型与迁移不变。

## Compatibility
`npm run seed` 继续是破坏性重建命令。测试仅用隔离 SQLite；不运行于开发库。

## Error & Boundary Handling
跨年窗口、月初当前日期、零实际投入、负效率和布尔状态需要覆盖。关键活动同一团队、指标、迭代只写一条有效事实。

## Risks & Trade-offs
演示版本与迭代随窗口滚动，不适合依赖固定 ID 或旧日期的外部脚本；月度窗口移动后重跑会替换先前记录。

## Test Strategy
验证跨年、幂等、默认月及六个月的计算结果、周/日与迭代查询、成熟度聚合、IR 指标，并运行相关前后端测试及文档检查。

## Documentation Impact
- Business Design: UPDATE `docs/business/analytics.md` — 说明演示事实与独立成熟度的覆盖。
- Architecture: UPDATE `docs/architecture/overview.md` — 说明滚动种子和写入范围。
- Standards: NONE — 现有测试、数据规则适用。
- ADR: NONE — 不改变已接受决策。
- Change Design: CREATE 本记录，完成后归档并更新索引。

## Validation
2026-09-24：后端测试 143 passed；前端单元/路由测试 46 + 89 passed；`npm run check:docs` 与 `npm run test:docs` 通过。隔离 SQLite 上执行 `npm run seed -- --db ...` 成功。测试验证全部目录指标的六个月结果、当前日/周、版本/迭代、布尔状态、六个月成熟度、IR 计算、跨年和幂等。未在真实开发库或真实 Gateway 上执行；本变更无需这些写入。

后续现场纠正：截图、服务进程文件句柄与只读检查确认开发服务读取根目录 `ai-dev-radar.db`，旧命令却写入 `backend/ai-dev-radar.db`。根目录库只含旧种子事实和演示账号，无人工事实、IR、产品或成熟度。修正 npm 工作目录后，先用 SQLite backup 备份根目录旧演示库，再对该库运行 `npm run seed`。重建后只读核对得到 4 产品、8 成员、12 条 IR、360 条成熟度记录和当前月事实。FastAPI 同库只读请求确认登录、产品、成员、IR、成熟度和六个月事实查询均返回 200 且有数据。Chrome 实际页面确认总览当前月覆盖 29/29、成熟度覆盖 32/32 与 28/28、IR 表 12 条、团队成员每组 2 人、产品列表 4 个。原先“无需真实开发库写入”的验证边界已失效，以本次纠正结果为准。
