# Testing Standards

## Observed Conventions

后端用 pytest，测试位于 `backend/tests/test_*.py`，HTTP 流程使用 FastAPI TestClient，计算规则有直接函数测试。现有 conftest 在导入应用前配置独立临时 SQLite；测试共享固定临时文件名，不并行启动多个后端测试进程。

前端纯逻辑用 Node `--test`，路由/页面渲染用 Vitest；命令以 package.json 为准。测试覆盖变化的实际行为和失败边界，复用已有测试组织，不凭空规定覆盖率数字。

## Commands

```text
npm test
npm --prefix frontend run test:unit
npm --prefix frontend run build
npm run check:docs
npm run test:docs
```

按改动风险选相关检查。后端命令复用根 `.venv` 包装器；前端交互变更补真实浏览器操作、请求和截图证据，渲染测试不能代替交互验收。部署变更需要实际部署验证；缺少环境就明确未验证，不从本地测试推断 Docker/MySQL 已通过。

没有既有 CI、覆盖率阈值或独立静态检查命令；不虚构已执行检查。
