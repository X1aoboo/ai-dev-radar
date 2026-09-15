# 统一项目设计资产维护机制

## Status

Completed

## Background

新的设计维护协议已经建立，但 AGENTS/CLAUDE 及导航仍保留旧 matt 项目协议。用户明确要求只保留新机制，后续不再采用本地 ticket、标签映射或 wayfinder 流程。

## Requirement

清理项目级旧规则及其入口，保留领域知识、ADR、历史需求与已归档变更。不卸载全局插件、不改应用行为、不提交或推送。

## Current Behavior

AGENTS 并列保存旧 Agent skills 和新维护协议，CLAUDE 仅有旧入口；旧协议位于 `docs/agents/issue-tracker.md`、`triage-labels.md`、`domain.md`。索引和工程规范仍引用它们。

## Target Behavior

AGENTS → docs/index → 相关设计与新维护协议是唯一项目流程。CLAUDE 指向同一入口。新中大型变更使用 Change Design，历史 `.scratch` 仅用于追溯。

## Design

先核对旧协议，将术语一致和 ADR 冲突处理要求整合进 design-maintenance。移除旧入口和三份协议，更新索引、工程规范及盘点。历史记录中的旧协议路径保留为普通文本而非失效链接，不重写当时决定。

## Business Impact

NONE；业务能力不变。

## Architecture Impact

NONE；运行结构不变。

## API / Contract Changes

NONE；没有应用接口变化。

## Data Changes

NONE；保留 CONTEXT、既有 ADR、历史 .scratch 和完成记录，不迁移业务数据。

## Compatibility

全局插件保持安装状态，但项目协议不依赖其技能。历史名称可继续出现在追溯材料中，不能作为当前规则入口。

## Error & Boundary Handling

删除协议后清理所有有效文档中的链接；CLAUDE 不复制另一套维护规则。既有未提交的前端及其他变更保持原样。

## Risks & Trade-offs

旧 ticket 不再驱动后续流程；历史状态不批量迁移。静态检查不证明新 Codex 会话一定遵循协议，不将本次清理当成独立会话验收。

## Test Strategy

全仓文本检索确认旧依赖只存在于历史说明；核对三份旧协议删除、CLAUDE 导航及保留资产。运行 check:docs、test:docs 和 git diff --check，无悬空链接。

## Documentation Impact

- Business Design：NONE，能力不变。
- Architecture：NONE，运行关系不变。
- Standards：UPDATE engineering 和 design-maintenance，移除旧流程依赖。
- ADR：NONE，无需新架构决策。
- Change Design：CREATE 本记录，验证后归档。
- Navigation：UPDATE AGENTS、CLAUDE、docs/index、盘点及变更目录索引。

## Validation

- `npm run check:docs` 和 `npm run test:docs` 通过，链接及记录格式有效。
- 全仓 Markdown 检索确认旧协议入口已清理；旧名称仅保留在盘点和本记录的历史说明中。
- AGENTS 仅有新设计维护规则；CLAUDE 指向 AGENTS 和 docs/index；术语与 ADR 冲突处理已并入新协议。
- 三份旧协议删除，CONTEXT、既有 ADR、历史 .scratch 及之前完成记录保持原样，应用文件未因本次清理修改。
- `git diff --check` 通过。本次仅文档变更，不重复运行应用测试、不提交或推送；未进行全新 Codex 会话独立验收。
