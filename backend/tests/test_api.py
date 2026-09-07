"""只读 REST 端点测试。"""


def test_catalog_endpoint(client):
    res = client.get("/api/catalog")
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


def test_teams_endpoint(client):
    res = client.get("/api/teams")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 4
    assert body[0]["source_mapping"]["product_versions"] == ["SCC 27.1.RC1", "SCC 27.2.RC1"]


def test_versions_endpoint(client):
    res = client.get("/api/versions")
    assert res.status_code == 200
    body = res.json()
    assert [v["name"] for v in body] == ["SCC 27.1.RC1", "SCC 27.2.RC1"]
    assert all(len(v["iterations"]) == 2 for v in body)
    assert body[1]["iterations"][0]["name"] == "SCC 27.2.RC1-迭代一"


def test_iterations_endpoint_filters_by_version(client):
    all_iters = client.get("/api/iterations").json()
    assert len(all_iters) == 4
    version_id = client.get("/api/versions").json()[0]["id"]
    filtered = client.get(f"/api/iterations?version_id={version_id}").json()
    assert len(filtered) == 2


def test_facts_endpoint_filters(client):
    all_facts = client.get("/api/facts").json()
    assert len(all_facts) > 1000
    team_id = all_facts[0]["team_id"]
    by_team = client.get(f"/api/facts?team_id={team_id}").json()
    assert by_team and all(f["team_id"] == team_id for f in by_team)
    manual = client.get("/api/facts?source=manual").json()
    assert len(manual) == len(all_facts)  # 第一版全部仅补录
    missing = client.get("/api/facts/999999")
    assert missing.status_code == 404


def test_users_not_exposed(client):
    """用户端点不在票面范围且认证未实现（spec §7），不应暴露。"""
    assert client.get("/api/users").status_code == 404
