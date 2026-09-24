"""种子测试：目录、滚动窗口、图表覆盖、幂等和边界样例。"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal
from app.models import Activity, FactRecord, IRRequirement, Iteration, Metric, MaturityRecord, ProductVersion, Team, User
from app.seed import CATALOG, month_start, run_seed


def test_catalog_matches_spec():
    """spec §2.1：15 个活动（8 关键 + 7 通用）及全部指标，全部仅补录。"""
    with SessionLocal() as db:
        activities = db.scalars(select(Activity)).all()
        assert len(activities) == 15
        assert sum(1 for a in activities if a.kind == "key") == 8
        assert sum(1 for a in activities if a.kind == "general") == 7
        # 目录常量与库内条目数一致
        assert sum(len(metrics) for *_ , metrics in CATALOG) == len(db.scalars(select(Metric)).all())
        # 全部标记仅补录（ADR-0002）
        assert all(m.collect_method == "manual_only" for m in db.scalars(select(Metric)))


def test_demo_dimensions():
    """演示数据：4 团队、2 版本、近六个月各一迭代、事实和评估齐备。"""
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Team)) == 4
        assert db.scalar(select(func.count()).select_from(ProductVersion)) == 2
        iterations = db.scalars(select(Iteration)).all()
        assert len(iterations) == 6
        today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        assert {it.start_date for it in iterations} == {month_start(today, offset) for offset in range(-5, 1)}
        assert db.scalar(select(func.count()).select_from(FactRecord)) > 1000
        assert db.scalar(select(func.count()).select_from(User)) == 6  # admin + 4 maintainer + viewer
        assert db.scalar(select(func.count()).select_from(MaturityRecord)) == 4 * 15 * 6
        assert db.scalar(select(func.count()).select_from(IRRequirement)) == 12


def test_fact_scope_dimensions():
    """关键活动事实挂迭代，通用能力事实无迭代且有纯时间。"""
    with SessionLocal() as db:
        key_metric_ids = {
            m.id for m in db.scalars(select(Metric).join(Activity)
                                     .where(Activity.kind == "key"))
        }
        facts = db.scalars(select(FactRecord)).all()
        for f in facts:
            if f.metric_id in key_metric_ids:
                assert f.iteration_id is not None
            else:
                assert f.iteration_id is None
            assert f.start_date is not None and f.end_date is not None
        # 第一版仅补录：全部 manual
        assert all(f.source == "manual" for f in facts)


def test_efficiency_boundary_samples():
    """验收项：实际=0 与负值效率提升的样例存在。"""
    with SessionLocal() as db:
        eff_facts = db.scalars(
            select(FactRecord).join(Metric).where(Metric.type == "efficiency")
        ).all()
        assert any(f.denominator == 0 for f in eff_facts), "缺少实际=0样例"
        assert any(
            f.denominator and f.denominator > f.numerator for f in eff_facts
        ), "缺少负值效率样例"


def test_seed_idempotent():
    """先清后插：重跑后各表行数与关键聚合不变。"""
    def snapshot(db):
        return {
            "facts": db.scalar(select(func.count()).select_from(FactRecord)),
            "metrics": db.scalar(select(func.count()).select_from(Metric)),
            "sum_num": db.scalar(select(func.sum(FactRecord.numerator))) or 0,
            "maturity": db.scalar(select(func.count()).select_from(MaturityRecord)),
            "ir": db.scalar(select(func.count()).select_from(IRRequirement)),
        }

    with SessionLocal() as db:
        before = snapshot(db)
        run_seed(db)  # 重跑（lifespan 已播过一次）
        after = snapshot(db)
        assert before == after
        assert after["facts"] > 0


def test_seed_window_crosses_year_and_current_month_day_one():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    today = date(2027, 1, 1)
    with Session(engine) as db:
        run_seed(db, today=today)
        expected = [month_start(today, offset) for offset in range(-5, 1)]
        assert [it.start_date for it in db.scalars(select(Iteration).order_by(Iteration.id))] == expected
        assert all(it.end_date <= today for it in db.scalars(select(Iteration)))
        assert {record.assessment_month for record in db.scalars(select(MaturityRecord))} == set(expected)
        assert db.scalar(select(func.count()).select_from(FactRecord).where(FactRecord.end_date == today)) > 0
        before = db.scalar(select(func.sum(FactRecord.numerator)))
        run_seed(db, today=today)
        assert db.scalar(select(func.sum(FactRecord.numerator))) == before


def test_seed_has_one_key_fact_per_scope_and_daily_general_coverage():
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    with SessionLocal() as db:
        key_ids = [metric.id for metric in db.scalars(select(Metric).join(Activity).where(Activity.kind == "key"))]
        iterations = db.scalars(select(Iteration)).all()
        assert db.scalar(select(func.count()).select_from(FactRecord).where(FactRecord.metric_id.in_(key_ids))) == 4 * len(key_ids) * len(iterations)
        general_metric = db.scalar(select(Metric).where(Metric.code == "mrr-rate"))
        recent_dates = {today - timedelta(days=offset) for offset in range(30)}
        fact_dates = set(db.scalars(select(FactRecord.end_date).where(FactRecord.metric_id == general_metric.id)))
        assert recent_dates <= fact_dates


def test_seed_populates_all_defined_metric_views(authenticated_client):
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    expected_months = {month_start(today, offset).strftime("%Y-%m") for offset in range(-5, 1)}
    catalog = authenticated_client.get("/api/catalog").json()
    for activity in catalog:
        for metric in activity["metrics"]:
            response = authenticated_client.get("/api/compute", params={
                "metric_id": metric["id"], "dim": "time", "gran": "month",
            })
            assert response.status_code == 200
            body = response.json()
            if metric["type"] == "boolean":
                assert {point["period_id"] for series in body["series"] for point in series["values"] if point["value"] is not None} == expected_months
            else:
                assert {point["period_id"] for point in body["company_average"] if point["value"] is not None} == expected_months, metric["code"]
    for kind, count in (("key", 8), ("general", 7)):
        for assessment_month in expected_months:
            overview = authenticated_client.get("/api/maturity/overview", params={"month": assessment_month, "kind": kind})
            assert overview.status_code == 200
            assert overview.json()["assessed_cell_count"] == 4 * count

    for metric in authenticated_client.get("/api/data-metrics?domain=ir").json():
        computed = authenticated_client.get("/api/data-metrics/compute", params={"metric_code": metric["code"]})
        assert computed.status_code == 200
        assert computed.json()["record_count"] == 12
        assert computed.json()["value"] is not None


def test_seed_populates_current_day_week_and_iteration_views(authenticated_client):
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    catalog = authenticated_client.get("/api/catalog").json()
    by_code = {metric["code"]: metric for activity in catalog for metric in activity["metrics"]}
    for code in ("sa-ir-pen", "mrr-rate"):
        for granularity in ("day", "week"):
            body = authenticated_client.get("/api/compute", params={
                "metric_id": by_code[code]["id"], "dim": "time", "gran": granularity,
            }).json()
            current = today.isoformat() if granularity == "day" else f"{today.isocalendar().year}-W{today.isocalendar().week:02d}"
            assert next(point for point in body["company_average"] if point["period_id"] == current)["value"] is not None

    versions = authenticated_client.get("/api/versions").json()
    for version in versions:
        body = authenticated_client.get("/api/compute", params={
            "metric_id": by_code["sa-ir-pen"]["id"], "dim": "iteration", "version_id": version["id"],
        }).json()
        assert len(body["periods"]) == 3
        assert all(point["value"] is not None for series in body["series"] for point in series["values"])

    boolean = authenticated_client.get("/api/compute", params={
        "metric_id": by_code["ad-bool"]["id"], "dim": "time", "gran": "month",
    }).json()
    current_month = today.strftime("%Y-%m")
    assert {next(point for point in series["values"] if point["period_id"] == current_month)["value"]
            for series in boolean["series"]} == {0, 1}


def test_manual_entry_granularity_keeps_correction_history():
    """同一团队、迭代、指标可追加修正记录，历史行不被唯一索引阻断。"""
    with SessionLocal() as db:
        rec = db.scalars(
            select(FactRecord).where(FactRecord.iteration_id.is_not(None))
        ).first()
        dup = FactRecord(
            team_id=rec.team_id, metric_id=rec.metric_id, iteration_id=rec.iteration_id,
            numerator=1, denominator=1,
            start_date=date(2026, 9, 1), end_date=date(2026, 9, 2),  # 日期不同也应被拒
            source="manual", entered_by="测试",
        )
        db.add(dup)
        db.flush()
        assert dup.id > rec.id
        db.rollback()
