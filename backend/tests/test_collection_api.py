"""Collection schedule API, time boundaries, permission, and batch confirmation."""

from datetime import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import delete, inspect, select, text

from app.db import SessionLocal
from app.migrations import ensure_data_management_schema
from app.models import AuditLog, IRRequirement, ImportBatch, ImportRow, Iteration, Product, ProductVersion
from app.source_collection import previous_complete_window


SHANGHAI = ZoneInfo("Asia/Shanghai")


def login(client, username):
    from app.config import SEED_PASSWORD

    return client.post("/api/auth/login", json={"username": username, "password": SEED_PASSWORD})


def make_ir_context(client):
    suffix = uuid4().hex[:8]
    product_response = client.post("/api/products", json={"team_id": 1, "name": f"Collection product {suffix}"})
    assert product_response.status_code == 201, product_response.text
    product = product_response.json()
    version_response = client.post("/api/versions", json={"product_id": product["id"], "name": f"Collection version {suffix}"})
    assert version_response.status_code == 201, version_response.text
    version = version_response.json()
    iteration_response = client.post("/api/iterations", json={
        "version_id": version["id"],
        "name": f"Collection iteration {suffix}",
        "start_date": "2026-09-01",
        "end_date": "2026-09-30",
    })
    assert iteration_response.status_code == 201, iteration_response.text
    iteration = iteration_response.json()
    return product, version, iteration


def ir_payload(product, version, iteration, requirement_no, **overrides):
    return {
        "requirement_no": requirement_no,
        "requirement_name": "正式需求名称",
        "responsible_employee_id": None,
        "parent_requirement_no": None,
        "product_id": product["id"],
        "version_id": version["id"],
        "iteration_id": iteration["id"],
        "completed_at": "2026-09-17",
        "business_module": "CNAE",
        "requirement_scenario": "采集测试",
        "estimated_workload": 10,
        "actual_workload": 5,
        "sa_estimated_workload": None,
        "sa_actual_workload": None,
        "se_estimated_workload": None,
        "se_actual_workload": None,
        "ai_assisted": None,
        **overrides,
    }


def test_previous_complete_windows_follow_shanghai_calendar_boundaries():
    assert previous_complete_window(
        "hourly", datetime(2026, 9, 18, 0, 3, tzinfo=SHANGHAI)
    ) == (
        datetime(2026, 9, 17, 23, 0, tzinfo=SHANGHAI),
        datetime(2026, 9, 18, 0, 0, tzinfo=SHANGHAI),
    )
    assert previous_complete_window(
        "daily", datetime(2026, 9, 18, 15, tzinfo=SHANGHAI)
    ) == (
        datetime(2026, 9, 17, 0, 0, tzinfo=SHANGHAI),
        datetime(2026, 9, 18, 0, 0, tzinfo=SHANGHAI),
    )
    assert previous_complete_window(
        "weekly", datetime(2026, 9, 16, 15, tzinfo=SHANGHAI)
    ) == (
        datetime(2026, 9, 7, 0, 0, tzinfo=SHANGHAI),
        datetime(2026, 9, 14, 0, 0, tzinfo=SHANGHAI),
    )
    assert previous_complete_window(
        "monthly", datetime(2026, 1, 31, 23, tzinfo=SHANGHAI)
    ) == (
        datetime(2025, 12, 1, 0, 0, tzinfo=SHANGHAI),
        datetime(2026, 1, 1, 0, 0, tzinfo=SHANGHAI),
    )


