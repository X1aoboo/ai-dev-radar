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


@pytest.mark.parametrize("username", ["viewer", "maintainer.团队A"])
@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("post", "/api/teams", {"name": "禁止", "source_mapping": {}}),
        ("patch", "/api/teams/1", {"name": "禁止"}),
        ("delete", "/api/teams/1", None),
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




def test_metric_catalog_is_read_only(client):
    login(client, "admin")

    catalog = client.get("/api/catalog")
    assert catalog.status_code == 200
    assert catalog.json()

    assert client.post(
        "/api/activities",
        json={"code": "removed", "name": "已移除", "kind": "general"},
    ).status_code in {404, 405}
    assert client.post(
        "/api/metrics",
        json={
            "activity_id": 1,
            "code": "removed",
            "name": "已移除",
            "type": "count",
            "numerator_semantic": "数量",
        },
    ).status_code in {404, 405}
    assert client.get("/api/data-metrics").status_code == 404
    assert client.post("/api/data-metrics", json={}).status_code in {404, 405}
    assert client.get("/api/data-metrics/compute", params={"metric_code": "ir-ai-penetration"}).status_code == 404


def test_team_can_be_created_with_name_only(client):
    login(client, "admin")

    response = client.post("/api/teams", json={"name": "仅名称团队"})
    assert response.status_code == 201, response.text
    assert response.json()["name"] == "仅名称团队"
    assert response.json()["source_mapping"] == {"product_versions": [], "repos": []}
    assert client.delete(f"/api/teams/{response.json()['id']}").status_code == 204


def test_team_options_is_lightweight_and_does_not_expose_source_mapping(client):
    login(client, "admin")

    response = client.get("/api/teams/options")
    assert response.status_code == 200
    options = response.json()
    assert options
    assert all(set(item) == {"id", "name"} for item in options)
    assert "source_mapping" not in response.text
