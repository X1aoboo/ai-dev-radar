"""Generic requirement row validation and pending-batch creation.

Design (IR) and development activity imports share the same staged-batch
pipeline: normalize, resolve owner/reference values, diff against the existing
record, then confirm the whole batch atomically. Activity differences live in
:mod:`app.requirement_fields` profiles; ``ir_imports`` keeps the design
compatibility entry points used by existing call sites.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .data_management import (
    _parse_bool,
    _parse_date,
    derive_ai_assisted,
    field_diff,
    normalize_row,
    serializable_payload,
)
from .models import (
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
from .requirement_fields import (
    DESIGN_PROFILE,
    RequirementProfile,
    missing_required_values,
)


@dataclass(slots=True)
class RequirementImportRowInput:
    raw: dict[str, Any]
    errors: list[str] = field(default_factory=list)
    source_id: str | None = None
    source_system: str | None = None


def _clean(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def check_write_access(current_user: User, team_id: int) -> None:
    if current_user.role == UserRole.ADMIN.value:
        return
    if current_user.role == UserRole.MAINTAINER.value and current_user.maintainer_team_id == team_id:
        return
    raise HTTPException(status_code=403, detail="team access denied")


def validate_record_refs(db: Session, payload: dict[str, Any]) -> Product:
    for field_name in ("product_id", "version_id", "iteration_id"):
        if payload.get(field_name) is None:
            raise HTTPException(status_code=422, detail=f"{field_name} is required")
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


def _parse_owner(value: Any) -> tuple[str | None, str | None]:
    """Parse ``姓名 工号`` into name and employee id."""

    raw = _clean(value)
    if raw is None:
        return None, None
    text = str(raw)
    match = re.match(r"^(.*?)[\s,，]+([A-Za-z0-9_-]+)$", text)
    if match and match.group(1).strip():
        return match.group(1).strip(), match.group(2).strip()
    if re.fullmatch(r"[A-Za-z]*\d+", text):
        return None, text
    return text, None


def _resolve_owner(
    db: Session,
    team_id: int | None,
    raw: Any,
    label: str,
) -> tuple[str | None, str | None, list[str]]:
    name, employee_id = _parse_owner(raw)
    warnings: list[str] = []
    if employee_id and team_id is not None:
        member = employee_for_team(db, team_id, employee_id)
        if member is None:
            warnings.append(f"{label}：工号 {employee_id} 暂未在该团队人员中匹配")
        elif not name:
            name = member.name
    elif not employee_id and name and team_id is not None:
        members = db.scalars(
            select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.name == name)
        ).all()
        if len(members) == 1:
            employee_id = members[0].employee_id
        else:
            warnings.append(f"{label}：未识别工号，当前按姓名保存")
    return name, employee_id, warnings


def resolve_references(
    db: Session,
    normalized: dict[str, Any],
    *,
    profile: RequirementProfile = DESIGN_PROFILE,
    strict_template: bool = False,
) -> tuple[dict[str, Any], int | None, list[str], list[str]]:
    payload = dict(normalized)
    errors: list[str] = []
    warnings: list[str] = []
    team_id: int | None = None
    product: Product | None = None
    version: ProductVersion | None = None
    iteration: Iteration | None = None

    team_name = _clean(payload.get("team_name"))
    if team_name:
        team = db.scalar(select(Team).where(Team.name == team_name))
        if team is None:
            errors.append(f"归属组：未找到团队“{team_name}”")
        else:
            team_id = team.id

    if payload.get("product_id") is not None:
        product = db.get(Product, int(payload["product_id"]))
        if product is None:
            errors.append("产品：未找到")
        else:
            if team_id is not None and product.team_id != team_id:
                errors.append("产品不属于该归属组")
            team_id = product.team_id

    version_name = _clean(payload.get("version_name"))
    if version_name:
        version = db.scalar(
            select(ProductVersion)
            .options(joinedload(ProductVersion.product))
            .where(ProductVersion.name == version_name)
        )
        if version is None:
            errors.append(f"PI：未找到产品版本“{version_name}”")
        else:
            if team_id is not None and version.product.team_id != team_id:
                errors.append("PI：产品版本不属于该归属组")
            payload["version_id"] = version.id
            payload["product_id"] = version.product_id
            team_id = version.product.team_id

    if payload.get("version_id") is not None:
        resolved_version = db.scalar(
            select(ProductVersion)
            .options(joinedload(ProductVersion.product))
            .where(ProductVersion.id == int(payload["version_id"]))
        )
        if resolved_version is None:
            errors.append("版本：未找到")
        else:
            if version is not None and resolved_version.id != version.id:
                errors.append("PI 与版本不匹配")
            version = resolved_version
            if team_id is not None and version.product.team_id != team_id:
                errors.append("版本不属于该归属组")
            payload["product_id"] = version.product_id
            team_id = version.product.team_id

    if version is None:
        errors.append("缺少PI或版本")
    elif payload.get("product_id") is not None and int(payload["product_id"]) != version.product_id:
        errors.append("PI 与产品不匹配")
    else:
        payload["product_id"] = version.product_id

    iteration_name = _clean(payload.get("iteration_name"))
    if iteration_name:
        if version is None:
            errors.append("迭代：缺少可匹配的 PI")
        else:
            iteration = db.scalar(
                select(Iteration).where(
                    Iteration.version_id == version.id,
                    Iteration.name == iteration_name,
                )
            )
            if iteration is None:
                errors.append(f"迭代：版本下未找到“{iteration_name}”")
            else:
                payload["iteration_id"] = iteration.id

    if payload.get("iteration_id") is not None:
        resolved_iteration = db.get(Iteration, int(payload["iteration_id"]))
        if resolved_iteration is None:
            errors.append("迭代：未找到")
        else:
            if version is not None and resolved_iteration.version_id != version.id:
                errors.append("迭代不属于该 PI")
            iteration = resolved_iteration
            payload["iteration_id"] = iteration.id

    if iteration is None:
        errors.append("缺少迭代")

    responsible_employee_id = payload.get("responsible_employee_id")
    if (
        responsible_employee_id
        and team_id is not None
        and employee_for_team(db, team_id, str(responsible_employee_id)) is None
    ):
        warnings.append("责任人工号暂未在该团队人员中匹配")

    for spec in profile.owner_specs:
        if spec.key not in payload:
            continue
        name, employee_id, owner_warnings = _resolve_owner(
            db, team_id, payload.pop(spec.key), spec.label
        )
        if spec.owner_name_field:
            payload[spec.owner_name_field] = name
        if spec.owner_employee_field:
            payload[spec.owner_employee_field] = employee_id
        warnings.extend(owner_warnings)

    payload.pop("team_name", None)
    payload.pop("version_name", None)
    payload.pop("iteration_name", None)
    if payload.get("requirement_type") is None and not strict_template:
        if profile.default_requirement_type is not None:
            payload["requirement_type"] = profile.default_requirement_type
    if any(payload.get(field) is not None for field in profile.ai_flag_fields):
        payload["ai_assisted"] = derive_ai_assisted(payload, profile=profile)
    return payload, team_id, errors, warnings


def _raw_requirement_no(raw: dict[str, Any], profile: RequirementProfile) -> str | None:
    for key, value in raw.items():
        if profile.header_aliases.get(str(key).strip()) == "requirement_no":
            cleaned = _clean(value)
            return str(cleaned) if cleaned is not None else None
    return None


def detect_strict_template(
    rows: list[dict[str, Any]],
    *,
    profile: RequirementProfile = DESIGN_PROFILE,
) -> bool:
    return any(
        profile.header_aliases.get(str(key).strip()) in profile.template_keys
        for row in rows
        for key in row.keys()
    )


def _payload_type_errors(
    profile: RequirementProfile,
    payload: dict[str, Any],
) -> list[str]:
    errors: list[str] = []
    for spec in profile.fields:
        field_name = spec.model_field or spec.key
        value = payload.get(field_name)
        if value is None:
            continue
        if spec.max_length is not None and isinstance(value, str) and len(value) > spec.max_length:
            errors.append(f"{spec.label}：长度不能超过 {spec.max_length}")
    return errors


def validate_import_row(
    db: Session,
    model: Any,
    row_input: RequirementImportRowInput,
    row_number: int,
    *,
    profile: RequirementProfile = DESIGN_PROFILE,
    current_user: User | None = None,
    expected_team_id: int | None = None,
    strict_template: bool = False,
    update_mode: str = "fill_empty",
) -> ImportRow:
    normalized, errors = normalize_row(
        row_input.raw, profile=profile, strict_template=strict_template
    )
    errors = [*row_input.errors, *errors]
    payload, team_id, ref_errors, warnings = resolve_references(
        db, normalized, profile=profile, strict_template=strict_template
    )
    errors.extend(ref_errors)
    errors.extend(_payload_type_errors(profile, payload))
    existing = None

    if not errors:
        try:
            product = validate_record_refs(db, payload)
            if expected_team_id is not None and product.team_id != expected_team_id:
                raise HTTPException(status_code=422, detail="product does not belong to batch team")
            if current_user is not None:
                check_write_access(current_user, product.team_id)
            existing = db.scalar(
                select(model)
                .options(joinedload(model.product))
                .where(model.requirement_no == payload["requirement_no"])
            )
            if existing is not None and existing.product.team_id != product.team_id:
                raise HTTPException(
                    status_code=422,
                    detail="requirement_no already belongs to another team",
                )
        except HTTPException as exc:
            errors.append(str(exc.detail))

    diff = field_diff(existing, payload, mode=update_mode, profile=profile)
    if existing is None:
        operation = "insert"
    elif any(item["action"] == "overwrite" for item in diff.values()):
        operation = "update"
    elif any(item["action"] == "fill" for item in diff.values()):
        operation = "fill"
    else:
        operation = "unchanged"

    return ImportRow(
        row_number=row_number,
        source_id=row_input.source_id or payload.get("requirement_no"),
        source_system=row_input.source_system,
        payload=serializable_payload(payload),
        operation=operation,
        diff=diff,
        errors=errors,
        warnings=warnings,
        status="invalid" if errors else "valid",
        target_id=existing.id if existing is not None else None,
    )


def create_import_batch(
    db: Session,
    model: Any,
    rows: list[RequirementImportRowInput],
    *,
    profile: RequirementProfile = DESIGN_PROFILE,
    source_kind: str,
    created_by: str,
    current_user: User | None = None,
    team_id: int | None = None,
    filename: str | None = None,
    first_row_number: int = 2,
    update_mode: str = "fill_empty",
    strict_template: bool | None = None,
) -> ImportBatch:
    if source_kind not in profile.source_kinds:
        raise ValueError(f"unsupported {profile.key} batch source_kind")
    if source_kind == "collector" and team_id is None:
        raise ValueError("collector batches require a team_id")
    if source_kind == "import" and team_id is not None:
        raise ValueError("file import batches cannot have a team_id")
    if update_mode not in {"upsert", "fill_empty"}:
        raise ValueError(f"unsupported {profile.key} update mode")
    if not rows:
        raise ValueError(f"empty {profile.key} batches are not created")
    if strict_template is None:
        # File imports always follow the activity template contract; collector
        # rows keep the historical, permissive design rules.
        strict_template = source_kind == "import"

    requirement_ids = [_raw_requirement_no(row.raw, profile) for row in rows]
    counts = Counter(requirement_id for requirement_id in requirement_ids if requirement_id)
    for row_input, requirement_id in zip(rows, requirement_ids):
        if requirement_id and counts[requirement_id] > 1:
            row_input.errors.append("需求编号在文件中重复")

    batch = ImportBatch(
        domain=profile.domain,
        source_kind=source_kind,
        team_id=team_id,
        filename=filename,
        update_mode=update_mode,
        status="pending",
        created_by=created_by,
    )
    db.add(batch)
    db.flush()
    for index, row_input in enumerate(rows):
        row = validate_import_row(
            db,
            model,
            row_input,
            first_row_number + index,
            profile=profile,
            current_user=current_user,
            expected_team_id=team_id,
            strict_template=strict_template,
            update_mode=update_mode,
        )
        row.batch_id = batch.id
        db.add(row)
    db.flush()
    return batch


def revalidate_import_payload(
    profile: RequirementProfile,
    payload: dict[str, Any] | None,
    *,
    strict: bool,
) -> list[str]:
    """Re-check a stored row against the current activity template contract.

    Pending batches created before the requirement-activity refactor must be
    re-previewed when their stored payload no longer satisfies the new template.
    """

    values = dict(payload or {})
    errors: list[str] = []
    for field_name, label in (
        ("product_id", "归属组或产品"),
        ("version_id", "PI"),
        ("iteration_id", "迭代"),
    ):
        if _clean(values.get(field_name)) is None:
            errors.append(f"缺少{label}")
    errors.extend(missing_required_values(profile, values, strict=strict))
    for spec in profile.fields:
        if spec.value_type != "enum":
            continue
        value = values.get(spec.model_field or spec.key)
        if value is None:
            continue
        if value not in spec.options:
            errors.append(f"{spec.label}：must be one of {' / '.join(spec.options)}")
    for spec in profile.fields:
        if spec.value_type != "float":
            continue
        value = values.get(spec.model_field or spec.key)
        if value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            errors.append(f"{spec.label}：must be a number")
            continue
        if not math.isfinite(number) or number < 0:
            errors.append(f"{spec.label}：must be a finite non-negative number")
    return errors


def payload_for_record(
    profile: RequirementProfile,
    payload: dict[str, Any],
    *,
    source_kind: str,
    actor: str,
) -> dict[str, Any]:
    """Coerce one stored JSON payload into model keyword arguments."""

    values: dict[str, Any] = {}
    field_by_key = profile.field_by_key
    for field_name in profile.db_fields:
        raw = payload.get(field_name)
        spec = field_by_key.get(field_name)
        value = raw
        if raw is not None and spec is not None:
            if spec.value_type == "date":
                value = _parse_date(raw)
            elif spec.value_type == "bool":
                value = _parse_bool(raw)
            elif spec.value_type == "float":
                value = float(raw)
            elif spec.value_type == "int":
                value = int(raw)
            elif isinstance(raw, str):
                value = raw.strip() or None
        values[field_name] = value
    for field_name, default in profile.non_nullable_text_defaults:
        if values.get(field_name) is None:
            values[field_name] = default
    if values.get("requirement_type") is None:
        values["requirement_type"] = profile.default_requirement_type
    values["ai_assisted"] = derive_ai_assisted(values, profile=profile)
    return values
