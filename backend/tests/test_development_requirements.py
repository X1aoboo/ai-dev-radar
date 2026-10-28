"""开发活动工作台的 HTTP seam 行为测试。"""

import io
import zipfile
from urllib.parse import quote
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, delete, inspect, or_, select

from app.db import SessionLocal
from app.models import (
    AuditLog,
    DevelopmentRequirement,
    ImportBatch,
    ImportRow,
    Iteration,
    Product,
    ProductVersion,
    TeamMember,
)

DEVELOPMENT_TEMPLATE_HEADERS = [
    "类型", "需求编号", "标题", "进展", "归属组", "PI", "迭代",
    "实现设计责任人", "开发责任人", "AI适用性", "实现设计是否使用AI",
    "开发是否使用AI", "AI研发模式", "预估工作量(实现设计)",
    "实际工作量(实现设计)", "预估工作量(开发)", "实际工作量(开发)",
    "开发时间", "备注",
]

TEST_PRODUCT_IDS = set()
TEST_VERSION_IDS = set()
TEST_ITERATION_IDS = set()
TEST_MEMBER_IDS = set()


@pytest.fixture(autouse=True)
def clean_development_test_rows():
    yield
    with SessionLocal() as db:
        db.execute(delete(AuditLog).where(AuditLog.domain == "development"))
        db.execute(delete(ImportRow).where(
            ImportRow.batch_id.in_(select(ImportBatch.id).where(ImportBatch.domain == "development"))
        ))
        db.execute(delete(ImportBatch).where(ImportBatch.domain == "development"))
        db.execute(delete(DevelopmentRequirement).where(
            ~or_(
                DevelopmentRequirement.requirement_no.like("AR-DEMO-%"),
                DevelopmentRequirement.requirement_no.like("SR-DEMO-%"),
            )
        ))
        if TEST_ITERATION_IDS:
            db.execute(delete(Iteration).where(Iteration.id.in_(TEST_ITERATION_IDS)))
        if TEST_VERSION_IDS:
            db.execute(delete(ProductVersion).where(ProductVersion.id.in_(TEST_VERSION_IDS)))
        if TEST_PRODUCT_IDS:
            db.execute(delete(Product).where(Product.id.in_(TEST_PRODUCT_IDS)))
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
    return response


def create_context(client, team_id=1):
    suffix = uuid4().hex[:8]
    product = client.post(
        "/api/products",
        json={"team_id": team_id, "name": f"开发活动产品-{team_id}-{suffix}"},
    )
    assert product.status_code == 201, product.text
    TEST_PRODUCT_IDS.add(product.json()["id"])
    version = client.post(
        "/api/versions",
        json={"product_id": product.json()["id"], "name": f"开发活动版本-{team_id}-{suffix}"},
    )
    assert version.status_code == 201, version.text
    TEST_VERSION_IDS.add(version.json()["id"])
    iteration = client.post(
        "/api/iterations",
        json={
            "version_id": version.json()["id"],
            "name": f"开发活动迭代-{team_id}-{suffix}",
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
            "employee_id": f"D{team_id:03d}-{suffix}",
            "name": f"开发成员{team_id}",
            "role": "开发",
        },
    )
    assert member.status_code == 201, member.text
    TEST_MEMBER_IDS.add(member.json()["id"])
    return product.json(), version.json(), iteration.json(), member.json()


def development_payload(product, version, iteration, requirement_no="IR-DEV-001", **overrides):
    if requirement_no == "IR-DEV-001":
        requirement_no = f"IR-DEV-{uuid4().hex[:8]}"
    payload = {
        "requirement_type": "IR",
        "requirement_no": requirement_no,
        "requirement_name": "开发活动需求一",
        "product_id": product["id"],
        "version_id": version["id"],
        "iteration_id": iteration["id"],
        "completed_at": "2026-08-15",
        "progress": "进行中",
        "implementation_owner_name": "实现成员A",
        "implementation_employee_id": None,
        "development_owner_name": "开发成员B",
        "development_employee_id": None,
        "implementation_estimated_workload": 3,
        "implementation_actual_workload": 2,
        "development_estimated_workload": 5,
        "development_actual_workload": 4,
        "ai_applicability": True,
        "implementation_ai_assisted": True,
        "development_ai_assisted": False,
        "ai_dev_mode": "设计开发一体化",
        "remark": "开发活动",
    }
    payload.update(overrides)
    return payload


