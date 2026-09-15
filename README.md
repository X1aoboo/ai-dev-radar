# ai-dev-radar

## 首次安装开发依赖

首次下载源码后，在项目根目录执行：

```bash
npm run setup
```

该脚本会安装根目录和前端的 Node.js 依赖，创建或复用项目根目录下的 `.venv`，并将后端 Python 依赖安装到该虚拟环境中。Python 创建环境时支持 `python`、`python3`（macOS/Linux）或 `python`、`py -3`（Windows）。

脚本不会生成 `.env`，也不会初始化数据库。Python 相关命令会直接使用项目 `.venv`，不需要手动激活虚拟环境。初始化完成后直接执行：

```bash
npm run dev
```

如果 `.venv` 不存在，先执行 `npm run setup`。

## 容器部署

### 快速启动

1. 复制 `.env.example` 为 `.env`，至少替换 `SESSION_SECRET` 和 `SEED_PASSWORD`。这两个值要在容器重启后保持不变。
2. 执行 `docker compose up`。Compose 会构建前端、把构建产物交给 FastAPI 静态托管，并以单个 Uvicorn 进程启动 FastAPI + APScheduler。
3. 打开 <http://localhost:8000>，使用账号 `admin` 和 `SEED_PASSWORD` 登录。

首次启动会在持久化卷 `ai-dev-radar-data` 的 `/data/ai-dev-radar.db` 中自动建表；空库会自动写入指标目录、演示团队/版本/事实记录和 admin 账号。不要删除该卷，否则 SQLite 数据会丢失。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_ENV` | `production` | 生产环境会拒绝内置 session 密钥和默认种子密码。 |
| `DATABASE_URL` | `sqlite:////data/ai-dev-radar.db` | SQLite 使用持久化卷；可切换为 `mysql+pymysql://user:password@host/database`。本票只提供连接串/驱动路径，不验证 MySQL 兼容性。 |
| `SESSION_SECRET` | 必填 | 签名 session 的密钥；保持稳定，否则已有登录 session 会失效。 |
| `SEED_PASSWORD` | 必填 | 空库初始化及显式重播种时 admin 等种子账号的密码。 |
| `SESSION_MAX_AGE` | `28800` | session 有效期，单位秒。 |
| `SESSION_HTTPS_ONLY` | `0` | 本地 HTTP 保持 `0`；HTTPS 反向代理部署应设为 `1`。 |
| `COLLECTION_CRON` | `0 2 * * *` | 五字段 cron 表达式，按 `Asia/Shanghai` 调度每日采集任务。当前目录指标均为“仅补录”时任务安全空跑。 |
| `APP_PORT` | `8000` | 宿主机映射端口，容器内端口固定为 `8000`。 |

### 数据初始化与重播种

正常部署不需要额外建库命令：应用启动时会创建 SQLite schema，并在目录为空时完成种子初始化。若需要主动重建目录和演示数据，可在确认会清空当前业务数据后执行：

```text
docker compose run --rm app python -m app.seed
```

切换到 MySQL 时，先准备数据库和账号，再将 `DATABASE_URL` 写入 `.env`；应用会沿用同一套启动建表/种子流程。MySQL 迁移兼容性不在本票验收范围内。

## 本地认证

`npm run dev` 和 `npm run seed` 已显式使用 `APP_ENV=development`。直接运行
后端命令时请自行设置环境；应用默认按生产模式启动，漏配生产密钥会直接失败。

首次启动会创建演示账号。默认密码由 `SEED_PASSWORD` 控制，默认值为
`dev-password`，仅适用于本地开发；重新运行种子会重置演示账号密码。

- `admin`：全部权限
- `maintainer.团队A` ～ `maintainer.团队D`：对应团队维护权限
- `viewer`：只读权限

部署时请设置 `APP_ENV=production`，并覆盖 `SESSION_SECRET`、`SEED_PASSWORD`；
应用会拒绝生产环境使用本地默认值。请按 HTTPS 环境设置
`SESSION_HTTPS_ONLY=1`。session 默认有效期为 8 小时，可用
`SESSION_MAX_AGE`（秒）调整。

## 数据管理工作台

登录后可从“数据管理”进入左侧分组工作台：

- 基础数据：团队/人员、产品、产品版本、开发迭代期及 IR/AR/SR/DTS/MR 数据域。
- AI 研发度量数据：AI 属性和指标规则、实时指标结果查询。

当前首期完整实现 IR 数据域。IR 支持表格筛选、分页、手工编辑以及 CSV/XLSX
导入预览；导入或采集结果先进入临时态，整批校验通过并确认后才写入正式数据。
现有“配置”和“补录”入口仍保留作为兼容入口。

## 成熟度总览

“研发总览”默认按当前月展示关键研发活动的领域成熟度。可以切换到通用研发能力
或团队矩阵，成熟度记录按团队、活动和月份独立维护，未评估不会被当作 0。指标
比较区默认收起；展开后同时展示按原始分子/分母合并的领域口径和旧的全公司均值对照。
