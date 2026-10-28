"""数据管理工作台的公开 HTTP seam 行为测试。"""

from datetime import date
import io
from types import SimpleNamespace
import zipfile
from uuid import uuid4

import pytest
from sqlalchemy import delete

from app.db import SessionLocal
from app.data_management import _xlsx_rows, build_ir_overview_series, normalize_ir_row
from app.models import AuditLog, IRRequirement, ImportBatch, ImportRow, Iteration, Product, ProductVersion, TeamMember
from app.requirement_fields import DESIGN_PROFILE, DEVELOPMENT_PROFILE


TEST_PRODUCT_IDS = set()
TEST_VERSION_IDS = set()
TEST_ITERATION_IDS = set()
TEST_MEMBER_IDS = set()


@pytest.fixture(autouse=True)
def clean_data_management_test_rows():
    yield
    with SessionLocal() as db:
        product_ids = set(TEST_PRODUCT_IDS)
        version_ids = set(TEST_VERSION_IDS)
        iteration_ids = set(TEST_ITERATION_IDS)
        db.execute(delete(AuditLog).where(AuditLog.domain.in_(("ir", "development"))))
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
        db.commit()
        TEST_PRODUCT_IDS.clear()
        TEST_VERSION_IDS.clear()
        TEST_ITERATION_IDS.clear()
        TEST_MEMBER_IDS.clear()


def login(client, username="admin"):
    from app.config import SEED_PASSWORD

    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": SEED_PASSWORD},
    )
    assert response.status_code == 200


def test_ir_overview_series_keeps_unknown_ai_and_incomplete_workload_missing():
    teams = [SimpleNamespace(id=1, name="团队A"), SimpleNamespace(id=2, name="团队B"), SimpleNamespace(id=3, name="团队C")]

    def record(team, completed_at, ai_assisted, estimated=None, actual=None):
        return SimpleNamespace(
            product=SimpleNamespace(team_id=team.id, team=team),
            completed_at=completed_at,
            ai_assisted=ai_assisted,
            estimated_workload=estimated,
            actual_workload=actual,
        )

    data = build_ir_overview_series(
        records=[
            record(teams[0], date(2026, 8, 4), True, 10, 5),
            record(teams[0], date(2026, 8, 8), False, 4, 2),
            record(teams[0], date(2026, 8, 10), None, 100, 0),
            record(teams[1], date(2026, 8, 12), False, 4, 4),
            record(teams[1], date(2026, 8, 15), True, 8, None),
            record(teams[0], date(2026, 9, 2), True, 0, 0),
        ],
        teams=teams,
        period_ids=["2026-08", "2026-09"],
    )

    assert data["domain_summary"][0] == {
        "period_id": "2026-08",
        "fact_count": 5,
        "known_ai_count": 4,
        "ai_assisted_count": 2,
        "ai_workload_count": 1,
        "ai_estimated_workload": 10,
        "ai_actual_workload": 5,
    }
    team_b_august = data["series"][1]["values"][0]
    assert team_b_august["ai_assisted_count"] == 1
    assert team_b_august["ai_workload_count"] == 0
    assert team_b_august["ai_estimated_workload"] is None
    team_c_august = data["series"][2]["values"][0]
    assert team_c_august["fact_count"] == 0
    assert team_c_august["ai_assisted_count"] is None
    september = data["domain_summary"][1]
    assert september["ai_assisted_count"] == 1
    assert september["ai_workload_count"] == 1
    assert september["ai_estimated_workload"] == 0
    assert september["ai_actual_workload"] == 0


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
            "role": "开发",
        },
    )
    assert member.status_code == 201, member.text
    TEST_MEMBER_IDS.add(member.json()["id"])
    return product.json(), version.json(), iteration.json()


