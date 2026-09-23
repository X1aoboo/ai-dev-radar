"""Readiness classifications, persistence transitions, staleness, and scheduler."""

from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.collectors import CollectorRegistry
from app.db import Base
from app.gateway_config import GatewayRuntimeConfig
from app.gateway_health import (
    HEALTH_INTERVAL_SECONDS,
    check_and_save_health,
    check_gateway_readiness,
    health_view,
    mark_active_status_unknown,
    schedule_gateway_health_check,
)
from app.models import GatewayConfiguration, GatewayHealthStatus
from app.scheduler import create_scheduler


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)(), engine


def runtime():
    return GatewayRuntimeConfig(
        config_id=1,
        revision=1,
        base_url="https://gateway.test",
        bearer_token="test-token",
        request_timeout_seconds=2,
    )


def response_transport(status=200, body=None):
    return httpx.MockTransport(lambda request: httpx.Response(status, json=body or {
        "service": "ai-dev-data-gateway",
        "status": "ready",
        "contract_version": "1.0.0",
    }))


@pytest.mark.parametrize(("status_code", "body", "expected"), [
    (200, {"service": "other", "status": "ready", "contract_version": "1.0.0"}, "SERVICE_MISMATCH"),
    (200, {"service": "ai-dev-data-gateway", "status": "ready", "contract_version": "2.0.0"}, "PROTOCOL_INCOMPATIBLE"),
    (200, {"service": "ai-dev-data-gateway", "status": "ready"}, "PROTOCOL_INCOMPATIBLE"),
    (401, {"code": "invalid_credentials", "message": "no", "retryable": False, "request_id": "r1"}, "AUTH_FAILED"),
    (503, {"code": "gateway_not_ready", "message": "no", "retryable": True, "request_id": "r1"}, "DEGRADED"),
])
def test_readiness_maps_identity_protocol_auth_and_unready_responses(status_code, body, expected):
    result = check_gateway_readiness(runtime(), transport=response_transport(status_code, body))
    assert result.status == expected
    assert result.network_failure is False


def test_three_network_failures_become_unreachable_then_success_recovers():
    db, engine = make_db()
    try:
        db.add(GatewayConfiguration(
            id=1,
            slot="active",
            base_url="https://gateway.test",
            bearer_token="test-token",
            request_timeout_seconds=2,
            revision=1,
            created_by="admin",
            updated_by="admin",
        ))
        db.commit()
        current_runtime = runtime()

        for expected in ("DEGRADED", "DEGRADED", "UNREACHABLE"):
            def disconnected(request):
                raise httpx.ConnectError("private host and test-token", request=request)

            saved, observation = check_and_save_health(
                db,
                current_runtime,
                scope="active",
                transport=httpx.MockTransport(disconnected),
            )
            assert saved is True
            assert observation.network_failure is True
            db.commit()
            assert health_view(db, "active", current_runtime)["status"] == expected

        saved, observation = check_and_save_health(
            db,
            current_runtime,
            scope="active",
            transport=response_transport(),
        )
        assert saved is True
        assert observation.status == "CONNECTED"
        db.commit()
        view = health_view(db, "active", current_runtime)
        assert view["status"] == "CONNECTED"
        assert view["consecutive_network_failures"] == 0
        assert "test-token" not in str(view)
    finally:
        db.close()
        engine.dispose()


def test_health_result_from_a_replaced_revision_is_discarded():
    db, engine = make_db()
    try:
        active = GatewayConfiguration(
            id=1,
            slot="active",
            base_url="https://gateway.test",
            bearer_token="test-token",
            request_timeout_seconds=2,
            revision=1,
            created_by="admin",
            updated_by="admin",
        )
        db.add(active)
        db.commit()

        def replace_during_request(request):
            active.revision = 2
            db.commit()
            return httpx.Response(200, json={
                "service": "ai-dev-data-gateway",
                "status": "ready",
                "contract_version": "1.0.0",
            })

        saved, observation = check_and_save_health(
            db,
            runtime(),
            scope="active",
            transport=httpx.MockTransport(replace_during_request),
        )
        assert saved is False
        assert observation.status == "CONNECTED"
        assert db.scalar(select(GatewayHealthStatus)) is None
    finally:
        db.close()
        engine.dispose()


def test_stale_status_and_process_restart_keep_last_known_state():
    db, engine = make_db()
    try:
        active = GatewayConfiguration(
            id=1,
            slot="active",
            base_url="https://gateway.test",
            bearer_token="test-token",
            request_timeout_seconds=2,
            revision=1,
            created_by="admin",
            updated_by="admin",
        )
        checked_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=91)
        db.add_all([
            active,
            GatewayHealthStatus(
                scope="active",
                config_id=1,
                status="CONNECTED",
                last_known_status="CONNECTED",
                checked_at=checked_at,
                last_success_at=checked_at,
                consecutive_network_failures=0,
            ),
        ])
        db.commit()

        view = health_view(db, "active", active)
        assert view["status"] == "UNKNOWN"
        assert view["stale"] is True
        assert view["last_known_status"] == "CONNECTED"

        mark_active_status_unknown(db)
        row = db.scalar(select(GatewayHealthStatus).where(GatewayHealthStatus.scope == "active"))
        assert row.status == "UNKNOWN"
        assert row.last_known_status == "CONNECTED"
    finally:
        db.close()
        engine.dispose()


def test_existing_scheduler_owns_immediate_thirty_second_gateway_check():
    scheduler = create_scheduler(CollectorRegistry())
    schedule_gateway_health_check(scheduler)
    scheduler.start(paused=True)
    try:
        job = scheduler.get_job("gateway-health-check")
        assert job is not None
        assert job.coalesce is True
        assert job.max_instances == 1
        assert job.trigger.interval.total_seconds() == HEALTH_INTERVAL_SECONDS
        assert job.next_run_time is not None
    finally:
        scheduler.shutdown(wait=False)
