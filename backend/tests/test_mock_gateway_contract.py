"""The independent Mock Gateway must satisfy the published provider contract."""

import sys
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from e2e.mock_gateway import scenarios  # noqa: E402
from e2e.mock_gateway.app import app as mock_gateway_app  # noqa: E402
from gateway_contract_utils import openapi_contract, validate_openapi  # noqa: E402


def test_mock_gateway_provider_responses_match_openapi_baseline():
    scenarios.reset()
    with TestClient(mock_gateway_app) as client:
        live = client.get("/health/live")
        assert live.status_code == 200
        validate_openapi("HealthLiveResponse", live.json())

        ready = client.get(
            "/v1/health/ready",
            headers={"Authorization": "Bearer e2e-valid-token"},
        )
        assert ready.status_code == 200
        validate_openapi("HealthReadyResponse", ready.json())

        denied = client.get("/v1/health/ready")
        assert denied.status_code == 401
        validate_openapi("GatewayError", denied.json())

        request = {
            "request_id": "provider-contract-1",
            "product_versions": [{"product_name": "团队A产品", "version_name": "SCC 27.1.RC1"}],
            "start_at": "2026-02-01T00:00:00+08:00",
            "end_at": "2026-02-02T00:00:00+08:00",
        }
        collection = client.post(
            "/v1/collections/ir",
            json=request,
            headers={"Authorization": "Bearer e2e-valid-token"},
        )
        assert collection.status_code == 200, collection.text
        validate_openapi("CollectorIRResponse", collection.json())

    contract_paths = openapi_contract()["paths"]
    assert "/health/live" in contract_paths
    assert "/v1/health/ready" in contract_paths


def test_mock_control_plane_is_not_registered_in_radar():
    from app.main import app as radar_app

    assert not any(path.startswith("/_mock/") for path in radar_app.openapi()["paths"])
