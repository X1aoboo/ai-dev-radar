"""轻量级启动迁移。项目尚未引入迁移框架，集中处理 schema 演进。"""

from sqlalchemy import Engine, inspect, select, text
from sqlalchemy.orm import Session, sessionmaker

from .auth import hash_password
from .config import SEED_PASSWORD
from .db import SessionLocal, engine
from .models import (
    GatewayConfigAudit,
    GatewayConfiguration,
    GatewayHealthStatus,
    MaturityRecord,
    User,
)


def ensure_fact_schema(db_engine: Engine = engine) -> None:
    """移除 01 票遗留的事实记录唯一索引，允许补录保留修正历史。"""

    inspector = inspect(db_engine)
    if "fact_records" not in inspector.get_table_names():
        return

    index_names = {
        index["name"] for index in inspector.get_indexes("fact_records")
    }
    if "uq_fact_key_scope" in index_names:
        with db_engine.begin() as connection:
            connection.execute(text("DROP INDEX IF EXISTS uq_fact_key_scope"))


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


def ensure_data_management_schema(db_engine: Engine = engine) -> None:
    """为旧版数据库补齐源数据管理所需的可空兼容列。

    新表由 ``Base.metadata.create_all`` 创建；这里仅处理 ``create_all`` 不会
    改动的既有表。旧事实数据不做迁移，product_id 和 ImportBatch.team_id 保持可空。
    """

    inspector = inspect(db_engine)
    tables = set(inspector.get_table_names())
    if "product_versions" in tables:
        columns = {column["name"] for column in inspector.get_columns("product_versions")}
        if "product_id" not in columns:
            with db_engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE product_versions ADD COLUMN product_id INTEGER")
                )
    if "import_batches" in tables:
        columns = {column["name"] for column in inspector.get_columns("import_batches")}
        if "team_id" not in columns:
            with db_engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE import_batches ADD COLUMN team_id INTEGER REFERENCES teams(id)")
                )
    if "import_rows" in tables:
        columns = {column["name"] for column in inspector.get_columns("import_rows")}
        if "source_system" not in columns:
            with db_engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE import_rows ADD COLUMN source_system VARCHAR(100)")
                )


def ensure_maturity_schema(db_engine: Engine = engine) -> None:
    """只补齐成熟度存储，不根据旧事实或指标数据生成评估记录。"""

    MaturityRecord.__table__.create(db_engine, checkfirst=True)


def ensure_gateway_schema(db_engine: Engine = engine) -> None:
    """Create Gateway state tables and add nullable run snapshots to old databases."""

    for model in (GatewayConfiguration, GatewayHealthStatus, GatewayConfigAudit):
        model.__table__.create(db_engine, checkfirst=True)

    inspector = inspect(db_engine)
    if "collection_runs" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("collection_runs")}
    additions = {
        "gateway_config_id": "INTEGER",
        "gateway_base_url": "VARCHAR(2000)",
        "error_code": "VARCHAR(100)",
        "message": "TEXT",
        "retryable": "BOOLEAN NOT NULL DEFAULT 0",
    }
    missing = [(name, sql_type) for name, sql_type in additions.items() if name not in columns]
    if missing:
        with db_engine.begin() as connection:
            for name, sql_type in missing:
                connection.execute(
                    text(f"ALTER TABLE collection_runs ADD COLUMN {name} {sql_type}")
                )
