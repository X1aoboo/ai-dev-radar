"""数据管理工作台的 HTTP 接口。

旧版 ``api.py`` 保持事实看板兼容；本模块提供源数据、临时批次和 AI 指标的
独立接口。路由层只编排认证和事务，领域规则集中在 ``data_management``。
"""

from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any
import zipfile

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from .auth import get_current_user, require_roles
from .data_management import (
    IR_FIELDS,
    calculate_data_metric,
    field_diff,
    json_changes,
    merge_empty_fields,
    normalize_ir_row,
    parse_import_file,
    record_is_valid,
    serializable_payload,
)
from .db import get_db
from .models import (
    AuditLog,
    DataMetricDefinition,
    IRRequirement,
    ImportBatch,
    ImportRow,
    Iteration,
    Product,
    ProductVersion,
    Team,
    TeamMember,
    User,
    UserRole,
)
from .schemas import (
    DataMetricComputeOut,
    DataMetricDefinitionIn,
    DataMetricDefinitionOut,
    DataMetricDefinitionUpdateIn,
    IRListOut,
    IRRequirementIn,
    IRRequirementOut,
    IRRequirementUpdateIn,
    ImportBatchOut,
    ImportConfirmOut,
    ImportPreviewIn,
    ImportRowOut,
    IterationIn,
    IterationOut,
    IterationUpdateIn,
    ProductIn,
    ProductOut,
    ProductUpdateIn,
    VersionIn,
    VersionOut,
    VersionSummaryOut,
    VersionUpdateIn,
    TeamMemberIn,
    TeamMemberOut,
    TeamMemberUpdateIn,
)


router = APIRouter(prefix="/api")
DATA_EDITOR = require_roles(UserRole.ADMIN, UserRole.MAINTAINER)
ADMIN = require_roles(UserRole.ADMIN)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _commit(db: Session, entity: Any):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="resource already exists") from exc
    db.refresh(entity)
    return entity


def _team_access(current_user: User, team_id: int, *, write: bool = False) -> None:
    if current_user.role == UserRole.ADMIN.value:
        return
    if current_user.role == UserRole.MAINTAINER.value and current_user.maintainer_team_id == team_id:
        if write:
            return
        return
    if write:
        raise HTTPException(status_code=403, detail="team access denied")
    raise HTTPException(status_code=403, detail="team access denied")


def _product_or_404(db: Session, product_id: int) -> Product:
    product = db.scalar(select(Product).options(joinedload(Product.team)).where(Product.id == product_id))
    if product is None:
        raise HTTPException(status_code=404, detail="product not found")
    return product


def _version_or_404(db: Session, version_id: int) -> ProductVersion:
    version = db.scalar(
        select(ProductVersion)
        .options(joinedload(ProductVersion.product).joinedload(Product.team))
        .where(ProductVersion.id == version_id)
    )
    if version is None:
        raise HTTPException(status_code=404, detail="version not found")
    return version


def _iteration_or_404(db: Session, iteration_id: int) -> Iteration:
    iteration = db.scalar(
        select(Iteration)
        .options(joinedload(Iteration.version).joinedload(ProductVersion.product).joinedload(Product.team))
        .where(Iteration.id == iteration_id)
    )
    if iteration is None:
        raise HTTPException(status_code=404, detail="iteration not found")
    return iteration


def _validate_hierarchy(db: Session, product_id: int, version_id: int, iteration_id: int) -> Product:
    product = _product_or_404(db, product_id)
    version = _version_or_404(db, version_id)
    iteration = _iteration_or_404(db, iteration_id)
    if version.product_id != product.id:
        raise HTTPException(status_code=422, detail="version does not belong to product")
    if iteration.version_id != version.id:
        raise HTTPException(status_code=422, detail="iteration does not belong to version")
    return product


def _product_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        team_id=product.team_id,
        team_name=product.team.name,
        name=product.name,
        versions=[
            VersionSummaryOut(id=version.id, name=version.name, product_id=version.product_id)
            for version in product.versions
        ],
    )


