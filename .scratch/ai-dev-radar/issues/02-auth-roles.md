# 02 认证与角色

Status: ready-for-human
Blocked by: 01

本地账号 + session 登录，三种角色（spec §7）。

## 范围

- 登录/登出端点 + session（本地账号表，密码哈希；不接 SSO）
- 角色：`admin`（全部权限）、`maintainer`（按关联团队补录，User 表含团队绑定）、`viewer`（只读）
- FastAPI 依赖注入式的权限检查（角色/团队两级）
- 前端登录页 + 路由守卫（未登录跳登录页；viewer 访问配置/补录页拒绝）
- 种子账号：admin ×1、每团队 maintainer ×1、viewer ×1

## 验收

- 三种角色各自只能做角色内的事（接口层 403，前端隐藏入口）
- session 过期后重新登录可恢复

## 依据

spec §7；`CONTEXT.md`。

## Comments

**2026-09-08 实现完成**（待人工验收，commit `eeddc8e`）：

- 后端新增 `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`；使用 Argon2 密码哈希和 HTTP-only signed session cookie，默认有效期 8 小时。
- 既有目录、团队、版本、迭代、事实记录 REST 端点已要求登录；新增 admin-only `GET /api/auth/users` 和团队权限端点 `GET /api/auth/teams/{team_id}/users`，viewer 与跨团队 maintainer 返回 403。
- 提供 FastAPI `require_roles` / `require_team_access` 依赖，供后续配置与补录接口复用；FactRecord 写入仍由 issue 06 实现。
- 前端新增登录页、未登录路由守卫、session 401 过期回登录页并保留原路径；viewer 隐藏并拒绝配置/补录入口。配置页和补录页当前为受保护占位页，业务内容分别由 issue 05/06 实现。
- 种子账号仍为 admin ×1、每团队 maintainer ×1、viewer ×1；密码由 `SEED_PASSWORD` 控制，本地开发默认值为 `dev-password`，生产环境要求显式配置 `APP_ENV`、`SESSION_SECRET` 和 `SEED_PASSWORD`。
- 为 01 票旧数据库补充 `password_hash` 启动迁移，`app.seed` CLI 也会执行迁移。

验证：`npm test` 21 passed；前端 `npm run build` 通过；最终 Standards/Spec review 无阻断项。
