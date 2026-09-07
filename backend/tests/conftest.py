"""测试夹具：每个测试会话用独立的临时 SQLite 文件，避免碰开发库 ai-dev-radar.db。

DATABASE_URL 必须在任何 app 模块导入之前设置（db.py 在导入时读配置），
因此这里在 conftest 导入阶段就完成赋值，而不是在 fixture 里。
"""

import os
import sys
import tempfile
from pathlib import Path

# 保证 backend/ 在 sys.path 中（从仓库根跑 pytest 时需要）
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

_TEST_DB = Path(tempfile.gettempdir()) / "ai-dev-radar-test.db"
_TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    # 在设置好 DATABASE_URL 之后才导入 app，lifespan 会建表并自动播种
    from app.main import app

    with TestClient(app) as client:
        yield client
