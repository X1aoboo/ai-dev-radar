"""Radar's readiness consumer models for the versioned Gateway protocol."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


GATEWAY_SERVICE_ID = "ai-dev-data-gateway"
GATEWAY_CONTRACT_MAJOR = 1
SEMVER_PATTERN = (
    r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
    r"(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)"
    r"(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)


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
    contract_version: str = Field(min_length=5, max_length=100, pattern=SEMVER_PATTERN)
    upstreams: list[GatewayUpstreamStatus] | None = None


def is_compatible_contract_version(value: str) -> bool:
    """Accept released SemVer-compatible versions on the supported v1 path."""

    if not value.startswith("1."):
        return False
    try:
        HealthReadyResponse(
            service=GATEWAY_SERVICE_ID,
            status="ready",
            contract_version=value,
        )
    except ValueError:
        return False
    return True
