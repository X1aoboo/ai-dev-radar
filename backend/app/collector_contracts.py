"""Versioned JSON contract shared with the private Collector Gateway."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CollectorIRRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    request_id: str = Field(min_length=1, max_length=100)
    team_name: str = Field(min_length=1, max_length=100)
    product_versions: list[str] = Field(max_length=100)
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def validate_window(self):
        for value in (self.start_at, self.end_at):
            if value.tzinfo is None or value.utcoffset() is None:
                raise ValueError("collection window must include a timezone")
        if self.start_at >= self.end_at:
            raise ValueError("start_at must be earlier than end_at")
        return self


class CollectorIRRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    source_id: str = Field(min_length=1, max_length=100)
    source_system: str = Field(min_length=1, max_length=100)
    version_name: str = Field(min_length=1, max_length=50)
    iteration_name: str = Field(min_length=1, max_length=60)
    requirement_name: str = Field(min_length=1, max_length=200)
    responsible_employee_id: str | None = Field(default=None, max_length=50)
    parent_requirement_no: str | None = Field(default=None, max_length=100)
    completed_at: date
    business_module: str = Field(min_length=1, max_length=100)
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


class CollectorIRError(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    code: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=500)
    retryable: bool
    request_id: str = Field(min_length=1, max_length=100)


class CollectorIRContract(BaseModel):
    """Snapshot envelope: request, response, and standard error schemas."""

    model_config = ConfigDict(extra="forbid")

    contract: Literal["collector-ir-v1"] = "collector-ir-v1"
    request: CollectorIRRequest
    response: CollectorIRResponse
    error: CollectorIRError


def collector_ir_v1_schema() -> dict:
    return CollectorIRContract.model_json_schema()
