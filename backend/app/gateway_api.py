"""Admin-only management API for the AI Engineering Data Gateway."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import require_roles
from .db import get_db
from .gateway_config import (
    GatewayConfigError,
    discard_draft,
    gateway_transport_for,
    get_configuration,
    promote_draft,
    runtime_config,
    save_draft,
)
from .gateway_health import check_and_save_health, health_view
from .models import GatewayConfigAudit, GatewayConfiguration, UserRole
from .schemas import (
    GatewayConfigAuditOut,
    GatewayConfigurationOut,
    GatewayDraftIn,
    GatewayHealthOut,
    GatewayStateOut,
)


router = APIRouter(prefix="/api/gateway", tags=["gateway"])
ADMIN = require_roles(UserRole.ADMIN)


async def redact_gateway_validation_errors(request: Request, exc: RequestValidationError):
    if request.url.path == "/api/gateway/draft":
        field_messages = [
            f"{'.'.join(str(part) for part in error.get('loc', []))}: {error.get('msg', 'Invalid input')}"
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"detail": "Gateway configuration request is invalid. " + "; ".join(field_messages)},
        )
    return await request_validation_exception_handler(request, exc)


def _health_out(db: Session, slot: str, configuration: GatewayConfiguration | None):
    return GatewayHealthOut.model_validate(health_view(db, slot, configuration))


def _configuration_out(
    db: Session,
    slot: str,
    configuration: GatewayConfiguration | None,
) -> GatewayConfigurationOut | None:
    if configuration is None:
        return None
    return GatewayConfigurationOut(
        id=configuration.id,
        slot=configuration.slot,
        base_url=configuration.base_url,
        request_timeout_seconds=configuration.request_timeout_seconds,
        token_configured=bool(configuration.bearer_token),
        revision=configuration.revision,
        created_by=configuration.created_by,
        updated_by=configuration.updated_by,
        created_at=configuration.created_at,
        updated_at=configuration.updated_at,
        health=_health_out(db, slot, configuration),
    )


def _state(db: Session) -> GatewayStateOut:
    active = get_configuration(db, "active")
    draft = get_configuration(db, "draft")
    return GatewayStateOut(
        active=_configuration_out(db, "active", active),
        draft=_configuration_out(db, "draft", draft),
    )


def _test_configuration(
    db: Session,
    *,
    slot: str,
    actor: str,
    transport,
) -> tuple[bool, str, int]:
    configuration = get_configuration(db, slot)
    if configuration is None:
        raise HTTPException(status_code=404, detail=f"Gateway {slot} configuration not found.")
    snapshot = runtime_config(configuration)
    revision = configuration.revision
    # Release the read transaction while the provider request is in flight.
    db.commit()
    saved, _observation = check_and_save_health(
        db,
        snapshot,
        scope=slot,
        transport=transport,
    )
    if not saved:
        latest = get_configuration(db, slot)
        db.add(GatewayConfigAudit(
            action="CONNECTION_TESTED",
            actor=actor,
            config_id=snapshot.config_id,
            scope=slot,
            changes={
                "tested_revision": revision,
                "result_discarded": True,
                "current_revision": latest.revision if latest else None,
            },
            result_status="UNKNOWN",
        ))
        db.commit()
        raise HTTPException(
            status_code=409,
            detail="Gateway configuration changed during the check. Reload and test again.",
        )

    result_status = health_view(db, slot, snapshot)["status"]
    db.add(GatewayConfigAudit(
        action="CONNECTION_TESTED",
        actor=actor,
        config_id=snapshot.config_id,
        scope=slot,
        changes={"revision": revision},
        result_status=result_status,
    ))
    db.commit()
    return True, result_status, revision


@router.get("", response_model=GatewayStateOut)
def get_gateway(
    _current_user=Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return _state(db)


@router.put("/draft", response_model=GatewayStateOut)
def put_gateway_draft(
    payload: GatewayDraftIn,
    current_user=Depends(ADMIN),
    db: Session = Depends(get_db),
):
    try:
        save_draft(db, payload, actor=current_user.username)
    except GatewayConfigError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message}) from exc
    return _state(db)


@router.post("/draft/check", response_model=GatewayStateOut)
def check_gateway_draft(
    request: Request,
    current_user=Depends(ADMIN),
    db: Session = Depends(get_db),
):
    _test_configuration(
        db,
        slot="draft",
        actor=current_user.username,
        transport=gateway_transport_for(request.app.state),
    )
    return _state(db)


@router.post("/draft/activate", response_model=GatewayStateOut)
def activate_gateway_draft(
    request: Request,
    current_user=Depends(ADMIN),
    db: Session = Depends(get_db),
):
    draft = get_configuration(db, "draft")
    if draft is None:
        raise HTTPException(status_code=404, detail="Gateway draft not found.")
    snapshot = runtime_config(draft)
    revision = draft.revision
    db.commit()
    saved, _observation = check_and_save_health(
        db,
        snapshot,
        scope="draft",
        transport=gateway_transport_for(request.app.state),
    )
    if not saved:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Gateway draft changed during activation. Reload and try again.",
        )

    result_status = health_view(db, "draft", snapshot)["status"]
    db.add(GatewayConfigAudit(
        action="CONNECTION_TESTED",
        actor=current_user.username,
        config_id=snapshot.config_id,
        scope="draft",
        changes={"revision": revision, "activation_check": True},
        result_status=result_status,
    ))
    db.commit()
    if result_status != "CONNECTED":
        raise HTTPException(
            status_code=409,
            detail="Gateway draft must be CONNECTED before activation.",
        )

    promote_draft(db, actor=current_user.username, expected_revision=revision)
    return _state(db)


@router.delete("/draft", status_code=204)
def delete_gateway_draft(
    current_user=Depends(ADMIN),
    db: Session = Depends(get_db),
):
    discard_draft(db, actor=current_user.username)
    return Response(status_code=204)


@router.post("/active/check", response_model=GatewayStateOut)
def check_active_gateway(
    request: Request,
    current_user=Depends(ADMIN),
    db: Session = Depends(get_db),
):
    _test_configuration(
        db,
        slot="active",
        actor=current_user.username,
        transport=gateway_transport_for(request.app.state),
    )
    return _state(db)


@router.get("/audits", response_model=list[GatewayConfigAuditOut])
def list_gateway_audits(
    limit: int = 50,
    _current_user=Depends(ADMIN),
    db: Session = Depends(get_db),
):
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
    audits = db.scalars(
        select(GatewayConfigAudit)
        .order_by(GatewayConfigAudit.created_at.desc(), GatewayConfigAudit.id.desc())
        .limit(limit)
    ).all()
    return [
        GatewayConfigAuditOut(
            id=audit.id,
            action=audit.action,
            actor=audit.actor,
            config_id=audit.config_id,
            scope=audit.scope,
            changes=audit.changes or {},
            result_status=audit.result_status,
            created_at=audit.created_at,
        )
        for audit in audits
    ]
