"""轻量级启动迁移。项目尚未引入迁移框架，先集中处理认证 schema 演进。"""

from sqlalchemy import Engine, inspect, select, text
from sqlalchemy.orm import Session, sessionmaker

from .auth import hash_password
from .config import SEED_PASSWORD
from .db import SessionLocal, engine
from .models import User


def ensure_auth_schema(
    db_engine: Engine = engine,
    session_factory: sessionmaker[Session] = SessionLocal,
) -> None:
    """兼容 01 票创建的旧 users 表，并初始化旧账号密码。"""
    inspector = inspect(db_engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_hash" not in columns:
        with db_engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))

    with session_factory() as db:
        users_without_password = db.scalars(
            select(User).where(User.password_hash.is_(None))
        ).all()
        if users_without_password:
            password_hash = hash_password(SEED_PASSWORD)
            for user in users_without_password:
                user.password_hash = password_hash
            db.commit()