def development_template_row(client, version, iteration, **overrides):
    team = next(item for item in client.get("/api/teams").json() if item["id"] == 1)
    members = [item for item in client.get("/api/team-members").json() if item["team_id"] == 1]
    member = members[-1]
    owner = f"{member['name']} {member['employee_id']}"
    row = {
        "类型": "IR",
        "需求编号": f"IR-DEV-TEMPLATE-{uuid4().hex[:8]}",
        "标题": "开发模板需求",
        "进展": "进行中",
        "归属组": team["name"],
        "PI": version["name"],
        "迭代": iteration["name"],
        "实现设计责任人": owner,
        "开发责任人": owner,
        "AI适用性": "是",
        "实现设计是否使用AI": "是",
        "开发是否使用AI": "否",
        "AI研发模式": "设计开发一体化",
        "预估工作量(实现设计)": 3,
        "实际工作量(实现设计)": 2,
        "预估工作量(开发)": 5,
        "实际工作量(开发)": 4,
        "开发时间": "2026/8/10",
        "备注": "开发模板导入",
    }
    row.update(overrides)
    return row


def test_development_schema_and_import_template_contract(client):
    login(client)
    schema = client.get("/api/data/development/schema")
    assert schema.status_code == 200
    body = schema.json()
    assert body["profile"] == "development"
    assert body["domain"] == "development"
    assert body["template_headers"] == DEVELOPMENT_TEMPLATE_HEADERS
    assert body["requirement_types"] == ["IR", "SR", "AR"]
    required = set(body["import_required"])
    assert {
        "requirement_type", "requirement_no", "requirement_name", "progress",
        "team_name", "version_name", "iteration_name",
        "implementation_owner", "development_owner", "completed_at",
    } == required
    assert "business_module" not in {field["key"] for field in body["fields"]}

    template = client.get("/api/data/development/import-template")
    assert template.status_code == 200
    assert template.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert zipfile.is_zipfile(io.BytesIO(template.content))
    from app.data_management import _xlsx_rows

    rows = _xlsx_rows(template.content)
    assert rows[0] == DEVELOPMENT_TEMPLATE_HEADERS
    assert (
        "filename*=UTF-8''" + quote("需求开发度量模板.xlsx")
        in template.headers["content-disposition"]
    )

    viewer = login(client, "viewer")
    assert viewer.status_code == 200
    assert client.get("/api/data/development/schema").status_code == 200


