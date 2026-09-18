"""Shared IR row validation and pending-batch creation for imports and collection."""

from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .data_management import field_diff, normalize_ir_row, serializable_payload
from .models import (
    IRRequirement,
    ImportBatch,
    ImportRow,
    Iteration,
    Product,
    ProductVersion,
    TeamMember,
    User,
    UserRole,
)
from .schemas import IRRequirementIn


@dataclass(slots=True)
class IRImportRowInput:
    raw: dict[str, Any]
    errors: list[str] = field(default_factory=list)
    source_id: str | None = None
    source_system: str | None = None


def check_ir_write_access(current_user: User, team_id: int) -> None:
    if current_user.role == UserRole.ADMIN.value:
        return
    if current_user.role == UserRole.MAINTAINER.value and current_user.maintainer_team_id == team_id:
        return
    raise HTTPException(status_code=403, detail="team access denied")


def validate_ir_record_refs(
    db: Session,
    payload: dict[str, Any],
) -> Product:
    product = db.scalar(
        select(Product).options(joinedload(Product.team)).where(Product.id == int(payload["product_id"]))
    )
    if product is None:
        raise HTTPException(status_code=404, detail="product not found")
    version = db.scalar(
        select(ProductVersion)
        .options(joinedload(ProductVersion.product))
        .where(ProductVersion.id == int(payload["version_id"]))
    )
    if version is None:
        raise HTTPException(status_code=404, detail="version not found")
    iteration = db.scalar(
        select(Iteration).where(Iteration.id == int(payload["iteration_id"]))
    )
    if iteration is None:
        raise HTTPException(status_code=404, detail="iteration not found")
    if version.product_id != product.id:
        raise HTTPException(status_code=422, detail="version does not belong to product")
    if iteration.version_id != version.id:
        raise HTTPException(status_code=422, detail="iteration does not belong to version")
    return product


def employee_for_team(db: Session, team_id: int, employee_id: str | None) -> TeamMember | None:
    if not employee_id:
        return None
    return db.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.employee_id == employee_id,
        )
    )


def validate_ir_import_row(
    db: Session,
    row_input: IRImportRowInput,
    row_number: int,
    *,
    current_user: User | None = None,
    expected_team_id: int | None = None,
) -> ImportRow:
    normalized, errors = normalize_ir_row(row_input.raw)
    errors = [*row_input.errors, *errors]
    normalized = serializable_payload(normalized)
    warnings: list[str] = []
    existing = None

    if not errors and normalized.get("requirement_no"):
        try:
            product = validate_ir_record_refs(db, normalized)
            if expected_team_id is not None and product.team_id != expected_team_id:
                raise HTTPException(status_code=422, detail="product does not belong to batch team")
            if current_user is not None:
                check_ir_write_access(current_user, product.team_id)
            if normalized.get("responsible_employee_id") and employee_for_team(
                db, product.team_id, normalized["responsible_employee_id"]
            ) is None:
                warnings.append("责任人工号暂未在该团队人员中匹配")
            existing = db.scalar(
                select(IRRequirement)
                .options(joinedload(IRRequirement.product))
                .where(IRRequirement.requirement_no == normalized["requirement_no"])
            )
            if existing is not None and existing.product.team_id != product.team_id:
                raise HTTPException(
                    status_code=422,
                    detail="requirement_no already belongs to another team",
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
        source_id=row_input.source_id or normalized.get("requirement_no"),
        source_system=row_input.source_system,
        payload=normalized,
        operation=operation,
        diff=diff,
        errors=errors,
        warnings=warnings,
        status="invalid" if errors else "valid",
        target_id=existing.id if existing is not None else None,
    )


def create_ir_import_batch(
    db: Session,
    rows: list[IRImportRowInput],
    *,
    source_kind: str,
    created_by: str,
    current_user: User | None = None,
    team_id: int | None = None,
    filename: str | None = None,
    first_row_number: int = 2,
) -> ImportBatch:
    if source_kind not in {"import", "collector"}:
        raise ValueError("unsupported IR batch source_kind")
    if source_kind == "collector" and team_id is None:
        raise ValueError("collector batches require a team_id")
    if source_kind == "import" and team_id is not None:
        raise ValueError("file import batches cannot have a team_id")
    if not rows:
        raise ValueError("empty IR batches are not created")

    batch = ImportBatch(
        domain="ir",
        source_kind=source_kind,
        team_id=team_id,
        filename=filename,
        status="pending",
        created_by=created_by,
    )
    db.add(batch)
    db.flush()
    for index, row_input in enumerate(rows):
        row = validate_ir_import_row(
            db,
            row_input,
            first_row_number + index,
            current_user=current_user,
            expected_team_id=team_id,
        )
        row.batch_id = batch.id
        db.add(row)
    db.flush()
    return batch
