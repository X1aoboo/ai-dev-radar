"""Synchronous, credential-bearing client for the private Collector Gateway."""

from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from . import config
from .collector_contracts import CollectorIRError, CollectorIRRequest


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
    *, request_id: str, transport: httpx.BaseTransport | None = None
) -> httpx.Client:
    base_url = config.COLLECTOR_GATEWAY_URL
    token = config.COLLECTOR_GATEWAY_TOKEN
    if not base_url or not token:
        raise GatewayFailure(
            code="gateway_not_configured",
            message="Collector Gateway is not configured.",
            retryable=False,
            request_id=request_id,
        )
    try:
        parsed_url = httpx.URL(base_url)
    except Exception as exc:
        raise GatewayFailure(
            code="gateway_configuration_error",
            message="Collector Gateway configuration is invalid.",
            retryable=False,
            request_id=request_id,
        ) from exc
    if (
        parsed_url.scheme not in {"http", "https"}
        or not parsed_url.host
        or parsed_url.username
        or parsed_url.password
        or parsed_url.query
        or parsed_url.fragment
    ):
        raise GatewayFailure(
            code="gateway_configuration_error",
            message="Collector Gateway configuration is invalid.",
            retryable=False,
            request_id=request_id,
        )
    if config.APP_ENV in {"production", "prod"} and parsed_url.scheme != "https":
        raise GatewayFailure(
            code="gateway_https_required",
            message="Collector Gateway must use HTTPS in production.",
            retryable=False,
            request_id="",
        )
    return httpx.Client(
        base_url=base_url.rstrip("/"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=config.COLLECTOR_GATEWAY_TIMEOUT_SECONDS,
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
