"""只读端点的响应模型。枚举与模型共用（app.models 中的共享 Enum）。"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import ActivityKind, CollectMethod, FactSource, MetricType, UserRole


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)


class AuthUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: UserRole
    maintainer_team_id: int | None


class LogoutOut(BaseModel):
    detail: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    source_mapping: dict
    created_at: datetime


class SourceMappingIn(BaseModel):
    """团队数据源映射的结构化输入，避免配置页编辑裸 JSON。"""

    model_config = ConfigDict(extra="forbid")

    product_versions: list[str] = Field(default_factory=list, max_length=100)
    repos: list[str] = Field(default_factory=list, max_length=100)


class TeamIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    source_mapping: SourceMappingIn


class TeamUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    source_mapping: SourceMappingIn | None = None


class ActivityIn(BaseModel):
    code: str = Field(min_length=1, max_length=20, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=100)
    kind: ActivityKind


class ActivityUpdateIn(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20, pattern=r"^[a-z0-9-]+$")
    name: str | None = Field(default=None, min_length=1, max_length=100)
    kind: ActivityKind | None = None


class MetricIn(BaseModel):
    activity_id: int = Field(ge=1)
    code: str = Field(min_length=1, max_length=40, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=100)
    type: MetricType
    numerator_semantic: str = Field(min_length=1, max_length=100)
    denominator_semantic: str | None = Field(default=None, max_length=100)
    collect_method: Literal[CollectMethod.MANUAL_ONLY] = CollectMethod.MANUAL_ONLY


class MetricUpdateIn(BaseModel):
    activity_id: int | None = Field(default=None, ge=1)
    code: str | None = Field(default=None, min_length=1, max_length=40, pattern=r"^[a-z0-9-]+$")
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: MetricType | None = None
    numerator_semantic: str | None = Field(default=None, min_length=1, max_length=100)
    denominator_semantic: str | None = Field(default=None, max_length=100)
    collect_method: Literal[CollectMethod.MANUAL_ONLY] | None = None


class UserIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8)
    role: UserRole
    maintainer_team_id: int | None = Field(default=None, ge=1)


class UserUpdateIn(BaseModel):
    role: UserRole | None = None
    maintainer_team_id: int | None = Field(default=None, ge=1)


class MetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activity_id: int
    code: str
    name: str
    type: MetricType
    numerator_semantic: str
    denominator_semantic: str | None
    collect_method: CollectMethod


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    kind: ActivityKind
    metrics: list[MetricOut]


class IterationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_id: int | None = None
    version_name: str | None = None
    name: str
    start_date: date
    end_date: date


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    product_id: int | None = None
    product_name: str | None = None
    team_id: int | None = None
    team_name: str | None = None
    iterations: list[IterationOut]


class TeamMemberIn(BaseModel):
    team_id: int = Field(ge=1)
    employee_id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=50)


class TeamMemberUpdateIn(BaseModel):
    team_id: int | None = Field(default=None, ge=1)
    employee_id: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    role: str | None = Field(default=None, min_length=1, max_length=50)


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    team_id: int
    employee_id: str
    name: str
    role: str
    created_at: datetime


class ProductIn(BaseModel):
    team_id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=100)


class ProductUpdateIn(BaseModel):
    team_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=100)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    team_id: int
    team_name: str
    name: str
    versions: list["VersionSummaryOut"]


class VersionSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    product_id: int | None = None


class VersionIn(BaseModel):
    product_id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=50)


class VersionUpdateIn(BaseModel):
    product_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=50)


class IterationIn(BaseModel):
    version_id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=60)
    start_date: date
    end_date: date


class IterationUpdateIn(BaseModel):
    version_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=60)
    start_date: date | None = None
    end_date: date | None = None


class IRRequirementIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirement_no: str = Field(min_length=1, max_length=100)
    requirement_name: str = Field(min_length=1, max_length=200)
    responsible_employee_id: str | None = Field(default=None, max_length=50)
    parent_requirement_no: str | None = Field(default=None, max_length=100)
    product_id: int = Field(ge=1)
    version_id: int = Field(ge=1)
    iteration_id: int = Field(ge=1)
    completed_at: date
    business_module: str = Field(min_length=1, max_length=100)
    requirement_scenario: str = Field(min_length=1, max_length=200)
    estimated_workload: float | None = Field(default=None, ge=0)
    actual_workload: float | None = Field(default=None, ge=0)
    sa_estimated_workload: float | None = Field(default=None, ge=0)
    sa_actual_workload: float | None = Field(default=None, ge=0)
    se_estimated_workload: float | None = Field(default=None, ge=0)
    se_actual_workload: float | None = Field(default=None, ge=0)
    ai_assisted: bool | None = None


class IRRequirementUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirement_no: str | None = Field(default=None, min_length=1, max_length=100)
    requirement_name: str | None = Field(default=None, min_length=1, max_length=200)
    responsible_employee_id: str | None = Field(default=None, max_length=50)
    parent_requirement_no: str | None = Field(default=None, max_length=100)
    product_id: int | None = Field(default=None, ge=1)
    version_id: int | None = Field(default=None, ge=1)
    iteration_id: int | None = Field(default=None, ge=1)
    completed_at: date | None = None
    business_module: str | None = Field(default=None, min_length=1, max_length=100)
    requirement_scenario: str | None = Field(default=None, min_length=1, max_length=200)
    estimated_workload: float | None = Field(default=None, ge=0)
    actual_workload: float | None = Field(default=None, ge=0)
    sa_estimated_workload: float | None = Field(default=None, ge=0)
    sa_actual_workload: float | None = Field(default=None, ge=0)
    se_estimated_workload: float | None = Field(default=None, ge=0)
    se_actual_workload: float | None = Field(default=None, ge=0)
    ai_assisted: bool | None = None


class IRRequirementOut(BaseModel):
    id: int
    requirement_no: str
    requirement_name: str
    responsible_employee_id: str | None
    responsible_employee_name: str | None
    responsible_employee_pending: bool
    parent_requirement_no: str | None
    product_id: int
    product_name: str
    team_id: int
    team_name: str
    version_id: int
    version_name: str
    iteration_id: int
    iteration_name: str
    completed_at: date
    business_module: str
    requirement_scenario: str
    estimated_workload: float | None
    actual_workload: float | None
    sa_estimated_workload: float | None
    sa_actual_workload: float | None
    se_estimated_workload: float | None
    se_actual_workload: float | None
    ai_assisted: bool | None
    ai_attribute_metadata: dict[str, Any]
    record_source: str
    created_at: datetime
    updated_at: datetime
    updated_by: str
    valid: bool


class IRListOut(BaseModel):
    items: list[IRRequirementOut]
    total: int
    page: int
    page_size: int


class ImportPreviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str | None = Field(default=None, max_length=255)
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=10000)


class ImportRowOut(BaseModel):
    id: int
    row_number: int
    source_id: str | None
    source_system: str | None = None
    operation: str
    diff: dict[str, Any]
    errors: list[str]
    warnings: list[str]
    status: str
    target_id: int | None
    payload: dict[str, Any]


class ImportBatchOut(BaseModel):
    id: int
    domain: str
    source_kind: str
    team_id: int | None = None
    filename: str | None
    status: str
    created_by: str
    created_at: datetime
    confirmed_at: datetime | None
    total_rows: int
    valid_rows: int
    invalid_rows: int
    rows: list[ImportRowOut]


class ImportBatchSummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    domain: str
    source_kind: str
    team_id: int | None
    filename: str | None
    status: str
    created_by: str
    created_at: datetime
    confirmed_at: datetime | None
    total_rows: int
    valid_rows: int
    invalid_rows: int


class ImportConfirmOut(BaseModel):
    batch_id: int
    status: str
    created: int
    updated: int
    unchanged: int


class CollectionScheduleUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    enabled: bool
    cadence: Literal["hourly", "daily", "weekly", "monthly"]
    minute: int = Field(ge=0, le=59)
    hour: int | None = Field(default=None, ge=0, le=23)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    day_of_month: int | None = Field(default=None, ge=1, le=28)

    @model_validator(mode="after")
    def validate_cadence_fields(self):
        required = {
            "hourly": set(),
            "daily": {"hour"},
            "weekly": {"hour", "day_of_week"},
            "monthly": {"hour", "day_of_month"},
        }[self.cadence]
        values = {
            "hour": self.hour,
            "day_of_week": self.day_of_week,
            "day_of_month": self.day_of_month,
        }
        for name, value in values.items():
            if name in required and value is None:
                raise ValueError(f"{name} is required for {self.cadence} cadence")
            if name not in required and value is not None:
                raise ValueError(f"{name} is not used for {self.cadence} cadence")
        return self


class CollectionScheduleOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: Literal["ir"]
    enabled: bool
    cadence: Literal["hourly", "daily", "weekly", "monthly"]
    minute: int
    hour: int | None
    day_of_week: int | None
    day_of_month: int | None
    timezone: Literal["Asia/Shanghai"]
    updated_by: str
    updated_at: datetime


class CollectionRunIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_at: datetime | None = None
    end_at: datetime | None = None

    @field_validator("start_at", "end_at")
    @classmethod
    def require_timezone(cls, value):
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("datetime must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_window(self):
        if (self.start_at is None) != (self.end_at is None):
            raise ValueError("start_at and end_at must be supplied together")
        if self.start_at is not None and self.start_at >= self.end_at:
            raise ValueError("start_at must be earlier than end_at")
        return self


class CollectionTeamResultOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: int
    team_name: str
    status: Literal["succeeded", "failed", "skipped"]
    request_id: str | None = None
    batch_id: int | None = None
    record_count: int = 0
    code: str | None = None
    message: str | None = None
    retryable: bool = False


class CollectionRunOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    domain: Literal["ir"]
    trigger_type: Literal["manual", "scheduled"]
    status: Literal["running", "succeeded", "partial", "failed"]
    started_by: str
    window_start_at: str
    window_end_at: str
    team_results: list[CollectionTeamResultOut]
    started_at: datetime
    completed_at: datetime | None


class CollectionScheduleListOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schedules: list[CollectionScheduleOut]
    recent_runs: list[CollectionRunOut]


class DataMetricDefinitionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: str = Field(min_length=1, max_length=20)
    code: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=100)
    metric_type: Literal["penetration", "efficiency", "count", "ratio"]
    activity_code: str | None = Field(default=None, max_length=30)
    numerator_field: str = Field(min_length=1, max_length=80)
    denominator_field: str | None = Field(default=None, max_length=80)
    filter_definition: dict[str, Any] = Field(default_factory=dict)
    active: bool = True


class DataMetricDefinitionUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: str | None = Field(default=None, min_length=1, max_length=20)
    code: str | None = Field(default=None, min_length=1, max_length=80, pattern=r"^[a-z0-9-]+$")
    name: str | None = Field(default=None, min_length=1, max_length=100)
    metric_type: Literal["penetration", "efficiency", "count", "ratio"] | None = None
    activity_code: str | None = Field(default=None, max_length=30)
    numerator_field: str | None = Field(default=None, min_length=1, max_length=80)
    denominator_field: str | None = Field(default=None, max_length=80)
    filter_definition: dict[str, Any] | None = None
    active: bool | None = None


class DataMetricDefinitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    code: str
    name: str
    metric_type: str
    activity_code: str | None
    numerator_field: str
    denominator_field: str | None
    filter_definition: dict[str, Any]
    active: bool
    created_at: datetime
    updated_at: datetime


class DataMetricComputeOut(BaseModel):
    metric_code: str
    metric_name: str
    domain: str
    numerator: float
    denominator: float
    value: float | None
    record_count: int
    filters: dict[str, Any]


class FactRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    team_id: int
    metric_id: int
    iteration_id: int | None
    numerator: float | None
    denominator: float | None
    start_date: date
    end_date: date
    source: FactSource
    entered_by: str
    entered_at: datetime


class ManualFactIn(BaseModel):
    """人工补录的事实记录；关键活动或通用能力决定时间字段形态。"""

    model_config = ConfigDict(extra="forbid")

    team_id: int = Field(ge=1)
    metric_id: int = Field(ge=1)
    iteration_id: int | None = Field(default=None, ge=1)
    numerator: float
    denominator: float | None = None
    start_date: date | None = None
    end_date: date | None = None


class ComputePeriodOut(BaseModel):
    id: int | str
    label: str
    kind: Literal["day", "week", "month", "iteration"]
    iteration_id: int | str | None = None
    start_date: date | None = None
    end_date: date | None = None


class ComputePointOut(BaseModel):
    period_id: int | str
    value: float | bool | None
    numerator: float | None = None
    denominator: float | None = None
    estimated: float | None = None
    actual: float | None = None


class ComputeDomainPointOut(ComputePointOut):
    fact_count: int
    sample_count: float


class ComputeAveragePointOut(BaseModel):
    period_id: int | str
    value: float | None


class ComputeSeriesOut(BaseModel):
    team_id: int
    team_name: str
    values: list[ComputePointOut]
    snapshot: bool | None = None


class ComputeOut(BaseModel):
    metric_id: int
    activity_id: int
    dimension: Literal["time", "iteration"]
    granularity: Literal["day", "week", "month"]
    time_field: Literal["start_date", "end_date"]
    periods: list[ComputePeriodOut]
    series: list[ComputeSeriesOut]
    company_average: list[ComputeAveragePointOut]
    domain_summary: list[ComputeDomainPointOut] = Field(default_factory=list)


class MaturityEntryIn(BaseModel):
    """一个团队月份内的活动成熟度编辑项；score=null 表示清除该项。"""

    model_config = ConfigDict(extra="forbid")

    activity_id: int = Field(ge=1)
    score: Decimal | None = None
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("score")
    @classmethod
    def validate_score(cls, value: Decimal | None) -> Decimal | None:
        if value is None:
            return value
        if not value.is_finite() or value < 0 or value > 5:
            raise ValueError("score must be between 0 and 5")
        if value.as_tuple().exponent < -2:
            raise ValueError("score supports at most two decimal places")
        return value


class MaturityBulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[MaturityEntryIn] = Field(default_factory=list, max_length=100)


class MaturityRecordOut(BaseModel):
    id: int
    team_id: int
    activity_id: int
    activity_code: str
    activity_name: str
    kind: ActivityKind
    month: str
    score: float
    score_raw: str
    score_display: str
    grade: int
    level: str
    note: str | None
    maintained_by: str
    updated_at: datetime


class MaturityCellOut(BaseModel):
    activity_id: int
    activity_code: str
    activity_name: str
    kind: ActivityKind
    record_id: int | None
    score: float | None
    score_raw: str | None
    score_display: str | None
    grade: int | None
    level: str | None
    note: str | None
    maintained_by: str | None
    updated_at: datetime | None


class MaturityTeamOut(BaseModel):
    team_id: int
    team_name: str
    cells: list[MaturityCellOut]


class MaturityActivitySummaryOut(BaseModel):
    activity_id: int
    activity_code: str
    activity_name: str
    kind: ActivityKind
    score: float | None
    score_raw: str | None
    score_display: str | None
    average_raw: str | None
    grade: int | None
    level: str | None
    assessed_team_count: int
    grade_distribution: dict[str, int]
    order: int


class MaturityOverviewOut(BaseModel):
    month: str
    kind: ActivityKind
    team_count: int
    assessed_cell_count: int
    total_cell_count: int
    coverage_rate: float
    activities: list[MaturityActivitySummaryOut]
    teams: list[MaturityTeamOut]
    strength_activity_ids: list[int]
    weakness_activity_ids: list[int]
    level_labels: list[str]


class MaturitySaveOut(BaseModel):
    team_id: int
    month: str
    saved_count: int
    cleared_count: int
    records: list[MaturityRecordOut]


class MaturityClearOut(BaseModel):
    team_id: int
    month: str
    deleted_count: int
