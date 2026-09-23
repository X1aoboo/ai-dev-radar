"""Shared JSON Schema checks against the published Gateway OpenAPI baseline."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


CONTRACT_PATH = (
    Path(__file__).resolve().parents[1]
    / "../docs/contracts/ai-dev-data-gateway/baseline/openapi.json"
).resolve()


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


def validate_openapi(schema_name, instance):
    contract = openapi_contract()
    schema = resolve_local_refs(contract["components"]["schemas"][schema_name], contract)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(instance)
