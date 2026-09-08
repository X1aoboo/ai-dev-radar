"""配置管理 HTTP seam 的行为测试。"""

import pytest


def login(client, username):
    from app.config import SEED_PASSWORD

    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": SEED_PASSWORD},
    )
    assert response.status_code == 200


def test_admin_can_create_a_team_with_structured_source_mapping(client):
    login(client, "admin")

    response = client.post(
        "/api/teams",
        json={
            "name": "平台团队",
            "source_mapping": {
                "product_versions": ["SCC 28.1.RC1"],
                "repos": ["https://git.example.com/platform/main.git"],
            },
        },
    )

    assert response.status_code == 201
    assert response.json()["name"] == "平台团队"
    assert response.json()["source_mapping"] == {
        "product_versions": ["SCC 28.1.RC1"],
        "repos": ["https://git.example.com/platform/main.git"],
    }
    assert client.delete(f"/api/teams/{response.json()['id']}").status_code == 204


def test_custom_catalog_entries_are_available_to_compute_without_code_changes(client):
    login(client, "admin")

    activity = client.post(
        "/api/activities",
        json={"code": "custom-review", "name": "自定义检视", "kind": "general"},
    )
    assert activity.status_code == 201

    metric = client.post(
        "/api/metrics",
        json={
            "activity_id": activity.json()["id"],
            "code": "custom-review-rate",
            "name": "自定义检视率",
            "type": "ratio",
            "numerator_semantic": "已完成数",
            "denominator_semantic": "总数",
            "collect_method": "manual_only",
        },
    )
    assert metric.status_code == 201

    catalog = client.get("/api/catalog")
    assert catalog.status_code == 200
    configured_activity = next(item for item in catalog.json() if item["code"] == "custom-review")
    assert [item["code"] for item in configured_activity["metrics"]] == ["custom-review-rate"]

    compute = client.get(f"/api/compute?metric_id={metric.json()['id']}")
    assert compute.status_code == 200
    assert compute.json()["activity_id"] == activity.json()["id"]
    assert client.delete(f"/api/metrics/{metric.json()['id']}").status_code == 204
    assert client.delete(f"/api/activities/{activity.json()['id']}").status_code == 204


@pytest.mark.parametrize("username", ["viewer", "maintainer.团队A"])
@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("post", "/api/teams", {"name": "禁止", "source_mapping": {}}),
        ("patch", "/api/teams/1", {"name": "禁止"}),
        ("delete", "/api/teams/1", None),
        ("post", "/api/activities", {"code": "forbidden", "name": "禁止", "kind": "general"}),
        ("patch", "/api/activities/1", {"name": "禁止"}),
        ("delete", "/api/activities/1", None),
        (
            "post",
            "/api/metrics",
            {
                "activity_id": 1,
                "code": "forbidden-rate",
                "name": "禁止",
                "type": "ratio",
                "numerator_semantic": "分子",
            },
        ),
        ("patch", "/api/metrics/1", {"name": "禁止"}),
        ("delete", "/api/metrics/1", None),
        ("post", "/api/users", {"username": "forbidden", "password": "password-1", "role": "viewer"}),
        ("patch", "/api/users/1", {"role": "viewer"}),
        ("delete", "/api/users/1", None),
    ],
)
def test_all_configuration_mutations_are_forbidden_to_non_admins(client, username, method, path, json):
    login(client, username)

    response = client.request(method, path, json=json)

    assert response.status_code == 403


def test_admin_can_edit_and_delete_unreferenced_configuration(client):
    login(client, "admin")

    team = client.post("/api/teams", json={"name": "临时团队", "source_mapping": {}})
    assert team.status_code == 201
    edited_team = client.patch(
        f"/api/teams/{team.json()['id']}",
        json={"name": "临时团队（已编辑）", "source_mapping": {"repos": ["https://git.example.com/tmp.git"]}},
    )
    assert edited_team.status_code == 200
    assert edited_team.json()["source_mapping"] == {
        "product_versions": [],
        "repos": ["https://git.example.com/tmp.git"],
    }
    assert client.delete(f"/api/teams/{team.json()['id']}").status_code == 204

    activity = client.post(
        "/api/activities",
        json={"code": "temporary", "name": "临时活动", "kind": "general"},
    )
    assert activity.status_code == 201
    metric = client.post(
        "/api/metrics",
        json={
            "activity_id": activity.json()["id"],
            "code": "temporary-count",
            "name": "临时数量",
            "type": "count",
            "numerator_semantic": "数量",
        },
    )
    assert metric.status_code == 201
    assert client.patch(f"/api/metrics/{metric.json()['id']}", json={"name": "已编辑数量"}).status_code == 200
    assert client.delete(f"/api/metrics/{metric.json()['id']}").status_code == 204
    assert client.delete(f"/api/activities/{activity.json()['id']}").status_code == 204

    team_id = client.get("/api/teams").json()[0]["id"]
    created_user = client.post(
        "/api/users",
        json={
            "username": "maintainer.临时团队",
            "password": "password-1",
            "role": "maintainer",
            "maintainer_team_id": team_id,
        },
    )
    assert created_user.status_code == 201
    updated_user = client.patch(
        f"/api/users/{created_user.json()['id']}",
        json={"role": "viewer", "maintainer_team_id": None},
    )
    assert updated_user.status_code == 200
    assert updated_user.json()["role"] == "viewer"
    assert updated_user.json()["maintainer_team_id"] is None
    assert client.delete(f"/api/users/{created_user.json()['id']}").status_code == 204


def test_referenced_data_and_last_admin_are_not_deletable_or_demotable(client):
    login(client, "admin")

    teams = client.get("/api/teams").json()
    assert client.delete(f"/api/teams/{teams[0]['id']}").status_code == 409
    catalog = client.get("/api/catalog").json()
    assert client.delete(f"/api/metrics/{catalog[0]['metrics'][0]['id']}").status_code == 409

    assert client.patch(f"/api/activities/{catalog[0]['id']}", json={"kind": "general"}).status_code == 409
    destination = client.post(
        "/api/activities",
        json={"code": "temp-destination", "name": "临时目标", "kind": "general"},
    )
    assert destination.status_code == 201
    assert client.patch(
        f"/api/metrics/{catalog[0]['metrics'][0]['id']}",
        json={"activity_id": destination.json()["id"]},
    ).status_code == 409
    assert client.delete(f"/api/activities/{destination.json()['id']}").status_code == 204

    admin = next(user for user in client.get("/api/auth/users").json() if user["username"] == "admin")
    assert client.delete(f"/api/users/{admin['id']}").status_code == 409
    assert client.patch(f"/api/users/{admin['id']}", json={"role": "viewer"}).status_code == 409


def test_maintainer_requires_a_bound_existing_team(client):
    login(client, "admin")

    missing_binding = client.post(
        "/api/users",
        json={"username": "missing-binding", "password": "password-1", "role": "maintainer"},
    )
    assert missing_binding.status_code == 422
    unknown_team = client.post(
        "/api/users",
        json={
            "username": "unknown-team", "password": "password-1", "role": "maintainer", "maintainer_team_id": 99999,
        },
    )
    assert unknown_team.status_code == 404


def test_catalog_configuration_cannot_enable_auto_collection_in_first_version(client):
    login(client, "admin")

    activity = client.get("/api/catalog").json()[0]
    response = client.post(
        "/api/metrics",
        json={
            "activity_id": activity["id"],
            "code": "unsupported-auto",
            "name": "不支持自动采集",
            "type": "count",
            "numerator_semantic": "数量",
            "collect_method": "auto",
        },
    )

    assert response.status_code == 422
