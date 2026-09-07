# 02 认证与角色

Status: ready-for-agent
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
