from datetime import date
from decimal import Decimal

import pytest

from app.maturity import build_maturity_overview, grade_for_score, parse_score


def activity(activity_id, name, kind="key", order=0):
    return {"id": activity_id, "code": f"a-{activity_id}", "name": name, "kind": kind, "sort_order": order}


def team(team_id, name):
    return {"id": team_id, "name": name}


def maturity_record(team_id, activity_id, score, month="2026-09", **extra):
    return {
        "id": f"r-{team_id}-{activity_id}",
        "team_id": team_id,
        "activity_id": activity_id,
        "assessment_month": date.fromisoformat(f"{month}-01"),
        "score_decimal": score,
        "activity": extra.pop("activity", None),
        **extra,
    }


def test_score_boundaries_are_decimal_and_floor_without_rounding_up():
    assert parse_score("0") == Decimal("0.00")
    assert parse_score("0.99") == Decimal("0.99")
    assert parse_score("2.90") == Decimal("2.90")
    assert parse_score("4.10") == Decimal("4.10")
    assert parse_score("5") == Decimal("5.00")
    assert grade_for_score("0.99") == 0
    assert grade_for_score("1") == 1
    assert grade_for_score("2.90") == 2
    assert grade_for_score("4.10") == 4
    assert grade_for_score("5") == 5

    with pytest.raises(ValueError, match="between 0 and 5"):
        parse_score("5.01")
    with pytest.raises(ValueError, match="two decimal"):
        parse_score("1.001")


def test_overview_keeps_missing_distinct_from_zero_and_uses_exact_average_grade():
    activities = [activity(1, "活动一", order=0), activity(2, "活动二", order=1)]
    records = [
        maturity_record(1, 1, "0.99"),
        maturity_record(2, 1, "1.00"),
        maturity_record(1, 2, "0"),
    ]
    result = build_maturity_overview(
        teams=[team(1, "团队A"), team(2, "团队B")],
        activities=activities,
        records=records,
        month="2026-09",
        kind="key",
    )

    first = result["activities"][0]
    assert first["average_raw"] == "0.995"
    assert first["score_display"] == "1.00"
    assert first["grade"] == 0
    assert first["assessed_team_count"] == 2
    assert first["grade_distribution"] == {"L0": 1, "L1": 1, "L2": 0, "L3": 0, "L4": 0, "L5": 0}
    assert result["coverage_rate"] == 3 / 4
    assert result["teams"][1]["cells"][1]["score"] is None
    assert result["teams"][0]["cells"][1]["score"] == 0
    assert result["teams"][0]["cells"][1]["grade"] == 0


def login(client, username):
    from app.config import SEED_PASSWORD

    return client.post("/api/auth/login", json={"username": username, "password": SEED_PASSWORD})


def test_maturity_api_saves_returns_raw_metadata_and_clears(client):
    assert login(client, "admin").status_code == 200
    activity_id = client.get("/api/catalog").json()[0]["id"]
    month = "2098-07"
    saved = client.put(
        f"/api/maturity/teams/1/months/{month}",
        json={"entries": [{"activity_id": activity_id, "score": "2.90", "note": "阶段性评估"}]},
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["saved_count"] == 1
    record = next(item for item in body["records"] if item["activity_id"] == activity_id)
    assert record["score_raw"] == "2.90"
    assert record["score_display"] == "2.90"
    assert record["grade"] == 2
    assert record["note"] == "阶段性评估"
    assert record["maintained_by"] == "admin"

    overview = client.get(
        "/api/maturity/overview", params={"month": month, "kind": "key"}
    )
    assert overview.status_code == 200
    summary = next(item for item in overview.json()["activities"] if item["activity_id"] == activity_id)
    assert summary["score_raw"] == "2.90"
    assert summary["grade"] == 2
    assert overview.json()["assessed_cell_count"] == 1

    cleared = client.delete(f"/api/maturity/teams/1/months/{month}")
    assert cleared.status_code == 200
    assert cleared.json()["deleted_count"] == 1


def test_maturity_api_enforces_roles_validation_and_atomic_unique_entries(client):
    assert login(client, "admin").status_code == 200
    activity_id = client.get("/api/catalog").json()[0]["id"]
    month = "2098-08"

    duplicate = client.put(
        f"/api/maturity/teams/1/months/{month}",
        json={"entries": [{"activity_id": activity_id, "score": 1}, {"activity_id": activity_id, "score": 2}]},
    )
    assert duplicate.status_code == 422

    too_precise = client.put(
        f"/api/maturity/teams/1/months/{month}",
        json={"entries": [{"activity_id": activity_id, "score": "1.001"}]},
    )
    assert too_precise.status_code == 422

    unknown_activity = client.put(
        f"/api/maturity/teams/1/months/{month}",
        json={"entries": [{"activity_id": 999999, "score": 1}]},
    )
    assert unknown_activity.status_code == 404

    assert client.put(
        f"/api/maturity/teams/1/months/{month}",
        json={"entries": [{"activity_id": activity_id, "score": 1}]},
    ).status_code == 200
    assert client.put(
        f"/api/maturity/teams/1/months/{month}",
        json={"entries": [{"activity_id": activity_id, "score": 2}]},
    ).status_code == 200
    records = client.get("/api/maturity/records", params={"month": month, "team_id": 1}).json()
    assert len([item for item in records if item["activity_id"] == activity_id]) == 1
    assert next(item for item in records if item["activity_id"] == activity_id)["score_raw"] == "2.00"

    assert client.post("/api/auth/logout").status_code == 200
    assert login(client, "maintainer.团队A").status_code == 200
    forbidden = client.put(
        f"/api/maturity/teams/2/months/{month}",
        json={"entries": [{"activity_id": activity_id, "score": 1}]},
    )
    assert forbidden.status_code == 403

    assert client.post("/api/auth/logout").status_code == 200
    assert login(client, "admin").status_code == 200
    cleared = client.delete(f"/api/maturity/teams/1/months/{month}")
    assert cleared.status_code == 200
    assert cleared.json()["deleted_count"] == 1
