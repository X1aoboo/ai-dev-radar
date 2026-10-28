"""需求活动字段注册表。

设计活动与开发活动共享同一套字段规范/profile 机制：字段顺序、标签、必填、
枚举、负责人和模板列都由 ``RequirementProfile`` 驱动。``ir_fields`` 保留设计
活动的历史导出名，仅作为兼容层。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True, slots=True)
class RequirementFieldSpec:
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
    # Owner input columns resolve to a name/employee-id column pair.
    owner_name_field: str | None = None
    owner_employee_field: str | None = None

    @property
    def db_field(self) -> str | None:
        return self.model_field


REQUIREMENT_GROUPS: tuple[tuple[str, str], ...] = (
    ("requirement", "需求信息"),
    ("ownership", "归属"),
    ("people", "责任人"),
    ("ai", "AI属性"),
    ("workload", "工作量"),
    ("time", "时间"),
    ("other", "备注"),
)

REFERENCE_VALUE_TYPES = frozenset({"team", "version", "iteration"})

_PROGRESS_ALIASES = {
    "未开始": "未开始",
    "待开始": "未开始",
    "进行中": "进行中",
    "处理中": "进行中",
    "完成": "完成",
    "已完成": "完成",
    "已关闭": "已关闭",
    "关闭": "已关闭",
}


def _enum_aliases(
    fields: Iterable[RequirementFieldSpec],
) -> dict[str, dict[str, str]]:
    aliases: dict[str, dict[str, str]] = {}
    for spec in fields:
        if spec.value_type != "enum":
            continue
        mapping: dict[str, str] = {option: option for option in spec.options}
        if spec.key == "progress":
            mapping.update(_PROGRESS_ALIASES)
        elif spec.key == "requirement_type":
            mapping.setdefault("初始需求", "IR")
        aliases[spec.key] = mapping
    return aliases


def _header_aliases(fields: Iterable[RequirementFieldSpec]) -> dict[str, str]:
    aliases: dict[str, str] = {}
    for spec in fields:
        values: list[str] = [spec.label, spec.key, *spec.aliases]
        if spec.model_field is not None:
            values.append(spec.model_field)
        for alias in values:
            if alias:
                aliases.setdefault(alias, spec.key)
    return aliases


@dataclass(frozen=True)
class RequirementProfile:
    key: str
    domain: str
    label: str
    record_label: str
    fields: tuple[RequirementFieldSpec, ...]
    requirement_types: tuple[str, ...]
    default_requirement_type: str | None
    source_kinds: tuple[str, ...]
    ai_flag_fields: tuple[str, ...]
    workload_components: tuple[tuple[str, str], ...]
    workload_total_fields: tuple[str, ...]
    summary_workload_fields: tuple[str, ...]
    validity_required_fields: tuple[str, ...]
    validity_owner_pairs: tuple[tuple[str, str], ...] = ()
    non_nullable_text_defaults: tuple[tuple[str, str], ...] = ()
    template_filename: str = ""
    template_sheet_name: str = ""
    groups: tuple[tuple[str, str], ...] = REQUIREMENT_GROUPS

    def __post_init__(self) -> None:
        field_by_key = {spec.key: spec for spec in self.fields}
        template_specs = tuple(spec for spec in self.fields if spec.template)
        db_fields = tuple(
            spec.model_field for spec in self.fields if spec.model_field is not None
        )
        owner_specs = tuple(
            spec for spec in self.fields if spec.value_type == "owner"
        )
        owner_model_fields = tuple(
            field
            for spec in owner_specs
            for field in (spec.owner_name_field, spec.owner_employee_field)
            if field
        )
        object.__setattr__(self, "field_by_key", field_by_key)
        object.__setattr__(self, "template_specs", template_specs)
        object.__setattr__(
            self, "template_headers", tuple(spec.label for spec in template_specs)
        )
        object.__setattr__(
            self, "template_keys", tuple(spec.key for spec in template_specs)
        )
        object.__setattr__(
            self, "template_header_set", frozenset(spec.label for spec in template_specs)
        )
        object.__setattr__(self, "header_aliases", _header_aliases(self.fields))
        object.__setattr__(self, "enum_aliases", _enum_aliases(self.fields))
        object.__setattr__(self, "db_fields", db_fields)
        object.__setattr__(
            self,
            "field_labels",
            {spec.model_field or spec.key: spec.label for spec in self.fields},
        )
        object.__setattr__(
            self,
            "numeric_fields",
            frozenset(spec.key for spec in self.fields if spec.value_type == "float"),
        )
        object.__setattr__(
            self,
            "int_fields",
            frozenset(spec.key for spec in self.fields if spec.value_type == "int"),
        )
        object.__setattr__(
            self,
            "date_fields",
            frozenset(spec.key for spec in self.fields if spec.value_type == "date"),
        )
        object.__setattr__(
            self,
            "bool_fields",
            frozenset(spec.key for spec in self.fields if spec.value_type == "bool"),
        )
        object.__setattr__(
            self,
            "enum_fields",
            frozenset(spec.key for spec in self.fields if spec.value_type == "enum"),
        )
        object.__setattr__(
            self,
            "owner_fields",
            frozenset(spec.key for spec in owner_specs),
        )
        object.__setattr__(self, "owner_specs", owner_specs)
        object.__setattr__(self, "owner_model_fields", owner_model_fields)
        object.__setattr__(
            self,
            "required_specs",
            tuple(
                spec
                for spec in self.fields
                if spec.required and spec.template
            ),
        )
        object.__setattr__(
            self,
            "legacy_required_specs",
            tuple(spec for spec in self.fields if spec.legacy_required),
        )
        object.__setattr__(
            self,
            "import_required_fields",
            tuple(spec.key for spec in self.required_specs),
        )
        object.__setattr__(
            self,
            "legacy_required_fields",
            tuple(spec.key for spec in self.legacy_required_specs),
        )
        object.__setattr__(
            self,
            "record_required_fields",
            tuple(self.validity_required_fields),
        )

    def required_fields_for(self, *, strict: bool) -> tuple[RequirementFieldSpec, ...]:
        return self.required_specs if strict else self.legacy_required_specs


def _design_fields() -> tuple[RequirementFieldSpec, ...]:
    return (
        RequirementFieldSpec(
            "requirement_type", "需求类型", "requirement", "enum",
            model_field="requirement_type", required=True,
            aliases=("requirement_type",), options=("IR", "SR"),
            editable=False, max_length=10, nullable=False,
        ),
        RequirementFieldSpec(
            "requirement_no", "需求编号", "requirement", "text",
            model_field="requirement_no", required=True, legacy_required=True,
            aliases=("requirement_no",), editable=False, max_length=100,
            nullable=False,
        ),
        RequirementFieldSpec(
            "requirement_name", "需求标题", "requirement", "text",
            model_field="requirement_name", required=True, legacy_required=True,
            aliases=("需求名称", "requirement_name"), max_length=200, nullable=False,
        ),
        RequirementFieldSpec(
            "business_module", "所属功能", "requirement", "text",
            model_field="business_module", required=False, legacy_required=True,
            aliases=("业务模块", "business_module"), max_length=100, nullable=False,
        ),
        RequirementFieldSpec(
            "progress", "进展", "requirement", "enum",
            model_field="progress", required=True,
            aliases=("progress",), options=("未开始", "进行中", "完成", "已关闭"),
            max_length=20,
        ),
        RequirementFieldSpec(
            "team_name", "归属组", "ownership", "team",
            required=True, aliases=("团队", "归属团队", "team", "team_name"),
            max_length=100,
        ),
        RequirementFieldSpec(
            "version_name", "PI", "ownership", "version",
            required=True,
            aliases=("产品版本", "版本", "version_name"), max_length=50,
        ),
        RequirementFieldSpec(
            "iteration_name", "迭代", "ownership", "iteration",
            required=True,
            aliases=("开发迭代期", "迭代名称", "iteration_name"), max_length=60,
        ),
        RequirementFieldSpec(
            "sa_owner", "SA", "people", "owner",
            required=True, aliases=("SA责任人", "sa", "sa_owner"),
            max_length=160,
            owner_name_field="sa_owner_name",
            owner_employee_field="sa_employee_id",
        ),
        RequirementFieldSpec(
            "se_owner", "SE", "people", "owner",
            required=True, aliases=("SE责任人", "se", "se_owner"),
            max_length=160,
            owner_name_field="se_owner_name",
            owner_employee_field="se_employee_id",
        ),
        RequirementFieldSpec(
            "ai_quality_level", "AI质检等级", "ai", "enum",
            model_field="ai_quality_level",
            aliases=("ai_quality_level",),
            options=("优秀", "良好", "合格", "不合格"), max_length=20,
        ),
        RequirementFieldSpec(
            "ai_applicability", "AI适用性", "ai", "bool",
            model_field="ai_applicability",
            aliases=("AI适用", "ai_applicability"), options=("是", "否"),
        ),
        RequirementFieldSpec(
            "sa_ai_assisted", "SA是否使用AI", "ai", "bool",
            model_field="sa_ai_assisted",
            aliases=("SA使用AI", "sa_ai_assisted"), options=("是", "否"),
        ),
        RequirementFieldSpec(
            "se_ai_assisted", "SE是否使用AI", "ai", "bool",
            model_field="se_ai_assisted",
            aliases=("SE使用AI", "se_ai_assisted"), options=("是", "否"),
        ),
        RequirementFieldSpec(
            "ai_dev_mode", "AI研发模式", "ai", "text",
            model_field="ai_dev_mode",
            aliases=("研发模式", "ai_dev_mode"),
            suggestions=("设计开发一体化", "超级单兵", "全栈开发", "设计一体化", "AI辅助设计"),
            max_length=60,
        ),
        RequirementFieldSpec(
            "sa_estimated_workload", "预估工作量(SA)", "workload", "float",
            model_field="sa_estimated_workload",
            aliases=("SA预估", "SA设计预估工作量", "sa_estimated_workload"),
        ),
        RequirementFieldSpec(
            "sa_actual_workload", "实际工作量(SA)", "workload", "float",
            model_field="sa_actual_workload",
            aliases=("SA实际", "SA设计实际工作量", "sa_actual_workload"),
        ),
        RequirementFieldSpec(
            "se_estimated_workload", "预估工作量(SE)", "workload", "float",
            model_field="se_estimated_workload",
            aliases=("SE预估", "SE设计预估工作量", "se_estimated_workload"),
        ),
        RequirementFieldSpec(
            "se_actual_workload", "实际工作量(SE)", "workload", "float",
            model_field="se_actual_workload",
            aliases=("SE实际", "SE设计实际工作量", "se_actual_workload"),
        ),
        RequirementFieldSpec(
            "completed_at", "设计时间", "time", "date",
            model_field="completed_at", required=True, legacy_required=True,
            aliases=("结束时间", "完成时间", "completed_at"), editable=False,
        ),
        RequirementFieldSpec(
            "remark", "备注", "other", "text",
            model_field="remark", aliases=("remark",), max_length=2000,
        ),
        # Legacy columns kept for existing imports, collectors and analytics.
        RequirementFieldSpec(
            "responsible_employee_id", "需求责任人工号", "people", "text",
            model_field="responsible_employee_id", template=False,
            aliases=("需求责任人", "责任人", "responsible_employee_id", "responsible_employee"),
            max_length=50,
        ),
        RequirementFieldSpec(
            "parent_requirement_no", "父需求编号", "requirement", "text",
            model_field="parent_requirement_no", template=False,
            aliases=("parent_requirement_no",), max_length=100,
        ),
        RequirementFieldSpec(
            "requirement_scenario", "需求场景", "requirement", "text",
            model_field="requirement_scenario", template=False,
            aliases=("requirement_scenario",), max_length=200,
        ),
        RequirementFieldSpec(
            "product_id", "产品ID", "ownership", "int",
            model_field="product_id", template=False,
            aliases=("product_id",), nullable=False,
        ),
        RequirementFieldSpec(
            "version_id", "版本ID", "ownership", "int",
            model_field="version_id", template=False,
            aliases=("版本ID", "version_id"), nullable=False,
        ),
        RequirementFieldSpec(
            "iteration_id", "迭代ID", "ownership", "int",
            model_field="iteration_id", template=False,
            aliases=("迭代ID", "iteration_id"), nullable=False,
        ),
        RequirementFieldSpec(
            "sa_owner_name", "SA姓名", "people", "text",
            model_field="sa_owner_name", template=False,
            aliases=("sa_owner_name",), max_length=100,
        ),
        RequirementFieldSpec(
            "sa_employee_id", "SA工号", "people", "text",
            model_field="sa_employee_id", template=False,
            aliases=("sa_employee_id",), max_length=50,
        ),
        RequirementFieldSpec(
            "se_owner_name", "SE姓名", "people", "text",
            model_field="se_owner_name", template=False,
            aliases=("se_owner_name",), max_length=100,
        ),
        RequirementFieldSpec(
            "se_employee_id", "SE工号", "people", "text",
            model_field="se_employee_id", template=False,
            aliases=("se_employee_id",), max_length=50,
        ),
        RequirementFieldSpec(
            "estimated_workload", "总预估工作量", "workload", "float",
            model_field="estimated_workload", template=False,
            aliases=("预估工作量", "总预估", "estimated_workload"),
        ),
        RequirementFieldSpec(
            "actual_workload", "总实际工作量", "workload", "float",
            model_field="actual_workload", template=False,
            aliases=("实际工作量", "总实际", "actual_workload"),
        ),
        RequirementFieldSpec(
            "ai_assisted", "是否使用AI辅助研发", "ai", "bool",
            model_field="ai_assisted", template=False,
            aliases=("是否使用AI", "是否使用AI辅助研发", "ai_assisted"),
        ),
    )


def _development_fields() -> tuple[RequirementFieldSpec, ...]:
    return (
        RequirementFieldSpec(
            "requirement_type", "类型", "requirement", "enum",
            model_field="requirement_type", required=True,
            aliases=("requirement_type", "需求类型"), options=("IR", "SR", "AR"),
            editable=False, max_length=10, nullable=False,
        ),
        RequirementFieldSpec(
            "requirement_no", "需求编号", "requirement", "text",
            model_field="requirement_no", required=True,
            aliases=("requirement_no",), editable=False, max_length=100,
            nullable=False,
        ),
        RequirementFieldSpec(
            "requirement_name", "标题", "requirement", "text",
            model_field="requirement_name", required=True,
            aliases=("需求名称", "requirement_name"), max_length=200, nullable=False,
        ),
        RequirementFieldSpec(
            "progress", "进展", "requirement", "enum",
            model_field="progress", required=True,
            aliases=("progress",), options=("未开始", "进行中", "完成", "已关闭"),
            max_length=20,
        ),
        RequirementFieldSpec(
            "team_name", "归属组", "ownership", "team",
            required=True, aliases=("团队", "归属团队", "team", "team_name"),
            max_length=100,
        ),
        RequirementFieldSpec(
            "version_name", "PI", "ownership", "version",
            required=True,
            aliases=("产品版本", "版本", "version_name"), max_length=50,
        ),
        RequirementFieldSpec(
            "iteration_name", "迭代", "ownership", "iteration",
            required=True,
            aliases=("开发迭代期", "迭代名称", "iteration_name"), max_length=60,
        ),
        RequirementFieldSpec(
            "implementation_owner", "实现设计责任人", "people", "owner",
            required=True,
            aliases=("实现设计责任人", "implementation_owner"),
            max_length=160,
            owner_name_field="implementation_owner_name",
            owner_employee_field="implementation_employee_id",
        ),
        RequirementFieldSpec(
            "development_owner", "开发责任人", "people", "owner",
            required=True,
            aliases=("开发责任人", "development_owner"),
            max_length=160,
            owner_name_field="development_owner_name",
            owner_employee_field="development_employee_id",
        ),
        RequirementFieldSpec(
            "ai_applicability", "AI适用性", "ai", "bool",
            model_field="ai_applicability",
            aliases=("AI适用", "ai_applicability"), options=("是", "否"),
        ),
        RequirementFieldSpec(
            "implementation_ai_assisted", "实现设计是否使用AI", "ai", "bool",
            model_field="implementation_ai_assisted",
            aliases=("实现设计使用AI", "implementation_ai_assisted"),
            options=("是", "否"),
        ),
        RequirementFieldSpec(
            "development_ai_assisted", "开发是否使用AI", "ai", "bool",
            model_field="development_ai_assisted",
            aliases=("开发使用AI", "development_ai_assisted"),
            options=("是", "否"),
        ),
        RequirementFieldSpec(
            "ai_dev_mode", "AI研发模式", "ai", "text",
            model_field="ai_dev_mode",
            aliases=("研发模式", "ai_dev_mode"),
            suggestions=("设计开发一体化", "超级单兵", "全栈开发", "设计一体化", "AI辅助开发"),
            max_length=60,
        ),
        RequirementFieldSpec(
            "implementation_estimated_workload", "预估工作量(实现设计)", "workload", "float",
            model_field="implementation_estimated_workload",
            aliases=("实现设计预估工作量", "implementation_estimated_workload"),
        ),
        RequirementFieldSpec(
            "implementation_actual_workload", "实际工作量(实现设计)", "workload", "float",
            model_field="implementation_actual_workload",
            aliases=("实现设计实际工作量", "implementation_actual_workload"),
        ),
        RequirementFieldSpec(
            "development_estimated_workload", "预估工作量(开发)", "workload", "float",
            model_field="development_estimated_workload",
            aliases=("开发预估工作量", "development_estimated_workload"),
        ),
        RequirementFieldSpec(
            "development_actual_workload", "实际工作量(开发)", "workload", "float",
            model_field="development_actual_workload",
            aliases=("开发实际工作量", "development_actual_workload"),
        ),
        RequirementFieldSpec(
            "completed_at", "开发时间", "time", "date",
            model_field="completed_at", required=True,
            aliases=("结束时间", "完成时间", "completed_at"), editable=False,
        ),
        RequirementFieldSpec(
            "remark", "备注", "other", "text",
            model_field="remark", aliases=("remark",), max_length=2000,
        ),
        # Hidden columns: resolved owner ids/names and derived AI flag.
        RequirementFieldSpec(
            "product_id", "产品ID", "ownership", "int",
            model_field="product_id", template=False,
            aliases=("product_id",), nullable=False,
        ),
        RequirementFieldSpec(
            "version_id", "版本ID", "ownership", "int",
            model_field="version_id", template=False,
            aliases=("版本ID", "version_id"), nullable=False,
        ),
        RequirementFieldSpec(
            "iteration_id", "迭代ID", "ownership", "int",
            model_field="iteration_id", template=False,
            aliases=("迭代ID", "iteration_id"), nullable=False,
        ),
        RequirementFieldSpec(
            "implementation_owner_name", "实现设计责任人姓名", "people", "text",
            model_field="implementation_owner_name", template=False,
            aliases=("implementation_owner_name",), max_length=100,
        ),
        RequirementFieldSpec(
            "implementation_employee_id", "实现设计责任人工号", "people", "text",
            model_field="implementation_employee_id", template=False,
            aliases=("implementation_employee_id",), max_length=50,
        ),
        RequirementFieldSpec(
            "development_owner_name", "开发责任人姓名", "people", "text",
            model_field="development_owner_name", template=False,
            aliases=("development_owner_name",), max_length=100,
        ),
        RequirementFieldSpec(
            "development_employee_id", "开发责任人工号", "people", "text",
            model_field="development_employee_id", template=False,
            aliases=("development_employee_id",), max_length=50,
        ),
        RequirementFieldSpec(
            "ai_assisted", "是否使用AI辅助研发", "ai", "bool",
            model_field="ai_assisted", template=False,
            aliases=("是否使用AI", "是否使用AI辅助研发", "ai_assisted"),
        ),
    )


DESIGN_PROFILE = RequirementProfile(
    key="design",
    domain="ir",
    label="设计活动",
    record_label="设计记录",
    fields=_design_fields(),
    requirement_types=("IR", "SR"),
    default_requirement_type="IR",
    source_kinds=("import", "collector"),
    ai_flag_fields=("sa_ai_assisted", "se_ai_assisted"),
    workload_components=(
        ("sa_estimated_workload", "sa_actual_workload"),
        ("se_estimated_workload", "se_actual_workload"),
    ),
    workload_total_fields=("estimated_workload", "actual_workload"),
    summary_workload_fields=(
        "sa_estimated_workload",
        "sa_actual_workload",
        "se_estimated_workload",
        "se_actual_workload",
        "total_estimated_workload",
        "total_actual_workload",
    ),
    validity_required_fields=(
        "requirement_no",
        "requirement_name",
        "product_id",
        "version_id",
        "iteration_id",
        "completed_at",
    ),
    non_nullable_text_defaults=(
        ("business_module", ""),
        ("requirement_scenario", ""),
    ),
    template_filename="需求设计度量模板.xlsx",
    template_sheet_name="设计活动",
)

DEVELOPMENT_PROFILE = RequirementProfile(
    key="development",
    domain="development",
    label="开发活动",
    record_label="开发记录",
    fields=_development_fields(),
    requirement_types=("IR", "SR", "AR"),
    default_requirement_type="IR",
    source_kinds=("import",),
    ai_flag_fields=("implementation_ai_assisted", "development_ai_assisted"),
    workload_components=(
        ("implementation_estimated_workload", "implementation_actual_workload"),
        ("development_estimated_workload", "development_actual_workload"),
    ),
    workload_total_fields=(),
    summary_workload_fields=(
        "implementation_estimated_workload",
        "implementation_actual_workload",
        "development_estimated_workload",
        "development_actual_workload",
        "total_estimated_workload",
        "total_actual_workload",
    ),
    validity_required_fields=(
        "requirement_type",
        "requirement_no",
        "requirement_name",
        "progress",
        "product_id",
        "version_id",
        "iteration_id",
        "completed_at",
    ),
    validity_owner_pairs=(
        ("implementation_owner_name", "implementation_employee_id"),
        ("development_owner_name", "development_employee_id"),
    ),
    non_nullable_text_defaults=(),
    template_filename="需求开发度量模板.xlsx",
    template_sheet_name="开发活动",
)


PROFILES: dict[str, RequirementProfile] = {
    DESIGN_PROFILE.key: DESIGN_PROFILE,
    DEVELOPMENT_PROFILE.key: DEVELOPMENT_PROFILE,
}


def profile_for(key: str) -> RequirementProfile:
    return PROFILES[key]


def field_schema(profile: RequirementProfile) -> dict[str, Any]:
    """JSON-safe field metadata used by the client and the template builder."""

    return {
        "profile": profile.key,
        "domain": profile.domain,
        "label": profile.label,
        "groups": [{"key": key, "label": label} for key, label in profile.groups],
        "requirement_types": list(profile.requirement_types),
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
            for spec in profile.fields
        ],
        "template_headers": list(profile.template_headers),
        "import_required": list(profile.import_required_fields),
        "record_required": list(profile.record_required_fields),
    }


def is_template_header(profile: RequirementProfile, key: str) -> bool:
    return str(key).strip() in profile.template_header_set


def missing_required_values(
    profile: RequirementProfile,
    values: dict[str, Any],
    *,
    strict: bool,
) -> list[str]:
    """Return Chinese error messages for missing required template values."""

    errors: list[str] = []
    for spec in profile.required_fields_for(strict=strict):
        if spec.value_type in REFERENCE_VALUE_TYPES:
            # Reference names are validated by the resolver against ids.
            continue
        if spec.owner_name_field or spec.owner_employee_field:
            present = any(
                _clean(values.get(field)) is not None
                for field in (spec.owner_name_field, spec.owner_employee_field)
                if field
            )
            if not present and _clean(values.get(spec.key)) is None:
                errors.append(f"缺少{spec.label}")
            continue
        if _clean(values.get(spec.key)) is None:
            errors.append(f"缺少{spec.label}")
    return errors


def _clean(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


# Design compatibility aliases used by tests and older call sites.
IR_PROFILE = DESIGN_PROFILE