def test_collection_schedule_is_admin_only_and_reschedules_running_job(client):
    assert client.get("/api/collection-schedules").status_code == 401
    assert login(client, "viewer").status_code == 200
    assert client.get("/api/collection-schedules").status_code == 403
    assert client.put("/api/collection-schedules/ir", json={"enabled": True}).status_code == 403
    client.post("/api/auth/logout")
    assert login(client, "admin").status_code == 200

    listing = client.get("/api/collection-schedules")
    assert listing.status_code == 200
    schedule = next(item for item in listing.json()["schedules"] if item["domain"] == "ir")
    assert schedule["enabled"] is False
    assert schedule["timezone"] == "Asia/Shanghai"
    assert "COLLECTOR_GATEWAY" not in listing.text

    hourly = client.put("/api/collection-schedules/ir", json={
        "enabled": True,
        "cadence": "hourly",
        "minute": 15,
        "hour": None,
        "day_of_week": None,
        "day_of_month": None,
    })
    assert hourly.status_code == 200, hourly.text
    assert hourly.json()["updated_by"] == "admin"
    scheduler = client.app.state.scheduler
    job = scheduler.get_job("source-collection-ir")
    assert job is not None
    assert job.trigger.get_next_fire_time(None, datetime(2026, 9, 18, 1, 14, tzinfo=SHANGHAI)) == datetime(
        2026, 9, 18, 1, 15, tzinfo=SHANGHAI
    )

    daily = client.put("/api/collection-schedules/ir", json={
        "enabled": True,
        "cadence": "daily",
        "minute": 30,
        "hour": 6,
        "day_of_week": None,
        "day_of_month": None,
    })
    assert daily.status_code == 200
    job = scheduler.get_job("source-collection-ir")
    assert job is not None
    assert job.trigger.get_next_fire_time(None, datetime(2026, 9, 18, 5, 0, tzinfo=SHANGHAI)) == datetime(
        2026, 9, 18, 6, 30, tzinfo=SHANGHAI
    )

    disabled = client.put("/api/collection-schedules/ir", json={
        "enabled": False,
        "cadence": "monthly",
        "minute": 30,
        "hour": 6,
        "day_of_week": None,
        "day_of_month": 28,
    })
    assert disabled.status_code == 200
    assert scheduler.get_job("source-collection-ir") is None
    assert client.put("/api/collection-schedules/ar", json={
        "enabled": False,
        "cadence": "hourly",
        "minute": 0,
        "hour": None,
        "day_of_week": None,
        "day_of_month": None,
    }).status_code == 404
    assert client.put("/api/collection-schedules/ir", json={
        "enabled": True,
        "cadence": "monthly",
        "minute": 30,
        "hour": 6,
        "day_of_week": None,
        "day_of_month": 29,
    }).status_code == 422


@pytest.mark.parametrize("window", [
    {"start_at": "2026-09-18T00:00:00+08:00"},
    {"end_at": "2026-09-18T01:00:00+08:00"},
    {"start_at": "2026-09-18T00:00:00", "end_at": "2026-09-18T01:00:00+08:00"},
    {"start_at": "2026-09-18T01:00:00+08:00", "end_at": "2026-09-18T01:00:00+08:00"},
    {"start_at": "2026-09-18T02:00:00+08:00", "end_at": "2026-09-18T01:00:00+08:00"},
])
def test_manual_run_rejects_invalid_or_partial_windows(client, window):
    assert login(client, "admin").status_code == 200
    response = client.post("/api/collection-schedules/ir/run", json=window)
    assert response.status_code == 422


