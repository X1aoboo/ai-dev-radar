# 04 验证和收口

Status: ready-for-human

## 范围

- 补充后端纯函数/API 测试和前端逻辑/渲染测试。
- 验证指标类型分开展示、原始分子分母合并、效率负值和超过 100%、布尔及通用能力回退。
- 运行后端测试、前端测试、构建，并检查桌面和窄屏布局。
- 记录实际改动、验证结果和遗留限制。

## Comments

**2026-09-15 验证完成**：后端 `npm test` 为 95 passed；前端 `npm --prefix frontend run test:unit` 为 31 个 Node 测试 + 44 个 Vitest 测试通过；Vite build 通过。桌面和 420px 窄屏真实浏览器检查通过，构建仅保留已有大 chunk warning。
