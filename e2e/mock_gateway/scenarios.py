"""Mutable process-local behavior for the Mock Gateway control plane."""


VALID_TOKEN = "e2e-valid-token"

_state = {
    "readiness": "ready",
    "collection": "collection_success",
    "collection_requests": [],
}


def reset() -> dict:
    _state["readiness"] = "ready"
    _state["collection"] = "collection_success"
    _state["collection_requests"].clear()
    return snapshot()


def update(readiness: str | None, collection: str | None) -> dict:
    if readiness is not None:
        _state["readiness"] = readiness
    if collection is not None:
        _state["collection"] = collection
    return snapshot()


def get_readiness_scenario() -> str:
    return _state["readiness"]


def get_collection_scenario() -> str:
    return _state["collection"]


def record_collection(request: dict) -> None:
    _state["collection_requests"].append(request)


def snapshot() -> dict:
    return {
        "readiness": _state["readiness"],
        "collection": _state["collection"],
        "collection_requests": list(_state["collection_requests"]),
    }
