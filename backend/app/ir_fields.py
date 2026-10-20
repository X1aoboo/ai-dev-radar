"""IR field registry.

Single source for field labels, header aliases, value types, template order,
import requirements and the client-facing schema. Domain logic in
``data_management`` and ``ir_imports`` derives its field lists from here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class IRFieldSpec:
    key: str
    label: str
    group: str
    value_type: str
    model_field: str | None = None
    required: bool = False
    legacy_required: bool = False
    aliases: tuple[str, ...] = ()
    options: tuple[str, ...] = ()
    suggestions: tuple[str, ...] = ()
    template: bool = True
    editable: bool = True
    max_length: int | None = None
    nullable: bool = True

    @property
    def db_field(self) -> str | None:
        return self.model_field


IR_GROUPS: tuple[tuple[str, str], ...] = (
    ("requirement", "需求信息"),
    ("ownership", "归属"),
    ("people", "责任人"),
    ("workload", "工作量"),
    ("ai", "AI 属性"),
    ("time", "时间"),
    ("other", "其他"),
)

# Template order is the order users see in Excel and in the grid.
IR_FIELD_SPECS: tuple[IRFieldSpec, ...] = (
    IRFieldSpec(
        "requirement_type", "需求类型", "requirement", "enum",
        model_field="requirement_type", aliases=("requirement_type",),
        options=("IR",), editable=False, max_length=10, nullable=False,
    ),
    IRFieldSpec(
        "requirement_no", "需求编号", "requirement", "text",
        model_field="requirement_no", required=True, legacy_required=True,
        aliases=("requirement_no",), editable=False, max_length=100, nullable=False,
    ),
    IRFieldSpec(
        "requirement_name", "需求标题", "requirement", "text",
        model_field="requirement_name", required=True, legacy_required=True,
        aliases=("需求名称", "requirement_name"), max_length=200, nullable=False,
    ),
    IRFieldSpec(
        "business_module", "所属功能", "requirement", "text",
        model_field="business_module", required=True, legacy_required=True,
        aliases=("业务模块", "business_module"), max_length=100, nullable=False,
    ),
    IRFieldSpec(
        "progress", "进展", "requirement", "enum",
        model_field="progress", required=True,
        aliases=("progress",), options=("未开始", "进行中", "完成", "已关闭"),
        max_length=20,
    ),
    IRFieldSpec(
        "team_name", "归属组", "ownership", "team",
        aliases=("团队", "归属团队", "team", "team_name"), max_length=100,
    ),
    IRFieldSpec(
        "version_name", "PI", "ownership", "version",
        aliases=("产品版本", "版本", "version_name"), max_length=50,
    ),
    IRFieldSpec(
        "iteration_name", "迭代", "ownership", "iteration",
        aliases=("开发迭代期", "迭代名称", "iteration_name"), max_length=60,
    ),
    IRFieldSpec(
        "sa_owner", "SA", "people", "owner",
        aliases=("SA责任人", "sa", "sa_owner"), max_length=160,
    ),
    IRFieldSpec(
        "se_owner", "SE", "people", "owner",
        required=True, aliases=("SE责任人", "se", "se_owner"), max_length=160,
    ),
    IRFieldSpec(
        "sa_estimated_workload", "预估工作量(SA)", "workload", "float",
        model_field="sa_estimated_workload",
        aliases=("SA预估", "SA设计预估工作量", "sa_estimated_workload"), max_length=None,
    ),
    IRFieldSpec(
        "sa_actual_workload", "实际工作量(SA)", "workload", "float",
        model_field="sa_actual_workload",
        aliases=("SA实际", "SA设计实际工作量", "sa_actual_workload"),
    ),
    IRFieldSpec(
        "se_estimated_workload", "预估工作量(SE)", "workload", "float",
        model_field="se_estimated_workload",
        aliases=("SE预估", "SE设计预估工作量", "se_estimated_workload"),
    ),
    IRFieldSpec(
        "se_actual_workload", "实际工作量(SE)", "workload", "float",
        model_field="se_actual_workload",
        aliases=("SE实际", "SE设计实际工作量", "se_actual_workload"),
    ),
    IRFieldSpec(
        "ai_quality_level", "AI质检等级", "ai", "enum",
        model_field="ai_quality_level",
        aliases=("ai_quality_level",), options=("优秀", "良好", "合格"),
        max_length=20,
    ),
    IRFieldSpec(
        "ai_applicability", "AI适用性", "ai", "bool",
        model_field="ai_applicability",
        aliases=("AI适用", "ai_applicability"), options=("是", "否"),
    ),
    IRFieldSpec(
        "sa_ai_assisted", "SA是否使用AI", "ai", "bool",
        model_field="sa_ai_assisted",
        aliases=("SA使用AI", "sa_ai_assisted"), options=("是", "否"),
    ),
    IRFieldSpec(
        "se_ai_assisted", "SE是否使用AI", "ai", "bool",
        model_field="se_ai_assisted",
        aliases=("SE使用AI", "se_ai_assisted"), options=("是", "否"),
    ),
    IRFieldSpec(
        "ai_dev_mode", "AI研发模式", "ai", "text",
        model_field="ai_dev_mode",
        aliases=("研发模式", "ai_dev_mode"),
        suggestions=("设计开发一体化", "超级单兵", "全栈开发", "设计一体化"),
        max_length=60,
    ),
    IRFieldSpec(
        "completed_at", "设计时间", "time", "date",
        model_field="completed_at", required=True, legacy_required=True,
        aliases=("结束时间", "完成时间", "completed_at"), editable=False,
    ),
    IRFieldSpec(
        "remark", "备注", "other", "text",
        model_field="remark", aliases=("remark",), max_length=2000,
    ),
    # Legacy columns kept for existing imports, collectors and analytics.
    IRFieldSpec(
        "responsible_employee_id", "需求责任人工号", "people", "text",
        model_field="responsible_employee_id", template=False,
        aliases=("需求责任人", "责任人", "responsible_employee_id", "responsible_employee"),
        max_length=50,
    ),
    IRFieldSpec(
        "parent_requirement_no", "父需求编号", "requirement", "text",
        model_field="parent_requirement_no", template=False,
        aliases=("parent_requirement_no",), max_length=100,
    ),
    IRFieldSpec(
        "requirement_scenario", "需求场景", "requirement", "text",
        model_field="requirement_scenario", template=False,
        aliases=("requirement_scenario",), max_length=200,
    ),
    IRFieldSpec(
        "product_id", "产品ID", "ownership", "int",
        model_field="product_id", template=False,
        aliases=("product_id",), nullable=False,
    ),
    IRFieldSpec(
        "version_id", "版本ID", "ownership", "int",
        model_field="version_id", template=False,
        aliases=("版本ID", "version_id"), nullable=False,
    ),
    IRFieldSpec(
        "iteration_id", "迭代ID", "ownership", "int",
        model_field="iteration_id", template=False,
        aliases=("迭代ID", "iteration_id"), nullable=False,
    ),
    IRFieldSpec(
        "estimated_workload", "总预估工作量", "workload", "float",
        model_field="estimated_workload", template=False,
        aliases=("预估工作量", "总预估", "estimated_workload"),
    ),
    IRFieldSpec(
        "actual_workload", "总实际工作量", "workload", "float",
        model_field="actual_workload", template=False,
        aliases=("实际工作量", "总实际", "actual_workload"),
    ),
    IRFieldSpec(
        "ai_assisted", "是否使用AI辅助研发", "ai", "bool",
        model_field="ai_assisted", template=False,
        aliases=("是否使用AI", "是否使用AI辅助研发", "ai_assisted"),
    ),
)

IR_FIELD_BY_KEY: dict[str, IRFieldSpec] = {spec.key: spec for spec in IR_FIELD_SPECS}

IR_TEMPLATE_SPECS: tuple[IRFieldSpec, ...] = tuple(
    spec for spec in IR_FIELD_SPECS if spec.template
)
IR_TEMPLATE_HEADERS: tuple[str, ...] = tuple(spec.label for spec in IR_TEMPLATE_SPECS)
IR_TEMPLATE_KEYS: tuple[str, ...] = tuple(spec.key for spec in IR_TEMPLATE_SPECS)
IR_TEMPLATE_HEADER_SET: frozenset[str] = frozenset(IR_TEMPLATE_HEADERS)

IR_DB_FIELDS: tuple[str, ...] = tuple(
    spec.model_field
    for spec in IR_FIELD_SPECS
    if spec.model_field is not None
)

IR_FIELDS = IR_DB_FIELDS

IR_FIELD_LABELS: dict[str, str] = {
    spec.model_field or spec.key: spec.label for spec in IR_FIELD_SPECS
}

IR_REQUIRED_FIELDS: tuple[str, ...] = (
    "requirement_no",
    "requirement_name",
    "product_id",
    "version_id",
    "iteration_id",
    "completed_at",
)

IR_LEGACY_REQUIRED_FIELDS: tuple[str, ...] = (
    "requirement_no",
    "requirement_name",
    "product_id",
    "version_id",
    "iteration_id",
    "completed_at",
    "business_module",
)

IR_IMPORT_REQUIRED_FIELDS: tuple[str, ...] = tuple(
    spec.key for spec in IR_TEMPLATE_SPECS if spec.required
)

IR_NUMERIC_FIELDS: frozenset[str] = frozenset(
    spec.key for spec in IR_FIELD_SPECS if spec.value_type == "float"
)
IR_INT_FIELDS: frozenset[str] = frozenset(
    spec.key for spec in IR_FIELD_SPECS if spec.value_type == "int"
)
IR_DATE_FIELDS: frozenset[str] = frozenset(
    spec.key for spec in IR_FIELD_SPECS if spec.value_type == "date"
)
IR_BOOL_FIELDS: frozenset[str] = frozenset(
    spec.key for spec in IR_FIELD_SPECS if spec.value_type == "bool"
)
IR_ENUM_FIELDS: frozenset[str] = frozenset(
    spec.key for spec in IR_FIELD_SPECS if spec.value_type == "enum"
)
IR_OWNER_FIELDS: frozenset[str] = frozenset({"sa_owner", "se_owner"})

# Normalize common source-system spellings into the stored enum values.
IR_ENUM_ALIASES: dict[str, dict[str, str]] = {
    "progress": {
        "未开始": "未开始",
        "待开始": "未开始",
        "进行中": "进行中",
        "处理中": "进行中",
        "完成": "完成",
        "已完成": "完成",
        "已关闭": "已关闭",
        "关闭": "已关闭",
    },
    "requirement_type": {
        "IR": "IR",
        "初始需求": "IR",
    },
    "ai_quality_level": {
        "优秀": "优秀",
        "良好": "良好",
        "合格": "合格",
    },
}


def _aliases_for(spec: IRFieldSpec) -> tuple[str, ...]:
    values: list[str] = [spec.label, spec.key]
    values.extend(spec.aliases)
    if spec.model_field is not None:
        values.append(spec.model_field)
    return tuple(dict.fromkeys(value for value in values if value))


IR_HEADER_ALIASES: dict[str, str] = {}
for _spec in IR_FIELD_SPECS:
    for _alias in _aliases_for(_spec):
        IR_HEADER_ALIASES.setdefault(_alias, _spec.key)
IR_HEADER_ALIASES["需求名称"] = "requirement_name"
IR_HEADER_ALIASES["版本"] = "version_name"
IR_HEADER_ALIASES["迭代"] = "iteration_name"


def is_template_header(key: str) -> bool:
    return str(key).strip() in IR_TEMPLATE_HEADER_SET


def ir_field_schema() -> dict[str, Any]:
    """JSON-safe field metadata used by the client and the template builder."""

    return {
        "groups": [{"key": key, "label": label} for key, label in IR_GROUPS],
        "fields": [
            {
                "key": spec.key,
                "label": spec.label,
                "group": spec.group,
                "type": spec.value_type,
                "required": spec.required,
                "legacy_required": spec.legacy_required,
                "options": list(spec.options),
                "suggestions": list(spec.suggestions),
                "template": spec.template,
                "editable": spec.editable,
                "max_length": spec.max_length,
            }
            for spec in IR_FIELD_SPECS
        ],
        "template_headers": list(IR_TEMPLATE_HEADERS),
        "import_required": list(IR_IMPORT_REQUIRED_FIELDS),
        "record_required": list(IR_REQUIRED_FIELDS),
    }
