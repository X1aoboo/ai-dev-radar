# ai-dev-radar

## Project Design Knowledge

设计或实现前必须读取 `docs/index.md`，再加载相关业务、架构、规范和 ADR，核对关键代码。`docs/` 保存设计意图与结构，代码保存实现事实；冲突应依据需求与证据解决。AGENTS 只保存规则和导航，详细流程见 `docs/agents/design-maintenance.md`。

### Documentation Impact

每次代码改动实施前及结束前都评估 Business、Architecture、Standards、ADR、Change Design 的影响。每次 Plan 必须给出各项操作、路径和原因；无设计事实变化时允许不改文档，最终明确 `Documentation Impact: None` 与理由。

### Current-State Documentation

`docs/business/` 和 `docs/architecture/` 描述完整当前状态，行为改变时更新正文；历史由 Git、Change Design 和 ADR 保存。新增设计文档同步维护 `docs/index.md` 的导航。

### Change Design

按 `docs/changes/README.md` 分类，medium/large 必须编码前创建 active 记录。实现中方案改变先修正设计；验证及当前文档同步后最终化并移至 completed。

### Architecture Decisions

重要长期决策按 `docs/adr/README.md` 记录原因和取舍。改变 Accepted 决策以新 ADR supersede，保留历史正文；ADR 不替代当前架构。

### Completion Gate

设计事实变化的任务只有在实现完成、相关验证通过、当前设计同步、所需 ADR 处理、Change Design 完成、导航有效及代码/设计一致后才完成。运行 `npm run check:docs`，并人工核对语义。最终报告列出 Documentation 更新、ADR、Change Design 和验证边界。