def test_development_create_list_summary_filters_and_updates(client):
    login(client)
    product, version, iteration, _member = create_context(client)
    first = client.post(
        "/api/data/development",
        json=development_payload(product, version, iteration, progress="完成"),
    )
    assert first.status_code == 201, first.text
    first_body = first.json()
    assert first_body["requirement_type"] == "IR"
    assert first_body["team_id"] == 1
    assert first_body["product_name"] == product["name"]
    assert first_body["total_estimated_workload"] == 8
    assert first_body["total_actual_workload"] == 6
    assert first_body["valid"] is True

    second = client.post(
        "/api/data/development",
        json=development_payload(
            product,
            version,
            iteration,
            requirement_type="SR",
            requirement_name="开发活动需求二",
            progress="进行中",
            implementation_estimated_workload=1,
            implementation_actual_workload=1,
            development_estimated_workload=2,
            development_actual_workload=2,
            implementation_ai_assisted=False,
            development_ai_assisted=False,
        ),
    )
    assert second.status_code == 201, second.text

    listing = client.get("/api/data/development", params={"product_id": product["id"]}).json()
    assert listing["total"] == 2
    assert listing["summary"]["total"] == 2
    assert listing["summary"]["by_progress"] == {"完成": 1, "进行中": 1}
    assert listing["summary"]["ai_used_count"] == 1
    assert listing["summary"]["ai_known_count"] == 2
    assert listing["summary"]["ai_usage_rate"] == 0.5
    assert listing["summary"]["implementation_estimated_workload"] == 4
    assert listing["summary"]["implementation_actual_workload"] == 3
    assert listing["summary"]["development_estimated_workload"] == 7
    assert listing["summary"]["development_actual_workload"] == 6
    assert listing["summary"]["total_estimated_workload"] == 11
    assert listing["summary"]["total_actual_workload"] == 9

    sr_only = client.get(
        "/api/data/development",
        params={"product_id": product["id"], "requirement_type": "SR"},
    ).json()
    assert sr_only["total"] == 1
    assert sr_only["items"][0]["requirement_no"] == second.json()["requirement_no"]

    progress = client.get(
        "/api/data/development",
        params={"product_id": product["id"], "progress": "完成"},
    ).json()
    assert progress["total"] == 1

    ai_filtered = client.get(
        "/api/data/development",
        params={"product_id": product["id"], "implementation_ai_assisted": "true"},
    ).json()
    assert ai_filtered["total"] == 1

    keyword = client.get(
        "/api/data/development",
        params={"product_id": product["id"], "keyword": "需求二"},
    ).json()
    assert keyword["total"] == 1

    bulk = client.patch(
        "/api/data/development/bulk",
        json={"items": [
            {"id": first_body["id"], "changes": {"progress": "已关闭", "remark": "批量"}},
            {"id": second.json()["id"], "changes": {"development_ai_assisted": True}},
        ]},
    )
    assert bulk.status_code == 200, bulk.text
    assert bulk.json()[0]["progress"] == "已关闭"
    assert bulk.json()[1]["ai_assisted"] is True

    patched = client.patch(
        f"/api/data/development/{first_body['id']}",
        json={"requirement_name": "开发活动需求（已编辑）"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["requirement_name"] == "开发活动需求（已编辑）"

    audit = client.get(f"/api/data/development/{first_body['id']}/audit-logs")
    assert audit.status_code == 200
    actions = {item["action"] for item in audit.json()}
    assert {"create", "bulk_update", "update"}.issubset(actions)
    with SessionLocal() as db:
        domains = {
            item.domain
            for item in db.scalars(
                select(AuditLog).where(AuditLog.record_id == first_body["id"])
            ).all()
        }
    assert domains == {"development"}


def test_development_create_requires_fields_and_validates_type(client):
    login(client)
    product, version, iteration, _member = create_context(client)
    payload = development_payload(product, version, iteration)
    for field in (
        "requirement_type",
        "progress",
        "implementation_owner_name",
        "development_owner_name",
        "completed_at",
    ):
        broken = {key: value for key, value in payload.items() if key != field}
        response = client.post("/api/data/development", json=broken)
        assert response.status_code == 422, (field, response.text)

    invalid_type = client.post(
        "/api/data/development",
        json={**payload, "requirement_type": "XX"},
    )
    assert invalid_type.status_code == 422

    ar_record = client.post(
        "/api/data/development",
        json={**payload, "requirement_type": "AR", "requirement_no": "AR-DEV-001"},
    )
    assert ar_record.status_code == 201, ar_record.text
    assert ar_record.json()["requirement_type"] == "AR"

    employee_only = client.post(
        "/api/data/development",
        json={
            **payload,
            "requirement_no": "IR-DEV-EMPLOYEE-ONLY",
            "implementation_owner_name": None,
            "implementation_employee_id": "E001",
        },
    )
    assert employee_only.status_code == 201, employee_only.text
    assert employee_only.json()["implementation_employee_id"] == "E001"
    assert employee_only.json()["valid"] is True


def test_development_import_upsert_fill_empty_and_atomicity(client):
    login(client)
    product, version, iteration, _member = create_context(client)
    row = development_template_row(client, version, iteration)

    preview = client.post(
        "/api/data/development/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "development.xlsx", "rows": [row]},
    )
    assert preview.status_code == 201, preview.text
    body = preview.json()
    assert body["domain"] == "development"
    assert body["valid_rows"] == 1
    assert body["rows"][0]["operation"] == "insert"
    assert client.post(
        f"/api/data/development/imports/{body['id']}/confirm"
    ).json()["created"] == 1

    stored = client.get(
        "/api/data/development", params={"requirement_no": row["需求编号"]}
    ).json()["items"][0]
    assert stored["progress"] == "进行中"
    assert stored["completed_at"] == "2026-08-10"
    assert stored["implementation_owner_name"] and stored["implementation_employee_id"]
    assert stored["development_owner_name"] and stored["development_employee_id"]
    assert stored["total_estimated_workload"] == 8
    assert stored["total_actual_workload"] == 6
    assert stored["implementation_ai_assisted"] is True
    assert stored["development_ai_assisted"] is False
    assert stored["ai_assisted"] is True
    assert stored["record_source"] == "import"

    updated_row = {
        **row,
        "标题": "开发模板更新",
        "进展": "完成",
        "实现设计是否使用AI": "否",
        "开发是否使用AI": "否",
        "备注": "",
    }
    update_preview = client.post(
        "/api/data/development/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "development.xlsx", "rows": [updated_row]},
    ).json()
    assert update_preview["rows"][0]["operation"] == "update"
    assert update_preview["rows"][0]["diff"]["requirement_name"]["action"] == "overwrite"
    assert client.post(
        f"/api/data/development/imports/{update_preview['id']}/confirm"
    ).json()["updated"] == 1

    after_update = client.get(
        "/api/data/development", params={"requirement_no": row["需求编号"]}
    ).json()["items"][0]
    assert after_update["requirement_name"] == "开发模板更新"
    assert after_update["progress"] == "完成"
    assert after_update["ai_assisted"] is False
    assert after_update["remark"] == "开发模板导入"

    fill_preview = client.post(
        "/api/data/development/imports/preview",
        params={"mode": "fill_empty"},
        json={"filename": "development.xlsx", "rows": [{**updated_row, "标题": "不应覆盖"}]},
    ).json()
    assert fill_preview["rows"][0]["operation"] == "unchanged"
    assert client.post(
        f"/api/data/development/imports/{fill_preview['id']}/confirm"
    ).json()["unchanged"] == 1

    invalid_row = {**row, "需求编号": "IR-DEV-INVALID"}
    invalid_row.pop("开发责任人")
    invalid_preview = client.post(
        "/api/data/development/imports/preview",
        params={"mode": "upsert"},
        json={"filename": "development.xlsx", "rows": [
            development_template_row(client, version, iteration, 需求编号="IR-DEV-NEW-VALID"),
            invalid_row,
        ]},
    ).json()
    assert invalid_preview["valid_rows"] == 1
    assert invalid_preview["invalid_rows"] == 1
    assert any("缺少开发责任人" in error for error in invalid_preview["rows"][1]["errors"])
    blocked = client.post(
        f"/api/data/development/imports/{invalid_preview['id']}/confirm"
    )
    assert blocked.status_code == 422
    assert client.get(
        "/api/data/development", params={"requirement_no": "IR-DEV-NEW-VALID"}
    ).json()["total"] == 0


def test_development_permissions_and_import_only_source(client):
    login(client)
    product, version, iteration, _member = create_context(client)
    other_product, other_version, other_iteration, _ = create_context(client, team_id=2)
    created = client.post(
        "/api/data/development",
        json=development_payload(product, version, iteration),
    )
    assert created.status_code == 201
    other = client.post(
        "/api/data/development",
        json=development_payload(other_product, other_version, other_iteration),
    )
    assert other.status_code == 201

    client.post("/api/auth/logout")
    login(client, "viewer")
    assert client.get("/api/data/development").status_code == 200
    assert client.post(
        "/api/data/development",
        json=development_payload(product, version, iteration),
    ).status_code == 403
    assert client.post("/api/data/development/imports/preview", json={
        "filename": "development.xlsx",
        "rows": [development_template_row(client, version, iteration)],
    }).status_code == 403

    client.post("/api/auth/logout")
    login(client, "maintainer.团队A")
    assert client.patch(
        f"/api/data/development/{created.json()['id']}",
        json={"progress": "完成"},
    ).status_code == 200
    assert client.patch(
        f"/api/data/development/{other.json()['id']}",
        json={"progress": "完成"},
    ).status_code == 403
    assert client.post(
        "/api/data/development",
        json=development_payload(other_product, other_version, other_iteration),
    ).status_code == 403
    assert client.get(
        "/api/data/development", params={"team_id": 2}
    ).status_code == 403

    from app.requirement_fields import DEVELOPMENT_PROFILE
    from app.requirement_imports import create_import_batch

    with SessionLocal() as db:
        with pytest.raises(ValueError):
            create_import_batch(
                db,
                DevelopmentRequirement,
                [],
                profile=DEVELOPMENT_PROFILE,
                source_kind="collector",
                team_id=1,
                created_by="scheduled-collector",
            )


def test_ensure_development_schema_creates_independent_table():
    from app.migrations import ensure_development_schema

    engine = create_engine("sqlite://")
    ensure_development_schema(engine)
    ensure_development_schema(engine)
    inspector = inspect(engine)
    assert "development_requirements" in inspector.get_table_names()
    columns = {column["name"] for column in inspector.get_columns("development_requirements")}
    assert {
        "requirement_type",
        "requirement_no",
        "requirement_name",
        "product_id",
        "version_id",
        "iteration_id",
        "completed_at",
        "progress",
        "implementation_owner_name",
        "implementation_employee_id",
        "development_owner_name",
        "development_employee_id",
        "implementation_estimated_workload",
        "implementation_actual_workload",
        "development_estimated_workload",
        "development_actual_workload",
        "ai_applicability",
        "implementation_ai_assisted",
        "development_ai_assisted",
        "ai_dev_mode",
        "ai_assisted",
        "remark",
        "record_source",
    }.issubset(columns)
    engine.dispose()


def test_development_same_requirement_number_can_coexist_with_design(client):
    login(client)
    product, version, iteration, _member = create_context(client)
    requirement_no = f"IR-SHARED-{uuid4().hex[:8]}"
    design = client.post(
        "/api/data/ir",
        json={
            "requirement_type": "IR",
            "requirement_no": requirement_no,
            "requirement_name": "共享编号设计记录",
            "product_id": product["id"],
            "version_id": version["id"],
            "iteration_id": iteration["id"],
            "completed_at": "2026-08-15",
            "business_module": "CNAE",
            "progress": "进行中",
            "sa_owner_name": "设计SA",
            "se_owner_name": "设计SE",
        },
    )
    assert design.status_code == 201, design.text
    development = client.post(
        "/api/data/development",
        json=development_payload(product, version, iteration, requirement_no=requirement_no),
    )
    assert development.status_code == 201, development.text
    assert development.json()["requirement_no"] == requirement_no

    with SessionLocal() as db:
        db.execute(delete(AuditLog).where(AuditLog.record_id == design.json()["id"]))
        from app.models import IRRequirement

        db.execute(delete(IRRequirement).where(IRRequirement.id == design.json()["id"]))
        db.commit()


def test_development_file_preview_requires_template_headers(client):
    login(client)
    product, version, iteration, _member = create_context(client)
    team = next(item for item in client.get("/api/teams").json() if item["id"] == 1)
    member = [item for item in client.get("/api/team-members").json() if item["team_id"] == 1][-1]
    owner = f"{member['name']} {member['employee_id']}"
    headers = DEVELOPMENT_TEMPLATE_HEADERS
    values = [
        "IR", "IR-DEV-CSV", "开发CSV需求", "进行中", team["name"], version["name"],
        iteration["name"], owner, owner, "是", "是", "否", "设计开发一体化",
        "3", "2", "5", "4", "2026/8/20", "文件导入",
    ]
    csv_content = ",".join(headers) + "\n" + ",".join(values) + "\n"
    response = client.post(
        "/api/data/development/imports/preview",
        content=csv_content.encode("utf-8"),
        headers={"content-type": "text/csv", "x-filename": "development.csv"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["domain"] == "development"
    assert body["valid_rows"] == 1
    assert body["rows"][0]["source_id"] == "IR-DEV-CSV"

    legacy_json = client.post(
        "/api/data/development/imports/preview",
        json={
            "filename": "legacy.xlsx",
            "rows": [{"requirement_no": "IR-DEV-LEGACY"}],
        },
    )
    assert legacy_json.status_code == 201
    assert legacy_json.json()["valid_rows"] == 0
    errors = legacy_json.json()["rows"][0]["errors"]
    assert any("缺少类型" in error for error in errors)


def test_overview_development_activity_progress_and_roles(client):
    login(client)
    product, version, iteration, _member = create_context(client)
    other_product, other_version, other_iteration, _ = create_context(client, team_id=2)

    def create_development(**overrides):
        response = client.post(
            "/api/data/development",
            json=development_payload(product, version, iteration, **overrides),
        )
        assert response.status_code == 201, response.text
        return response.json()

    first = create_development(
        requirement_no="IR-OVERVIEW-DEV-A",
        progress="完成",
        implementation_ai_assisted=True,
        development_ai_assisted=False,
        implementation_estimated_workload=3,
        implementation_actual_workload=2,
        development_estimated_workload=5,
        development_actual_workload=4,
        ai_applicability=None,
    )
    assert first["valid"] is True
    create_development(
        requirement_no="IR-OVERVIEW-DEV-B",
        progress="已关闭",
        implementation_ai_assisted=False,
        development_ai_assisted=True,
        implementation_estimated_workload=None,
        implementation_actual_workload=None,
        development_estimated_workload=2,
        development_actual_workload=1,
        ai_applicability=None,
    )
    create_development(
        requirement_no="IR-OVERVIEW-DEV-C",
        progress="进行中",
        implementation_ai_assisted=True,
        development_ai_assisted=True,
    )
    create_development(
        requirement_no="SR-OVERVIEW-DEV-D",
        requirement_type="SR",
        progress="完成",
        implementation_ai_assisted=True,
        development_ai_assisted=None,
        implementation_estimated_workload=4,
        implementation_actual_workload=4,
        development_estimated_workload=None,
        development_actual_workload=2,
        ai_applicability=None,
    )
    create_development(
        requirement_no="AR-OVERVIEW-DEV-E",
        requirement_type="AR",
        progress="完成",
        implementation_ai_assisted=None,
        development_ai_assisted=None,
        ai_applicability=None,
        implementation_estimated_workload=None,
        implementation_actual_workload=None,
        development_estimated_workload=None,
        development_actual_workload=None,
    )
    team2 = client.post(
        "/api/data/development",
        json=development_payload(
            other_product, other_version, other_iteration,
            requirement_no="AR-OVERVIEW-DEV-TEAM2",
            progress="完成",
        ),
    )
    assert team2.status_code == 201, team2.text

    base_params = {
        "from_month": "2026-08",
        "to_month": "2026-08",
        "version_id": str(version["id"]),
        "activity": "development",
    }
    overview = client.get("/api/data-metrics/overview", params=base_params)
    assert overview.status_code == 200, overview.text
    development_all = overview.json()["domain_summary"][0]
    # A + B + D + E complete/closed records; C is in progress and excluded.
    assert development_all["fact_count"] == 4
    assert development_all["known_ai_count"] == 3
    assert development_all["ai_assisted_count"] == 3
    assert development_all["ai_workload_count"] == 3
    assert development_all["ai_estimated_workload"] == 14
    assert development_all["ai_actual_workload"] == 13

    implementation_overview = client.get(
        "/api/data-metrics/overview",
        params={**base_params, "role": "implementation"},
    )
    assert implementation_overview.status_code == 200, implementation_overview.text
    implementation_point = implementation_overview.json()["domain_summary"][0]
    assert implementation_point["fact_count"] == 4
    assert implementation_point["known_ai_count"] == 3
    assert implementation_point["ai_assisted_count"] == 2
    assert implementation_point["ai_workload_count"] == 2
    assert implementation_point["ai_estimated_workload"] == 7
    assert implementation_point["ai_actual_workload"] == 6

    development_overview = client.get(
        "/api/data-metrics/overview",
        params={**base_params, "role": "development"},
    )
    assert development_overview.status_code == 200, development_overview.text
    development_point = development_overview.json()["domain_summary"][0]
    assert development_point["known_ai_count"] == 2
    assert development_point["ai_assisted_count"] == 1
    assert development_point["ai_workload_count"] == 1
    assert development_point["ai_estimated_workload"] == 2
    assert development_point["ai_actual_workload"] == 1

    assert client.get(
        "/api/data-metrics/overview",
        params={**base_params, "activity": "design", "role": "implementation"},
    ).status_code == 422
    assert client.get(
        "/api/data-metrics/overview",
        params={**base_params, "role": "se"},
    ).status_code == 422
    assert client.get(
        "/api/data-metrics/overview",
        params={**base_params, "version_id": "999999"},
    ).status_code == 404

    client.post("/api/auth/logout")
    login(client, "maintainer.团队A")
    maintainer_overview = client.get(
        "/api/data-metrics/overview",
        params={
            "from_month": "2026-08",
            "to_month": "2026-08",
            "activity": "development",
        },
    )
    assert maintainer_overview.status_code == 200
    assert {series["team_id"] for series in maintainer_overview.json()["series"]} == {1}
    assert maintainer_overview.json()["domain_summary"][0]["fact_count"] >= 4