def ir_payload(product, version, iteration, requirement_no="IR-001", **overrides):
    if requirement_no == "IR-001":
        requirement_no = f"IR-{uuid4().hex[:8]}"
    payload = {
        "requirement_type": "IR",
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
        "progress": "进行中",
        "sa_owner_name": "设计成员A",
        "se_owner_name": "设计成员B",
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
            requirement_scenario="正式场景",
            ai_assisted=False,
        ),
    )
    assert existing.status_code == 201, existing.text

    preview = client.post(
        "/api/data/ir/imports/preview",
        json={
            "filename": "design-template.xlsx",
            "rows": [
                _template_row(
                    client,
                    version,
                    iteration,
                    需求编号="IR-EXISTING",
                    需求标题="导入名称不应覆盖",
                ),
                _template_row(
                    client,
                    version,
                    iteration,
                    需求编号="IR-NEW",
                    SA="未知设计者 UNKNOWN-001",
                ),
            ],
        },
    )
    assert preview.status_code == 201, preview.text
    preview_body = preview.json()
    assert preview_body["domain"] == "ir"
    assert preview_body["status"] == "pending"
    assert preview_body["valid_rows"] == 2
    assert preview_body["invalid_rows"] == 0
    assert preview_body["rows"][0]["operation"] == "fill"
    assert preview_body["rows"][0]["diff"]["requirement_name"]["action"] == "keep"
    assert preview_body["rows"][0]["diff"]["sa_owner_name"]["action"] == "keep"
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
    # AI usage is derived from the filled SA/SE flags, not the stale aggregate.
    assert existing_after["sa_ai_assisted"] is True
    assert existing_after["ai_assisted"] is True
    assert new_after["sa_employee_id"] == "UNKNOWN-001"
    assert new_after["sa_employee_pending"] is True

    audit = client.get(f"/api/data/ir/{existing_after['id']}/audit-logs")
    assert audit.status_code == 200
    assert audit.json()[0]["action"] == "import_confirm"



