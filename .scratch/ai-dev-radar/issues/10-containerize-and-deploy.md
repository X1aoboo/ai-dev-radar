# 10 容器化部署

Status: ready-for-human
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

## Comments

**2026-09-09 实现完成**（待人工验收）：

- 新增多阶段 `Dockerfile`：构建 React/Vite 前端并复制到 FastAPI，最终镜像以单个 Uvicorn 进程运行，APScheduler 继续在同一进程生命周期内启动。
- 新增 `docker-compose.yml` 和 `.env.example`：SQLite 数据库挂载到命名卷 `/data`，session 密钥从环境变量读取并由部署者持久配置。
- FastAPI 在存在前端构建产物时托管静态资源和客户端路由；API 路由保持独立，补录、看板和登录链路均复用原有端点。
- `COLLECTION_CRON` 支持标准五字段 cron，默认 `0 2 * * *`（Asia/Shanghai）；增加 `PyMySQL` 依赖并在 README 说明连接串切换路径，未验证 MySQL 兼容性。
- README 已补充容器启动、环境变量、自动建库/种子/admin 初始化、重播种风险和 SQLite/MySQL 说明。

验证：

- `.venv\Scripts\python.exe -m pytest backend/tests -q` → 81 passed。
- `npm --prefix frontend run test:unit` → 19 passed；`npm --prefix frontend run build` 通过。
- `python -m compileall -q backend/app backend/tests`、`git diff --check` 通过。
- 应用级冒烟验证通过：静态首页 200、SPA 路由 200、登录 200、目录 200、补录 201、计算 200。
- 当前环境没有 Docker CLI，未能执行实际 `docker compose up`、容器重启和命名卷持久化验收；保留待人工验收。
