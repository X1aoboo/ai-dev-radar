"""Radar consumer models conforming to the versioned Gateway protocol."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .gateway_contracts import GatewayError as CollectorIRError


class ProductVersionRef(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    product_name: str = Field(min_length=1, max_length=100)
    version_name: str = Field(min_length=1, max_length=50)


class CollectorIRRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    request_id: str = Field(min_length=1, max_length=100)
    product_versions: list[ProductVersionRef] = Field(
        min_length=1,
        max_length=100,
        json_schema_extra={"uniqueItems": True},
    )
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def validate_window(self):
        for value in (self.start_at, self.end_at):
            if value.tzinfo is None or value.utcoffset() is None:
                raise ValueError("collection window must include a timezone")
        if self.start_at >= self.end_at:
            raise ValueError("start_at must be earlier than end_at")
        pairs = {
            (item.product_name, item.version_name)
            for item in self.product_versions
        }
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
    completed_at: date
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