def test_ir_import_is_atomic_when_any_row_is_invalid(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    preview = client.post(
        "/api/data/ir/imports/preview",
        json={
            "filename": "invalid-design-template.xlsx",
            "rows": [
                _template_row(client, version, iteration, 需求编号="IR-VALID"),
                _template_row(
                    client,
                    version,
                    iteration,
                    需求编号="",
                    需求标题="缺少编号",
                ),
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
    product_b, version_b, iteration_b = create_ir_context(client, team_id=2)
    assert client.post(
        "/api/data/ir",
        json=ir_payload(product, version, iteration, business_module="CNAE-TEST"),
    ).status_code == 201
    assert client.post(
        "/api/data/ir",
        json=ir_payload(product_b, version_b, iteration_b, business_module="CNAE-TEST", ai_assisted=False),
    ).status_code == 201
    # SR is a valid design type but must stay out of the provisional IR KPIs.
    assert client.post(
        "/api/data/ir",
        json=ir_payload(
            product,
            version,
            iteration,
            requirement_type="SR",
            business_module="CNAE-TEST",
        ),
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
    # Both the IR and the SR design records match the query filters.
    assert filtered.json()["total"] == 2

    overview = client.get("/api/data-metrics/overview", params={"from_month": "2026-08", "to_month": "2026-09"})
    assert overview.status_code == 200, overview.text
    assert overview.json()["period_ids"] == ["2026-08", "2026-09"]
    assert overview.json()["domain_summary"][0]["fact_count"] >= 2
    assert "requirement_no" not in overview.text

    version_scope = client.get(
        "/api/data-metrics/overview",
        params={"from_month": "2026-08", "to_month": "2026-08", "version_id": str(version["id"])},
    )
    assert version_scope.status_code == 200
    august = version_scope.json()["domain_summary"][0]
    assert august["fact_count"] == 1
    assert august["known_ai_count"] == 1
    assert august["ai_assisted_count"] == 1
    assert august["ai_workload_count"] == 1
    assert august["ai_estimated_workload"] == 10
    assert august["ai_actual_workload"] == 5

    false_ai_scope = client.get(
        "/api/data-metrics/overview",
        params={"from_month": "2026-08", "to_month": "2026-08", "version_id": str(version_b["id"])},
    )
    assert false_ai_scope.status_code == 200
    assert false_ai_scope.json()["domain_summary"][0]["ai_assisted_count"] == 0
    assert false_ai_scope.json()["domain_summary"][0]["ai_workload_count"] == 0
    assert false_ai_scope.json()["domain_summary"][0]["ai_estimated_workload"] is None

    login(client, "maintainer.团队A")
    team_scope = client.get("/api/data-metrics/overview", params={"from_month": "2026-08", "to_month": "2026-08"})
    assert team_scope.status_code == 200
    assert {series["team_id"] for series in team_scope.json()["series"]} == {1}
    assert team_scope.json()["domain_summary"][0]["fact_count"] >= 1

    invalid_window = client.get("/api/data-metrics/overview", params={"from_month": "2026-09", "to_month": "2026-08"})
    assert invalid_window.status_code == 422



def test_ir_file_preview_accepts_csv_and_xlsx_payloads(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    team = next(item for item in client.get("/api/teams").json() if item["id"] == 1)
    member = [item for item in client.get("/api/team-members").json() if item["team_id"] == 1][-1]
    owner = f"{member['name']} {member['employee_id']}"
    headers = ["需求类型", "需求编号", "需求标题", "进展", "归属组", "PI", "迭代", "SA", "SE", "设计时间"]
    csv_content = ",".join(headers) + "\n"
    csv_content += ",".join([
        "IR", "IR-CSV", "CSV导入", "进行中", team["name"], version["name"],
        iteration["name"], owner, owner, "2026/8/20",
    ]) + "\n"
    csv_preview = client.post(
        "/api/data/ir/imports/preview",
        content=csv_content.encode("utf-8"),
        headers={"content-type": "text/csv", "x-filename": "design.csv"},
    )
    assert csv_preview.status_code == 201, csv_preview.text
    assert csv_preview.json()["valid_rows"] == 1
    assert csv_preview.json()["rows"][0]["source_id"] == "IR-CSV"

    values = [
        "IR", "IR-XLSX", "XLSX导入", "进行中", team["name"], version["name"],
        iteration["name"], owner, owner, "2026/8/21",
    ]
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
        headers={"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "x-filename": "design.xlsx"},
    )
    assert xlsx_preview.status_code == 201, xlsx_preview.text
    assert xlsx_preview.json()["valid_rows"] == 1
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


def test_non_admin_cannot_change_hierarchy_or_metric_rules(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    client.post("/api/auth/logout")
    login(client, "maintainer.团队A")

    assert client.patch(f"/api/products/{product['id']}", json={"name": "不应修改"}).status_code == 403
    assert client.patch(f"/api/versions/{version['id']}", json={"name": "不应修改"}).status_code == 403
    assert client.patch(f"/api/iterations/{iteration['id']}", json={"name": "不应修改"}).status_code == 403


def test_legacy_product_versions_schema_gets_a_nullable_product_link():
    from sqlalchemy import create_engine, inspect, text

    from app.migrations import ensure_data_management_schema

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE product_versions (id INTEGER PRIMARY KEY, name VARCHAR(50))"))

    ensure_data_management_schema(engine)

    assert "product_id" in {column["name"] for column in inspect(engine).get_columns("product_versions")}


def _template_row(client, version, iteration, **overrides):
    team = next(item for item in client.get("/api/teams").json() if item["id"] == 1)
    members = [item for item in client.get("/api/team-members").json() if item["team_id"] == 1]
    member = members[-1]
    row = {
        "需求类型": "IR",
        "需求编号": f"IR-TEMPLATE-{uuid4().hex[:8]}",
        "需求标题": "模板导入需求",
        "所属功能": "CNAE",
        "进展": "进行中",
        "归属组": team["name"],
        "PI": version["name"],
        "迭代": iteration["name"],
        "SA": f"{member['name']} {member['employee_id']}",
        "SE": f"{member['name']} {member['employee_id']}",
        "预估工作量(SA)": 4,
        "实际工作量(SA)": 2,
        "预估工作量(SE)": 6,
        "实际工作量(SE)": 3,
        "AI质检等级": "优秀",
        "AI适用性": "是",
        "SA是否使用AI": "是",
        "SE是否使用AI": "否",
        "AI研发模式": "设计开发一体化",
        "设计时间": "2026/8/10",
        "备注": "模板导入",
    }
    row.update(overrides)
    return row


def test_ir_schema_and_import_template_match_field_registry(client):
    login(client)
    schema = client.get("/api/data/ir/schema")
    assert schema.status_code == 200
    body = schema.json()
    assert body["profile"] == "design"
    assert body["domain"] == "ir"
    assert body["template_headers"] == [
        "需求类型", "需求编号", "需求标题", "所属功能", "进展", "归属组", "PI",
        "迭代", "SA", "SE", "AI质检等级", "AI适用性", "SA是否使用AI",
        "SE是否使用AI", "AI研发模式", "预估工作量(SA)", "实际工作量(SA)",
        "预估工作量(SE)", "实际工作量(SE)", "设计时间", "备注",
    ]
    assert body["template_headers"] == list(DESIGN_PROFILE.template_headers)
    required = set(body["import_required"])
    assert {"requirement_type", "requirement_no", "requirement_name", "progress", "sa_owner", "se_owner", "completed_at"}.issubset(required)
    assert "business_module" not in required
    ai_quality = next(field for field in body["fields"] if field["key"] == "ai_quality_level")
    assert ai_quality["options"] == ["优秀", "良好", "合格", "不合格"]
    assert body["requirement_types"] == ["IR", "SR"]

    template = client.get("/api/data/ir/import-template")
    assert template.status_code == 200
    assert template.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert zipfile.is_zipfile(io.BytesIO(template.content))
    rows = _xlsx_rows(template.content)
    assert rows[0] == list(DESIGN_PROFILE.template_headers)
    assert "design-requirements-template.xlsx" in template.headers["content-disposition"]



def test_template_import_upsert_and_fill_empty_modes(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    row = _template_row(client, version, iteration)

    preview = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "ir-template.xlsx", "rows": [row]},
    )
    assert preview.status_code == 201, preview.text
    body = preview.json()
    assert body["update_mode"] == "upsert"
    assert body["valid_rows"] == 1
    assert body["invalid_rows"] == 0
    assert body["rows"][0]["operation"] == "insert"

    confirmed = client.post(f"/api/data/ir/imports/{body['id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["created"] == 1

    listed = client.get("/api/data/ir", params={"requirement_no": row["需求编号"]}).json()["items"][0]
    assert listed["progress"] == "进行中"
    assert listed["completed_at"] == "2026-08-10"
    assert listed["business_module"] == "CNAE"
    assert listed["sa_owner_name"] and listed["sa_employee_id"]
    assert listed["se_owner_name"] and listed["se_employee_id"]
    assert listed["total_estimated_workload"] == 10
    assert listed["total_actual_workload"] == 5
    assert listed["ai_quality_level"] == "优秀"
    assert listed["ai_applicability"] is True
    assert listed["sa_ai_assisted"] is True
    assert listed["se_ai_assisted"] is False
    assert listed["ai_assisted"] is True
    assert listed["ai_dev_mode"] == "设计开发一体化"
    assert listed["remark"] == "模板导入"
    assert listed["record_source"] == "import"
    assert listed["valid"] is True

    updated_row = {
        **row,
        "需求标题": "模板更新",
        "进展": "完成",
        "SA是否使用AI": "否",
        "SE是否使用AI": "否",
        "备注": "",
    }
    update_preview = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "ir-template.xlsx", "rows": [updated_row]},
    ).json()
    assert update_preview["rows"][0]["operation"] == "update"
    assert update_preview["rows"][0]["diff"]["requirement_name"]["action"] == "overwrite"
    update_confirm = client.post(f"/api/data/ir/imports/{update_preview['id']}/confirm")
    assert update_confirm.status_code == 200
    assert update_confirm.json()["updated"] == 1

    after_update = client.get("/api/data/ir", params={"requirement_no": row["需求编号"]}).json()["items"][0]
    assert after_update["requirement_name"] == "模板更新"
    assert after_update["progress"] == "完成"
    assert after_update["ai_assisted"] is False
    assert after_update["remark"] == "模板导入"
    assert after_update["ai_attribute_metadata"]["sa_ai_assisted"]["source"] == "import"

    fill_preview = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "fill_empty"},
        json={"filename": "ir-template.xlsx", "rows": [{**updated_row, "需求标题": "不应覆盖"}]},
    ).json()
    assert fill_preview["rows"][0]["operation"] == "unchanged"
    fill_confirm = client.post(f"/api/data/ir/imports/{fill_preview['id']}/confirm")
    assert fill_confirm.status_code == 200
    assert fill_confirm.json()["unchanged"] == 1
    after_fill = client.get("/api/data/ir", params={"requirement_no": row["需求编号"]}).json()["items"][0]
    assert after_fill["requirement_name"] == "模板更新"


def test_template_import_requires_sa_and_se_and_allows_optional_business_module(client):
    login(client)
    product, version, iteration = create_ir_context(client)

    for missing_field, label in (("SE", "SE"), ("SA", "SA")):
        row = _template_row(client, version, iteration)
        row.pop(missing_field)
        body = client.post(
            "/api/data/ir/imports/preview",
            params={"mode": "upsert"},
            json={"filename": "design.xlsx", "rows": [row]},
        ).json()
        assert body["valid_rows"] == 0
        assert any(f"缺少{label}" in error for error in body["rows"][0]["errors"])

    optional_business = _template_row(client, version, iteration)
    optional_business.pop("所属功能")
    body = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "design.xlsx", "rows": [optional_business]},
    ).json()
    assert body["valid_rows"] == 1, body["rows"][0]["errors"]

    unknown_team = _template_row(client, version, iteration, 归属组="不存在的团队")
    body = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "design.xlsx", "rows": [unknown_team]},
    ).json()
    assert body["valid_rows"] == 0
    assert any("归属组" in error for error in body["rows"][0]["errors"])

    duplicate = _template_row(client, version, iteration)
    body = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "design.xlsx", "rows": [duplicate, {**duplicate, "需求标题": "重复"}]},
    ).json()
    assert body["valid_rows"] == 0
    assert body["invalid_rows"] == 2
    assert all("需求编号在文件中重复" in error for row in body["rows"] for error in row["errors"])



