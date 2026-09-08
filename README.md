# ai-dev-radar

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
