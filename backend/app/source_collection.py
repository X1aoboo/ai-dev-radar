"""IR Gateway collection, team-level staging, and complete-period windows."""

from collections import Counter
from datetime import datetime, timedelta, timezone
import json
import logging
from uuid import uuid4
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.session import sessionmaker

from .collector_contracts import (
    CollectorIRRecord,
    CollectorIRRequest,
    ProductVersionRef,
)
from .collector_gateway import GatewayFailure, collect_ir_records, create_gateway_client
from .db import SessionLocal
from .ir_imports import IRImportRowInput, create_ir_import_batch
from .models import (
    CollectionRun,
    CollectionSchedule,
    Iteration,
    Product,
    ProductVersion,
    Team,
)


LOGGER = logging.getLogger(__name__)
COLLECTION_TIMEZONE = ZoneInfo("Asia/Shanghai")
SCHEDULED_COLLECTOR_ACTOR = "scheduled-collector"
IR_BUSINESS_FIELDS = (
    "requirement_name",
    "responsible_employee_id",
    "parent_requirement_no",
    "completed_at",
    "business_module",
    "requirement_scenario",
    "estimated_workload",
    "actual_workload",
    "sa_estimated_workload",
    "sa_actual_workload",
    "se_estimated_workload",
    "se_actual_workload",
    "ai_assisted",
)
COLLECTOR_RECORD_FIELDS = frozenset({
    "source_id",
    "source_system",
    "product_name",
    "version_name",
    "iteration_name",
    *IR_BUSINESS_FIELDS,
})