def _version_out(version: ProductVersion) -> VersionOut:
    product = version.product
    team = product.team if product is not None else None
    return VersionOut(
        id=version.id,
        name=version.name,
        product_id=version.product_id,
        product_name=product.name if product is not None else None,
        team_id=product.team_id if product is not None else None,
        team_name=team.name if team is not None else None,
        iterations=[
            IterationOut(
                id=iteration.id,
                version_id=version.id,
                version_name=version.name,
                name=iteration.name,
                start_date=iteration.start_date,
                end_date=iteration.end_date,
            )
            for iteration in version.iterations
        ],
    )


def _iteration_out(iteration: Iteration) -> IterationOut:
    return IterationOut(
        id=iteration.id,
        version_id=iteration.version_id,
        version_name=iteration.version.name if iteration.version is not None else None,
        name=iteration.name,
        start_date=iteration.start_date,
        end_date=iteration.end_date,
    )


@router.get("/products", response_model=list[ProductOut])
def list_products(
    team_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if team_id is not None and current_user.role == UserRole.MAINTAINER.value:
        _team_access(current_user, team_id)
    stmt = (
        select(Product)
        .options(joinedload(Product.team), selectinload(Product.versions))
        .order_by(Product.team_id, Product.name)
    )
    if team_id is not None:
        stmt = stmt.where(Product.team_id == team_id)
    if current_user.role == UserRole.MAINTAINER.value:
        stmt = stmt.where(Product.team_id == current_user.maintainer_team_id)
    return [_product_out(product) for product in db.scalars(stmt).unique().all()]


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    team = db.get(Team, payload.team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="team not found")
    product = Product(team_id=team.id, name=payload.name)
    db.add(product)
    db.flush()
    product.team = team
    _commit(db, product)
    return _product_out(product)


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdateIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    product = db.scalar(select(Product).options(joinedload(Product.team), selectinload(Product.versions)).where(Product.id == product_id))
    if product is None:
        raise HTTPException(status_code=404, detail="product not found")
    changes = payload.model_dump(exclude_unset=True)
    if "team_id" in changes and changes["team_id"] != product.team_id:
        has_ir = db.scalar(select(func.count()).select_from(IRRequirement).where(IRRequirement.product_id == product.id))
        if has_ir:
            raise HTTPException(status_code=409, detail="cannot move a product with IR data")
        if db.get(Team, changes["team_id"]) is None:
            raise HTTPException(status_code=404, detail="team not found")
    for field, value in changes.items():
        setattr(product, field, value)
    _commit(db, product)
    return _product_out(product)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    product = _product_or_404(db, product_id)
    has_versions = db.scalar(select(func.count()).select_from(ProductVersion).where(ProductVersion.product_id == product.id))
    has_ir = db.scalar(select(func.count()).select_from(IRRequirement).where(IRRequirement.product_id == product.id))
    if has_versions or has_ir:
        raise HTTPException(status_code=409, detail="product is referenced by versions or IR data")
    db.delete(product)
    db.commit()


@router.post("/versions", response_model=VersionOut, status_code=201)
def create_version(
    payload: VersionIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    product = _product_or_404(db, payload.product_id)
    sort_order = int(db.scalar(select(func.max(ProductVersion.sort_order))) or -1) + 1
    version = ProductVersion(product_id=product.id, name=payload.name, sort_order=sort_order)
    db.add(version)
    db.flush()
    version.product = product
    version.iterations = []
    _commit(db, version)
    return _version_out(version)


@router.patch("/versions/{version_id}", response_model=VersionOut)
def update_version(
    version_id: int,
    payload: VersionUpdateIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    version = _version_or_404(db, version_id)
    changes = payload.model_dump(exclude_unset=True)
    if "product_id" in changes and changes["product_id"] != version.product_id:
        has_ir = db.scalar(select(func.count()).select_from(IRRequirement).where(IRRequirement.version_id == version.id))
        if has_ir:
            raise HTTPException(status_code=409, detail="cannot move a version with IR data")
        _product_or_404(db, changes["product_id"])
    for field, value in changes.items():
        setattr(version, field, value)
    _commit(db, version)
    return _version_out(version)


@router.delete("/versions/{version_id}", status_code=204)
def delete_version(
    version_id: int,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    version = _version_or_404(db, version_id)
    has_iterations = db.scalar(select(func.count()).select_from(Iteration).where(Iteration.version_id == version.id))
    has_ir = db.scalar(select(func.count()).select_from(IRRequirement).where(IRRequirement.version_id == version.id))
    if has_iterations or has_ir:
        raise HTTPException(status_code=409, detail="version is referenced by iterations or IR data")
    db.delete(version)
    db.commit()


@router.post("/iterations", response_model=IterationOut, status_code=201)
def create_iteration(
    payload: IterationIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    version = _version_or_404(db, payload.version_id)
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=422, detail="start_date must not be after end_date")
    sort_order = int(db.scalar(select(func.max(Iteration.sort_order)).where(Iteration.version_id == version.id)) or -1) + 1
    iteration = Iteration(
        version_id=version.id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        sort_order=sort_order,
    )
    db.add(iteration)
    db.flush()
    iteration.version = version
    _commit(db, iteration)
    return _iteration_out(iteration)


@router.patch("/iterations/{iteration_id}", response_model=IterationOut)
def update_iteration(
    iteration_id: int,
    payload: IterationUpdateIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    iteration = _iteration_or_404(db, iteration_id)
    changes = payload.model_dump(exclude_unset=True)
    next_start = changes.get("start_date", iteration.start_date)
    next_end = changes.get("end_date", iteration.end_date)
    if next_start > next_end:
        raise HTTPException(status_code=422, detail="start_date must not be after end_date")
    if "version_id" in changes and changes["version_id"] != iteration.version_id:
        has_ir = db.scalar(select(func.count()).select_from(IRRequirement).where(IRRequirement.iteration_id == iteration.id))
        if has_ir:
            raise HTTPException(status_code=409, detail="cannot move an iteration with IR data")
        _version_or_404(db, changes["version_id"])
    for field, value in changes.items():
        setattr(iteration, field, value)
    _commit(db, iteration)
    return _iteration_out(iteration)


@router.delete("/iterations/{iteration_id}", status_code=204)
def delete_iteration(
    iteration_id: int,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    iteration = _iteration_or_404(db, iteration_id)
    has_ir = db.scalar(select(func.count()).select_from(IRRequirement).where(IRRequirement.iteration_id == iteration.id))
    if has_ir:
        raise HTTPException(status_code=409, detail="iteration is referenced by IR data")
    db.delete(iteration)
    db.commit()


@router.get("/team-members", response_model=list[TeamMemberOut])
def list_team_members(
    team_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if team_id is not None and current_user.role == UserRole.MAINTAINER.value:
        _team_access(current_user, team_id)
    stmt = select(TeamMember).order_by(TeamMember.team_id, TeamMember.employee_id)
    if team_id is not None:
        stmt = stmt.where(TeamMember.team_id == team_id)
    if current_user.role == UserRole.MAINTAINER.value:
        stmt = stmt.where(TeamMember.team_id == current_user.maintainer_team_id)
    return db.scalars(stmt).all()


@router.post("/team-members", response_model=TeamMemberOut, status_code=201)
def create_team_member(
    payload: TeamMemberIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    if db.get(Team, payload.team_id) is None:
        raise HTTPException(status_code=404, detail="team not found")
    member = TeamMember(**payload.model_dump())
    db.add(member)
    return _commit(db, member)


@router.patch("/team-members/{member_id}", response_model=TeamMemberOut)
def update_team_member(
    member_id: int,
    payload: TeamMemberUpdateIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    member = db.get(TeamMember, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="team member not found")
    changes = payload.model_dump(exclude_unset=True)
    if "team_id" in changes and db.get(Team, changes["team_id"]) is None:
        raise HTTPException(status_code=404, detail="team not found")
    for field, value in changes.items():
        setattr(member, field, value)
    return _commit(db, member)


@router.delete("/team-members/{member_id}", status_code=204)
def delete_team_member(
    member_id: int,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    member = db.get(TeamMember, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="team member not found")
    db.delete(member)
    db.commit()


def _employee_for_team(db: Session, team_id: int, employee_id: str | None) -> TeamMember | None:
    if not employee_id:
        return None
    return db.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.employee_id == employee_id,
        )
    )


def _ir_out(db: Session, record: IRRequirement) -> IRRequirementOut:
    product = record.product
    version = record.version
    iteration = record.iteration
    team = product.team
    member = _employee_for_team(db, team.id, record.responsible_employee_id)
    return IRRequirementOut(
        id=record.id,
        requirement_no=record.requirement_no,
        requirement_name=record.requirement_name,
        responsible_employee_id=record.responsible_employee_id,
        responsible_employee_name=member.name if member else None,
        responsible_employee_pending=bool(record.responsible_employee_id and member is None),
        parent_requirement_no=record.parent_requirement_no,
        product_id=product.id,
        product_name=product.name,
        team_id=team.id,
        team_name=team.name,
        version_id=version.id,
        version_name=version.name,
        iteration_id=iteration.id,
        iteration_name=iteration.name,
        completed_at=record.completed_at,
        business_module=record.business_module,
        requirement_scenario=record.requirement_scenario,
        estimated_workload=record.estimated_workload,
        actual_workload=record.actual_workload,
        sa_estimated_workload=record.sa_estimated_workload,
        sa_actual_workload=record.sa_actual_workload,
        se_estimated_workload=record.se_estimated_workload,
        se_actual_workload=record.se_actual_workload,
        ai_assisted=record.ai_assisted,
        ai_attribute_metadata=record.ai_attribute_metadata or {},
        record_source=record.record_source,
        created_at=record.created_at,
        updated_at=record.updated_at,
        updated_by=record.updated_by,
        valid=record_is_valid(record),
    )


def _ir_record_query(db: Session):
    return (
        select(IRRequirement)
        .options(
            joinedload(IRRequirement.product).joinedload(Product.team),
            joinedload(IRRequirement.version),
            joinedload(IRRequirement.iteration),
        )
        .join(Product, IRRequirement.product_id == Product.id)
        .join(ProductVersion, IRRequirement.version_id == ProductVersion.id)
        .join(Iteration, IRRequirement.iteration_id == Iteration.id)
        .order_by(IRRequirement.completed_at.desc(), IRRequirement.id.desc())
    )


def _check_ir_write_access(current_user: User, team_id: int) -> None:
    if current_user.role == UserRole.ADMIN.value:
        return
    if current_user.role == UserRole.MAINTAINER.value and current_user.maintainer_team_id == team_id:
        return
    raise HTTPException(status_code=403, detail="team access denied")


def _validate_ir_record_refs(db: Session, payload: dict[str, Any]) -> Product:
    return _validate_hierarchy(
        db,
        int(payload["product_id"]),
        int(payload["version_id"]),
        int(payload["iteration_id"]),
    )


def _manual_ai_metadata(existing: dict[str, Any], actor: str) -> dict[str, Any]:
    metadata = deepcopy(existing or {})
    metadata["ai_assisted"] = {
        "source": "manual",
        "updated_by": actor,
        "updated_at": _now().isoformat(),
    }
    return metadata


@router.get("/data/ir", response_model=IRListOut)
def list_ir_requirements(
    team_id: int | None = None,
    product_id: int | None = None,
    version_id: int | None = None,
    iteration_id: int | None = None,
    requirement_no: str | None = None,
    responsible_employee_id: str | None = None,
    business_module: str | None = None,
    requirement_scenario: str | None = None,
    ai_assisted: bool | None = None,
    completed_from: date | None = None,
    completed_to: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if team_id is not None and current_user.role == UserRole.MAINTAINER.value:
        _check_ir_write_access(current_user, team_id)
    stmt = _ir_record_query(db)
    if current_user.role == UserRole.MAINTAINER.value:
        stmt = stmt.where(Product.team_id == current_user.maintainer_team_id)
    if team_id is not None:
        stmt = stmt.where(Product.team_id == team_id)
    if product_id is not None:
        stmt = stmt.where(IRRequirement.product_id == product_id)
    if version_id is not None:
        stmt = stmt.where(IRRequirement.version_id == version_id)
    if iteration_id is not None:
        stmt = stmt.where(IRRequirement.iteration_id == iteration_id)
    if requirement_no is not None:
        stmt = stmt.where(IRRequirement.requirement_no == requirement_no)
    if responsible_employee_id is not None:
        stmt = stmt.where(IRRequirement.responsible_employee_id == responsible_employee_id)
    if business_module is not None:
        stmt = stmt.where(IRRequirement.business_module == business_module)
    if requirement_scenario is not None:
        stmt = stmt.where(IRRequirement.requirement_scenario == requirement_scenario)
    if ai_assisted is not None:
        stmt = stmt.where(IRRequirement.ai_assisted == ai_assisted)
    if completed_from is not None:
        stmt = stmt.where(IRRequirement.completed_at >= completed_from)
    if completed_to is not None:
        stmt = stmt.where(IRRequirement.completed_at <= completed_to)

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    records = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return IRListOut(
        items=[_ir_out(db, record) for record in records],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/data/ir", response_model=IRRequirementOut, status_code=201)
def create_ir_requirement(
    payload: IRRequirementIn,
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    values = payload.model_dump()
    product = _validate_ir_record_refs(db, values)
    _check_ir_write_access(current_user, product.team_id)
    now = _now()
    metadata = {}
    if values.get("ai_assisted") is not None:
        metadata = _manual_ai_metadata({}, current_user.username)
    record = IRRequirement(
        **values,
        ai_attribute_metadata=metadata,
        record_source="manual",
        created_at=now,
        updated_at=now,
        updated_by=current_user.username,
    )
    db.add(record)
    db.flush()
    db.add(AuditLog(
        domain="ir",
        record_id=record.id,
        action="create",
        actor=current_user.username,
        source="manual",
        changes={field: {"from": None, "to": value} for field, value in serializable_payload(values).items()},
    ))
    _commit(db, record)
    return _ir_out(db, record)


@router.patch("/data/ir/{record_id}", response_model=IRRequirementOut)
def update_ir_requirement(
    record_id: int,
    payload: IRRequirementUpdateIn,
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    record = db.scalar(
        select(IRRequirement)
        .options(
            joinedload(IRRequirement.product).joinedload(Product.team),
            joinedload(IRRequirement.version),
            joinedload(IRRequirement.iteration),
        )
        .where(IRRequirement.id == record_id)
    )
    if record is None:
        raise HTTPException(status_code=404, detail="IR record not found")
    _check_ir_write_access(current_user, record.product.team_id)
    changes = payload.model_dump(exclude_unset=True)
    next_values = {
        field: changes.get(field, getattr(record, field))
        for field in IR_FIELDS
    }
    product = _validate_ir_record_refs(db, next_values)
    _check_ir_write_access(current_user, product.team_id)
    before = {field: getattr(record, field) for field in changes}
    for field, value in changes.items():
        setattr(record, field, value)
    if "ai_assisted" in changes:
        record.ai_attribute_metadata = _manual_ai_metadata(record.ai_attribute_metadata, current_user.username)
    record.record_source = "manual"
    record.updated_at = _now()
    record.updated_by = current_user.username
    db.add(AuditLog(
        domain="ir",
        record_id=record.id,
        action="update",
        actor=current_user.username,
        source="manual",
        changes={
            field: {
                "from": serializable_payload({"value": before[field]})["value"],
                "to": serializable_payload({"value": value})["value"],
            }
            for field, value in changes.items()
        },
    ))
    _commit(db, record)
    return _ir_out(db, record)


@router.get("/data/ir/{record_id}/audit-logs")
def list_ir_audit_logs(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.scalar(
        select(IRRequirement)
        .options(joinedload(IRRequirement.product).joinedload(Product.team))
        .where(IRRequirement.id == record_id)
    )
    if record is None:
        raise HTTPException(status_code=404, detail="IR record not found")
    _check_ir_write_access(current_user, record.product.team_id)
    return db.scalars(
        select(AuditLog)
        .where(AuditLog.domain == "ir", AuditLog.record_id == record_id)
        .order_by(AuditLog.id.desc())
    ).all()


def _batch_out(batch: ImportBatch) -> ImportBatchOut:
    rows = list(batch.rows)
    return ImportBatchOut(
        id=batch.id,
        domain=batch.domain,
        source_kind=batch.source_kind,
        filename=batch.filename,
        status=batch.status,
        created_by=batch.created_by,
        created_at=batch.created_at,
        confirmed_at=batch.confirmed_at,
        total_rows=len(rows),
        valid_rows=sum(row.status in {"valid", "applied"} for row in rows),
        invalid_rows=sum(row.status == "invalid" for row in rows),
        rows=[
            ImportRowOut(
                id=row.id,
                row_number=row.row_number,
                source_id=row.source_id,
                operation=row.operation,
                diff=row.diff or {},
                errors=row.errors or [],
                warnings=row.warnings or [],
                status=row.status,
                target_id=row.target_id,
                payload=row.payload or {},
            )
            for row in rows
        ],
    )


def _validate_import_row(
    db: Session,
    current_user: User,
    raw_row: dict[str, Any],
    row_number: int,
) -> ImportRow:
    normalized, errors = normalize_ir_row(raw_row)
    normalized = serializable_payload(normalized)
    warnings: list[str] = []
    existing = None
    if not errors and normalized.get("requirement_no"):
        try:
            product = _validate_ir_record_refs(db, normalized)
            _check_ir_write_access(current_user, product.team_id)
            if normalized.get("responsible_employee_id") and _employee_for_team(
                db, product.team_id, normalized["responsible_employee_id"]
            ) is None:
                warnings.append("责任人工号暂未在该团队人员中匹配")
            existing = db.scalar(
                select(IRRequirement).where(
                    IRRequirement.requirement_no == normalized["requirement_no"]
                )
            )
        except HTTPException as exc:
            errors.append(str(exc.detail))

    if not errors:
        try:
            IRRequirementIn.model_validate(normalized)
        except Exception as exc:
            errors.append(str(exc).split(" [type=", 1)[0])

    diff = field_diff(existing, normalized)
    if existing is None:
        operation = "insert"
    elif any(item["action"] == "fill" for item in diff.values()):
        operation = "fill"
    else:
        operation = "unchanged"
    return ImportRow(
        row_number=row_number,
        source_id=normalized.get("requirement_no"),
        payload=normalized,
        operation=operation,
        diff=diff,
        errors=errors,
        warnings=warnings,
        status="invalid" if errors else "valid",
        target_id=existing.id if existing is not None else None,
    )


async def _import_preview_payload(request: Request) -> ImportPreviewIn:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        return ImportPreviewIn.model_validate(await request.json())
    content = await request.body()
    filename = request.headers.get("x-filename") or request.query_params.get("filename")
    if not filename:
        raise HTTPException(status_code=422, detail="filename is required for file import")
    try:
        rows = parse_import_file(content, filename)
    except (ValueError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ImportPreviewIn(filename=filename, rows=rows)


@router.post("/data/ir/imports/preview", response_model=ImportBatchOut, status_code=201)
async def preview_ir_import(
    request: Request,
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    payload = await _import_preview_payload(request)
    batch = ImportBatch(
        domain="ir",
        source_kind=payload.source_kind,
        filename=payload.filename,
        status="pending",
        created_by=current_user.username,
    )
    db.add(batch)
    db.flush()
    for row_number, raw_row in enumerate(payload.rows, start=2):
        if not isinstance(raw_row, dict):
            raw_row = {}
        row = _validate_import_row(db, current_user, raw_row, row_number)
        row.batch_id = batch.id
        db.add(row)
    db.commit()
    db.refresh(batch)
    return _batch_out(batch)


@router.get("/data/ir/imports/{batch_id}", response_model=ImportBatchOut)
def get_ir_import(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch = db.scalar(
        select(ImportBatch)
        .options(selectinload(ImportBatch.rows))
        .where(ImportBatch.id == batch_id, ImportBatch.domain == "ir")
    )
    if batch is None:
        raise HTTPException(status_code=404, detail="import batch not found")
    if current_user.role != UserRole.ADMIN.value and batch.created_by != current_user.username:
        raise HTTPException(status_code=403, detail="import batch access denied")
    return _batch_out(batch)


def _import_audit_changes(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        field: {"from": None, "to": value}
        for field, value in serializable_payload(payload).items()
        if value is not None
    }


@router.post("/data/ir/imports/{batch_id}/confirm", response_model=ImportConfirmOut)
def confirm_ir_import(
    batch_id: int,
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    batch = db.scalar(
        select(ImportBatch)
        .options(selectinload(ImportBatch.rows))
        .where(ImportBatch.id == batch_id, ImportBatch.domain == "ir")
    )
    if batch is None:
        raise HTTPException(status_code=404, detail="import batch not found")
    if current_user.role != UserRole.ADMIN.value and batch.created_by != current_user.username:
        raise HTTPException(status_code=403, detail="import batch access denied")
    if batch.status != "pending":
        raise HTTPException(status_code=409, detail="import batch is not pending")
    invalid_rows = [row.row_number for row in batch.rows if row.status == "invalid"]
    if invalid_rows:
        raise HTTPException(
            status_code=422,
            detail={"message": "import batch contains invalid rows", "rows": invalid_rows},
        )

    created = updated = unchanged = 0
    try:
        for row in batch.rows:
            payload = IRRequirementIn.model_validate(row.payload).model_dump()
            product = _validate_ir_record_refs(db, payload)
            _check_ir_write_access(current_user, product.team_id)
            existing = db.scalar(
                select(IRRequirement).where(IRRequirement.requirement_no == payload["requirement_no"])
            )
            if existing is None:
                now = _now()
                metadata = {}
                if payload.get("ai_assisted") is not None:
                    metadata = {
                        "ai_assisted": {
                            "source": batch.source_kind,
                            "updated_by": current_user.username,
                            "updated_at": now.isoformat(),
                        }
                    }
                existing = IRRequirement(
                    **payload,
                    ai_attribute_metadata=metadata,
                    record_source=batch.source_kind,
                    created_at=now,
                    updated_at=now,
                    updated_by=current_user.username,
                )
                db.add(existing)
                db.flush()
                db.add(AuditLog(
                    domain="ir",
                    record_id=existing.id,
                    action="import_confirm",
                    actor=current_user.username,
                    source=batch.source_kind,
                    changes=_import_audit_changes(payload),
                ))
                created += 1
            else:
                changes = merge_empty_fields(existing, payload)
                if any(change["field"] == "ai_assisted" for change in changes):
                    existing.ai_attribute_metadata = {
                        **(existing.ai_attribute_metadata or {}),
                        "ai_assisted": {
                            "source": batch.source_kind,
                            "updated_by": current_user.username,
                            "updated_at": _now().isoformat(),
                        },
                    }
                if changes:
                    existing.updated_at = _now()
                    existing.updated_by = current_user.username
                    db.add(AuditLog(
                        domain="ir",
                        record_id=existing.id,
                        action="import_confirm",
                        actor=current_user.username,
                        source=batch.source_kind,
                        changes=json_changes(changes),
                    ))
                    updated += 1
                else:
                    unchanged += 1
            row.target_id = existing.id
            row.status = "applied"
        batch.status = "confirmed"
        batch.confirmed_at = _now()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return ImportConfirmOut(
        batch_id=batch.id,
        status=batch.status,
        created=created,
        updated=updated,
        unchanged=unchanged,
    )


def _metric_payload(metric: DataMetricDefinition) -> DataMetricDefinitionOut:
    return DataMetricDefinitionOut(
        id=metric.id,
        domain=metric.domain,
        code=metric.code,
        name=metric.name,
        metric_type=metric.metric_type,
        activity_code=metric.activity_code,
        numerator_field=metric.numerator_field,
        denominator_field=metric.denominator_field,
        filter_definition=metric.filter_definition or {},
        active=metric.active,
        created_at=metric.created_at,
        updated_at=metric.updated_at,
    )


@router.get("/data-metrics", response_model=list[DataMetricDefinitionOut])
def list_data_metrics(
    domain: str | None = None,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(DataMetricDefinition).order_by(DataMetricDefinition.domain, DataMetricDefinition.id)
    if domain is not None:
        stmt = stmt.where(DataMetricDefinition.domain == domain)
    return [_metric_payload(metric) for metric in db.scalars(stmt).all()]


@router.post("/data-metrics", response_model=DataMetricDefinitionOut, status_code=201)
def create_data_metric(
    payload: DataMetricDefinitionIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    if payload.domain != "ir":
        raise HTTPException(status_code=422, detail="only the IR data domain is available in this version")
    metric = DataMetricDefinition(**payload.model_dump())
    db.add(metric)
    return _commit(db, metric)


@router.patch("/data-metrics/{metric_id}", response_model=DataMetricDefinitionOut)
def update_data_metric(
    metric_id: int,
    payload: DataMetricDefinitionUpdateIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    metric = db.get(DataMetricDefinition, metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail="data metric not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("domain") not in (None, "ir"):
        raise HTTPException(status_code=422, detail="only the IR data domain is available in this version")
    for field, value in changes.items():
        setattr(metric, field, value)
    metric.updated_at = _now()
    return _commit(db, metric)


@router.delete("/data-metrics/{metric_id}", status_code=204)
def delete_data_metric(
    metric_id: int,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    metric = db.get(DataMetricDefinition, metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail="data metric not found")
    db.delete(metric)
    db.commit()


def _ir_metric_records(
    db: Session,
    current_user: User,
    *,
    team_id: int | None,
    product_id: int | None,
    version_id: int | None,
    iteration_id: int | None,
    responsible_employee_id: str | None,
    business_module: str | None,
    requirement_scenario: str | None,
    completed_from: date | None,
    completed_to: date | None,
) -> list[IRRequirement]:
    if team_id is not None and current_user.role == UserRole.MAINTAINER.value:
        _check_ir_write_access(current_user, team_id)
    stmt = _ir_record_query(db)
    if current_user.role == UserRole.MAINTAINER.value:
        stmt = stmt.where(Product.team_id == current_user.maintainer_team_id)
    if team_id is not None:
        stmt = stmt.where(Product.team_id == team_id)
    if product_id is not None:
        stmt = stmt.where(IRRequirement.product_id == product_id)
    if version_id is not None:
        stmt = stmt.where(IRRequirement.version_id == version_id)
    if iteration_id is not None:
        stmt = stmt.where(IRRequirement.iteration_id == iteration_id)
    if responsible_employee_id is not None:
        stmt = stmt.where(IRRequirement.responsible_employee_id == responsible_employee_id)
    if business_module is not None:
        stmt = stmt.where(IRRequirement.business_module == business_module)
    if requirement_scenario is not None:
        stmt = stmt.where(IRRequirement.requirement_scenario == requirement_scenario)
    if completed_from is not None:
        stmt = stmt.where(IRRequirement.completed_at >= completed_from)
    if completed_to is not None:
        stmt = stmt.where(IRRequirement.completed_at <= completed_to)
    return db.scalars(stmt).unique().all()


@router.get("/data-metrics/compute", response_model=DataMetricComputeOut)
def compute_data_metric(
    metric_code: str,
    team_id: int | None = None,
    product_id: int | None = None,
    version_id: int | None = None,
    iteration_id: int | None = None,
    responsible_employee_id: str | None = None,
    business_module: str | None = None,
    requirement_scenario: str | None = None,
    completed_from: date | None = None,
    completed_to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    metric = db.scalar(
        select(DataMetricDefinition).where(
            DataMetricDefinition.code == metric_code,
            DataMetricDefinition.active.is_(True),
        )
    )
    if metric is None:
        raise HTTPException(status_code=404, detail="active data metric not found")
    if metric.domain != "ir":
        raise HTTPException(status_code=422, detail="only the IR data domain is available in this version")
    records = _ir_metric_records(
        db,
        current_user,
        team_id=team_id,
        product_id=product_id,
        version_id=version_id,
        iteration_id=iteration_id,
        responsible_employee_id=responsible_employee_id,
        business_module=business_module,
        requirement_scenario=requirement_scenario,
        completed_from=completed_from,
        completed_to=completed_to,
    )
    filters = {
        key: value
        for key, value in {
            "team_id": team_id,
            "product_id": product_id,
            "version_id": version_id,
            "iteration_id": iteration_id,
            "responsible_employee_id": responsible_employee_id,
            "business_module": business_module,
            "requirement_scenario": requirement_scenario,
            "completed_from": completed_from.isoformat() if completed_from else None,
            "completed_to": completed_to.isoformat() if completed_to else None,
        }.items()
        if value is not None
    }
    result = calculate_data_metric(records, metric)
    return DataMetricComputeOut(
        metric_code=metric.code,
        metric_name=metric.name,
        domain=metric.domain,
        filters=filters,
        **result,
    )
