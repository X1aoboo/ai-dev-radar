"""数据管理工作台的公开 HTTP seam 行为测试。"""

from datetime import date
import io
import zipfile
from uuid import uuid4

import pytest
from sqlalchemy import delete

from app.db import SessionLocal
from app.models import AuditLog, DataMetricDefinition, IRRequirement, ImportBatch, ImportRow, Iteration, Product, ProductVersion, TeamMember


TEST_PRODUCT_IDS = set()
TEST_VERSION_IDS = set()
TEST_ITERATION_IDS = set()
TEST_MEMBER_IDS = set()
TEST_METRIC_IDS = set()


@pytest.fixture(autouse=True)
def clean_data_management_test_rows():
    yield
    with SessionLocal() as db:
        product_ids = set(TEST_PRODUCT_IDS)
        version_ids = set(TEST_VERSION_IDS)
        iteration_ids = set(TEST_ITERATION_IDS)
        db.execute(delete(AuditLog).where(AuditLog.domain == "ir"))
        db.execute(delete(ImportRow))
        db.execute(delete(ImportBatch))
        db.execute(delete(IRRequirement).where(~IRRequirement.requirement_no.like("IR-DEMO-%")))
        if iteration_ids:
            db.execute(delete(Iteration).where(Iteration.id.in_(iteration_ids)))
        elif version_ids:
            db.execute(delete(Iteration).where(Iteration.version_id.in_(version_ids)))
        if version_ids:
            db.execute(delete(ProductVersion).where(ProductVersion.id.in_(version_ids)))
        if product_ids:
            db.execute(delete(Product).where(Product.id.in_(product_ids)))
        if TEST_MEMBER_IDS:
            db.execute(delete(TeamMember).where(TeamMember.id.in_(TEST_MEMBER_IDS)))
        if TEST_METRIC_IDS:
            db.execute(delete(DataMetricDefinition).where(DataMetricDefinition.id.in_(TEST_METRIC_IDS)))
        db.commit()
        TEST_PRODUCT_IDS.clear()
        TEST_VERSION_IDS.clear()
        TEST_ITERATION_IDS.clear()
        TEST_MEMBER_IDS.clear()
        TEST_METRIC_IDS.clear()


def login(client, username="admin"):
    from app.config import SEED_PASSWORD

    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": SEED_PASSWORD},
    )
    assert response.status_code == 200


def create_ir_context(client, team_id=1):
    suffix = uuid4().hex[:8]
    product = client.post(
        "/api/products",
        json={"team_id": team_id, "name": f"数据管理产品-{team_id}-{suffix}"},
    )
    assert product.status_code == 201, product.text
    TEST_PRODUCT_IDS.add(product.json()["id"])
    version = client.post(
        "/api/versions",
        json={"product_id": product.json()["id"], "name": f"数据管理版本-{team_id}-{suffix}"},
    )
    assert version.status_code == 201, version.text
    TEST_VERSION_IDS.add(version.json()["id"])
    iteration = client.post(
        "/api/iterations",
        json={
            "version_id": version.json()["id"],
            "name": f"数据管理迭代-{team_id}-{suffix}",
            "start_date": "2026-08-01",
            "end_date": "2026-08-31",
        },
    )
    assert iteration.status_code == 201, iteration.text
    TEST_ITERATION_IDS.add(iteration.json()["id"])
    member = client.post(
        "/api/team-members",
        json={
            "team_id": team_id,
            "employee_id": f"E{team_id:03d}-{suffix}",
            "name": f"成员{team_id}",
            "role": "研发工程师",
        },
    )
    assert member.status_code == 201, member.text
    TEST_MEMBER_IDS.add(member.json()["id"])
    return product.json(), version.json(), iteration.json()