def test_bulk_ir_update_is_atomic_and_audited(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    first_no = f"IR-BULK-{uuid4().hex[:8]}"
    second_no = f"IR-BULK-{uuid4().hex[:8]}"
    first = client.post(
        "/api/data/ir",
        json=ir_payload(product, version, iteration, requirement_no=first_no),
    ).json()
    second = client.post(
        "/api/data/ir",
        json=ir_payload(product, version, iteration, requirement_no=second_no),
    ).json()

    updated = client.patch(
        "/api/data/ir/bulk",
        json={"items": [
            {"id": first["id"], "changes": {"progress": "完成", "ai_quality_level": "优秀", "remark": "批量"}},
            {"id": second["id"], "changes": {"progress": "进行中"}},
        ]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()[0]["progress"] == "完成"
    assert updated.json()[0]["ai_quality_level"] == "优秀"
    assert updated.json()[1]["progress"] == "进行中"

    audit = client.get(f"/api/data/ir/{first['id']}/audit-logs").json()
    assert any(item["action"] == "bulk_update" for item in audit)

    invalid = client.patch(
        "/api/data/ir/bulk",
        json={"items": [{"id": first["id"], "changes": {"version_id": 999999}}]},
    )
    assert invalid.status_code == 404
    after_invalid = client.get("/api/data/ir", params={"requirement_no": first_no}).json()["items"][0]
    assert after_invalid["progress"] == "完成"


def test_ir_list_summary_and_filters(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    client.post(
        "/api/data/ir",
        json=ir_payload(product, version, iteration, progress="进行中", sa_ai_assisted=True, se_ai_assisted=False),
    )
    client.post(
        "/api/data/ir",
        json=ir_payload(product, version, iteration, progress="完成", sa_ai_assisted=False, se_ai_assisted=False),
    )

    body = client.get("/api/data/ir", params={"team_id": 1, "progress": "进行中"}).json()
    assert body["total"] == 1
    assert body["items"][0]["progress"] == "进行中"
    assert body["summary"]["total"] == 1
    assert body["summary"]["by_progress"] == {"进行中": 1}

    all_body = client.get("/api/data/ir", params={"team_id": 1, "sort_by": "requirement_no", "sort_order": "asc"}).json()
    assert all_body["summary"]["total"] >= 2
    assert {"进行中", "完成"}.issubset(all_body["summary"]["by_progress"])
    assert all_body["summary"]["ai_usage_rate"] is not None


def test_normalize_ir_row_accepts_template_aliases_and_excel_dates():
    normalized, errors = normalize_ir_row(
        {
            "需求类型": "IR",
            "需求编号": "IR-DATE",
            "需求标题": "日期需求",
            "所属功能": "CNAE",
            "进展": "已完成",
            "归属组": "团队A",
            "PI": "版本",
            "迭代": "迭代",
            "SA": "成员A 001",
            "SE": "成员 001",
            "设计时间": 46244,
        },
        strict_template=True,
    )
    assert errors == []
    assert normalized["completed_at"] == date(2026, 8, 10)
    assert normalized["progress"] == "完成"
    assert normalized["sa_owner"] == "成员A 001"
    assert normalized["se_owner"] == "成员 001"

    _, strict_errors = normalize_ir_row(
        {
            "需求编号": "IR-NO-TYPE",
            "需求标题": "缺类型",
            "进展": "进行中",
            "归属组": "团队A",
            "PI": "版本",
            "迭代": "迭代",
            "SA": "成员A 001",
            "SE": "成员 001",
            "设计时间": "2026/8/10",
        },
        strict_template=True,
    )
    assert any("缺少需求类型" in error for error in strict_errors)



def test_ensure_ir_schema_adds_template_columns_and_update_mode():
    from sqlalchemy import create_engine, inspect, text

    from app.migrations import ensure_ir_schema

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE ir_requirements (id INTEGER PRIMARY KEY, requirement_no VARCHAR(100))"))
        connection.execute(text("CREATE TABLE import_batches (id INTEGER PRIMARY KEY, domain VARCHAR(20))"))
        connection.execute(text("INSERT INTO ir_requirements (id, requirement_no) VALUES (1, 'IR-OLD')"))

    ensure_ir_schema(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("ir_requirements")}
    assert {
        "requirement_type",
        "progress",
        "sa_owner_name",
        "se_owner_name",
        "ai_quality_level",
        "ai_applicability",
        "sa_ai_assisted",
        "se_ai_assisted",
        "ai_dev_mode",
        "remark",
    }.issubset(columns)
    batch_columns = {column["name"] for column in inspect(engine).get_columns("import_batches")}
    assert "update_mode" in batch_columns
    with engine.connect() as connection:
        assert connection.execute(text("SELECT requirement_type FROM ir_requirements WHERE id = 1")).scalar() == "IR"


def test_design_create_requires_type_progress_and_owners(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    payload = ir_payload(product, version, iteration)
    for field in ("requirement_type", "progress", "sa_owner_name", "se_owner_name"):
        broken = {key: value for key, value in payload.items() if key != field}
        response = client.post("/api/data/ir", json=broken)
        assert response.status_code == 422, (field, response.text)

    without_business_module = {
        key: value for key, value in payload.items() if key != "business_module"
    }
    created = client.post("/api/data/ir", json=without_business_module)
    assert created.status_code == 201, created.text
    assert created.json()["business_module"] == ""
    assert created.json()["requirement_type"] == "IR"
    assert created.json()["valid"] is True

    sr = client.post(
        "/api/data/ir",
        json={**payload, "requirement_type": "SR", "requirement_no": "SR-001"},
    )
    assert sr.status_code == 201, sr.text
    assert sr.json()["requirement_type"] == "SR"

    sr_only = client.get(
        "/api/data/ir", params={"team_id": 1, "requirement_type": "SR"}
    ).json()
    assert sr_only["total"] == 1
    assert sr_only["items"][0]["requirement_no"] == "SR-001"

    invalid_type = client.post(
        "/api/data/ir",
        json={**payload, "requirement_type": "AR", "requirement_no": "IR-BAD-TYPE"},
    )
    assert invalid_type.status_code == 422

    employee_only = client.post(
        "/api/data/ir",
        json={
            **payload,
            "requirement_no": "IR-EMPLOYEE-ONLY",
            "sa_owner_name": None,
            "sa_employee_id": "E001",
        },
    )
    assert employee_only.status_code == 201, employee_only.text
    assert employee_only.json()["sa_employee_id"] == "E001"


def test_design_import_updates_owner_columns_in_diff_and_merge(client):
    login(client)
    product, version, iteration = create_ir_context(client)
    row = _template_row(client, version, iteration)
    preview = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "design.xlsx", "rows": [row]},
    ).json()
    assert preview["rows"][0]["operation"] == "insert"
    assert client.post(f"/api/data/ir/imports/{preview['id']}/confirm").status_code == 200

    updated = {**row, "SA": "替换设计者 REPLACE-001"}
    update_preview = client.post(
        "/api/data/ir/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "design.xlsx", "rows": [updated]},
    ).json()
    update_row = update_preview["rows"][0]
    assert update_row["operation"] == "update"
    assert update_row["diff"]["sa_owner_name"]["action"] == "overwrite"
    assert update_row["diff"]["sa_employee_id"]["to"] == "REPLACE-001"
    assert client.post(f"/api/data/ir/imports/{update_preview['id']}/confirm").json()["updated"] == 1

    stored = client.get("/api/data/ir", params={"requirement_no": row["需求编号"]}).json()["items"][0]
    assert stored["sa_owner_name"] == "替换设计者"
    assert stored["sa_employee_id"] == "REPLACE-001"


def test_design_pending_file_batch_is_revalidated_on_confirm(client):
    from app.ir_imports import IRImportRowInput, create_ir_import_batch

    login(client)
    product, version, iteration = create_ir_context(client)
    requirement_no = f"IR-STALE-{uuid4().hex[:8]}"
    legacy_row = {
        "requirement_no": requirement_no,
        "requirement_name": "旧批次设计需求",
        "product_id": product["id"],
        "version_id": version["id"],
        "iteration_id": iteration["id"],
        "completed_at": "2026-08-20",
        "business_module": "CNAE",
    }
    with SessionLocal() as db:
        batch = create_ir_import_batch(
            db,
            [IRImportRowInput(raw=legacy_row)],
            source_kind="import",
            created_by="admin",
            filename="old-design.xlsx",
            strict_template=False,
        )
        db.commit()
        batch_id = batch.id

    confirmed = client.post(f"/api/data/ir/imports/{batch_id}/confirm")
    assert confirmed.status_code == 422, confirmed.text
    detail = confirmed.json()["detail"]
    assert "preview again" in detail["message"]
    assert client.get("/api/data/ir", params={"requirement_no": requirement_no}).json()["total"] == 0


def test_collector_legacy_batch_still_accepts_missing_design_required_fields(client):
    from app.ir_imports import IRImportRowInput, create_ir_import_batch

    login(client)
    product, version, iteration = create_ir_context(client)
    requirement_no = f"IR-COLLECTOR-LEGACY-{uuid4().hex[:8]}"
    legacy_row = {
        "requirement_no": requirement_no,
        "requirement_name": "采集旧字段需求",
        "product_id": product["id"],
        "version_id": version["id"],
        "iteration_id": iteration["id"],
        "completed_at": "2026-08-20",
        "business_module": "CNAE",
        "actual_workload": 3,
        "ai_assisted": False,
    }
    with SessionLocal() as db:
        batch = create_ir_import_batch(
            db,
            [IRImportRowInput(raw=legacy_row, source_id=requirement_no)],
            source_kind="collector",
            team_id=1,
            created_by="scheduled-collector",
            first_row_number=1,
        )
        db.commit()
        batch_id = batch.id

    confirmed = client.post(f"/api/data/ir/imports/{batch_id}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["created"] == 1

    record = client.get("/api/data/ir", params={"requirement_no": requirement_no}).json()["items"][0]
    assert record["requirement_type"] == "IR"
    assert record["progress"] is None
    assert record["sa_owner_name"] is None
    assert record["se_owner_name"] is None
    assert record["actual_workload"] == 3
    assert record["ai_assisted"] is False
    assert record["valid"] is True
    assert record["record_source"] == "collector"
