"""Design activity Excel template compatibility wrapper.

The generic template builder lives in :mod:`app.requirement_template`.
"""

from __future__ import annotations

from .requirement_fields import DESIGN_PROFILE, DEVELOPMENT_PROFILE
from .requirement_template import (
    build_design_import_template,
    build_import_template,
)

DESIGN_TEMPLATE_FILENAME = DESIGN_PROFILE.template_filename
DEVELOPMENT_TEMPLATE_FILENAME = DEVELOPMENT_PROFILE.template_filename


def build_ir_import_template() -> bytes:
    return build_design_import_template()


__all__ = [
    "DESIGN_TEMPLATE_FILENAME",
    "DEVELOPMENT_TEMPLATE_FILENAME",
    "build_ir_import_template",
    "build_import_template",
]
