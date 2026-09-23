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

## Project E2E Gate

修改 Gateway、Collection、Settings 等运行时链路时，项目完成门禁为 `npm run gate`，顺序执行后端测试、前端单元/渲染测试、前端生产构建、Gateway Project E2E、设计文档检查和文档测试。单独运行 `npm run test:e2e:gateway` 也会先构建前端。

Project E2E 是 L3：Chromium 浏览器操作 Radar 前端，经 Radar 后端和真实 TCP/HTTP 访问仓库内独立运行的 `e2e/mock_gateway` 进程。运行器在临时 SQLite 上启动/关闭进程，使用动态 localhost 端口，并在成功或失败时清理服务和数据库。Mock Gateway Provider Contract Test 直接以 `docs/contracts/ai-dev-data-gateway/baseline/openapi.json` 校验 Mock 响应；MockProvider 不能导入 Radar Consumer DTO 或 HTTP Client。`httpx.MockTransport` 和 FastAPI TestClient 仅用于 L1/L2，不能替代 L3。

Playwright 默认使用 Headless Chromium。失败时保留 trace、截图、浏览器 console、Radar 日志和 Mock Gateway 日志到被 Git 忽略的 `e2e-results/`。运行器和门禁使用 Node 子进程编排，不能依赖 Bash、`jq`、`pkill` 或 `killall`。

L3 通过只证明 Radar 与 Mock Gateway 的项目级 HTTP 链路。L4 的 Radar + 真实 Gateway，以及 Gateway + GDEMate/CodeHub/DTS 内部平台仍需在真实部署环境分别验收；没有内网环境时明确报告 `NOT VERIFIED`。
