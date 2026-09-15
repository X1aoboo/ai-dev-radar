# AI 研发效能数据管理工作台

## Notes

首期实现基础数据管理和 IR 数据域；AR、SR、DTS、MR 保留统一入口，后续复用 IR 的查询、编辑、导入和指标模式。

## Decisions-so-far

- 源数据记录是正式业务数据，AI 属性附着其上，指标按有效正式记录计算。
- 层级为团队 → 产品 → 产品版本 → 开发迭代期。
- 导入和采集先进入临时态，整批校验通过后确认；已有 ID 只补空值，页面手工编辑可以覆盖。
- 当前看板和旧版事实记录链路保留，后续再接入源数据指标适配层。

## Delivery

- [01-data-model-and-api.md](./issues/01-data-model-and-api.md)
- [02-staged-import-and-collector.md](./issues/02-staged-import-and-collector.md)
- [03-data-management-workbench.md](./issues/03-data-management-workbench.md)
