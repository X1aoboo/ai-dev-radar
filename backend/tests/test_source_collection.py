"""IR collection orchestration tests with a deterministic HTTPX MockTransport."""

from datetime import date, datetime
import json
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker, selectinload
from sqlalchemy.pool import StaticPool

from app import config
from app.db import Base
from app.models import (
    CollectionRun,
    CollectionSchedule,
    IRRequirement,
    ImportBatch,
    Iteration,
    Product,
    ProductVersion,
    Team,
)
from app.source_collection import run_ir_collection
from app.collectors import CollectorRegistry
from app.scheduler import create_scheduler, load_source_collection_schedules


SHANGHAI = ZoneInfo("Asia/Shanghai")


def collection_session() -> tuple[Session, object]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    return factory(), engine


def add_team_with_ir_hierarchy(db: Session, name: str, version_name: str, *, mapped=True):
    team = Team(
        name=name,
        source_mapping={"product_versions": [version_name] if mapped else []},
    )
    product = Product(name=f"{name} product", team=team)
    version = ProductVersion(name=version_name, product=product)
    iteration = Iteration(
        name=f"{version_name} iteration",
        version=version,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 30),
    )
    db.add_all([team, product, version, iteration])
    db.commit()
    return team, product, version, iteration


def gateway_record(source_id="IR-001", **overrides):
    return {
        "source_id": source_id,
        "source_system": "internal-ir",
        "version_name": "版本A",
        "iteration_name": "版本A iteration",
        "requirement_name": "需求一",
        "completed_at": "2026-09-17",
        "business_module": "CNAE",
        "requirement_scenario": "平台采集",
        "actual_workload": 2,
        "ai_assisted": False,
        **overrides,
    }


def configure_gateway(monkeypatch):
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_URL", "https://gateway.test")
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_TOKEN", "test-token")
    monkeypatch.setattr(config, "COLLECTOR_GATEWAY_TIMEOUT_SECONDS", 2)
    monkeypatch.setattr(config, "APP_ENV", "test")


def run(db, transport):
    return run_ir_collection(
        db,
        start_at=datetime(2026, 9, 17, tzinfo=SHANGHAI),
        end_at=datetime(2026, 9, 18, tzinfo=SHANGHAI),
        started_by="admin",
        trigger_type="manual",
        transport=transport,
    )


def test_team_collection_maps_business_names_stages_batch_and_isolates_failure(monkeypatch):
    configure_gateway(monkeypatch)
    db, engine = collection_session()
    team_a, product, version, iteration = add_team_with_ir_hierarchy(db, "团队A", "版本A")
    team_b, _, _, _ = add_team_with_ir_hierarchy(db, "团队B", "版本B")
    requests = []

    def handle(request):
        body = json.loads(request.content)
        requests.append((request, body))
        if body["team_name"] == "团队B":
            return httpx.Response(503, json={
                "code": "internal_unavailable",
                "message": "https://internal.example error; Bearer test-token",
                "retryable": True,
                "request_id": body["request_id"],
            })
        return httpx.Response(200, json={
            "request_id": body["request_id"],
            "records": [gateway_record()],
        })

    run_result = run(db, httpx.MockTransport(handle))
    assert run_result.status == "partial"
    assert [item["status"] for item in run_result.team_results] == ["succeeded", "failed"]
    assert [item[1]["team_name"] for item in requests] == ["团队A", "团队B"]
    assert all(item[0].url.path == "/v1/collections/ir" for item in requests)
    assert all(item[0].headers["authorization"] == "Bearer test-token" for item in requests)
    assert requests[0][1]["product_versions"] == ["版本A"]
    assert "version_id" not in requests[0][1]
    assert "iteration_id" not in requests[0][1]
    assert requests[0][1]["start_at"] == "2026-09-17T00:00:00+08:00"
    assert requests[0][1]["end_at"] == "2026-09-18T00:00:00+08:00"

    batch = db.scalar(
        select(ImportBatch)
        .options(selectinload(ImportBatch.rows))
        .where(ImportBatch.team_id == team_a.id)
    )
    assert batch is not None
    assert batch.source_kind == "collector"
    assert batch.status == "pending"
    row = batch.rows[0]
    assert row.source_id == "IR-001"
    assert row.source_system == "internal-ir"
    assert row.status == "valid"
    assert row.payload["product_id"] == product.id
    assert row.payload["version_id"] == version.id
    assert row.payload["iteration_id"] == iteration.id
    assert db.scalars(select(IRRequirement)).all() == []
    failed_team = run_result.team_results[1]
    assert failed_team["retryable"] is True
    assert "internal.example" not in failed_team["message"]
    assert "test-token" not in failed_team["message"]
    db.close()
    engine.dispose()