def ir_payload(product, version, iteration, requirement_no="IR-001", **overrides):
    if requirement_no == "IR-001":
        requirement_no = f"IR-{uuid4().hex[:8]}"
    payload = {
        "requirement_no": requirement_no,
        "requirement_name": "CNAE 需求一",
        "responsible_employee_id": "E001",
        "parent_requirement_no": None,
        "product_id": product["id"],
        "version_id": version["id"],
        "iteration_id": iteration["id"],
        "completed_at": "2026-08-15",
        "business_module": "CNAE",
        "requirement_scenario": "智能配置",
        "estimated_workload": 10,
        "actual_workload": 5,
        "sa_estimated_workload": 4,
        "sa_actual_workload": 2,
        "se_estimated_workload": 6,
        "se_actual_workload": 3,
        "ai_assisted": True,
    }
    payload.update(overrides)
    return payload


def test_admin_can_manage_team_product_version_iteration_and_members(client):
    login(client)
    product, version, iteration = create_ir_context(client)

    products = client.get("/api/products", params={"team_id": 1})
    assert products.status_code == 200
    current_product = next(item for item in products.json() if item["id"] == product["id"])
    assert current_product["team_id"] == 1
    assert current_product["versions"][0]["id"] == version["id"]

    versions = client.get("/api/versions").json()
    current_version = next(item for item in versions if item["id"] == version["id"])
    assert current_version["product_id"] == product["id"]
    assert current_version["team_id"] == 1
    assert current_version["iterations"][0]["id"] == iteration["id"]

    members = client.get("/api/team-members", params={"team_id": 1})
    assert members.status_code == 200
    assert any(member["employee_id"].startswith("E001-") for member in members.json())


