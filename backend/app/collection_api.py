"""Administrator API for domain schedules and synchronous manual collection."""

from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user, require_roles
from .db import get_db
from .gateway_config import gateway_transport_for
from .models import CollectionRun, CollectionSchedule, User, UserRole
from .scheduler import apply_source_collection_schedule
from .schemas import (
    CollectionRunIn,
    CollectionRunOut,
    CollectionScheduleListOut,
    CollectionScheduleOut,
    CollectionScheduleUpdateIn,
)
from .source_collection import previous_complete_window, run_ir_collection


router = APIRouter(prefix="/api")
ADMIN = require_roles(UserRole.ADMIN)


def _schedule_out(schedule: CollectionSchedule) -> CollectionScheduleOut:
    return CollectionScheduleOut(
        domain=schedule.domain,
        enabled=schedule.enabled,
        cadence=schedule.cadence,
        minute=schedule.minute,
        hour=schedule.hour,
        day_of_week=schedule.day_of_week,
        day_of_month=schedule.day_of_month,
        timezone=schedule.timezone,
        updated_by=schedule.updated_by,
        updated_at=schedule.updated_at,
    )


def _run_out(run: CollectionRun) -> CollectionRunOut:
    return CollectionRunOut(
        id=run.id,
        domain=run.domain,
        trigger_type=run.trigger_type,
        status=run.status,
        started_by=run.started_by,
        window_start_at=run.window_start_at,
        window_end_at=run.window_end_at,
        gateway_config_id=run.gateway_config_id,
        gateway_base_url=run.gateway_base_url,
        error_code=run.error_code,
        message=run.message,
        retryable=run.retryable,
        team_results=run.team_results or [],
        started_at=run.started_at,
        completed_at=run.completed_at,
    )


def _schedule_or_404(db: Session, domain: str) -> CollectionSchedule:
    if domain != "ir":
        raise HTTPException(status_code=404, detail="collection domain not found")
    schedule = db.scalar(
        select(CollectionSchedule).where(CollectionSchedule.domain == domain)
    )
    if schedule is None:
        raise HTTPException(status_code=404, detail="collection schedule not found")
    return schedule


@router.get("/collection-schedules", response_model=CollectionScheduleListOut)
def list_collection_schedules(
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    schedules = db.scalars(
        select(CollectionSchedule).order_by(CollectionSchedule.domain)
    ).all()
    runs = db.scalars(
        select(CollectionRun)
        .where(CollectionRun.domain == "ir")
        .order_by(CollectionRun.started_at.desc(), CollectionRun.id.desc())
        .limit(20)
    ).all()
    return CollectionScheduleListOut(
        schedules=[_schedule_out(schedule) for schedule in schedules],
        recent_runs=[_run_out(run) for run in runs],
    )


@router.put("/collection-schedules/{domain}", response_model=CollectionScheduleOut)
def update_collection_schedule(
    domain: str,
    payload: CollectionScheduleUpdateIn,
    request: Request,
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    schedule = _schedule_or_404(db, domain)
    schedule.enabled = payload.enabled
    schedule.cadence = payload.cadence
    schedule.minute = payload.minute
    schedule.hour = payload.hour
    schedule.day_of_week = payload.day_of_week
    schedule.day_of_month = payload.day_of_month
    schedule.timezone = "Asia/Shanghai"
    schedule.updated_by = current_user.username
    schedule.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(schedule)

    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler is not None:
        apply_source_collection_schedule(scheduler, schedule)
    return _schedule_out(schedule)


@router.post("/collection-schedules/{domain}/run", response_model=CollectionRunOut)
def run_collection_now(
    domain: str,
    request: Request,
    payload: CollectionRunIn | None = Body(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    schedule = _schedule_or_404(db, domain)
    if payload is not None and payload.start_at is not None:
        start_at, end_at = payload.start_at, payload.end_at
    else:
        start_at, end_at = previous_complete_window(schedule.cadence)
    run = run_ir_collection(
        db,
        start_at=start_at,
        end_at=end_at,
        started_by=current_user.username,
        trigger_type="manual",
        transport=gateway_transport_for(request.app.state),
    )
    return _run_out(run)
