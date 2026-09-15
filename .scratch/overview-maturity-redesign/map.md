# 研发总览成熟度重构

## Notes

按“成熟度存储与后端聚合 → 总览两层视图 → 维护抽屉 → 验证收口”顺序实施完成。现有指标计算和下钻路由保持兼容。

## Decisions-so-far

- 成熟度记录以活动为粒度，不把成熟度错误地绑定到某一个指标。
- 分值使用规范化十进制字符串保存，响应同时提供可显示数值和原始文本；聚合使用 Decimal。
- 领域平均和等级分布在后端完成，前端只负责展示和交互。
- 上月复制是明确的用户动作；保存请求不隐式创建或复制评估。

## Delivery

- [01-maturity-model-and-api.md](./issues/01-maturity-model-and-api.md)
- [02-overview-comparison-views.md](./issues/02-overview-comparison-views.md)
- [03-maturity-maintenance.md](./issues/03-maturity-maintenance.md)
- [04-verification-and-closeout.md](./issues/04-verification-and-closeout.md)
