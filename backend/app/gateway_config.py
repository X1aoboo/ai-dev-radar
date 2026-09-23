"""Database-managed Gateway configuration and immutable collection snapshots."""

from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import config
from .models import GatewayConfigAudit, GatewayConfiguration, GatewayHealthStatus
from .schemas import GatewayDraftIn


@dataclass(frozen=True, slots=True)
class GatewayRuntimeConfig:
    config_id: int
    revision: int
    base_url: str
    bearer_token: str = field(repr=False)
    request_timeout_seconds: float = 30


class GatewayConfigError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def validate_gateway_base_url(value: str) -> str:
    try:
        url = httpx.URL(value)
    except (TypeError, ValueError) as exc:
        raise GatewayConfigError(
            "gateway_configuration_error", "Gateway URL is invalid."
        ) from exc
    if (
        url.scheme not in {"http", "https"}
        or not url.host
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path not in {"", "/"}
    ):
        raise GatewayConfigError(
            "gateway_configuration_error", "Gateway URL is invalid."
        )
    if config.APP_ENV in {"production", "prod"} and url.scheme != "https":
        raise GatewayConfigError(
            "gateway_https_required", "Production Gateway URLs must use HTTPS."
        )
    return str(url).rstrip("/")


def runtime_config(row: GatewayConfiguration) -> GatewayRuntimeConfig:
    return GatewayRuntimeConfig(
        config_id=row.id,
        revision=row.revision,
        base_url=row.base_url,
        bearer_token=row.bearer_token,
        request_timeout_seconds=row.request_timeout_seconds,
    )


def active_runtime_config(db: Session) -> GatewayRuntimeConfig | None:
    active = db.scalar(
        select(GatewayConfiguration).where(GatewayConfiguration.slot == "active")
    )
    return runtime_config(active) if active is not None else None


def get_configuration(db: Session, slot: str) -> GatewayConfiguration | None:
    return db.scalar(
        select(GatewayConfiguration)
        .where(GatewayConfiguration.slot == slot)
        .execution_options(populate_existing=True)
    )


def gateway_transport_for(app_state):
    """Provide a fresh L1/L2 transport when the test app declares a factory."""

    factory = getattr(app_state, "gateway_transport_factory", None)
    return factory() if factory is not None else getattr(app_state, "gateway_transport", None)


def save_draft(
    db: Session,
    payload: GatewayDraftIn,
    *,
    actor: str,
) -> GatewayConfiguration:
    base_url = validate_gateway_base_url(payload.base_url)
    active = get_configuration(db, "active")
    draft = get_configuration(db, "draft")
    submitted_token = (
        payload.bearer_token.get_secret_value()
        if payload.bearer_token is not None
        else ""
    ).strip()
    if len(submitted_token) > 4096:
        raise GatewayConfigError(
            "gateway_token_invalid", "Gateway token exceeds the supported length."
        )
    if submitted_token:
        token = submitted_token
    elif active is not None:
        token = active.bearer_token
    else:
        raise GatewayConfigError(
            "gateway_token_required", "Enter a Gateway token for the first configuration."
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    token_changed = token != (draft.bearer_token if draft is not None else (active.bearer_token if active else None))
    before_url = draft.base_url if draft is not None else None
    before_timeout = draft.request_timeout_seconds if draft is not None else None
    if draft is None:
        draft = GatewayConfiguration(
            slot="draft",
            base_url=base_url,
            bearer_token=token,
            request_timeout_seconds=payload.request_timeout_seconds,
            revision=1,
            created_by=actor,
            updated_by=actor,
            created_at=now,
            updated_at=now,
        )
        db.add(draft)
    else:
        draft.base_url = base_url
        draft.bearer_token = token
        draft.request_timeout_seconds = payload.request_timeout_seconds
        draft.revision += 1
        draft.updated_by = actor
        draft.updated_at = now
        old_health = db.scalar(
            select(GatewayHealthStatus).where(GatewayHealthStatus.scope == "draft")
        )
        if old_health is not None:
            db.delete(old_health)

    db.flush()
    db.add(GatewayConfigAudit(
        action="DRAFT_SAVED",
        actor=actor,
        config_id=draft.id,
        scope="draft",
        changes={
            "base_url": {"from": before_url, "to": base_url},
            "request_timeout_seconds": {
                "from": before_timeout,
                "to": payload.request_timeout_seconds,
            },
            "token_changed": token_changed,
        },
        result_status="UNKNOWN",
        created_at=now,
    ))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise GatewayConfigError(
            "gateway_configuration_conflict", "Gateway configuration changed; reload and retry."
        ) from exc
    db.refresh(draft)
    return draft


def discard_draft(db: Session, *, actor: str) -> None:
    draft = get_configuration(db, "draft")
    if draft is None:
        raise HTTPException(status_code=404, detail="Gateway draft not found.")
    health = db.scalar(
        select(GatewayHealthStatus).where(GatewayHealthStatus.scope == "draft")
    )
    if health is not None:
        db.delete(health)
    db.add(GatewayConfigAudit(
        action="DRAFT_DISCARDED",
        actor=actor,
        config_id=draft.id,
        scope="draft",
        changes={},
        result_status=None,
    ))
    db.delete(draft)
    db.commit()


def promote_draft(
    db: Session,
    *,
    actor: str,
    expected_revision: int,
) -> GatewayConfiguration:
    """Promote the tested Draft after the caller has persisted CONNECTED."""

    draft = db.scalar(
        select(GatewayConfiguration)
        .where(GatewayConfiguration.slot == "draft")
        .execution_options(populate_existing=True)
    )
    if draft is None:
        raise HTTPException(status_code=404, detail="Gateway draft not found.")
    if draft.revision != expected_revision:
        raise HTTPException(status_code=409, detail="Gateway draft changed; test it again.")

    old_active = get_configuration(db, "active")
    if old_active is not None:
        old_health = db.scalar(
            select(GatewayHealthStatus).where(GatewayHealthStatus.scope == "active")
        )
        if old_health is not None:
            db.delete(old_health)
        db.delete(old_active)
        db.flush()

    draft.slot = "active"
    draft.updated_by = actor
    draft.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    draft_health = db.scalar(
        select(GatewayHealthStatus).where(
            GatewayHealthStatus.scope == "draft",
            GatewayHealthStatus.config_id == draft.id,
        ).execution_options(populate_existing=True)
    )
    if draft_health is not None:
        draft_health.scope = "active"

    db.add(GatewayConfigAudit(
        action="DRAFT_ACTIVATED",
        actor=actor,
        config_id=draft.id,
        scope="active",
        changes={"previous_active_config_id": old_active.id if old_active else None},
        result_status="CONNECTED",
    ))
    db.commit()
    db.refresh(draft)
    return draft
