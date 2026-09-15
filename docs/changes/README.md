# Change Design

## Classification

Small：通常单模块、局部、低风险，不改变公共 API、持久模型、业务边界或架构，无需独立记录。Medium：完整功能、重要流程、接口/模型变化、多组件或明显兼容/异常设计，必须记录。Large：跨模块/服务、新子系统、架构调整或大迁移，必须记录并明确架构影响、ADR 评估和当前设计更新范围。

规模取决于实际影响，不按代码行数分类。Change Design 描述一次变化，不能替代当前设计。

## Lifecycle

编码前创建 `active/<change-name>.md`，Status 为 Active；方案变化先更新记录。验证通过、受影响当前设计与索引同步、ADR 处理后，补最终结果与验证，将 Status 改为 Completed，移动到 completed 并更新两个目录索引。未完成的范围须明确说明，不能借归档隐藏未完成需求。

入口：[Active](active/README.md)、[Completed](completed/README.md)。目录 README 是导航，不是变更记录。

## Template

```markdown
# Change Title

## Status
Active

## Background
为什么变化。

## Requirement
目标、范围、约束。

## Current Behavior
链接已有当前设计。

## Target Behavior
最终行为。

## Design
组件、实现路径及交互。

## Business Impact
能力和规则。

## Architecture Impact
职责和运行关系。

## API / Contract Changes
契约或 NONE 与原因。

## Data Changes
模型、迁移或 NONE 与原因。

## Compatibility
兼容策略。

## Error & Boundary Handling
失败及边界行为。

## Risks & Trade-offs
风险与取舍。

## Test Strategy
相关自动化及真实验收。

## Documentation Impact
Business、Architecture、Standards、ADR、Change Design 的操作、路径及原因。

## Validation
完成时记录实际结果及未验证边界。
```