def test_collector_batch_access_confirmation_merge_and_audit(client):
    assert login(client, "admin").status_code == 200
    product, version, iteration = make_ir_context(client)
    requirement_no = f"IR-COLLECTOR-{uuid4().hex[:10]}"
    existing_response = client.post("/api/data/ir", json=ir_payload(
        product,
        version,
        iteration,
        requirement_no,
        requirement_name="正式需求名称",
        actual_workload=5,
        ai_assisted=None,
    ))
    assert existing_response.status_code == 201, existing_response.text
    record_id = existing_response.json()["id"]
    payload = ir_payload(
        product,
        version,
        iteration,
        requirement_no,
        requirement_name="Gateway 名称不得覆盖",
        actual_workload=99,
        sa_estimated_workload=3,
        ai_assisted=False,
    )

    public_preview = client.post("/api/data/ir/imports/preview", json={
        "filename": "collector.json",
        "rows": [payload],
        "source_kind": "collector",
    })
    assert public_preview.status_code == 422

    from app.ir_imports import IRImportRowInput, create_ir_import_batch
    with SessionLocal() as db:
        batch = create_ir_import_batch(
            db,
            [IRImportRowInput(raw=payload, source_id=requirement_no, source_system="internal-ir")],
            source_kind="collector",
            team_id=1,
            created_by="scheduled-collector",
            first_row_number=1,
        )
        db.commit()
        batch_id = batch.id

    with SessionLocal() as db:
        other_team_batch = create_ir_import_batch(
            db,
            [IRImportRowInput(raw={}, errors=["collector contract row is invalid"], source_id="IR-OTHER-TEAM")],
            source_kind="collector",
            team_id=2,
            created_by="scheduled-collector",
            first_row_number=1,
        )
        db.commit()
        other_team_batch_id = other_team_batch.id

    all_pending = client.get("/api/data/ir/imports", params={"source_kind": "collector", "status": "pending"})
    assert {item["id"] for item in all_pending.json()} == {batch_id, other_team_batch_id}

    listed = client.get("/api/data/ir/imports", params={
        "source_kind": "collector",
        "status": "pending",
        "team_id": 1,
    })
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [batch_id]

    assert client.post("/api/auth/logout").status_code == 200
    assert login(client, "maintainer.团队B").status_code == 200
    assert client.get(f"/api/data/ir/imports/{batch_id}").status_code == 403
    assert client.get("/api/data/ir/imports", params={"team_id": 1}).status_code == 403
    assert client.post(f"/api/data/ir/imports/{batch_id}/confirm").status_code == 403
    assert client.get(f"/api/data/ir/imports/{other_team_batch_id}").status_code == 200

    client.post("/api/auth/logout")
    assert login(client, "maintainer.团队A").status_code == 200
    visible = client.get(f"/api/data/ir/imports/{batch_id}")
    assert visible.status_code == 200
    assert visible.json()["team_id"] == 1
    assert visible.json()["rows"][0]["source_system"] == "internal-ir"
    confirmed = client.post(f"/api/data/ir/imports/{batch_id}/confirm")
    assert confirmed.status_code == 200, confirmed.text

    record = client.get("/api/data/ir", params={"requirement_no": requirement_no}).json()["items"][0]
    assert record["requirement_name"] == "正式需求名称"
    assert record["actual_workload"] == 5
    assert record["sa_estimated_workload"] == 3
    assert record["ai_assisted"] is False
    assert record["ai_attribute_metadata"]["ai_assisted"]["source"] == "collector"
    audit = client.get(f"/api/data/ir/{record_id}/audit-logs")
    assert audit.status_code == 200
    assert audit.json()[0]["action"] == "collector_confirm"

    client.post("/api/auth/logout")
    assert login(client, "admin").status_code == 200
    admin_detail = client.get(f"/api/data/ir/imports/{batch_id}")
    assert admin_detail.status_code == 200
    assert admin_detail.json()["status"] == "confirmed"

    from app.ir_imports import IRImportRowInput, create_ir_import_batch
    with SessionLocal() as db:
        invalid_batch = create_ir_import_batch(
            db,
            [IRImportRowInput(raw=payload, errors=["collector contract row is invalid"], source_id=requirement_no)],
            source_kind="collector",
            team_id=1,
            created_by="scheduled-collector",
            first_row_number=1,
        )
        db.commit()
        invalid_batch_id = invalid_batch.id
    blocked = client.post(f"/api/data/ir/imports/{invalid_batch_id}/confirm")
    assert blocked.status_code == 422

    with SessionLocal() as db:
        db.execute(delete(AuditLog).where(AuditLog.domain == "ir", AuditLog.record_id == record_id))
        batch_ids = [batch_id, other_team_batch_id, invalid_batch_id]
        db.execute(delete(ImportRow).where(ImportRow.batch_id.in_(batch_ids)))
        db.execute(delete(ImportBatch).where(ImportBatch.id.in_(batch_ids)))
        db.execute(delete(IRRequirement).where(IRRequirement.id == record_id))
        db.execute(delete(Iteration).where(Iteration.id == iteration["id"]))
        db.execute(delete(ProductVersion).where(ProductVersion.id == version["id"]))
        db.execute(delete(Product).where(Product.id == product["id"]))
        db.commit()


def test_existing_import_tables_get_nullable_collection_columns():
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE teams (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE product_versions (id INTEGER PRIMARY KEY, name VARCHAR(50))"))
        connection.execute(text("CREATE TABLE import_batches (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE import_rows (id INTEGER PRIMARY KEY)"))

    ensure_data_management_schema(engine)
    assert "product_id" in {column["name"] for column in inspect(engine).get_columns("product_versions")}
    assert "team_id" in {column["name"] for column in inspect(engine).get_columns("import_batches")}
    assert "source_system" in {column["name"] for column in inspect(engine).get_columns("import_rows")}
    engine.dispose()
