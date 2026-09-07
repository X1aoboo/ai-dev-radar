"""运行配置：连接串环境变量化，预留 MySQL 迁移路径（改 DATABASE_URL 即可）。"""

import os

# SQLite 默认；切 MySQL 时设 DATABASE_URL=mysql+pymysql://user:pass@host/db
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./ai-dev-radar.db")
