"""Admin-only Gateway management API, live activation, and secret boundaries."""

import json

import httpx
import pytest
from sqlalchemy import delete

from app.db import SessionLocal
from app.models import GatewayConfigAudit, GatewayConfiguration, GatewayHealthStatus


TOKEN = "api-test-secret-token"


def clear_gateway_state():
    with SessionLocal() as db:
        db.execute(delete(GatewayConfigAudit))
        db.execute(delete(GatewayHealthStatus))
        db.execute(delete(GatewayConfiguration))
        db.commit()


@pytest.fixture
def gateway_client(client):
    clear_gateway_state()
    yield client
    if hasattr(client.app.state, "gateway_transport_factory"):
        delattr(client.app.state, "gateway_transport_factory")
    if hasattr(client.app.state, "gateway_transport"):
        delattr(client.app.state, "gateway_transport")
    clear_gateway_state()


def login(client, username):
    from app.config import SEED_PASSWORD

    return client.post("/api/auth/login", json={"username": username, "password": SEED_PASSWORD})


def draft_payload(token=TOKEN, *, url="https://gateway.test"):
    return {
        "base_url": url,
        "bearer_token": token,
        "request_timeout_seconds": 2,
    }


def test_gateway_management_is_admin_only_and_secret_validation_is_redacted(gateway_client):
    client = gateway_client
    assert client.get("/api/gateway").status_code == 401
    assert login(client, "viewer").status_code == 200
    assert client.get("/api/gateway").status_code == 403
    forbidden = client.put("/api/gateway/draft", json=draft_payload())
    assert forbidden.status_code == 403
    client.post("/api/auth/logout")
    assert login(client, "admin").status_code == 200

    initial = client.get("/api/gateway")
    assert initial.status_code == 200
    assert initial.json() == {"active": None, "draft": None}

    invalid_url = client.put("/api/gateway/draft", json=draft_payload(url="not-a-url"))
    assert invalid_url.status_code == 422
    assert TOKEN not in invalid_url.text

    missing_token = client.put("/api/gateway/draft", json=draft_payload(token=""))
    assert missing_token.status_code == 422
    assert TOKEN not in missing_token.text

    too_long_token = client.put("/api/gateway/draft", json=draft_payload(token="s" * 4097))
    assert too_long_token.status_code == 422
    assert "s" * 80 not in too_long_token.text
    assert TOKEN not in too_long_token.text

    malformed_secret = client.put("/api/gateway/draft", json={
        "base_url": "https://gateway.test",
        "bearer_token": {"value": TOKEN},
        "request_timeout_seconds": 5,
    })
    assert malformed_secret.status_code == 422
    assert TOKEN not in malformed_secret.text


def test_activation_rechecks_live_readiness_and_failed_draft_keeps_active(gateway_client):
    client = gateway_client
    assert login(client, "admin").status_code == 200
    current = {"status": 200}
    readiness_calls = []

    def gateway_response(request):
        if request.url.path == "/v1/health/ready":
            readiness_calls.append(request)
            if current["status"] == 401:
                return httpx.Response(401, json={
                    "code": "invalid_credentials",
                    "message": "Authentication failed.",
                    "retryable": False,
                    "request_id": "r1",
                })
            return httpx.Response(200, json={
                "service": "ai-dev-data-gateway",
                "status": "ready",
                "contract_version": "1.0.0",
            })
        body = json.loads(request.content)
        return httpx.Response(200, json={"request_id": body["request_id"], "records": []})

    client.app.state.gateway_transport_factory = lambda: httpx.MockTransport(gateway_response)
    saved = client.put("/api/gateway/draft", json=draft_payload())
    assert saved.status_code == 200, saved.text
    assert TOKEN not in saved.text
    assert "bearer_token" not in saved.text
    assert saved.json()["draft"]["token_configured"] is True

    checked = client.post("/api/gateway/draft/check")
    assert checked.status_code == 200
    assert checked.json()["draft"]["health"]["status"] == "CONNECTED"
    activated = client.post("/api/gateway/draft/activate")
    assert activated.status_code == 200, activated.text
    assert len(readiness_calls) == 2
    active_id = activated.json()["active"]["id"]
    assert activated.json()["active"]["health"]["status"] == "CONNECTED"
    assert activated.json()["draft"] is None

    current["status"] = 401
    bad_draft = client.put("/api/gateway/draft", json=draft_payload(token="wrong-secret"))
    assert bad_draft.status_code == 200
    failed_check = client.post("/api/gateway/draft/check")
    assert failed_check.status_code == 200
    assert failed_check.json()["draft"]["health"]["status"] == "AUTH_FAILED"
    assert failed_check.json()["active"]["id"] == active_id
    before_activation = len(readiness_calls)
    rejected = client.post("/api/gateway/draft/activate")
    assert rejected.status_code == 409
    assert len(readiness_calls) == before_activation + 1
    state = client.get("/api/gateway").json()
    assert state["active"]["id"] == active_id
    assert state["active"]["health"]["status"] == "CONNECTED"
    assert "wrong-secret" not in json.dumps(state)

    audits = client.get("/api/gateway/audits")
    assert audits.status_code == 200
    assert any(item["action"] == "DRAFT_ACTIVATED" for item in audits.json())
    assert "wrong-secret" not in audits.text
    assert TOKEN not in audits.text

    runs = client.post("/api/collection-schedules/ir/run", json={})
    assert runs.status_code == 200, runs.text
    assert runs.json()["status"] in {"succeeded", "partial"}
    assert runs.json()["gateway_config_id"] == active_id
    assert runs.json()["gateway_base_url"] == "https://gateway.test"
    assert "wrong-secret" not in runs.text
