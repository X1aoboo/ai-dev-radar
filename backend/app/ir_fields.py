"""IR field registry (design compatibility layer).

The generic registry now lives in :mod:`app.requirement_fields`; this module
keeps the historical ``IR_*`` names so existing imports and the design
compatibility API continue to work.
"""

from __future__ import annotations

from typing import Any

from .requirement_fields import (
    DESIGN_PROFILE,
    RequirementFieldSpec,
    field_schema,
    is_template_header as _is_template_header,
)

IRFieldSpec = RequirementFieldSpec

IR_GROUPS = DESIGN_PROFILE.groups
IR_FIELD_SPECS = DESIGN_PROFILE.fields
IR_FIELD_BY_KEY = DESIGN_PROFILE.field_by_key
IR_TEMPLATE_SPECS = DESIGN_PROFILE.template_specs
IR_TEMPLATE_HEADERS = DESIGN_PROFILE.template_headers
IR_TEMPLATE_KEYS = DESIGN_PROFILE.template_keys
IR_TEMPLATE_HEADER_SET = DESIGN_PROFILE.template_header_set
IR_DB_FIELDS = DESIGN_PROFILE.db_fields
IR_FIELDS = IR_DB_FIELDS
IR_FIELD_LABELS = DESIGN_PROFILE.field_labels
IR_REQUIRED_FIELDS = DESIGN_PROFILE.record_required_fields
IR_LEGACY_REQUIRED_FIELDS = DESIGN_PROFILE.legacy_required_fields
IR_IMPORT_REQUIRED_FIELDS = DESIGN_PROFILE.import_required_fields
IR_NUMERIC_FIELDS = DESIGN_PROFILE.numeric_fields
IR_INT_FIELDS = DESIGN_PROFILE.int_fields
IR_DATE_FIELDS = DESIGN_PROFILE.date_fields
IR_BOOL_FIELDS = DESIGN_PROFILE.bool_fields
IR_ENUM_FIELDS = DESIGN_PROFILE.enum_fields
IR_OWNER_FIELDS = DESIGN_PROFILE.owner_fields
IR_ENUM_ALIASES = DESIGN_PROFILE.enum_aliases
IR_HEADER_ALIASES = DESIGN_PROFILE.header_aliases


def is_template_header(key: str) -> bool:
    return _is_template_header(DESIGN_PROFILE, key)


def ir_field_schema() -> dict[str, Any]:
    """JSON-safe field metadata used by the client and the template builder."""

    return field_schema(DESIGN_PROFILE)
