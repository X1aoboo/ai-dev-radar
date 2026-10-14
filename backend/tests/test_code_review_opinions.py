"""Behavior tests for the local AI MR review-opinion source and derived metrics."""

from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import sessionmaker

from app.db import Base, SessionLocal
from app.models import AIReviewOpinion, Activity, Metric


def login(client, username="admin"):
    from app.config import SEED_PASSWORD

    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": SEED_PASSWORD},
    )
    assert response.status_code == 200


@pytest.fixture
def source_prefix():
    prefix = f"test-mrr-opinion-{uuid4().hex}"
    yield prefix
    with SessionLocal() as db:
        db.execute(delete(AIReviewOpinion).where(AIReviewOpinion.source_id.like(f"{prefix}%")))
        db.commit()


def team_ids(client):
    response = client.get("/api/teams")
    assert response.status_code == 200
    return {team["name"]: team["id"] for team in response.json()}


def metric_id(code):
    with SessionLocal() as db:
        metric = db.scalar(select(Metric).where(Metric.code == code))
        assert metric is not None
        return metric.id


def test_opinion_source_upserts_lists_and_scopes_maintainers(client, source_prefix):
    login(client)
    teams = team_ids(client)
    source_id = f"{source_prefix}-owned-by-team-b"
    payload = {
        "team_id": teams["团队B"],
        "opinion_date": "2040-01-12",
        "ai_effective": True,
    }

    created = client.put(f"/api/data/code-review/opinions/{source_id}", json=payload)
    assert created.status_code == 200
    created_body = created.json()
    assert created_body["source_id"] == source_id
    assert created_body["ai_effective"] is True
    assert "opinion_text" not in created_body

    updated = client.put(
        f"/api/data/code-review/opinions/{source_id}",
        json={**payload, "ai_effective": False},
    )
    assert updated.status_code == 200
    assert updated.json()["id"] == created_body["id"]
    assert updated.json()["ai_effective"] is False

    login(client, "maintainer.团队A")
    assert client.get("/api/data/code-review/opinions?team_id={}".format(teams["团队B"])).status_code == 403
    own_records = client.get("/api/data/code-review/opinions?page_size=200")
    assert own_records.status_code == 200
    assert all(row["team_id"] == teams["团队A"] for row in own_records.json()["items"])
    stolen = client.put(
        f"/api/data/code-review/opinions/{source_id}",
        json={"team_id": teams["团队A"], "opinion_date": "2040-01-12", "ai_effective": True},
    )
    assert stolen.status_code == 403


def test_effective_opinion_metrics_keep_zero_and_missing_distinct(client, source_prefix):
    login(client)
    teams = team_ids(client)
    team_a = teams["团队A"]

    records = [
        ("jan-true", date(2040, 1, 12), True),
        ("jan-false", date(2040, 1, 13), False),
        ("feb-false", date(2040, 2, 12), False),
    ]
    for suffix, opinion_date, ai_effective in records:
        response = client.put(
            f"/api/data/code-review/opinions/{source_prefix}-{suffix}",
            json={"team_id": team_a, "opinion_date": opinion_date.isoformat(), "ai_effective": ai_effective},
        )
        assert response.status_code == 200

    count_response = client.get(
        "/api/compute",
        params={"metric_id": metric_id("mrr-effective-count"), "team_id": team_a, "dim": "time", "gran": "month"},
    )
    rate_response = client.get(
        "/api/compute",
        params={"metric_id": metric_id("mrr-effective-rate"), "team_id": team_a, "dim": "time", "gran": "month"},
    )
    assert count_response.status_code == rate_response.status_code == 200

    def point(response, month):
        body = response.json()
        points = body["series"][0]["values"]
        return next(value for value in points if value["period_id"] == month)

    assert point(count_response, "2040-01")["value"] == 1
    assert point(rate_response, "2040-01")["value"] == pytest.approx(0.5)
    count_january = next(point for point in count_response.json()["domain_summary"] if point["period_id"] == "2040-01")
    assert count_january["sample_count"] == 2
    assert point(count_response, "2040-02")["value"] == 0
    assert point(rate_response, "2040-02")["value"] == 0

    missing_count = client.get(
        "/api/compute",
        params={"metric_id": metric_id("mrr-effective-count"), "team_id": teams["团队B"], "dim": "time", "gran": "month"},
    ).json()
    missing_rate = client.get(
        "/api/compute",
        params={"metric_id": metric_id("mrr-effective-rate"), "team_id": teams["团队B"], "dim": "time", "gran": "month"},
    ).json()
    assert next(point for point in missing_count["series"][0]["values"] if point["period_id"] == "2040-01")["value"] is None
    assert next(point for point in missing_rate["series"][0]["values"] if point["period_id"] == "2040-01")["value"] is None


def test_startup_migration_adds_opinion_table_and_metrics_without_reseeding(tmp_path):
    from sqlalchemy import create_engine

    from app.migrations import ensure_ai_review_opinion_schema

    database_path = tmp_path / "legacy-capability.db"
    legacy_engine = create_engine(f"sqlite:///{database_path}")
    Base.metadata.create_all(legacy_engine)
    AIReviewOpinion.__table__.drop(legacy_engine)
    factory = sessionmaker(bind=legacy_engine, expire_on_commit=False)
    with factory() as db:
        activity = Activity(code="mrr", name="MR代码检视", kind="general", sort_order=8)
        db.add(activity)
        db.flush()
        db.add_all([
            Metric(activity_id=activity.id, code="mrr-count", name="AI检视意见数", type="count", numerator_semantic="AI检视意见数", denominator_semantic=None),
            Metric(activity_id=activity.id, code="mrr-rate", name="AI检视率", type="ratio", numerator_semantic="AI检视MR数", denominator_semantic="MR总数"),
        ])
        db.commit()

    ensure_ai_review_opinion_schema(legacy_engine, factory)
    with factory() as db:
        codes = set(db.scalars(select(Metric.code).where(Metric.activity_id == 1)).all())
        assert codes == {"mrr-count", "mrr-rate", "mrr-effective-count", "mrr-effective-rate"}
    assert "ai_review_opinions" in inspect(legacy_engine).get_table_names()
    legacy_engine.dispose()