def test_duplicate_ids_and_contract_errors_become_invalid_staging_rows(monkeypatch):
    configure_gateway(monkeypatch)
    db, engine = collection_session()
    _, product, _, _ = add_team_with_ir_hierarchy(db, "团队A", "版本A")
    records = [
        gateway_record("IR-DUP", estimated_workload="not-a-number", product_id=999),
        gateway_record("IR-DUP"),
    ]
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={
        "request_id": json.loads(request.content)["request_id"],
        "records": records,
    }))

    result = run(db, transport)
    batch = db.scalar(select(ImportBatch).options(selectinload(ImportBatch.rows)))
    assert result.status == "succeeded"
    assert sum(row.status == "invalid" for row in batch.rows) == 2
    assert all(row.status == "invalid" for row in batch.rows)
    assert any("source_id 重复" in error for row in batch.rows for error in row.errors)
    assert any("product_id" in error for error in batch.rows[0].errors)
    assert any("estimated_workload" in error for error in batch.rows[0].errors)
    assert batch.rows[0].payload["product_id"] == product.id
    assert batch.rows[0].payload["product_id"] != 999
    db.close()
    engine.dispose()


def test_unmatched_version_team_or_iteration_names_are_invalid_rows(monkeypatch):
    configure_gateway(monkeypatch)
    db, engine = collection_session()
    add_team_with_ir_hierarchy(db, "团队A", "版本A")
    add_team_with_ir_hierarchy(db, "团队B", "版本B")
    records = [
        gateway_record("IR-MISSING-VERSION", version_name="不存在的版本"),
        gateway_record("IR-WRONG-TEAM", version_name="版本B", iteration_name="版本B iteration"),
        gateway_record("IR-MISSING-ITERATION", iteration_name="不存在的迭代"),
    ]

    def handle(request):
        body = json.loads(request.content)
        return httpx.Response(200, json={
            "request_id": body["request_id"],
            "records": records if body["team_name"] == "团队A" else [],
        })

    result = run(db, httpx.MockTransport(handle))
    batch = db.scalar(
        select(ImportBatch)
        .options(selectinload(ImportBatch.rows))
        .where(ImportBatch.team_id == result.team_results[0]["team_id"])
    )
    assert batch is not None
    assert all(row.status == "invalid" for row in batch.rows)
    assert any("版本名称缺失" in error for row in batch.rows for error in row.errors)
    assert any("不属于当前团队" in error for row in batch.rows for error in row.errors)
    assert any("迭代名称缺失" in error for row in batch.rows for error in row.errors)
    db.close()
    engine.dispose()


def test_empty_product_mapping_skips_gateway_and_empty_result_creates_no_batch(monkeypatch):
    configure_gateway(monkeypatch)
    db, engine = collection_session()
    add_team_with_ir_hierarchy(db, "团队空映射", "版本空", mapped=False)
    add_team_with_ir_hierarchy(db, "团队无结果", "版本无结果")
    requests = []
    transport = httpx.MockTransport(lambda request: requests.append(request) or httpx.Response(
        200,
        json={"request_id": json.loads(request.content)["request_id"], "records": []},
    ))

    result = run(db, transport)
    assert len(requests) == 1
    assert [item["status"] for item in result.team_results] == ["skipped", "succeeded"]
    assert all(item.get("batch_id") is None for item in result.team_results)
    assert db.scalars(select(ImportBatch)).all() == []
    db.close()
    engine.dispose()


def test_startup_schedule_loader_installs_only_enabled_domain_jobs():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(CollectionSchedule(
            domain="ir",
            enabled=True,
            cadence="weekly",
            minute=20,
            hour=5,
            day_of_week=0,
            timezone="Asia/Shanghai",
            updated_by="admin",
        ))
        db.add(CollectionSchedule(
            domain="ar",
            enabled=False,
            cadence="daily",
            minute=0,
            hour=2,
            timezone="Asia/Shanghai",
            updated_by="system",
        ))
        db.commit()

    scheduler = create_scheduler(CollectorRegistry(), factory)
    load_source_collection_schedules(scheduler, factory)
    scheduler.start(paused=True)
    try:
        job = scheduler.get_job("source-collection-ir")
        assert job is not None
        assert job.trigger.get_next_fire_time(None, datetime(2026, 9, 14, 5, 19, tzinfo=SHANGHAI)) == datetime(
            2026, 9, 14, 5, 20, tzinfo=SHANGHAI
        )
        assert scheduler.get_job("source-collection-ar") is None
    finally:
        scheduler.shutdown(wait=False)
        engine.dispose()
