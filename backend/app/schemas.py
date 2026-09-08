"""只读端点的响应模型。枚举与模型共用（app.models 中的共享 Enum）。"""

from datetime import date, datetime

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


class MetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
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