def test_maintainer_can_read_and_edit_only_its_team_ir_records(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    created = client.post("/api/data/ir", json=ir_payload(product, version, iteration))
    assert created.status_code == 201, created.text
    record_id = created.json()["id"]
    other_product, other_version, other_iteration = create_ir_context(client, team_id=2)
    other_created = client.post(
        "/api/data/ir",
        json=ir_payload(other_product, other_version, other_iteration),
    )
    assert other_created.status_code == 201, other_created.text
    other_record_id = other_created.json()["id"]

    client.post("/api/auth/logout")
    login(client, "maintainer.团队A")
    edited = client.patch(
        f"/api/data/ir/{record_id}",
        json={"requirement_name": "CNAE 需求一（人工修正）"},
    )
    assert edited.status_code == 200
    assert edited.json()["requirement_name"] == "CNAE 需求一（人工修正）"

    forbidden = client.patch(
        f"/api/data/ir/{other_record_id}",
        json={"business_module": "不可越权"},
    )
    assert forbidden.status_code == 403


def test_ir_import_preview_confirm_merges_only_empty_fields_and_records_audit(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    existing = client.post(
        "/api/data/ir",
        json=ir_payload(
            product,
            version,
            iteration,
            requirement_no="IR-EXISTING",
            requirement_name="正式名称",
            parent_requirement_no=None,
            requirement_scenario="正式场景",
            ai_assisted=False,
        ),
    )
    assert existing.status_code == 201, existing.text

    preview = client.post(
        "/api/data/ir/imports/preview",
        json={
            "filename": "ir-2026-08.csv",
            "rows": [
                ir_payload(
                    product,
                    version,
                    iteration,
                    requirement_no="IR-EXISTING",
                    requirement_name="导入名称不应覆盖",
                    parent_requirement_no="IR-PARENT",
                    requirement_scenario="导入场景不应覆盖",
                    ai_assisted=True,
                ),
                ir_payload(
                    product,
                    version,
                    iteration,
                    requirement_no="IR-NEW",
                    responsible_employee_id="UNKNOWN-001",
                ),
            ],
        },
    )
    assert preview.status_code == 201, preview.text
    preview_body = preview.json()
    assert preview_body["status"] == "pending"
    assert preview_body["valid_rows"] == 2
    assert preview_body["invalid_rows"] == 0
    assert preview_body["rows"][0]["operation"] == "fill"
    assert preview_body["rows"][0]["diff"]["requirement_name"]["action"] == "keep"
    assert preview_body["rows"][1]["warnings"]

    confirmed = client.post(f"/api/data/ir/imports/{preview_body['id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["created"] == 1
    assert confirmed.json()["updated"] == 1

    records = client.get("/api/data/ir", params={"business_module": "CNAE"}).json()
    existing_after = next(item for item in records["items"] if item["requirement_no"] == "IR-EXISTING")
    new_after = next(item for item in records["items"] if item["requirement_no"] == "IR-NEW")
    assert existing_after["requirement_name"] == "正式名称"
    assert existing_after["requirement_scenario"] == "正式场景"
    assert existing_after["parent_requirement_no"] == "IR-PARENT"
    assert existing_after["ai_assisted"] is False
    assert new_after["responsible_employee_id"] == "UNKNOWN-001"
    assert new_after["responsible_employee_pending"] is True

    audit = client.get(f"/api/data/ir/{existing_after['id']}/audit-logs")
    assert audit.status_code == 200
    assert audit.json()[0]["action"] == "import_confirm"


def test_ir_import_is_atomic_when_any_row_is_invalid(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    preview = client.post(
        "/api/data/ir/imports/preview",
        json={
            "filename": "invalid.csv",
            "rows": [
                ir_payload(product, version, iteration, requirement_no="IR-VALID"),
                ir_payload(product, version, iteration, requirement_no="", requirement_name="缺少编号"),
            ],
        },
    )
    assert preview.status_code == 201
    body = preview.json()
    assert body["valid_rows"] == 1
    assert body["invalid_rows"] == 1

    confirmed = client.post(f"/api/data/ir/imports/{body['id']}/confirm")
    assert confirmed.status_code == 422
    assert client.get("/api/data/ir", params={"requirement_no": "IR-VALID"}).json()["total"] == 0


def test_ir_query_and_metrics_use_valid_formal_records(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    create_ir_context(client, team_id=2)
    assert client.post(
        "/api/data/ir",
        json=ir_payload(product, version, iteration, business_module="CNAE-TEST"),
    ).status_code == 201

    filtered = client.get(
        "/api/data/ir",
        params={
            "team_id": 1,
            "completed_from": "2026-08-01",
            "completed_to": "2026-08-31",
            "business_module": "CNAE-TEST",
            "ai_assisted": "true",
        },
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1

    metrics = client.get("/api/data-metrics")
    assert metrics.status_code == 200
    assert {item["code"] for item in metrics.json()} >= {
        "ir-ai-penetration", "ir-sa-efficiency", "ir-se-efficiency",
    }

    penetration = client.get(
        "/api/data-metrics/compute",
        params={"metric_code": "ir-ai-penetration", "team_id": 1, "business_module": "CNAE-TEST", "completed_from": "2026-08-01", "completed_to": "2026-08-31"},
    )
    assert penetration.status_code == 200
    assert penetration.json()["numerator"] == 1
    assert penetration.json()["denominator"] == 1
    assert penetration.json()["value"] == 1

    efficiency = client.get(
        "/api/data-metrics/compute",
        params={"metric_code": "ir-sa-efficiency", "team_id": 1, "business_module": "CNAE-TEST", "completed_from": "2026-08-01", "completed_to": "2026-08-31"},
    )
    assert efficiency.status_code == 200
    assert efficiency.json()["value"] == 1


def test_ir_file_preview_accepts_csv_and_xlsx_payloads(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    csv_content = "需求编号,需求名称,产品ID,版本ID,迭代ID,完成时间,业务模块,需求场景\n"
    csv_content += f"IR-CSV,CSV导入,{product['id']},{version['id']},{iteration['id']},2026-08-20,CNAE,文件导入\n"
    csv_preview = client.post(
        "/api/data/ir/imports/preview",
        content=csv_content.encode("utf-8"),
        headers={"content-type": "text/csv", "x-filename": "ir.csv"},
    )
    assert csv_preview.status_code == 201, csv_preview.text
    assert csv_preview.json()["rows"][0]["source_id"] == "IR-CSV"

    headers = ["需求编号", "需求名称", "产品ID", "版本ID", "迭代ID", "完成时间", "业务模块", "需求场景"]
    values = ["IR-XLSX", "XLSX导入", str(product["id"]), str(version["id"]), str(iteration["id"]), "2026-08-21", "CNAE", "文件导入"]
    worksheet = "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>"
    worksheet += "<row r=\"1\">" + "".join(
        f"<c r=\"{chr(65 + index)}1\" t=\"inlineStr\"><is><t>{value}</t></is></c>"
        for index, value in enumerate(headers)
    ) + "</row>"
    worksheet += "<row r=\"2\">" + "".join(
        f"<c r=\"{chr(65 + index)}2\" t=\"inlineStr\"><is><t>{value}</t></is></c>"
        for index, value in enumerate(values)
    ) + "</row></sheetData></worksheet>"
    xlsx = io.BytesIO()
    with zipfile.ZipFile(xlsx, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", worksheet)
    xlsx_preview = client.post(
        "/api/data/ir/imports/preview",
        content=xlsx.getvalue(),
        headers={"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "x-filename": "ir.xlsx"},
    )
    assert xlsx_preview.status_code == 201, xlsx_preview.text
    assert xlsx_preview.json()["rows"][0]["source_id"] == "IR-XLSX"


def test_admin_can_edit_managed_hierarchy_and_metric_rules(client):
    login(client)
    product, version, iteration = create_ir_context(client)

    edited_product = client.patch(
        f"/api/products/{product['id']}",
        json={"name": "数据管理产品（已编辑）"},
    )
    assert edited_product.status_code == 200
    assert edited_product.json()["name"] == "数据管理产品（已编辑）"

    edited_version = client.patch(
        f"/api/versions/{version['id']}",
        json={"name": "数据管理版本（已编辑）"},
    )
    assert edited_version.status_code == 200
    assert edited_version.json()["name"] == "数据管理版本（已编辑）"

    edited_iteration = client.patch(
        f"/api/iterations/{iteration['id']}",
        json={"end_date": "2026-09-01"},
    )
    assert edited_iteration.status_code == 200
    assert edited_iteration.json()["end_date"] == "2026-09-01"

    metric = client.post(
        "/api/data-metrics",
        json={
            "domain": "ir",
            "code": "ir-module-count",
            "name": "IR模块数量",
            "metric_type": "count",
            "numerator_field": "actual_workload",
        },
    )
    assert metric.status_code == 201, metric.text
    TEST_METRIC_IDS.add(metric.json()["id"])
    edited_metric = client.patch(
        f"/api/data-metrics/{metric.json()['id']}",
        json={"name": "IR实际工作量"},
    )
    assert edited_metric.status_code == 200
    assert edited_metric.json()["name"] == "IR实际工作量"


def test_non_admin_cannot_change_hierarchy_or_metric_rules(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    client.post("/api/auth/logout")
    login(client, "maintainer.团队A")

    assert client.patch(f"/api/products/{product['id']}", json={"name": "不应修改"}).status_code == 403
    assert client.patch(f"/api/versions/{version['id']}", json={"name": "不应修改"}).status_code == 403
    assert client.patch(f"/api/iterations/{iteration['id']}", json={"name": "不应修改"}).status_code == 403
    assert client.post(
        "/api/data-metrics",
        json={"domain": "ir", "code": "not-allowed", "name": "禁止", "metric_type": "count", "numerator_field": "actual_workload"},
    ).status_code == 403


def test_legacy_product_versions_schema_gets_a_nullable_product_link():
    from sqlalchemy import create_engine, inspect, text

    from app.migrations import ensure_data_management_schema

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE product_versions (id INTEGER PRIMARY KEY, name VARCHAR(50))"))

    ensure_data_management_schema(engine)

    assert "product_id" in {column["name"] for column in inspect(engine).get_columns("product_versions")}
