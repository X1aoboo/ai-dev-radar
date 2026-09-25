"""计算层 HTTP seam 测试。"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.seed import month_start


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
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    expected_months = [month_start(today, offset).strftime("%Y-%m") for offset in range(-5, 1)]
    assert [period["id"] for period in body["periods"]] == expected_months
    assert len(body["series"]) == 4
    assert len(body["series"][0]["values"]) == 6
    assert all("fact_count" in point for series in body["series"] for point in series["values"])
    assert len(body["company_average"]) == 6
    assert len(body["domain_summary"]) == 6
    assert body["domain_summary"][0]["fact_count"] > 0
    assert all(point["value"] is not None for point in body["company_average"])


def test_compute_endpoint_filters_time_key_facts_by_version_id(authenticated_client):
    catalog = authenticated_client.get("/api/catalog").json()
    metric_id = next(
        metric["id"]
        for activity in catalog
        for metric in activity["metrics"]
        if metric["code"] == "sa-ir-pen"
    )
    version = authenticated_client.get("/api/versions").json()[0]
    version_id = version["id"]

    all_time = authenticated_client.get(
        "/api/compute",
        params={"metric_id": metric_id, "dim": "time", "gran": "month"},
    )
    version_time = authenticated_client.get(
        "/api/compute",
        params={"metric_id": metric_id, "dim": "time", "gran": "month", "version_id": version_id},
    )
    version_iterations = authenticated_client.get(
        "/api/compute",
        params={"metric_id": metric_id, "dim": "iteration", "version_id": version_id},
    )

    assert all_time.status_code == version_time.status_code == version_iterations.status_code == 200
    count_facts = lambda body: sum(point["fact_count"] for point in body["domain_summary"])
    assert 0 < count_facts(version_time.json()) < count_facts(all_time.json())
    assert count_facts(version_time.json()) == count_facts(version_iterations.json())


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
