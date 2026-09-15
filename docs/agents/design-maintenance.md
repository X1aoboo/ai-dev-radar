# Design Maintenance Protocol

## Read and Verify

每个新任务先读 AGENTS 和 `docs/index.md`，按导航读相关业务、架构、规范、CONTEXT 和 ADR，再核对关键实现。文档与代码冲突时记录差异，判断设计偏离还是文档过期，根据明确需求确定最终状态并同步修正。

项目只采用本协议及其导航的设计维护机制，AGENTS 保存规则入口，CLAUDE 指向同一入口。后续需求不再使用 `.scratch` ticket、分诊标签或旧技能流程；历史 `.scratch` 内容仅用于追溯，中大型变更按 Change Design 记录。

本项目为单上下文，领域术语统一使用根 CONTEXT 的定义，包括需求、设计、代码讨论和最终报告。缺少术语时先核对是否已有等价概念；确需新概念时澄清定义并更新 CONTEXT。涉及既有 ADR 的冲突必须明确指出编号、冲突内容和重新决策原因，按 ADR 协议处理，不能静默覆盖。

## Analyze Before Implementation

明确现状、目标、业务/架构/契约/数据影响、兼容及风险，并按 [Change Design](../changes/README.md) 分类。每次 Plan 必须包含以下评估；无需完整计划的小改动也必须在实施前评估：

```markdown
## Documentation Impact

- Business Design: UPDATE / CREATE / NONE — 路径及原因
- Architecture: UPDATE / CREATE / NONE — 路径及原因
- Standards: UPDATE / CREATE / NONE — 路径及原因
- ADR: CREATE / SUPERSEDE / NONE — 决策及原因
- Change Design: CREATE / UPDATE / NONE — 规模及记录路径
```

medium/large 在编码前写 active Change Design，足以指导实现；方案变化先修正设计。重要长期决策按 [ADR Protocol](../adr/README.md) 评估，记录原因与取舍。

## Update Resulting Design

实现及验证后重新评估影响，直接更新 business/architecture 正文，使其描述完整最终状态。历史留在 Git、Change Design、ADR。仅格式、拼写、测试补充或不改变行为与设计语义的内部改动通常无需正文更新；外部行为、业务规则、契约、数据模型、模块职责、依赖、部署及非功能约束变化需要更新相关设计。

新增设计文档必须从 index 直接或通过分区索引可达。CONTEXT 保持术语事实源，glossary 仅导航。新决策 supersede 旧 ADR，旧接受记录的决策正文不静默改写。

## Completion Gate

任务完成前确认实现完成、相关检查通过、影响复核、当前设计准确、所需 ADR 处理、Change Design 最终化并移入 completed、导航有效及实现/设计语义一致。运行 `npm run check:docs`；静态结果不替代语义核对。

最终报告给出 Documentation：更新文件、ADR（或 None）、completed Change Design（或 None）、验证及未验证边界。无需更新时明确写 `Documentation Impact: None` 和理由。未完成必需验证时不能把对应步骤标为完成。
