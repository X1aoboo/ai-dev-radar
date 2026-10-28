"""Design activity import compatibility wrapper.

The generic staged-import pipeline lives in
:mod:`app.requirement_imports`; these entry points preserve the historical IR
names used by the collector and existing tests.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .models import IRRequirement, User
from .requirement_fields import DESIGN_PROFILE
from .requirement_imports import (
    RequirementImportRowInput,
    check_write_access,
    create_import_batch,
    detect_strict_template as _detect_strict_template,
    employee_for_team,
    validate_import_row,
    validate_record_refs,
)

IRImportRowInput = RequirementImportRowInput


def check_ir_write_access(current_user: User, team_id: int) -> None:
    check_write_access(current_user, team_id)


def validate_ir_record_refs(db: Session, payload: dict[str, Any]):
    return validate_record_refs(db, payload)


def _detect(rows: list[dict[str, Any]]) -> bool:
    return _detect_strict_template(rows, profile=DESIGN_PROFILE)


def detect_strict_template(rows: list[dict[str, Any]]) -> bool:
    return _detect(rows)


def validate_ir_import_row(
    db: Session,
    row_input: RequirementImportRowInput,
    row_number: int,
    **kwargs: Any,
):
    return validate_import_row(
        db,
        IRRequirement,
        row_input,
        row_number,
        profile=DESIGN_PROFILE,
        **kwargs,
    )


def create_ir_import_batch(
    db: Session,
    rows: list[RequirementImportRowInput],
    **kwargs: Any,
):
    return create_import_batch(
        db,
        IRRequirement,
        rows,
        profile=DESIGN_PROFILE,
        **kwargs,
    )
