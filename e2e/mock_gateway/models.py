"""Mock provider's independent models copied from the public OpenAPI contract."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ReadinessScenario = Literal[
    "ready",
    "auth_failed",
    "not_ready",
    "service_mismatch",
    "protocol_incompatible",
    "malformed_readiness",
    "delayed_readiness",
]
CollectionScenario = Literal[
    "collection_success",
    "collection_empty",
    "collection_error",
    "malformed_collection",
]


class ProductVersionRef(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    product_name: str = Field(min_length=1, max_length=100)
    version_name: str = Field(min_length=1, max_length=50)


class CollectorIRRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    request_id: str = Field(min_length=1, max_length=100)
    product_versions: list[ProductVersionRef] = Field(min_length=1, max_length=100)
    start_at: datetime = Field(strict=False)
    end_at: datetime = Field(strict=False)

    @model_validator(mode="after")
    def validate_window(self):
        if any(value.tzinfo is None or value.utcoffset() is None for value in (self.start_at, self.end_at)):
            raise ValueError("collection window must include a timezone")
        if self.start_at >= self.end_at:
            raise ValueError("start_at must be earlier than end_at")
        pairs = {(item.product_name, item.version_name) for item in self.product_versions}
        if len(pairs) != len(self.product_versions):
            raise ValueError("product_versions must not contain duplicates")
        return self


class CollectorIRRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    source_id: str = Field(min_length=1, max_length=100)
    source_system: str = Field(min_length=1, max_length=100)
    product_name: str = Field(min_length=1, max_length=100)
    version_name: str = Field(min_length=1, max_length=50)
    iteration_name: str = Field(min_length=1, max_length=60)
    requirement_name: str = Field(min_length=1, max_length=200)
    responsible_employee_id: str | None = Field(default=None, max_length=50)
    parent_requirement_no: str | None = Field(default=None, max_length=100)
    completed_at: str
    business_module: str | None = Field(max_length=100)
    requirement_scenario: str = Field(min_length=1, max_length=200)
    estimated_workload: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    actual_workload: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    sa_estimated_workload: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    sa_actual_workload: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    se_estimated_workload: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    se_actual_workload: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    ai_assisted: bool | None = None


class CollectorIRResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    request_id: str = Field(min_length=1, max_length=100)
    records: list[CollectorIRRecord] = Field(max_length=10000)


class GatewayError(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    code: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=500)
    retryable: bool
    request_id: str = Field(min_length=1, max_length=100)


class HealthLiveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["alive"]


class GatewayUpstreamStatus(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    id: str = Field(min_length=1, max_length=100)
    status: str = Field(min_length=1, max_length=30)


class HealthReadyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    service: str = Field(min_length=1, max_length=100)
    status: Literal["ready"]
    contract_version: str = Field(min_length=5, max_length=100)
    upstreams: list[GatewayUpstreamStatus] | None = None


class MockScenarioUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    readiness: ReadinessScenario | None = None
    collection: CollectionScenario | None = None
