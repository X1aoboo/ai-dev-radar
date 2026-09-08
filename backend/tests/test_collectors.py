"""采集器注册与批量落事实记录的公开 seam 测试。"""

from datetime import date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.collectors import CollectedFact, CollectorRegistry
from app.db import Base
from app.models import Activity, FactRecord, Metric, Team
from app.scheduler import run_daily_collection


def collection_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    return factory()


class FakeCollector:
    def __init__(self, metric_code="fake-rate"):
        self.metric_code = metric_code
        self.calls = []

    def collect(self, source_mapping, window):
        self.calls.append((source_mapping, window))
        return [
            CollectedFact(
                metric_code=self.metric_code,
                numerator=3,
                denominator=5,
                start_date=window.start_date,
                end_date=window.end_date,
            )
        ]


def test_registered_fake_collector_writes_auto_fact():
    db = collection_session()
    try:
        activity = Activity(code="fake", name="Fake", kind="general", sort_order=0)
        db.add(activity)
        db.flush()
        metric = Metric(
            activity_id=activity.id,
            code="fake-rate",
            name="Fake rate",
            type="ratio",
            numerator_semantic="numerator",
            denominator_semantic="denominator",
            collect_method="auto",
            sort_order=0,
        )
        db.add(metric)
        team = Team(name="Fake team", source_mapping={"project": "fake"})
        db.add(team)
        db.commit()

        collector = FakeCollector()
        registry = CollectorRegistry()
        registry.register(collector, metric_codes=["fake-rate"])

        summary = run_daily_collection(db, registry, run_date=date(2026, 9, 8))

        facts = db.scalars(select(FactRecord)).all()
        assert len(facts) == 1
        assert facts[0].source == "auto"
        assert facts[0].team_id == team.id
        assert facts[0].metric_id == metric.id
        assert facts[0].numerator == 3
        assert facts[0].denominator == 5
        assert facts[0].start_date == date(2026, 9, 7)
        assert facts[0].end_date == date(2026, 9, 7)
        assert len(collector.calls) == 1
        assert collector.calls[0][0] == {"project": "fake"}
        assert summary.facts_written == 1

        second_summary = run_daily_collection(db, registry, run_date=date(2026, 9, 8))
        assert len(db.scalars(select(FactRecord)).all()) == 1
        assert second_summary.facts_written == 0
        assert second_summary.facts_updated == 1
        assert len(collector.calls) == 2
    finally:
        db.close()


def test_manual_only_metrics_are_skipped_without_calling_collector(caplog):
    caplog.set_level("INFO", logger="app.scheduler")
    db = collection_session()
    try:
        activity = Activity(code="manual", name="Manual", kind="general", sort_order=0)
        db.add(activity)
        db.flush()
        db.add(
            Metric(
                activity_id=activity.id,
                code="manual-rate",
                name="Manual rate",
                type="ratio",
                numerator_semantic="numerator",
                denominator_semantic="denominator",
                collect_method="manual_only",
                sort_order=0,
            )
        )
        db.add(Team(name="Manual team", source_mapping={"project": "manual"}))
        db.commit()

        collector = FakeCollector()
        registry = CollectorRegistry()
        registry.register(collector, metric_codes=["manual-rate"])

        summary = run_daily_collection(db, registry, run_date=date(2026, 9, 8))

        assert collector.calls == []
        assert db.scalars(select(FactRecord)).all() == []
        assert summary.registrations_run == 0
        assert "no automatic metrics" in caplog.text
    finally:
        db.close()


def test_activity_group_registration_matches_automatic_metric():
    db = collection_session()
    try:
        activity = Activity(code="fake-group", name="Fake group", kind="general", sort_order=0)
        db.add(activity)
        db.flush()
        db.add(
            Metric(
                activity_id=activity.id,
                code="fake-group-rate",
                name="Fake group rate",
                type="ratio",
                numerator_semantic="numerator",
                denominator_semantic="denominator",
                collect_method="auto",
                sort_order=0,
            )
        )
        db.add(Team(name="Group team", source_mapping={"project": "group"}))
        db.commit()

        collector = FakeCollector(metric_code="fake-group-rate")
        registry = CollectorRegistry()
        registry.register(collector, activity_codes=["fake-group"])

        summary = run_daily_collection(db, registry, run_date=date(2026, 9, 8))

        assert summary.facts_written == 1
        assert summary.registrations_run == 1
        assert len(collector.calls) == 1
        assert len(db.scalars(select(FactRecord)).all()) == 1
    finally:
        db.close()
