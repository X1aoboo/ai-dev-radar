"""Wire-contract and MockTransport checks for the private IR Gateway."""

from datetime import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import pytest
from pydantic import ValidationError

from app import config
from app.collector_contracts import (
    CollectorIRRecord,
    CollectorIRRequest,
    CollectorIRResponse,
    collector_ir_v1_schema,
)
from app.collector_gateway import (
    GatewayFailure,
    collect_ir_records,
    create_gateway_client,
)


SHANGHAI = ZoneInfo("Asia/Shanghai")


def request_payload(request_id="request-1"):
    return CollectorIRRequest(
        request_id=request_id,
        team_name="团队A",
        product_versions=["版本A"],
        start_at=datetime(2026, 9, 17, tzinfo=SHANGHAI),
        end_at=datetime(2026, 9, 18, tzinfo=SHANGHAI),
    )


def configure_gateway(monkeypatch, *, url="https://gateway.test", token="test-token", env="test"):
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_URL", url)
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_TOKEN", token)
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_TIMEOUT_SECONDS", 2)
    monkeypatch.setattr(config, "APP_ENV", env)


def test_json_schema_snapshot_matches_the_strict_pydantic_contract():
    snapshot = Path(__file__).resolve().parents[2] / "docs" / "contracts" / "collector-ir-v1.schema.json"
    assert json.loads(snapshot.read_text(encoding="utf-8")) == collector_ir_v1_schema()
    response_properties = collector_ir_v1_schema()["$defs"]["CollectorIRResponse"]["properties"]
    record_properties = collector_ir_v1_schema()["$defs"]["CollectorIRRecord"]["properties"]
    assert "product_id" not in response_properties
    assert "version_id" not in record_properties
    assert "iteration_id" not in record_properties


def test_contract_requires_timezone_and_forbids_undeclared_fields():
    with pytest.raises(ValidationError):
        CollectorIRRequest.model_validate({
            "request_id": "r1",
            "team_name": "团队A",
            "product_versions": [],
            "start_at": datetime(2026, 9, 17),
            "end_at": datetime(2026, 9, 18, tzinfo=SHANGHAI),
        })
    with pytest.raises(ValidationError):
        CollectorIRRecord.model_validate_json(
            '{"source_id":"IR-1","source_system":"x","version_name":"v",'
            '"iteration_name":"i","requirement_name":"n","completed_at":"2026-09-17",'
            '"business_module":"m","requirement_scenario":"s","product_id":1}'
        )


def test_gateway_client_uses_bearer_and_exact_ir_endpoint(monkeypatch):
    configure_gateway(monkeypatch)
    seen = []

    def handle(request):
        seen.append(request)
        return httpx.Response(200, json={"request_id": "request-1", "records": []})

    client = create_gateway_client(transport=httpx.MockTransport(handle), request_id="request-1")
    try:
        assert collect_ir_records(client, request_payload()) == []
    finally:
        client.close()
    assert seen[0].url == "https://gateway.test/v1/collections/ir"
    assert seen[0].headers["authorization"] == "Bearer test-token"
    body = json.loads(seen[0].content)
    assert body["request_id"] == "request-1"
    assert body["start_at"] == "2026-09-17T00:00:00+08:00"
    assert body["end_at"] == "2026-09-18T00:00:00+08:00"


def test_production_rejects_non_https_gateway_configuration(monkeypatch):
    configure_gateway(monkeypatch, url="http://gateway.test", env="production")
    with pytest.raises(GatewayFailure) as caught:
        create_gateway_client(request_id="request-1")
    assert caught.value.code == "gateway_https_required"


def test_gateway_timeout_is_standardized_without_transport_details(monkeypatch):
    configure_gateway(monkeypatch)

    def handle(request):
        raise httpx.ReadTimeout("private host and token", request=request)

    client = create_gateway_client(transport=httpx.MockTransport(handle), request_id="request-1")
    try:
        with pytest.raises(GatewayFailure) as caught:
            collect_ir_records(client, request_payload())
    finally:
        client.close()
    assert caught.value.code == "gateway_timeout"
    assert caught.value.retryable is True
    assert caught.value.request_id == "request-1"
    assert "private host" not in str(caught.value)
    assert "test-token" not in str(caught.value)


def test_standard_gateway_error_is_checked_and_sanitized(monkeypatch):
    configure_gateway(monkeypatch)
    transport = httpx.MockTransport(lambda request: httpx.Response(503, json={
        "code": "upstream_unavailable",
        "message": "https://internal.example failed with Bearer test-token",
        "retryable": True,
        "request_id": "request-1",
    }))
    client = create_gateway_client(transport=transport, request_id="request-1")
    try:
        with pytest.raises(GatewayFailure) as caught:
            collect_ir_records(client, request_payload())
    finally:
        client.close()
    assert caught.value.code == "upstream_unavailable"
    assert caught.value.retryable is True
    assert caught.value.message == "Collector Gateway reported a collection error."
    assert "internal.example" not in str(caught.value)
    assert "test-token" not in str(caught.value)


def test_gateway_requires_request_id_echo_and_enforces_10000_record_limit(monkeypatch):
    configure_gateway(monkeypatch)
    wrong_id_client = create_gateway_client(
        transport=httpx.MockTransport(lambda request: httpx.Response(
            200, json={"request_id": "other", "records": []}
        )),
        request_id="request-1",
    )
    try:
        with pytest.raises(GatewayFailure, match="request_id") as caught:
            collect_ir_records(wrong_id_client, request_payload())
        assert caught.value.code == "request_id_mismatch"
    finally:
        wrong_id_client.close()

    exact_limit_client = create_gateway_client(
        transport=httpx.MockTransport(lambda request: httpx.Response(
            200, json={"request_id": "request-1", "records": [{}] * 10000}
        )),
        request_id="request-1",
    )
    try:
        assert len(collect_ir_records(exact_limit_client, request_payload())) == 10000
    finally:
        exact_limit_client.close()

    def handle(request):
        return httpx.Response(200, json={"request_id": "request-1", "records": [{}] * 10001})

    client = create_gateway_client(transport=httpx.MockTransport(handle), request_id="request-1")
    try:
        with pytest.raises(GatewayFailure) as caught:
            collect_ir_records(client, request_payload())
    finally:
        client.close()
    assert caught.value.code == "too_many_records"
    assert "10000" in caught.value.message
