# 10 容器化部署

Status: ready-for-agent
Blocked by: 04

spec §8 的部署收尾。

## 范围

- 前端构建产物由后端静态托管，单容器单进程（FastAPI + APScheduler 同进程）
- Dockerfile + docker-compose（挂载 SQLite 卷）
- 部署 README：环境变量（连接串、session 密钥、采集计划 cron）、初始化步骤（建库、种子目录、建 admin 账号）
- MySQL 迁移路径说明（连接串切换即用，不在本票验证兼容性）

## 验收

- `docker compose up` 一条命令起完整服务，登录、看板、补录全链路可用
- 容器重启后 SQLite 数据与 session 密钥配置不丢数据

## 依据

spec §8。
