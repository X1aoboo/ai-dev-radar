"""只读端点的响应模型。枚举与模型共用（app.models 中的共享 Enum）。"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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
    name: str
    start_date: date
    end_date: date


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    iterations: list[IterationOut]


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
    kind: Literal["week", "month", "iteration"]
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
    granularity: Literal["week", "month"]
    time_field: Literal["start_date", "end_date"]
    periods: list[ComputePeriodOut]
    series: list[ComputeSeriesOut]
    company_average: list[ComputeAveragePointOut]
