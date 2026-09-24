"""只读 REST 端点测试。"""


def test_catalog_endpoint(authenticated_client):
    res = authenticated_client.get("/api/catalog")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 15
    sa = next(a for a in body if a["code"] == "sa")
    assert sa["kind"] == "key"
    assert [m["code"] for m in sa["metrics"]] == ["sa-ir-pen", "sa-eff"]
    ad = next(a for a in body if a["code"] == "ad")
    assert ad["kind"] == "general"
    assert ad["metrics"][0]["type"] == "boolean"
    assert all(m["collect_method"] == "manual_only" for a in body for m in a["metrics"])


def test_teams_endpoint(authenticated_client):
    res = authenticated_client.get("/api/teams")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 4
    versions = authenticated_client.get("/api/versions").json()
    assert body[0]["source_mapping"]["product_versions"] == [v["name"] for v in versions]


def test_versions_endpoint(authenticated_client):
    res = authenticated_client.get("/api/versions")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert all(v["name"].startswith("演示版本 ") for v in body)
    assert all(len(v["iterations"]) == 3 for v in body)
    assert len({item["start_date"][:7] for v in body for item in v["iterations"]}) == 6


def test_iterations_endpoint_filters_by_version(authenticated_client):
    all_iters = authenticated_client.get("/api/iterations").json()
    assert len(all_iters) == 6
    version_id = authenticated_client.get("/api/versions").json()[0]["id"]
    filtered = authenticated_client.get(f"/api/iterations?version_id={version_id}").json()
    assert len(filtered) == 3


def test_facts_endpoint_filters(authenticated_client):
    all_facts = authenticated_client.get("/api/facts").json()
    assert len(all_facts) > 1000
    team_id = all_facts[0]["team_id"]
    by_team = authenticated_client.get(f"/api/facts?team_id={team_id}").json()
    assert by_team and all(f["team_id"] == team_id for f in by_team)
    manual = authenticated_client.get("/api/facts?source=manual").json()
    assert len(manual) == len(all_facts)  # 第一版全部仅补录
    missing = authenticated_client.get("/api/facts/999999")
    assert missing.status_code == 404


def test_users_collection_only_exposes_configured_mutation_methods(client):
    """账号列表经 /auth/users 暴露；/users 仅保留配置写入口。"""
    assert client.get("/api/users").status_code == 405
