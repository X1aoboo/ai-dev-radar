"""Synchronous, credential-bearing client for the private Collector Gateway."""

from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .collector_contracts import CollectorIRError, CollectorIRRequest
from .gateway_config import GatewayConfigError, GatewayRuntimeConfig, validate_gateway_base_url


class GatewayFailure(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        retryable: bool,
        request_id: str,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.request_id = request_id


class _CollectorIRResponseEnvelope(BaseModel):
    """Validate the response envelope, then stage malformed records as invalid rows."""

    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=1, max_length=100)
    records: list[Any] = Field(max_length=10000)


def create_gateway_client(
    *,
    runtime_config: GatewayRuntimeConfig,
    transport: httpx.BaseTransport | None = None,
    timeout_seconds: float | None = None,
) -> httpx.Client:
    try:
        base_url = validate_gateway_base_url(runtime_config.base_url)
    except GatewayConfigError as exc:
        raise GatewayFailure(
            code=exc.code,
            message=exc.message,
            retryable=False,
            request_id="",
        ) from exc
    return httpx.Client(
        base_url=base_url,
        headers={"Authorization": f"Bearer {runtime_config.bearer_token}"},
        timeout=(timeout_seconds if timeout_seconds is not None else runtime_config.request_timeout_seconds),
        follow_redirects=False,
        transport=transport,
    )


def collect_ir_records(
    client: httpx.Client,
    request: CollectorIRRequest,
) -> list[Any]:
    try:
        response = client.post(
            "/v1/collections/ir",
            json=request.model_dump(mode="json"),
        )
    except httpx.TimeoutException as exc:
        raise GatewayFailure(
            code="gateway_timeout",
            message="Collector Gateway timed out.",
            retryable=True,
            request_id=request.request_id,
        ) from exc
    except httpx.RequestError as exc:
        raise GatewayFailure(
            code="gateway_unavailable",
            message="Collector Gateway is unavailable.",
            retryable=True,
            request_id=request.request_id,
        ) from exc

    if not response.is_success:
        try:
            error = CollectorIRError.model_validate_json(response.content)
        except ValidationError as exc:
            raise GatewayFailure(
                code="gateway_http_error",
                message="Collector Gateway returned an invalid error response.",
                retryable=response.status_code == 429 or response.status_code >= 500,
                request_id=request.request_id,
            ) from exc
        if error.request_id != request.request_id:
            raise GatewayFailure(
                code="request_id_mismatch",
                message="Collector Gateway response request_id did not match.",
                retryable=False,
                request_id=request.request_id,
            )
        # Do not reflect remote messages into Radar logs or user-visible run details.
        raise GatewayFailure(
            code=error.code,
            message="Collector Gateway reported a collection error.",
            retryable=error.retryable,
            request_id=error.request_id,
        )

    try:
        envelope = _CollectorIRResponseEnvelope.model_validate_json(response.content)
    except ValidationError as exc:
        code = "too_many_records" if any(
            error.get("type") == "too_long" and error.get("loc") == ("records",)
            for error in exc.errors()
        ) else "invalid_gateway_response"
        message = (
            "Collector Gateway exceeded the 10000 record limit."
            if code == "too_many_records"
            else "Collector Gateway returned an invalid response."
        )
        raise GatewayFailure(
            code=code,
            message=message,
            retryable=False,
            request_id=request.request_id,
        ) from exc
    if envelope.request_id != request.request_id:
        raise GatewayFailure(
            code="request_id_mismatch",
            message="Collector Gateway response request_id did not match.",
            retryable=False,
            request_id=request.request_id,
        )
    return envelope.records
