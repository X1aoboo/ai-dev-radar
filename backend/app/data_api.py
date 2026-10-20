"""数据管理工作台的 HTTP 接口。

旧版 ``api.py`` 保持事实看板兼容；本模块提供源数据、临时批次和 AI 指标的
独立接口。路由层只编排认证和事务，领域规则集中在 ``data_management``。
"""

from __future__ import annotations

from calendar import monthrange
from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any, Literal
import zipfile

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from .auth import get_current_user, require_roles
from .data_management import (
    IR_FIELDS,
    calculate_data_metric,
    build_ir_overview_series,
    derive_ai_assisted,
    effective_actual_workload,
    effective_ai_assisted,
    effective_estimated_workload,
    field_diff,
    json_changes,
    merge_empty_fields,
    overwrite_non_empty_fields,
    parse_import_file,
    record_is_valid,
    serializable_payload,
)
from .db import get_db
from .ir_fields import IR_FIELD_LABELS, ir_field_schema
from .ir_imports import (
    IRImportRowInput,
    check_ir_write_access as _check_ir_write_access,
    create_ir_import_batch,
    detect_strict_template,
    employee_for_team as _employee_for_team,
    validate_ir_record_refs as _validate_ir_record_refs,
)
from .ir_template import build_ir_import_template
from .models import (
    AuditLog,
    AIReviewOpinion,
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
from .team_excel import build_team_export, build_team_import_template
from .team_imports import TeamImportError, analyze_team_rows, apply_team_rows
from .schemas import (
    AIReviewOpinionIn,
    AIReviewOpinionListOut,
    AIReviewOpinionOut,
    DataMetricComputeOut,
    DataMetricDefinitionIn,
    DataMetricDefinitionOut,
    DataMetricDefinitionUpdateIn,
    IRBulkUpdateIn,
    IRListOut,
    IRRequirementIn,
    IRRequirementOut,
    IRSummaryOut,
    IROverviewMetricsOut,
    IRRequirementUpdateIn,
    ImportBatchOut,
    ImportBatchSummaryOut,
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
    TeamImportConfirmIn,
    TeamImportPreviewOut,
    TeamImportResultOut,
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



@router.get("/teams/import-template")
def download_team_import_template(
    _current_user: User = Depends(get_current_user),
):
    content = build_team_import_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                "attachment; filename=team-personnel-template.xlsx; "
                "filename*=UTF-8''%E5%9B%A2%E9%98%9F%E4%BA%BA%E5%91%98%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xlsx"
            )
        },
    )


@router.get("/teams/export")
def export_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team_stmt = select(Team).order_by(Team.id)
    if current_user.role == UserRole.MAINTAINER.value:
        team_stmt = team_stmt.where(Team.id == current_user.maintainer_team_id)
    teams = db.scalars(team_stmt).all()
    team_ids = [team.id for team in teams]
    members = db.scalars(
        select(TeamMember)
        .where(TeamMember.team_id.in_(team_ids))
        .order_by(TeamMember.team_id, TeamMember.employee_id)
    ).all() if team_ids else []
    members_by_team: dict[int, list[tuple[str, str, str]]] = {team_id: [] for team_id in team_ids}
    for member in members:
        members_by_team.setdefault(member.team_id, []).append((member.employee_id, member.name, member.role))
    content = build_team_export([
        (team.name, members_by_team.get(team.id, []))
        for team in teams
    ])
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f"attachment; filename=team-personnel-{date.today().isoformat()}.xlsx; "
                "filename*=UTF-8''%E5%9B%A2%E9%98%9F%E4%BA%BA%E5%91%98%E5%AF%BC%E5%87%BA.xlsx"
            )
        },
    )


