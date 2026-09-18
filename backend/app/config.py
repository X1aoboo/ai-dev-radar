"""运行配置：连接串环境变量化，预留 MySQL 迁移路径（改 DATABASE_URL 即可）。"""

import os
from pathlib import Path

# SQLite 默认；切 MySQL 时设 DATABASE_URL=mysql+pymysql://user:pass@host/db
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./ai-dev-radar.db")
PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = Path(
    os.environ.get("STATIC_DIR", str(PROJECT_ROOT / "frontend" / "dist"))
)
COLLECTION_CRON = os.environ.get("COLLECTION_CRON", "0 2 * * *").strip()

APP_ENV = os.environ.get("APP_ENV", "production").lower()
COLLECTOR_GATEWAY_URL = os.environ.get("COLLECTOR_GATEWAY_URL", "").strip()
COLLECTOR_GATEWAY_TOKEN = os.environ.get("COLLECTOR_GATEWAY_TOKEN", "")
COLLECTOR_GATEWAY_TIMEOUT_SECONDS = float(
    os.environ.get("COLLECTOR_GATEWAY_TIMEOUT_SECONDS", "30")
)
_DEFAULT_SESSION_SECRET = "ai-dev-radar-local-session-secret-change-me"
_DEFAULT_SEED_PASSWORD = "dev-password"

# 本地开发默认值只用于让种子环境开箱可用；生产环境强制显式配置。
SESSION_SECRET = os.environ.get("SESSION_SECRET", _DEFAULT_SESSION_SECRET)
SESSION_MAX_AGE = int(os.environ.get("SESSION_MAX_AGE", "28800"))
_HTTPS_ONLY_DEFAULT = "1" if APP_ENV in {"production", "prod"} else "0"
SESSION_HTTPS_ONLY = (
    os.environ.get("SESSION_HTTPS_ONLY", _HTTPS_ONLY_DEFAULT).lower()
    in {"1", "true", "yes"}
)
SEED_PASSWORD = os.environ.get("SEED_PASSWORD", _DEFAULT_SEED_PASSWORD)

if SESSION_MAX_AGE <= 0:
    raise ValueError("SESSION_MAX_AGE must be greater than zero")
if COLLECTOR_GATEWAY_TIMEOUT_SECONDS <= 0:
    raise ValueError("COLLECTOR_GATEWAY_TIMEOUT_SECONDS must be greater than zero")
if APP_ENV in {"production", "prod"}:
    if SESSION_SECRET == _DEFAULT_SESSION_SECRET:
        raise RuntimeError("SESSION_SECRET must be set outside development")
    if SEED_PASSWORD == _DEFAULT_SEED_PASSWORD:
        raise RuntimeError("SEED_PASSWORD must be set outside development")
