"""Gateway configuration lifecycle and secret-safe audit behavior."""

import json
from dataclasses import FrozenInstanceError

import pytest
from pydantic import SecretStr
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import config
from app.db import Base
from app.gateway_config import (
    GatewayConfigError,
    GatewayRuntimeConfig,
    get_configuration,
    promote_draft,
    runtime_config,
    save_draft,
)
from app.models import GatewayConfigAudit, GatewayConfiguration, GatewayHealthStatus
from app.schemas import GatewayDraftIn
from app.migrations import ensure_gateway_schema


def gateway_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)(), engine


def draft_payload(token="candidate-secret", *, url="https://gateway.test", timeout=5):
    return GatewayDraftIn(
        base_url=url,
        bearer_token=SecretStr(token) if token is not None else None,
        request_timeout_seconds=timeout,
    )


def test_first_draft_requires_a_token_and_never_puts_it_in_audit_or_repr(monkeypatch):
    monkeypatch.setattr(config, "APP_ENV", "test")
    db, engine = gateway_db()
    try:
        with pytest.raises(GatewayConfigError, match="first configuration"):
            save_draft(db, draft_payload(token=""), actor="admin")

        draft = save_draft(db, draft_payload(), actor="admin")
        audit = db.scalar(select(GatewayConfigAudit))
        assert draft.slot == "draft"
        assert draft.bearer_token == "candidate-secret"
        assert audit.changes["token_changed"] is True
        assert "candidate-secret" not in json.dumps(audit.changes)
        assert "candidate-secret" not in repr(runtime_config(draft))
        assert get_configuration(db, "active") is None
    finally:
        db.close()
        engine.dispose()


def test_blank_draft_token_reuses_active_and_activation_replaces_slots_atomically(monkeypatch):
    monkeypatch.setattr(config, "APP_ENV", "test")
    db, engine = gateway_db()
    try:
        active = GatewayConfiguration(
            slot="active",
            base_url="https://active.test",
            bearer_token="active-secret",
            request_timeout_seconds=30,
            revision=1,
            created_by="admin",
            updated_by="admin",
        )
        db.add(active)
        db.commit()
        draft = save_draft(db, draft_payload(token=""), actor="admin")
        assert draft.bearer_token == "active-secret"
        assert get_configuration(db, "active").id == active.id
        assert db.scalar(select(GatewayConfigAudit).order_by(GatewayConfigAudit.id.desc())).changes["token_changed"] is False

        db.add(GatewayHealthStatus(
            scope="active",
            config_id=active.id,
            status="CONNECTED",
            last_known_status="CONNECTED",
            consecutive_network_failures=0,
        ))
        db.add(GatewayHealthStatus(
            scope="draft",
            config_id=draft.id,
            status="CONNECTED",
            last_known_status="CONNECTED",
            consecutive_network_failures=0,
        ))
        db.commit()

        promoted = promote_draft(db, actor="admin", expected_revision=draft.revision)
        assert promoted.slot == "active"
        assert promoted.id == draft.id
        assert promoted.bearer_token == "active-secret"
        assert get_configuration(db, "draft") is None
        assert db.scalar(select(GatewayConfiguration).where(GatewayConfiguration.slot == "active")).id == draft.id
        health = db.scalar(select(GatewayHealthStatus))
        assert health.scope == "active"
        assert health.config_id == draft.id
        activated = db.scalar(select(GatewayConfigAudit).where(GatewayConfigAudit.action == "DRAFT_ACTIVATED"))
        assert activated.result_status == "CONNECTED"
        assert "active-secret" not in json.dumps(activated.changes)
    finally:
        db.close()
        engine.dispose()


def test_runtime_snapshot_is_immutable_and_production_requires_https(monkeypatch):
    monkeypatch.setattr(config, "APP_ENV", "test")
    db, engine = gateway_db()
    try:
        draft = save_draft(db, draft_payload(), actor="admin")
        snapshot = runtime_config(draft)
        with pytest.raises(FrozenInstanceError):
            snapshot.base_url = "https://changed.test"
        monkeypatch.setattr(config, "APP_ENV", "production")
        with pytest.raises(GatewayConfigError, match="HTTPS"):
            save_draft(db, draft_payload(token="candidate-secret", url="http://gateway.test"), actor="admin")
    finally:
        db.close()
        engine.dispose()


def test_gateway_schema_adds_nullable_collection_snapshots_to_existing_databases():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE collection_runs (id INTEGER PRIMARY KEY)"))

    ensure_gateway_schema(engine)
    columns = {column["name"]: column for column in inspect(engine).get_columns("collection_runs")}
    assert {"gateway_config_id", "gateway_base_url", "error_code", "message", "retryable"} <= set(columns)
    assert columns["gateway_config_id"]["nullable"] is True
    assert columns["gateway_base_url"]["nullable"] is True
    assert {"gateway_configurations", "gateway_health_status", "gateway_config_audits"} <= set(inspect(engine).get_table_names())
    engine.dispose()