@router.post("/teams/imports/preview", response_model=TeamImportPreviewOut)
async def preview_team_import(
    request: Request,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    content = await request.body()
    filename = request.headers.get("x-filename") or request.query_params.get("filename")
    if not filename:
        raise HTTPException(status_code=422, detail="filename is required for file import")
    try:
        rows = parse_import_file(content, filename)
    except (ValueError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=422, detail="文件没有数据行")
    preview = analyze_team_rows(db, rows)
    valid_rows = sum(1 for row in preview if row["action"] != "invalid")
    invalid_rows = len(preview) - valid_rows
    summary = {
        "total_rows": len(preview),
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "create": sum(1 for row in preview if row["action"] == "create"),
        "update": sum(1 for row in preview if row["action"] == "update"),
        "unchanged": sum(1 for row in preview if row["action"] == "unchanged"),
        "teams_create": len({row["team_name"] for row in preview if row["team_action"] == "create"}),
    }
    return TeamImportPreviewOut(
        filename=filename,
        total_rows=len(preview),
        valid_rows=valid_rows,
        invalid_rows=invalid_rows,
        rows=preview,
        summary=summary,
    )


@router.post("/teams/imports/confirm", response_model=TeamImportResultOut)
def confirm_team_import(
    payload: TeamImportConfirmIn,
    _current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    rows = [
        {
            "团队名称": row.team_name,
            "工号": row.employee_id,
            "姓名": row.name,
            "角色": row.role,
        }
        for row in payload.rows
    ]
    try:
        return apply_team_rows(db, rows)
    except TeamImportError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc



def _ir_out(db: Session, record: IRRequirement) -> IRRequirementOut:
    product = record.product
    version = record.version
    iteration = record.iteration
    team = product.team
    member = _employee_for_team(db, team.id, record.responsible_employee_id)
    sa_member = _employee_for_team(db, team.id, record.sa_employee_id)
    se_member = _employee_for_team(db, team.id, record.se_employee_id)
    return IRRequirementOut(
        id=record.id,
        requirement_type=record.requirement_type or "IR",
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
        requirement_scenario=record.requirement_scenario or "",
        progress=record.progress,
        sa_owner_name=record.sa_owner_name or (sa_member.name if sa_member else None),
        sa_employee_id=record.sa_employee_id,
        sa_employee_name=sa_member.name if sa_member else None,
        sa_employee_pending=bool(record.sa_employee_id and sa_member is None),
        se_owner_name=record.se_owner_name or (se_member.name if se_member else None),
        se_employee_id=record.se_employee_id,
        se_employee_name=se_member.name if se_member else None,
        se_employee_pending=bool(record.se_employee_id and se_member is None),
        estimated_workload=record.estimated_workload,
        actual_workload=record.actual_workload,
        total_estimated_workload=effective_estimated_workload(record),
        total_actual_workload=effective_actual_workload(record),
        sa_estimated_workload=record.sa_estimated_workload,
        sa_actual_workload=record.sa_actual_workload,
        se_estimated_workload=record.se_estimated_workload,
        se_actual_workload=record.se_actual_workload,
        ai_quality_level=record.ai_quality_level,
        ai_applicability=record.ai_applicability,
        sa_ai_assisted=record.sa_ai_assisted,
        se_ai_assisted=record.se_ai_assisted,
        ai_dev_mode=record.ai_dev_mode,
        ai_assisted=effective_ai_assisted(record),
        ai_attribute_metadata=record.ai_attribute_metadata or {},
        remark=record.remark,
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


AI_ATTRIBUTE_FIELDS = (
    "ai_assisted",
    "ai_quality_level",
    "ai_applicability",
    "sa_ai_assisted",
    "se_ai_assisted",
    "ai_dev_mode",
)


def _ai_metadata(
    existing: dict[str, Any],
    actor: str,
    source: str,
    fields: list[str] | tuple[str, ...],
) -> dict[str, Any]:
    metadata = deepcopy(existing or {})
    updated_at = _now().isoformat()
    for field in fields:
        if field in AI_ATTRIBUTE_FIELDS:
            metadata[field] = {
                "source": source,
                "updated_by": actor,
                "updated_at": updated_at,
            }
    return metadata


def _manual_ai_metadata(existing: dict[str, Any], actor: str) -> dict[str, Any]:
    return _ai_metadata(existing, actor, "manual", ["ai_assisted"])


@router.get("/data/code-review/opinions", response_model=AIReviewOpinionListOut)
def list_ai_review_opinions(
    team_id: int | None = Query(default=None, ge=1),
    from_date: date | None = None,
    to_date: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List opinion source records without exposing MR-review text."""
    if from_date is not None and to_date is not None and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must not be after to_date")
    if team_id is not None and current_user.role == UserRole.MAINTAINER.value:
        _team_access(current_user, team_id)

    stmt = select(AIReviewOpinion).order_by(
        AIReviewOpinion.opinion_date.desc(), AIReviewOpinion.source_id
    )
    if current_user.role == UserRole.MAINTAINER.value:
        stmt = stmt.where(AIReviewOpinion.team_id == current_user.maintainer_team_id)
    if team_id is not None:
        stmt = stmt.where(AIReviewOpinion.team_id == team_id)
    if from_date is not None:
        stmt = stmt.where(AIReviewOpinion.opinion_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(AIReviewOpinion.opinion_date <= to_date)

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    records = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return AIReviewOpinionListOut(
        items=[AIReviewOpinionOut.model_validate(record) for record in records],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.put(
    "/data/code-review/opinions/{source_id}",
    response_model=AIReviewOpinionOut,
)
def upsert_ai_review_opinion(
    source_id: str = Path(min_length=1, max_length=120),
    payload: AIReviewOpinionIn = ...,
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    """Idempotently create or update one AI-generated MR review opinion."""
    team = db.get(Team, payload.team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="team not found")
    _team_access(current_user, team.id, write=True)

    record = db.scalar(
        select(AIReviewOpinion).where(AIReviewOpinion.source_id == source_id)
    )
    if record is None:
        record = AIReviewOpinion(
            source_id=source_id,
            team_id=team.id,
            opinion_date=payload.opinion_date,
            ai_effective=payload.ai_effective,
            created_at=_now(),
            updated_at=_now(),
            updated_by=current_user.username,
        )
        db.add(record)
    else:
        # A maintainer may not claim a source ID owned by another team's record.
        _team_access(current_user, record.team_id, write=True)
        record.team_id = team.id
        record.opinion_date = payload.opinion_date
        record.ai_effective = payload.ai_effective
        record.updated_at = _now()
        record.updated_by = current_user.username
    db.flush()
    return _commit(db, record)


def _sum_optional(values: list[float | None]) -> float | None:
    present = [float(value) for value in values if value is not None]
    return sum(present) if present else None


def _ir_summary(rows: list[Any]) -> IRSummaryOut:
    by_progress: dict[str, int] = {}
    ai_used = 0
    ai_known = 0
    sa_estimated: list[float | None] = []
    sa_actual: list[float | None] = []
    se_estimated: list[float | None] = []
    se_actual: list[float | None] = []
    total_estimated: list[float | None] = []
    total_actual: list[float | None] = []

    for row in rows:
        progress = row.progress or "待维护"
        by_progress[progress] = by_progress.get(progress, 0) + 1

        sa_flag = row.sa_ai_assisted
        se_flag = row.se_ai_assisted
        if sa_flag is None and se_flag is None:
            effective_ai = row.ai_assisted
        elif sa_flag is True or se_flag is True:
            effective_ai = True
        elif sa_flag is False and se_flag is False:
            effective_ai = False
        else:
            effective_ai = None
        if effective_ai is not None:
            ai_known += 1
            if effective_ai:
                ai_used += 1

        estimated = row.estimated_workload
        if estimated is None:
            parts = [row.sa_estimated_workload, row.se_estimated_workload]
            estimated = sum(part or 0 for part in parts) if any(part is not None for part in parts) else None
        actual = row.actual_workload
        if actual is None:
            parts = [row.sa_actual_workload, row.se_actual_workload]
            actual = sum(part or 0 for part in parts) if any(part is not None for part in parts) else None

        sa_estimated.append(row.sa_estimated_workload)
        sa_actual.append(row.sa_actual_workload)
        se_estimated.append(row.se_estimated_workload)
        se_actual.append(row.se_actual_workload)
        total_estimated.append(estimated)
        total_actual.append(actual)

    return IRSummaryOut(
        total=len(rows),
        by_progress=by_progress,
        ai_used_count=ai_used,
        ai_known_count=ai_known,
        ai_usage_rate=(ai_used / ai_known) if ai_known else None,
        sa_estimated_workload=_sum_optional(sa_estimated),
        sa_actual_workload=_sum_optional(sa_actual),
        se_estimated_workload=_sum_optional(se_estimated),
        se_actual_workload=_sum_optional(se_actual),
        total_estimated_workload=_sum_optional(total_estimated),
        total_actual_workload=_sum_optional(total_actual),
    )


@router.get("/data/ir/schema")
def get_ir_schema(
    _current_user: User = Depends(get_current_user),
):
    return ir_field_schema()


@router.get("/data/ir/import-template")
def download_ir_import_template(
    _current_user: User = Depends(DATA_EDITOR),
):
    content = build_ir_import_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                "attachment; filename=IR-requirements-template.xlsx; "
                "filename*=UTF-8''IR%E9%9C%80%E6%B1%82%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xlsx"
            )
        },
    )


@router.get("/data/ir", response_model=IRListOut)
def list_ir_requirements(
    team_id: int | None = None,
    product_id: int | None = None,
    version_id: int | None = None,
    iteration_id: int | None = None,
    keyword: str | None = None,
    requirement_no: str | None = None,
    responsible_employee_id: str | None = None,
    business_module: str | None = None,
    requirement_scenario: str | None = None,
    progress: str | None = None,
    ai_quality_level: str | None = None,
    ai_applicability: bool | None = None,
    sa_ai_assisted: bool | None = None,
    se_ai_assisted: bool | None = None,
    ai_dev_mode: str | None = None,
    ai_assisted: bool | None = None,
    sa_employee_id: str | None = None,
    se_employee_id: str | None = None,
    completed_from: date | None = None,
    completed_to: date | None = None,
    sort_by: str = "completed_at",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if team_id is not None and current_user.role == UserRole.MAINTAINER.value:
        _check_ir_write_access(current_user, team_id)
    conditions = []
    if current_user.role == UserRole.MAINTAINER.value:
        conditions.append(Product.team_id == current_user.maintainer_team_id)
    if team_id is not None:
        conditions.append(Product.team_id == team_id)
    if product_id is not None:
        conditions.append(IRRequirement.product_id == product_id)
    if version_id is not None:
        conditions.append(IRRequirement.version_id == version_id)
    if iteration_id is not None:
        conditions.append(IRRequirement.iteration_id == iteration_id)
    if keyword:
        pattern = f"%{keyword.strip()}%"
        conditions.append(or_(
            IRRequirement.requirement_no.ilike(pattern),
            IRRequirement.requirement_name.ilike(pattern),
            IRRequirement.business_module.ilike(pattern),
        ))
    if requirement_no is not None:
        conditions.append(IRRequirement.requirement_no == requirement_no)
    if responsible_employee_id is not None:
        conditions.append(IRRequirement.responsible_employee_id == responsible_employee_id)
    if business_module is not None:
        conditions.append(IRRequirement.business_module == business_module)
    if requirement_scenario is not None:
        conditions.append(IRRequirement.requirement_scenario == requirement_scenario)
    if progress is not None:
        conditions.append(IRRequirement.progress == progress)
    if ai_quality_level is not None:
        conditions.append(IRRequirement.ai_quality_level == ai_quality_level)
    if ai_applicability is not None:
        conditions.append(IRRequirement.ai_applicability == ai_applicability)
    if sa_ai_assisted is not None:
        conditions.append(IRRequirement.sa_ai_assisted == sa_ai_assisted)
    if se_ai_assisted is not None:
        conditions.append(IRRequirement.se_ai_assisted == se_ai_assisted)
    if ai_dev_mode is not None:
        conditions.append(IRRequirement.ai_dev_mode == ai_dev_mode)
    if ai_assisted is not None:
        conditions.append(IRRequirement.ai_assisted == ai_assisted)
    if sa_employee_id is not None:
        conditions.append(IRRequirement.sa_employee_id == sa_employee_id)
    if se_employee_id is not None:
        conditions.append(IRRequirement.se_employee_id == se_employee_id)
    if completed_from is not None:
        conditions.append(IRRequirement.completed_at >= completed_from)
    if completed_to is not None:
        conditions.append(IRRequirement.completed_at <= completed_to)

    sort_fields = {
        "requirement_no": IRRequirement.requirement_no,
        "requirement_name": IRRequirement.requirement_name,
        "business_module": IRRequirement.business_module,
        "progress": IRRequirement.progress,
        "completed_at": IRRequirement.completed_at,
        "sa_estimated_workload": IRRequirement.sa_estimated_workload,
        "sa_actual_workload": IRRequirement.sa_actual_workload,
        "se_estimated_workload": IRRequirement.se_estimated_workload,
        "se_actual_workload": IRRequirement.se_actual_workload,
        "ai_quality_level": IRRequirement.ai_quality_level,
        "updated_at": IRRequirement.updated_at,
        "id": IRRequirement.id,
    }
    sort_column = sort_fields.get(sort_by)
    if sort_column is None:
        raise HTTPException(status_code=422, detail="unsupported sort field")
    direction = sort_column.asc() if sort_order == "asc" else sort_column.desc()

    summary_stmt = (
        select(
            IRRequirement.progress,
            IRRequirement.sa_ai_assisted,
            IRRequirement.se_ai_assisted,
            IRRequirement.ai_assisted,
            IRRequirement.estimated_workload,
            IRRequirement.actual_workload,
            IRRequirement.sa_estimated_workload,
            IRRequirement.sa_actual_workload,
            IRRequirement.se_estimated_workload,
            IRRequirement.se_actual_workload,
        )
        .select_from(IRRequirement)
        .join(Product, IRRequirement.product_id == Product.id)
        .where(*conditions)
    )
    summary_rows = db.execute(summary_stmt).all()

    stmt = (
        _ir_record_query(db)
        .where(*conditions)
        .order_by(None)
        .order_by(direction, IRRequirement.id.desc())
    )
    total = len(summary_rows)
    records = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return IRListOut(
        items=[_ir_out(db, record) for record in records],
        total=total,
        page=page,
        page_size=page_size,
        summary=_ir_summary(summary_rows),
    )


@router.post("/data/ir", response_model=IRRequirementOut, status_code=201)
def create_ir_requirement(
    payload: IRRequirementIn,
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    values = payload.model_dump()
    values["requirement_type"] = "IR"
    values["requirement_scenario"] = values.get("requirement_scenario") or ""
    values["ai_assisted"] = derive_ai_assisted(values)
    product = _validate_ir_record_refs(db, values)
    _check_ir_write_access(current_user, product.team_id)
    now = _now()
    metadata = _ai_metadata(
        {},
        current_user.username,
        "manual",
        [field for field in AI_ATTRIBUTE_FIELDS if values.get(field) is not None],
    )
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


def _effective_changes(record: IRRequirement, changes: dict[str, Any]) -> dict[str, Any]:
    effective: dict[str, Any] = {}
    for field, value in changes.items():
        current = getattr(record, field, None)
        current_value = serializable_payload({"value": current})["value"]
        next_value = serializable_payload({"value": value})["value"]
        if current_value != next_value:
            effective[field] = value
    return effective


def _apply_ir_changes(
    db: Session,
    record: IRRequirement,
    changes: dict[str, Any],
    current_user: User,
    *,
    source: str = "manual",
) -> dict[str, Any]:
    """Validate and apply one record's changes without committing."""

    changes = _effective_changes(record, changes)
    if not changes:
        return {}
    next_values = {
        field: changes.get(field, getattr(record, field, None))
        for field in IR_FIELDS
    }
    if next_values.get("requirement_scenario") is None:
        next_values["requirement_scenario"] = ""
    product = _validate_ir_record_refs(db, next_values)
    _check_ir_write_access(current_user, product.team_id)

    if "sa_ai_assisted" in changes or "se_ai_assisted" in changes:
        derived = derive_ai_assisted(next_values)
        if "ai_assisted" not in changes or changes["ai_assisted"] != derived:
            changes["ai_assisted"] = derived
    if changes.get("requirement_scenario") is None:
        changes["requirement_scenario"] = ""
    if "requirement_no" in changes:
        duplicate = db.scalar(
            select(IRRequirement).where(
                IRRequirement.requirement_no == changes["requirement_no"],
                IRRequirement.id != record.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="requirement_no already exists")

    before = {field: getattr(record, field, None) for field in changes}
    for field, value in changes.items():
        setattr(record, field, value)

    metadata_fields = [field for field in changes if field in AI_ATTRIBUTE_FIELDS]
    if metadata_fields:
        record.ai_attribute_metadata = _ai_metadata(
            record.ai_attribute_metadata,
            current_user.username,
            source,
            metadata_fields,
        )
    record.record_source = source
    record.updated_at = _now()
    record.updated_by = current_user.username
    return {
        field: {
            "from": serializable_payload({"value": before[field]})["value"],
            "to": serializable_payload({"value": changes[field]})["value"],
        }
        for field in changes
    }


@router.patch("/data/ir/bulk", response_model=list[IRRequirementOut])
def bulk_update_ir_requirements(
    payload: IRBulkUpdateIn,
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    ids = [item.id for item in payload.items]
    records = db.scalars(
        select(IRRequirement)
        .options(
            joinedload(IRRequirement.product).joinedload(Product.team),
            joinedload(IRRequirement.version),
            joinedload(IRRequirement.iteration),
        )
        .where(IRRequirement.id.in_(ids))
    ).unique().all()
    by_id = {record.id: record for record in records}
    if len(by_id) != len(set(ids)):
        raise HTTPException(status_code=404, detail="IR record not found")

    try:
        for item in payload.items:
            record = by_id[item.id]
            changes = item.changes.model_dump(exclude_unset=True)
            if not changes:
                continue
            audit_changes = _apply_ir_changes(db, record, changes, current_user)
            if not audit_changes:
                continue
            db.add(AuditLog(
                domain="ir",
                record_id=record.id,
                action="bulk_update",
                actor=current_user.username,
                source="manual",
                changes=audit_changes,
            ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return [_ir_out(db, by_id[item.id]) for item in payload.items]


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
    if not changes:
        return _ir_out(db, record)
    audit_changes = _apply_ir_changes(db, record, changes, current_user)
    if not audit_changes:
        return _ir_out(db, record)
    db.add(AuditLog(
        domain="ir",
        record_id=record.id,
        action="update",
        actor=current_user.username,
        source="manual",
        changes=audit_changes,
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
        team_id=batch.team_id,
        filename=batch.filename,
        update_mode=batch.update_mode or "fill_empty",
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
                source_system=row.source_system,
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


def _batch_summary(batch: ImportBatch) -> ImportBatchSummaryOut:
    rows = list(batch.rows)
    return ImportBatchSummaryOut(
        id=batch.id,
        domain=batch.domain,
        source_kind=batch.source_kind,
        team_id=batch.team_id,
        filename=batch.filename,
        update_mode=batch.update_mode or "fill_empty",
        status=batch.status,
        created_by=batch.created_by,
        created_at=batch.created_at,
        confirmed_at=batch.confirmed_at,
        total_rows=len(rows),
        valid_rows=sum(row.status in {"valid", "applied"} for row in rows),
        invalid_rows=sum(row.status == "invalid" for row in rows),
    )


def _check_batch_access(current_user: User, batch: ImportBatch) -> None:
    if current_user.role == UserRole.ADMIN.value:
        return
    if current_user.role == UserRole.MAINTAINER.value:
        if batch.source_kind == "collector" and batch.team_id == current_user.maintainer_team_id:
            return
        if batch.source_kind == "import" and batch.created_by == current_user.username:
            return
    raise HTTPException(status_code=403, detail="import batch access denied")


async def _import_preview_payload(request: Request) -> ImportPreviewIn:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        try:
            return ImportPreviewIn.model_validate(await request.json())
        except ValidationError as exc:
            raise HTTPException(
                status_code=422,
                detail={"message": "invalid import preview", "errors": exc.errors(include_input=False)},
            ) from exc
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
    mode: Literal["upsert", "fill_empty"] = Query(default="fill_empty"),
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    payload = await _import_preview_payload(request)
    if not payload.rows:
        raise HTTPException(status_code=422, detail="文件没有数据行")
    batch = create_ir_import_batch(
        db,
        [IRImportRowInput(raw=row) for row in payload.rows],
        source_kind="import",
        filename=payload.filename,
        created_by=current_user.username,
        current_user=current_user,
        update_mode=mode,
        strict_template=detect_strict_template(payload.rows),
    )
    db.commit()
    db.refresh(batch)
    return _batch_out(batch)


@router.get("/data/ir/imports", response_model=list[ImportBatchSummaryOut])
def list_ir_imports(
    source_kind: Literal["import", "collector"] | None = Query(default=None),
    status: Literal["pending", "confirmed"] | None = Query(default=None),
    team_id: int | None = Query(default=None, ge=1),
    current_user: User = Depends(DATA_EDITOR),
    db: Session = Depends(get_db),
):
    conditions = [ImportBatch.domain == "ir"]
    if source_kind is not None:
        conditions.append(ImportBatch.source_kind == source_kind)
    if status is not None:
        conditions.append(ImportBatch.status == status)
    if current_user.role != UserRole.ADMIN.value:
        if team_id is not None and team_id != current_user.maintainer_team_id:
            raise HTTPException(status_code=403, detail="team access denied")
        if source_kind == "import":
            conditions.append(ImportBatch.created_by == current_user.username)
        elif source_kind == "collector":
            conditions.append(ImportBatch.team_id == current_user.maintainer_team_id)
        else:
            conditions.append(or_(
                and_(
                    ImportBatch.source_kind == "collector",
                    ImportBatch.team_id == current_user.maintainer_team_id,
                ),
                and_(
                    ImportBatch.source_kind == "import",
                    ImportBatch.created_by == current_user.username,
                ),
            ))
    if team_id is not None:
        conditions.append(ImportBatch.team_id == team_id)
    batches = db.scalars(
        select(ImportBatch)
        .options(selectinload(ImportBatch.rows))
        .where(*conditions)
        .order_by(ImportBatch.created_at.desc(), ImportBatch.id.desc())
    ).all()
    return [_batch_summary(batch) for batch in batches]


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
    _check_batch_access(current_user, batch)
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
    _check_batch_access(current_user, batch)
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
            payload["requirement_type"] = "IR"
            payload["ai_assisted"] = derive_ai_assisted(payload)
            product = _validate_ir_record_refs(db, payload)
            _check_ir_write_access(current_user, product.team_id)
            existing = db.scalar(
                select(IRRequirement).where(IRRequirement.requirement_no == payload["requirement_no"])
            )
            if existing is None:
                now = _now()
                payload["requirement_scenario"] = payload.get("requirement_scenario") or ""
                metadata = _ai_metadata(
                    {},
                    current_user.username,
                    batch.source_kind,
                    [field for field in AI_ATTRIBUTE_FIELDS if payload.get(field) is not None],
                )
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
                    action="collector_confirm" if batch.source_kind == "collector" else "import_confirm",
                    actor=current_user.username,
                    source=batch.source_kind,
                    changes=_import_audit_changes(payload),
                ))
                created += 1
            else:
                changes = (
                    overwrite_non_empty_fields(existing, payload)
                    if batch.update_mode == "upsert"
                    else merge_empty_fields(existing, payload)
                )
                changed_fields = {change["field"] for change in changes}
                ai_fields = [field for field in changed_fields if field in AI_ATTRIBUTE_FIELDS]
                if ai_fields:
                    existing.ai_attribute_metadata = _ai_metadata(
                        existing.ai_attribute_metadata,
                        current_user.username,
                        batch.source_kind,
                        ai_fields,
                    )
                if changes:
                    existing.updated_at = _now()
                    existing.updated_by = current_user.username
                    db.add(AuditLog(
                        domain="ir",
                        record_id=existing.id,
                        action="collector_confirm" if batch.source_kind == "collector" else "import_confirm",
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


@router.get("/data-metrics/overview", response_model=IROverviewMetricsOut)
def ir_overview_metrics(
    from_month: str = Query(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
    to_month: str = Query(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
    version_id: str = Query(default="all", pattern=r"^(all|[1-9][0-9]*)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start_year, start_month = map(int, from_month.split("-"))
    end_year, end_month = map(int, to_month.split("-"))
    start_index = start_year * 12 + start_month - 1
    end_index = end_year * 12 + end_month - 1
    month_count = end_index - start_index + 1
    if month_count < 1 or month_count > 12:
        raise HTTPException(status_code=422, detail="IR overview window must contain 1 to 12 months")

    period_ids = []
    for offset in range(month_count):
        month_index = start_month - 1 + offset
        period_ids.append(f"{start_year + month_index // 12:04d}-{month_index % 12 + 1:02d}")

    resolved_version_id = None if version_id == "all" else int(version_id)
    if resolved_version_id is not None and db.get(ProductVersion, resolved_version_id) is None:
        raise HTTPException(status_code=404, detail="version not found")

    start_date = date(start_year, start_month, 1)
    end_date = date(end_year, end_month, monthrange(end_year, end_month)[1])
    records = _ir_metric_records(
        db,
        current_user,
        team_id=None,
        product_id=None,
        version_id=resolved_version_id,
        iteration_id=None,
        responsible_employee_id=None,
        business_module=None,
        requirement_scenario=None,
        completed_from=start_date,
        completed_to=end_date,
    )

    team_query = select(Team).order_by(Team.id)
    if current_user.role == UserRole.MAINTAINER.value:
        if current_user.maintainer_team_id is None:
            raise HTTPException(status_code=403, detail="maintainer team is not configured")
        team_query = team_query.where(Team.id == current_user.maintainer_team_id)
    teams = db.scalars(team_query).all()
    return build_ir_overview_series(records, teams, period_ids)


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
