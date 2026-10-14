# 清理临时 UX 验收材料与运行产物依赖

## Status
Active

## Background
四页用户评审文档和 `e2e-results` 中的截图、几何及日志属于一次性验收产物；部分正式文档链接到被 Git 忽略的运行结果，导致清理后文档链接失效。已批准 Reference、UX 规格和可复用的几何/交互基线是版本管理的测试/设计输入，应保留。

## Requirement
删除所有 `four-page-user-review-*` 临时评审文档及本地 `e2e-results` 运行结果。保留 `docs/ux` 中的 UX 规格、已批准 Reference、reference-crops 和机器可读验收基线。正式文档不得依赖运行结果目录；测试输入继续使用受版本管理的固定 Reference。

## Current Behavior
当前设计依据为根目录 `DESIGN.md`、`UX-CONTRACT.md` 及 `docs/business/`、`docs/architecture/`。视觉 E2E 直接引用受版本管理的 `docs/ux/reference-crops/` 图片；四页评审记录和部分变更记录引用忽略的 `e2e-results` 运行文件。

## Target Behavior
删除 `four-page-user-review-*` 文档和本地 `e2e-results` 内容。保留 UX 规格、Reference 和视觉验收基线。正式文档不链接到 `e2e-results` 中的具体文件；本地该目录继续作为可再生的 Git 忽略输出目录。

## Design
清理 Change Design 和索引中指向运行结果的具体链接；从 `overview-visual` 输出证据中移除旧用户截图路径元数据；删除四页临时评审文档但保留其用户确认结论于已完成 Change Design；更新测试规范，明确运行产物可删除，固定 Reference 另行管理。

## Business Impact
NONE — 不改变业务、数据语义或用户可见行为。

## Architecture Impact
NONE — 不改变应用模块、API、存储或部署。

## API / Contract Changes
NONE。

## Data Changes
NONE。

## Compatibility
保留视觉 E2E 的固定参考图输入；历史运行截图不再作为正式文档可访问资产。

## Error & Boundary Handling
`e2e-results` 作为临时输出目录仍由测试运行时创建；文档校验不得要求其存在。

## Risks & Trade-offs
删除本机历史截图后无法从该目录恢复；已确认结果摘要保留在 Change Design 历史记录中。需要视觉回归时重新运行 E2E 生成新输出。

## Test Strategy
运行 `npm run check:docs`，核对正式文档无 `e2e-results` 文件链接，并验证保留的固定 Reference 路径存在。

## Documentation Impact
- Business Design: NONE — 业务定义不变。
- Architecture: NONE — 运行架构不变。
- Standards: UPDATE `docs/standards/testing.md`，说明运行结果可清理且正式文档不得引用，测试固定输入需受版本管理。
- ADR: NONE — 无长期架构决策改变。
- Change Design: CREATE 本记录并于验证后移至 `docs/changes/completed/`。

## Validation
`npm run check:docs` passed. Verified there are no Markdown links to `e2e-results` or the deleted review packages, and the machine-readable baseline contains no per-run output paths. The three `four-page-user-review-*` files were removed. Recursive removal of the exact `H:\projects\ai-dev-radar\e2e-results` path was rejected by the execution policy; the directory remains with 41,298 files, 6,314 subdirectories, and 10.87 GB. This Change Design remains Active until that local cleanup is completed.