def previous_complete_window(
    cadence: str,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Return the previous complete hourly, daily, weekly, or monthly interval."""

    current = (now or datetime.now(COLLECTION_TIMEZONE)).astimezone(COLLECTION_TIMEZONE)
    if cadence == "hourly":
        end_at = current.replace(minute=0, second=0, microsecond=0)
        return end_at - timedelta(hours=1), end_at
    if cadence == "daily":
        end_at = current.replace(hour=0, minute=0, second=0, microsecond=0)
        return end_at - timedelta(days=1), end_at
    if cadence == "weekly":
        today = current.date()
        end_date = today - timedelta(days=today.weekday())
        end_at = datetime.combine(end_date, datetime.min.time(), COLLECTION_TIMEZONE)
        return end_at - timedelta(days=7), end_at
    if cadence == "monthly":
        end_at = current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if end_at.month == 1:
            start_at = end_at.replace(year=end_at.year - 1, month=12)
        else:
            start_at = end_at.replace(month=end_at.month - 1)
        return start_at, end_at
    raise ValueError(f"unsupported collection cadence: {cadence}")


def _record_errors(exc: ValidationError) -> list[str]:
    messages = []
    for error in exc.errors():
        field = str(error.get("loc", ["record"])[-1])
        if error.get("type") == "extra_forbidden":
            messages.append(f"采集响应包含未声明字段：{field}")
        else:
            messages.append(f"采集响应字段无效：{field}")
    return messages or ["采集响应记录无效"]


def _collector_row_input(
    db: Session,
    team: Team,
    raw: object,
    *,
    duplicate_source_id: bool,
    requested_product_versions: frozenset[tuple[str, str]],
) -> IRImportRowInput:
    errors: list[str] = []
    if not isinstance(raw, dict):
        return IRImportRowInput(raw={}, errors=["采集记录必须是 JSON 对象"])

    try:
        record = CollectorIRRecord.model_validate_json(
            json.dumps(raw, ensure_ascii=False, allow_nan=False)
        )
        values = record.model_dump(mode="python")
    except (ValidationError, TypeError, ValueError) as exc:
        values = {key: value for key, value in raw.items() if key in COLLECTOR_RECORD_FIELDS}
        if isinstance(exc, ValidationError):
            errors.extend(_record_errors(exc))
        else:
            errors.append("采集响应记录无法解析")

    source_id = values.get("source_id") if isinstance(values.get("source_id"), str) else None
    source_system = values.get("source_system") if isinstance(values.get("source_system"), str) else None
    if duplicate_source_id:
        errors.append("采集响应中 source_id 重复")

    import_row = {
        field: values[field]
        for field in IR_BUSINESS_FIELDS
        if field in values
    }
    business_module = import_row.get("business_module")
    if "business_module" in import_row and (
        business_module is None
        or (isinstance(business_module, str) and not business_module.strip())
    ):
        import_row["business_module"] = "通用模块"
    if source_id is not None:
        import_row["requirement_no"] = source_id

    product_name = values.get("product_name")
    version_name = values.get("version_name")
    if (
        isinstance(product_name, str)
        and product_name.strip()
        and isinstance(version_name, str)
        and version_name.strip()
    ):
        product_version = (product_name, version_name)
        if product_version not in requested_product_versions:
            errors.append("采集响应产品版本不在请求范围内")
        versions = db.scalars(
            select(ProductVersion)
            .options(joinedload(ProductVersion.product))
            .join(Product, ProductVersion.product_id == Product.id)
            .where(
                Product.team_id == team.id,
                Product.name == product_name,
                ProductVersion.name == version_name,
            )
        ).all()
        if len(versions) != 1:
            errors.append("产品与版本名称缺失或无法唯一匹配本地产品版本")
        else:
            version = versions[0]
            import_row["product_id"] = version.product_id
            import_row["version_id"] = version.id
            iteration_name = values.get("iteration_name")
            if isinstance(iteration_name, str) and iteration_name.strip():
                iterations = db.scalars(
                    select(Iteration).where(
                        Iteration.version_id == version.id,
                        Iteration.name == iteration_name,
                    )
                ).all()
                if len(iterations) != 1:
                    errors.append("迭代名称缺失或不属于该版本")
                else:
                    import_row["iteration_id"] = iterations[0].id
    return IRImportRowInput(
        raw=import_row,
        errors=errors,
        source_id=source_id,
        source_system=source_system,
    )


def _save_team_result(db: Session, run_id: int, result: dict) -> None:
    run = db.get(CollectionRun, run_id)
    if run is None:
        raise RuntimeError("collection run disappeared")
    run.team_results = [*(run.team_results or []), result]
    db.commit()


def _resolve_product_versions(
    db: Session,
    team: Team,
    configured_version_names: object,
    *,
    request_id: str,
) -> list[ProductVersionRef]:
    if not isinstance(configured_version_names, list) or any(
        not isinstance(value, str) or not value.strip()
        for value in configured_version_names
    ):
        raise GatewayFailure(
            code="invalid_team_mapping",
            message="团队产品版本映射无效。",
            retryable=False,
            request_id=request_id,
        )

    versions = db.scalars(
        select(ProductVersion)
        .options(joinedload(ProductVersion.product))
        .join(Product, ProductVersion.product_id == Product.id)
        .where(
            Product.team_id == team.id,
            ProductVersion.name.in_(configured_version_names),
        )
        .order_by(ProductVersion.name, Product.name, ProductVersion.id)
    ).all()
    versions_by_name: dict[str, list[ProductVersion]] = {}
    for version in versions:
        versions_by_name.setdefault(version.name, []).append(version)

    resolved: list[ProductVersionRef] = []
    seen: set[tuple[str, str]] = set()
    for configured_name in configured_version_names:
        matches = versions_by_name.get(configured_name, [])
        if not matches:
            raise GatewayFailure(
                code="invalid_team_mapping",
                message="团队产品版本映射无法匹配本地产品版本。",
                retryable=False,
                request_id=request_id,
            )
        for version in matches:
            pair = (version.product.name, version.name)
            if pair in seen:
                raise GatewayFailure(
                    code="invalid_team_mapping",
                    message="团队产品版本映射包含重复项。",
                    retryable=False,
                    request_id=request_id,
                )
            seen.add(pair)
            resolved.append(
                ProductVersionRef(
                    product_name=version.product.name,
                    version_name=version.name,
                )
            )
    return resolved


def run_ir_collection(
    db: Session,
    *,
    start_at: datetime,
    end_at: datetime,
    started_by: str,
    trigger_type: str,
    transport: httpx.BaseTransport | None = None,
) -> CollectionRun:
    if start_at.tzinfo is None or start_at.utcoffset() is None:
        raise HTTPException(status_code=422, detail="start_at must include a timezone")
    if end_at.tzinfo is None or end_at.utcoffset() is None:
        raise HTTPException(status_code=422, detail="end_at must include a timezone")
    if start_at >= end_at:
        raise HTTPException(status_code=422, detail="start_at must be earlier than end_at")

    run = CollectionRun(
        domain="ir",
        trigger_type=trigger_type,
        status="running",
        started_by=started_by,
        window_start_at=start_at.isoformat(),
        window_end_at=end_at.isoformat(),
    )
    db.add(run)
    db.commit()
    run_id = run.id
    teams = db.scalars(select(Team).order_by(Team.id)).all()
    gateway_client: httpx.Client | None = None
    team_results: list[dict] = []

    for team in teams:
        team_id, team_name = team.id, team.name
        mapping = team.source_mapping or {}
        product_versions = mapping.get("product_versions", []) if isinstance(mapping, dict) else None
        if product_versions == []:
            result = {
                "team_id": team_id,
                "team_name": team_name,
                "status": "skipped",
                "message": "团队未配置产品版本，已跳过。",
                "retryable": False,
            }
            team_results.append(result)
            _save_team_result(db, run_id, result)
            continue

        request_id = str(uuid4())
        try:
            resolved_product_versions = _resolve_product_versions(
                db,
                team,
                product_versions,
                request_id=request_id,
            )
            request = CollectorIRRequest(
                request_id=request_id,
                product_versions=resolved_product_versions,
                start_at=start_at,
                end_at=end_at,
            )
            if gateway_client is None:
                gateway_client = create_gateway_client(
                    request_id=request_id,
                    transport=transport,
                )
            records = collect_ir_records(gateway_client, request)
            record_ids = [
                item.get("source_id")
                for item in records
                if isinstance(item, dict) and isinstance(item.get("source_id"), str)
            ]
            duplicate_ids = {
                source_id
                for source_id, count in Counter(record_ids).items()
                if count > 1
            }
            requested_product_versions = frozenset(
                (item.product_name, item.version_name)
                for item in resolved_product_versions
            )
            row_inputs = [
                _collector_row_input(
                    db,
                    team,
                    item,
                    duplicate_source_id=(
                        isinstance(item, dict)
                        and isinstance(item.get("source_id"), str)
                        and item.get("source_id") in duplicate_ids
                    ),
                    requested_product_versions=requested_product_versions,
                )
                for item in records
            ]
            batch_id = None
            if row_inputs:
                batch = create_ir_import_batch(
                    db,
                    row_inputs,
                    source_kind="collector",
                    team_id=team_id,
                    created_by=started_by,
                    first_row_number=1,
                )
                db.commit()
                batch_id = batch.id
            result = {
                "team_id": team_id,
                "team_name": team_name,
                "status": "succeeded",
                "request_id": request_id,
                "batch_id": batch_id,
                "record_count": len(records),
                "retryable": False,
                "message": "采集成功。" if records else "采集成功，Gateway 未返回记录。",
            }
        except GatewayFailure as exc:
            db.rollback()
            result = {
                "team_id": team_id,
                "team_name": team_name,
                "status": "failed",
                "request_id": exc.request_id or request_id,
                "code": exc.code,
                "message": exc.message,
                "retryable": exc.retryable,
            }
        except Exception as exc:
            db.rollback()
            LOGGER.error(
                "IR collection failed for team_id=%s error_type=%s",
                team_id,
                type(exc).__name__,
            )
            result = {
                "team_id": team_id,
                "team_name": team_name,
                "status": "failed",
                "request_id": locals().get("request_id"),
                "code": "collection_processing_error",
                "message": "采集结果处理失败。",
                "retryable": False,
            }
        team_results.append(result)
        try:
            _save_team_result(db, run_id, result)
        except Exception as exc:
            db.rollback()
            LOGGER.error(
                "IR collection result persistence failed for team_id=%s error_type=%s",
                team_id,
                type(exc).__name__,
            )

    if gateway_client is not None:
        gateway_client.close()
    statuses = {result["status"] for result in team_results}
    if "failed" in statuses:
        status = "partial" if "succeeded" in statuses or "skipped" in statuses else "failed"
    else:
        status = "succeeded"
    run = db.get(CollectionRun, run_id)
    run.status = status
    run.team_results = team_results
    run.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return run


def run_scheduled_source_collection(
    domain: str = "ir",
    session_factory: sessionmaker = SessionLocal,
) -> CollectionRun | None:
    if domain != "ir":
        raise ValueError(f"unsupported collection domain: {domain}")
    with session_factory() as db:
        schedule = db.scalar(
            select(CollectionSchedule).where(CollectionSchedule.domain == "ir")
        )
        if schedule is None or not schedule.enabled:
            return None
        start_at, end_at = previous_complete_window(schedule.cadence)
        return run_ir_collection(
            db,
            start_at=start_at,
            end_at=end_at,
            started_by=SCHEDULED_COLLECTOR_ACTOR,
            trigger_type="scheduled",
        )


def ensure_ir_collection_schedule(session_factory: sessionmaker = SessionLocal) -> None:
    with session_factory() as db:
        schedule = db.scalar(
            select(CollectionSchedule).where(CollectionSchedule.domain == "ir")
        )
        if schedule is None:
            db.add(CollectionSchedule(
                domain="ir",
                enabled=False,
                cadence="daily",
                minute=0,
                hour=2,
                timezone="Asia/Shanghai",
                updated_by="system",
            ))
            db.commit()
