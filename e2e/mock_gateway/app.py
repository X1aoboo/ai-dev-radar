"""Separate test-only Gateway HTTP provider; it never imports Radar consumer code."""

import asyncio

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import scenarios
from .models import (
    CollectorIRRequest,
    CollectorIRResponse,
    GatewayError,
    HealthLiveResponse,
    HealthReadyResponse,
    MockScenarioUpdate,
)


app = FastAPI(title="AI Dev Data Gateway E2E Mock", docs_url=None, redoc_url=None)


def error_response(status_code: int, code: str, message: str, request_id: str):
    return JSONResponse(
        status_code=status_code,
        content=GatewayError(
            code=code,
            message=message,
            retryable=status_code >= 500,
            request_id=request_id or "mock-generated-request-id",
        ).model_dump(),
    )


def authorized(request: Request) -> bool:
    return request.headers.get("authorization") == f"Bearer {scenarios.VALID_TOKEN}"


@app.get("/health/live", response_model=HealthLiveResponse)
def health_live():
    return {"status": "alive"}


@app.get("/v1/health/ready", response_model=HealthReadyResponse)
async def health_ready(request: Request):
    if not authorized(request):
        return error_response(401, "invalid_credentials", "Authentication failed.", "")

    scenario = scenarios.get_readiness_scenario()
    if scenario == "auth_failed":
        return error_response(401, "invalid_credentials", "Authentication failed.", "")
    if scenario == "not_ready":
        return error_response(503, "gateway_not_ready", "Gateway is not ready.", "")
    if scenario == "delayed_readiness":
        await asyncio.sleep(1.5)
    if scenario == "service_mismatch":
        return JSONResponse(content={
            "service": "another-service",
            "status": "ready",
            "contract_version": "1.0.0",
        })
    if scenario == "protocol_incompatible":
        return {"service": "ai-dev-data-gateway", "status": "ready", "contract_version": "2.0.0"}
    if scenario == "malformed_readiness":
        return JSONResponse(content={"service": "ai-dev-data-gateway", "status": "ready"})
    return {
        "service": "ai-dev-data-gateway",
        "status": "ready",
        "contract_version": "1.0.0",
        "upstreams": [{"id": "gdemate", "status": "ready"}],
    }


@app.post("/v1/collections/ir", response_model=CollectorIRResponse)
def collect_ir(request: Request, payload: CollectorIRRequest):
    if not authorized(request):
        return error_response(401, "invalid_credentials", "Authentication failed.", payload.request_id)

    scenarios.record_collection(payload.model_dump(mode="json"))
    scenario = scenarios.get_collection_scenario()
    if scenario == "collection_error":
        return error_response(503, "upstream_unavailable", "Gateway is temporarily unavailable.", payload.request_id)
    if scenario == "malformed_collection":
        return JSONResponse(content={"request_id": payload.request_id, "unexpected": True})
    if scenario == "collection_empty":
        return {"request_id": payload.request_id, "records": []}

    product_version = payload.product_versions[0]
    return {
        "request_id": payload.request_id,
        "records": [{
            "source_id": "IR-E2E-001",
            "source_system": "mock-gateway",
            "product_name": product_version.product_name,
            "version_name": product_version.version_name,
            "iteration_name": "SCC 27.1.RC1-迭代一",
            "requirement_name": "E2E Gateway Requirement",
            "completed_at": "2026-02-01",
            "business_module": "E2E",
            "requirement_scenario": "Gateway E2E",
            "ai_assisted": True,
        }],
    }


@app.post("/_mock/reset", include_in_schema=False)
def reset_scenarios():
    return scenarios.reset()


@app.put("/_mock/scenario", include_in_schema=False)
def update_scenario(payload: MockScenarioUpdate):
    return scenarios.update(payload.readiness, payload.collection)


@app.get("/_mock/state", include_in_schema=False)
def get_scenario_state():
    return scenarios.snapshot()
