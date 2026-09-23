"""Gateway readiness checks, status transitions, and the shared scheduler job."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Callable

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from .collector_gateway import GatewayFailure, create_gateway_client
from .db import SessionLocal
from .gateway_config import GatewayRuntimeConfig
from .gateway_contracts import (
    GATEWAY_SERVICE_ID,
    HealthReadyResponse,
    is_compatible_contract_version,
)
from .models import GatewayConfiguration, GatewayHealthStatus


HEALTH_INTERVAL_SECONDS = 30
NETWORK_FAILURE_LIMIT = 3
STALE_AFTER_SECONDS = 90
HEALTH_TIMEOUT_SECONDS = 5
GatewayStatus = str


@dataclass(frozen=True, slots=True)
class GatewayHealthObservation:
    status: GatewayStatus
    checked_at: datetime
    latency_ms: int
    service_id: str | None = None
    contract_version: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    network_failure: bool = False


def _observation(
    status: str,
    started: float,
    *,
    service_id: str | None = None,
    contract_version: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    network_failure: bool = False,
) -> GatewayHealthObservation:
    return GatewayHealthObservation(
        status=status,
        checked_at=datetime.now(timezone.utc).replace(tzinfo=None),
        latency_ms=max(0, round((perf_counter() - started) * 1000)),
        service_id=service_id,
        contract_version=contract_version,
        error_code=error_code,
        error_message=error_message,
        network_failure=network_failure,
    )


def check_gateway_readiness(
    runtime: GatewayRuntimeConfig,
    *,
    transport: httpx.BaseTransport | None = None,
) -> GatewayHealthObservation:
    started = perf_counter()
    try:
        client = create_gateway_client(
            runtime_config=runtime,
            timeout_seconds=min(HEALTH_TIMEOUT_SECONDS, runtime.request_timeout_seconds),
            transport=transport,
        )
    except GatewayFailure as exc:
        return _observation(
            "PROTOCOL_INCOMPATIBLE",
            started,
            error_code=exc.code,
            error_message="Gateway configuration cannot be used.",
        )

    try:
        with client:
            response = client.get("/v1/health/ready")
    except httpx.TimeoutException:
        return _observation(
            "DEGRADED",
            started,
            error_code="gateway_timeout",
            error_message="Gateway readiness check timed out.",
            network_failure=True,
        )
    except httpx.RequestError:
        return _observation(
            "DEGRADED",
            started,
            error_code="gateway_unavailable",
            error_message="Gateway cannot be reached.",
            network_failure=True,
        )

    if response.status_code in {401, 403}:
        return _observation(
            "AUTH_FAILED",
            started,
            error_code="gateway_auth_failed",
            error_message="Gateway authentication failed. Check the configured token.",
        )
    if response.status_code == 503:
        return _observation(
            "DEGRADED",
            started,
            error_code="gateway_not_ready",
            error_message="Gateway is reachable but not ready.",
        )
    if response.status_code >= 500:
        return _observation(
            "DEGRADED",
            started,
            error_code="gateway_server_error",
            error_message="Gateway readiness check failed.",
        )
    if response.status_code != 200:
        return _observation(
            "PROTOCOL_INCOMPATIBLE",
            started,
            error_code="gateway_readiness_http_error",
            error_message="Gateway readiness endpoint returned an unexpected response.",
        )

    try:
        ready = HealthReadyResponse.model_validate_json(response.content)
    except ValidationError:
        return _observation(
            "PROTOCOL_INCOMPATIBLE",
            started,
            error_code="gateway_readiness_invalid",
            error_message="Gateway readiness response is invalid.",
        )
    if ready.service != GATEWAY_SERVICE_ID:
        return _observation(
            "SERVICE_MISMATCH",
            started,
            service_id=ready.service,
            contract_version=ready.contract_version,
            error_code="gateway_service_mismatch",
            error_message="Gateway returned an unexpected service identity.",
        )
    if not is_compatible_contract_version(ready.contract_version):
        return _observation(
            "PROTOCOL_INCOMPATIBLE",
            started,
            service_id=ready.service,
            contract_version=ready.contract_version,
            error_code="gateway_protocol_incompatible",
            error_message="Gateway protocol version is not compatible with Radar.",
        )
    return _observation(
        "CONNECTED",
        started,
        service_id=ready.service,
        contract_version=ready.contract_version,
    )


def check_and_save_health(
    db: Session,
    runtime: GatewayRuntimeConfig,
    *,
    scope: str,
    transport: httpx.BaseTransport | None = None,
    now: datetime | None = None,
) -> tuple[bool, GatewayHealthObservation]:
    observation = check_gateway_readiness(runtime, transport=transport)
    checked_at = now or observation.checked_at
    current = db.scalar(
        select(GatewayConfiguration)
        .where(GatewayConfiguration.slot == scope)
        .execution_options(populate_existing=True)
    )
    if current is None or current.id != runtime.config_id or current.revision != runtime.revision:
        return False, observation

    row = db.scalar(
        select(GatewayHealthStatus)
        .where(GatewayHealthStatus.scope == scope)
        .execution_options(populate_existing=True)
    )
    if row is None:
        row = GatewayHealthStatus(scope=scope, config_id=runtime.config_id, status="UNKNOWN")
        db.add(row)

    same_config = row.config_id == runtime.config_id
    previous_failure_count = 0
    if (
        same_config
        and row.checked_at is not None
        and checked_at - row.checked_at <= timedelta(seconds=STALE_AFTER_SECONDS)
        and row.error_code in {"gateway_timeout", "gateway_unavailable"}
    ):
        previous_failure_count = row.consecutive_network_failures

    if observation.network_failure:
        failure_count = previous_failure_count + 1
        status = "UNREACHABLE" if failure_count >= NETWORK_FAILURE_LIMIT else "DEGRADED"
    else:
        failure_count = 0
        status = observation.status

    last_success_at = row.last_success_at if same_config else None
    if status == "CONNECTED":
        last_success_at = checked_at
    row.scope = scope
    row.config_id = runtime.config_id
    row.status = status
    row.last_known_status = status
    row.checked_at = checked_at
    row.last_success_at = last_success_at
    row.latency_ms = observation.latency_ms
    row.service_id = observation.service_id
    row.contract_version = observation.contract_version
    row.consecutive_network_failures = failure_count
    row.error_code = observation.error_code
    row.error_message = observation.error_message
    db.flush()
    return True, observation


def health_view(
    db: Session,
    scope: str,
    configuration: GatewayConfiguration | GatewayRuntimeConfig | None,
    *,
    now: datetime | None = None,
) -> dict:
    if configuration is None:
        return {"status": "UNCONFIGURED", "stale": False, "consecutive_network_failures": 0}
    config_id = getattr(configuration, "id", None) or getattr(configuration, "config_id", None)
    row = db.scalar(
        select(GatewayHealthStatus)
        .where(GatewayHealthStatus.scope == scope)
        .execution_options(populate_existing=True)
    )
    if row is None or row.config_id != config_id:
        return {"status": "UNKNOWN", "stale": False, "consecutive_network_failures": 0}

    current_time = now or datetime.now(timezone.utc).replace(tzinfo=None)
    status = row.status
    last_known_status = row.last_known_status
    stale = row.checked_at is not None and (
        current_time - row.checked_at > timedelta(seconds=STALE_AFTER_SECONDS)
    )
    if stale:
        status = "UNKNOWN"
        last_known_status = row.status
    return {
        "status": status,
        "stale": stale,
        "last_known_status": last_known_status,
        "checked_at": row.checked_at,
        "last_success_at": row.last_success_at,
        "latency_ms": row.latency_ms,
        "service_id": row.service_id,
        "contract_version": row.contract_version,
        "consecutive_network_failures": row.consecutive_network_failures,
        "error_code": None if stale else row.error_code,
        "error_message": None if stale else row.error_message,
    }


def mark_active_status_unknown(db: Session) -> None:
    active = db.scalar(
        select(GatewayConfiguration)
        .where(GatewayConfiguration.slot == "active")
        .execution_options(populate_existing=True)
    )
    if active is None:
        return
    row = db.scalar(
        select(GatewayHealthStatus)
        .where(GatewayHealthStatus.scope == "active")
        .execution_options(populate_existing=True)
    )
    if row is None:
        db.add(GatewayHealthStatus(
            scope="active",
            config_id=active.id,
            status="UNKNOWN",
            consecutive_network_failures=0,
        ))
    else:
        same_config = row.config_id == active.id
        row.last_known_status = (
            (row.status if row.status != "UNKNOWN" else row.last_known_status)
            if same_config
            else None
        )
        row.config_id = active.id
        row.status = "UNKNOWN"
        row.consecutive_network_failures = 0
        if not same_config:
            row.checked_at = None
            row.last_success_at = None
            row.latency_ms = None
            row.service_id = None
            row.contract_version = None
        row.error_code = None
        row.error_message = None
    db.commit()


def run_active_health_check(
    session_factory: sessionmaker = SessionLocal,
    *,
    transport: httpx.BaseTransport | None = None,
) -> None:
    with session_factory() as db:
        active = db.scalar(
            select(GatewayConfiguration).where(GatewayConfiguration.slot == "active")
        )
        if active is None:
            return
        runtime = GatewayRuntimeConfig(
            config_id=active.id,
            revision=active.revision,
            base_url=active.base_url,
            bearer_token=active.bearer_token,
            request_timeout_seconds=active.request_timeout_seconds,
        )
        db.commit()
        saved, _observation = check_and_save_health(
            db,
            runtime,
            scope="active",
            transport=transport,
        )
        if saved:
            db.commit()


def schedule_gateway_health_check(
    scheduler: BackgroundScheduler,
    *,
    session_factory: sessionmaker = SessionLocal,
    on_initial_check_complete: Callable[[], None] | None = None,
) -> None:
    def check_and_mark_initial() -> None:
        try:
            run_active_health_check(session_factory)
        finally:
            if on_initial_check_complete is not None:
                on_initial_check_complete()

    scheduler.add_job(
        check_and_mark_initial,
        trigger=IntervalTrigger(seconds=HEALTH_INTERVAL_SECONDS),
        next_run_time=datetime.now(timezone.utc),
        id="gateway-health-check",
        name="Gateway readiness health check",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
