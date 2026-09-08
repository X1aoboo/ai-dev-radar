"""手动补录 API 与当前事实记录语义的行为测试。"""

import pytest
from sqlalchemy import delete

from app.db import SessionLocal
from app.models import FactRecord


@pytest.fixture(autouse=True)
def clean_manual_records():
    yield
    with SessionLocal() as db:
        db.execute(delete(FactRecord).where(FactRecord.entered_by != "演示种子"))
        db.commit()


def login(client, username):
    from app.config import SEED_PASSWORD

    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": SEED_PASSWORD},
    )
    assert response.status_code == 200


def metric_by_code(client, code):
    return next(
        metric
        for activity in client.get("/api/catalog").json()
        for metric in activity["metrics"]
        if metric["code"] == code
    )


def team_by_name(client, name):
    return next(team for team in client.get("/api/teams").json() if team["name"] == name)


def iteration_by_name(client, name):
    return next(
        iteration
        for version in client.get("/api/versions").json()
        for iteration in version["iterations"]
        if iteration["name"] == name
    )


def test_maintainer_can_append_a_key_fact_with_audit_metadata(client):
    login(client, "maintainer.团队A")
    team = team_by_name(client, "团队A")
    metric = metric_by_code(client, "sa-ir-pen")
    iteration = iteration_by_name(client, "SCC 27.2.RC1-迭代一")

    response = client.post(
        "/api/facts",
        json={
            "team_id": team["id"],
            "metric_id": metric["id"],
            "iteration_id": iteration["id"],
            "numerator": 9,
            "denominator": 10,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["team_id"] == team["id"]
    assert body["metric_id"] == metric["id"]
    assert body["iteration_id"] == iteration["id"]
    assert body["numerator"] == 9
    assert body["denominator"] == 10
    assert body["start_date"] == iteration["start_date"]
    assert body["end_date"] == iteration["end_date"]
    assert body["source"] == "manual"
    assert body["entered_by"] == "maintainer.团队A"
    assert body["entered_at"]


def test_maintainer_cannot_append_a_fact_for_another_team(client):
    login(client, "maintainer.团队A")
    team = team_by_name(client, "团队B")
    metric = metric_by_code(client, "sa-ir-pen")
    iteration = iteration_by_name(client, "SCC 27.2.RC1-迭代一")

    response = client.post(
        "/api/facts",
        json={
            "team_id": team["id"],
            "metric_id": metric["id"],
            "iteration_id": iteration["id"],
            "numerator": 9,
            "denominator": 10,
        },
    )

    assert response.status_code == 403


def test_viewer_cannot_append_a_fact(client):
    login(client, "viewer")
    team = team_by_name(client, "团队A")
    metric = metric_by_code(client, "sa-ir-pen")
    iteration = iteration_by_name(client, "SCC 27.2.RC1-迭代一")

    response = client.post(
        "/api/facts",
        json={
            "team_id": team["id"],
            "metric_id": metric["id"],
            "iteration_id": iteration["id"],
            "numerator": 9,
            "denominator": 10,
        },
    )

    assert response.status_code == 403


def test_repeated_manual_entry_keeps_history_but_compute_uses_latest_manual(client):
    login(client, "maintainer.团队A")
    team = team_by_name(client, "团队A")
    metric = metric_by_code(client, "sa-ir-pen")
    iteration = iteration_by_name(client, "SCC 27.2.RC1-迭代一")
    payload = {
        "team_id": team["id"],
        "metric_id": metric["id"],
        "iteration_id": iteration["id"],
        "numerator": 1,
        "denominator": 2,
    }

    first = client.post("/api/facts", json=payload)
    assert first.status_code == 201
    payload.update(numerator=9, denominator=10)
    second = client.post("/api/facts", json=payload)
    assert second.status_code == 201
    assert second.json()["id"] > first.json()["id"]

    current = client.get(
        "/api/facts",
        params={
            "team_id": team["id"],
            "metric_id": metric["id"],
            "iteration_id": iteration["id"],
        },
    )
    assert current.status_code == 200
    assert len(current.json()) == 1
    assert current.json()[0]["id"] == second.json()["id"]

    history = client.get(
        "/api/facts",
        params={
            "team_id": team["id"],
            "metric_id": metric["id"],
            "iteration_id": iteration["id"],
            "history": "true",
        },
    )
    assert history.status_code == 200
    assert [fact["id"] for fact in history.json()][-2:] == [first.json()["id"], second.json()["id"]]

    computed = client.get(
        "/api/compute",
        params={
            "metric_id": metric["id"],
            "team_id": team["id"],
            "iteration_id": iteration["id"],
            "dim": "iteration",
            "version_id": 2,
        },
    )
    assert computed.status_code == 200
    assert computed.json()["series"][0]["values"][0]["value"] == 0.9


def test_general_manual_entry_uses_an_explicit_period(client):
    login(client, "maintainer.团队A")
    team = team_by_name(client, "团队A")
    metric = metric_by_code(client, "mrr-rate")

    response = client.post(
        "/api/facts",
        json={
            "team_id": team["id"],
            "metric_id": metric["id"],
            "start_date": "2026-09-01",
            "end_date": "2026-09-07",
            "numerator": 3,
            "denominator": 4,
        },
    )

    assert response.status_code == 201
    assert response.json()["iteration_id"] is None
    assert response.json()["start_date"] == "2026-09-01"
    assert response.json()["end_date"] == "2026-09-07"

    computed = client.get(
        "/api/compute",
        params={
            "metric_id": metric["id"],
            "team_id": team["id"],
            "dim": "time",
            "gran": "month",
        },
    )
    assert computed.status_code == 200
    september = next(point for point in computed.json()["series"][0]["values"] if point["period_id"] == "2026-09")
    assert september["value"] == 0.75


def test_manual_entry_rejects_mismatched_scope_and_metric_values(client):
    login(client, "admin")
    team = team_by_name(client, "团队A")
    key_metric = metric_by_code(client, "sa-ir-pen")
    general_metric = metric_by_code(client, "mrr-count")
    iteration = iteration_by_name(client, "SCC 27.2.RC1-迭代一")

    key_with_period = client.post(
        "/api/facts",
        json={
            "team_id": team["id"],
            "metric_id": key_metric["id"],
            "start_date": "2026-09-01",
            "end_date": "2026-09-07",
            "numerator": 1,
            "denominator": 2,
        },
    )
    assert key_with_period.status_code == 422

    general_with_iteration = client.post(
        "/api/facts",
        json={
            "team_id": team["id"],
            "metric_id": general_metric["id"],
            "iteration_id": iteration["id"],
            "numerator": 1,
        },
    )
    assert general_with_iteration.status_code == 422

    missing_denominator = client.post(
        "/api/facts",
        json={
            "team_id": team["id"],
            "metric_id": key_metric["id"],
            "iteration_id": iteration["id"],
            "numerator": 1,
        },
    )
    assert missing_denominator.status_code == 422


def test_fact_schema_migration_removes_the_old_key_uniqueness_index():
    from sqlalchemy import create_engine, inspect, text

    from app.migrations import ensure_fact_schema

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE fact_records (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE UNIQUE INDEX uq_fact_key_scope ON fact_records (id)"))

    ensure_fact_schema(engine)

    assert "uq_fact_key_scope" not in {
        index["name"] for index in inspect(engine).get_indexes("fact_records")
    }
