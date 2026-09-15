"""计算层 HTTP seam 测试。"""


def test_compute_endpoint_returns_time_series_and_company_average(authenticated_client):
    catalog = authenticated_client.get("/api/catalog").json()
    metric_id = next(
        metric["id"]
        for activity in catalog
        for metric in activity["metrics"]
        if metric["code"] == "sa-ir-pen"
    )

    response = authenticated_client.get(
        "/api/compute",
        params={"metric_id": metric_id, "dim": "time", "gran": "month"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["metric_id"] == metric_id
    assert body["dimension"] == "time"
    assert body["granularity"] == "month"
    assert [period["id"] for period in body["periods"]] == [
        "2026-01", "2026-02", "2026-03", "2026-04",
        "2026-05", "2026-06", "2026-07", "2026-08",
    ]
    assert len(body["series"]) == 4
    assert len(body["series"][0]["values"]) == 8
    assert len(body["company_average"]) == 8
    assert len(body["domain_summary"]) == 8
    assert body["domain_summary"][0]["fact_count"] > 0
    assert all(point["value"] is not None for point in body["company_average"])


def test_compute_endpoint_uses_iteration_labels_and_version_filter(authenticated_client):
    catalog = authenticated_client.get("/api/catalog").json()
    metric_id = next(
        metric["id"]
        for activity in catalog
        for metric in activity["metrics"]
        if metric["code"] == "sa-ir-pen"
    )
    version = authenticated_client.get("/api/versions").json()[0]

    response = authenticated_client.get(
        "/api/compute",
        params={"metric_id": metric_id, "dim": "iteration", "version_id": version["id"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert [period["label"] for period in body["periods"]] == [
        item["name"] for item in version["iterations"]
    ]
    assert all(point["period_id"] in {item["id"] for item in version["iterations"]}
               for point in body["series"][0]["values"])


def test_compute_endpoint_orders_all_iterations_by_version_then_iteration(authenticated_client):
    catalog = authenticated_client.get("/api/catalog").json()
    metric_id = next(
        metric["id"]
        for activity in catalog
        for metric in activity["metrics"]
        if metric["code"] == "sa-ir-pen"
    )
    versions = authenticated_client.get("/api/versions").json()

    response = authenticated_client.get(
        "/api/compute",
        params={"metric_id": metric_id, "dim": "iteration", "version_id": "all"},
    )

    assert response.status_code == 200
    assert [period["id"] for period in response.json()["periods"]] == [
        item["id"] for version in versions for item in version["iterations"]
    ]


def test_compute_endpoint_rejects_iteration_dimension_for_general_activity(authenticated_client):
    catalog = authenticated_client.get("/api/catalog").json()
    metric_id = next(
        metric["id"]
        for activity in catalog
        for metric in activity["metrics"]
        if metric["code"] == "mrr-rate"
    )

    response = authenticated_client.get(
        "/api/compute",
        params={"metric_id": metric_id, "dim": "iteration"},
    )

    assert response.status_code == 422
    assert "no iteration dimension" in response.json()["detail"]


def test_compute_endpoint_requires_authentication(client):
    assert client.get("/api/compute", params={"metric_id": 1}).status_code == 401
