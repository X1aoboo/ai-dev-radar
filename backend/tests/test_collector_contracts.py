"""Wire-contract and MockTransport checks for the private IR Gateway."""

from datetime import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError as JSONSchemaValidationError
import pytest
from pydantic import ValidationError

from app import config
from app.collector_contracts import (
    CollectorIRError,
    CollectorIRRecord,
    CollectorIRRequest,
    CollectorIRResponse,
    ProductVersionRef,
)
from app.collector_gateway import (
    GatewayFailure,
    collect_ir_records,
    create_gateway_client,
)


SHANGHAI = ZoneInfo("Asia/Shanghai")
CONTRACT_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs/contracts/ai-dev-data-gateway/baseline/openapi.json"
)


def openapi_contract():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def resolve_local_refs(value, root):
    if isinstance(value, dict):
        if set(value) == {"$ref"}:
            ref = value["$ref"]
            assert ref.startswith("#/"), ref
            target = root
            for part in ref[2:].split("/"):
                target = target[part.replace("~1", "/").replace("~0", "~")]
            return resolve_local_refs(target, root)
        return {key: resolve_local_refs(item, root) for key, item in value.items()}
    if isinstance(value, list):
        return [resolve_local_refs(item, root) for item in value]
    return value


def normalized_schema(schema):
    if isinstance(schema, dict):
        return {
            key: normalized_schema(value)
            for key, value in schema.items()
            if key not in {"$defs", "title", "description", "pattern"}
        }
    if isinstance(schema, list):
        return [normalized_schema(item) for item in schema]
    return schema


def validate_openapi(schema_name, instance):
    contract = openapi_contract()
    schema = resolve_local_refs(contract["components"]["schemas"][schema_name], contract)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(instance)


def request_payload(request_id="request-1"):
    return CollectorIRRequest(
        request_id=request_id,
        product_versions=[
            ProductVersionRef(product_name="产品A", version_name="版本A")
        ],
        start_at=datetime(2026, 9, 17, tzinfo=SHANGHAI),
        end_at=datetime(2026, 9, 18, tzinfo=SHANGHAI),
    )


def configure_gateway(monkeypatch, *, url="https://gateway.test", token="test-token", env="test"):
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_URL", url)
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_TOKEN", token)
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_TIMEOUT_SECONDS", 2)
    monkeypatch.setattr(config, "APP_ENV", env)


def test_openapi_is_the_versioned_wire_contract_and_models_conform():
    contract = openapi_contract()
    assert contract["openapi"].startswith("3.1.")
    assert contract["info"]["version"] == "1.0.0"
    operation = contract["paths"]["/v1/collections/ir"]["post"]
    assert operation["x-capability-id"] == "requirements.ir.collection"
    request_schema = contract["components"]["schemas"]["CollectorIRRequest"]
    timezone_pattern = "(?:Z|[+-][0-9]{2}:[0-9]{2})$"
    assert request_schema["properties"]["start_at"]["pattern"] == timezone_pattern
    assert request_schema["properties"]["end_at"]["pattern"] == timezone_pattern

    model_pairs = (
        ("ProductVersionRef", ProductVersionRef),
        ("CollectorIRRequest", CollectorIRRequest),
        ("CollectorIRRecord", CollectorIRRecord),
        ("CollectorIRResponse", CollectorIRResponse),
        ("GatewayError", CollectorIRError),
    )
    for schema_name, model in model_pairs:
        protocol_schema = resolve_local_refs(
            contract["components"]["schemas"][schema_name], contract
        )
        model_schema = model.model_json_schema()
        resolved_model_schema = resolve_local_refs(model_schema, model_schema)
        assert normalized_schema(protocol_schema) == normalized_schema(resolved_model_schema)

    request_example = operation["requestBody"]["content"]["application/json"]["example"]
    response_example = operation["responses"]["200"]["content"]["application/json"]["example"]
    validate_openapi("CollectorIRRequest", request_example)
    validate_openapi("CollectorIRResponse", response_example)
    CollectorIRRequest.model_validate_json(json.dumps(request_example))
    CollectorIRResponse.model_validate_json(json.dumps(response_example))
    retryable_by_status = {
        "400": False,
        "401": False,
        "403": False,
        "422": False,
        "429": True,
        "500": True,
        "502": True,
        "503": True,
        "504": True,
    }
    for status, retryable in retryable_by_status.items():
        error_response = resolve_local_refs(operation["responses"][status], contract)
        error_example = error_response["content"]["application/json"]["example"]
        assert error_example["retryable"] is retryable
        validate_openapi("GatewayError", error_example)
        CollectorIRError.model_validate_json(json.dumps(error_example))


def test_contract_requires_timezone_and_forbids_undeclared_fields():
    invalid_request = {
        "request_id": "r1",
        "product_versions": [],
        "start_at": "2026-09-17T00:00:00",
        "end_at": "2026-09-18T00:00:00+08:00",
    }
    with pytest.raises(JSONSchemaValidationError):
        validate_openapi("CollectorIRRequest", invalid_request)
    with pytest.raises(ValidationError):
        CollectorIRRequest.model_validate_json(json.dumps(invalid_request))

    invalid_record = {
        "source_id": "IR-1",
        "source_system": "x",
        "product_name": "p",
        "version_name": "v",
        "iteration_name": "i",
        "requirement_name": "n",
        "completed_at": "2026-09-17",
        "business_module": "m",
        "requirement_scenario": "s",
        "product_id": 1,
    }
    with pytest.raises(JSONSchemaValidationError):
        validate_openapi("CollectorIRRecord", invalid_record)
    with pytest.raises(ValidationError):
        CollectorIRRecord.model_validate_json(json.dumps(invalid_record))


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
    assert "team_name" not in body
    assert body["product_versions"] == [
        {"product_name": "产品A", "version_name": "版本A"}
    ]
    assert body["start_at"] == "2026-09-17T00:00:00+08:00"
    assert body["end_at"] == "2026-09-18T00:00:00+08:00"


def test_contract_rejects_duplicate_product_version_pairs_and_accepts_empty_module():
    with pytest.raises(ValidationError, match="must not contain duplicates"):
        CollectorIRRequest(
            request_id="request-1",
            product_versions=[
                ProductVersionRef(product_name="产品A", version_name="版本A"),
                ProductVersionRef(product_name="产品A", version_name="版本A"),
            ],
            start_at=datetime(2026, 9, 17, tzinfo=SHANGHAI),
            end_at=datetime(2026, 9, 18, tzinfo=SHANGHAI),
        )

    operation = openapi_contract()["paths"]["/v1/collections/ir"]["post"]
    record = operation["responses"]["200"]["content"]["application/json"]["example"]["records"][0]
    assert record["business_module"] is None
    validate_openapi("CollectorIRRecord", record)
    CollectorIRRecord.model_validate_json(json.dumps(record))
    CollectorIRRecord.model_validate_json(json.dumps({**record, "business_module": "   "}))


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
