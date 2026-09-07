"""种子测试：目录完整性、幂等重跑、边界样例。"""

from datetime import date

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Activity, FactRecord, Iteration, Metric, ProductVersion, Team, User
from app.seed import CATALOG, run_seed


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
    """演示数据：4 团队、2 版本、各 2 迭代、事实记录齐备。"""
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Team)) == 4
        assert db.scalar(select(func.count()).select_from(ProductVersion)) == 2
        iterations = db.scalars(select(Iteration)).all()
        assert len(iterations) == 4
        assert {it.name for it in iterations} == {
            "SCC 27.1.RC1-迭代一", "SCC 27.1.RC1-迭代二",
            "SCC 27.2.RC1-迭代一", "SCC 27.2.RC1-迭代二",
        }
        assert db.scalar(select(func.count()).select_from(FactRecord)) > 1000
        assert db.scalar(select(func.count()).select_from(User)) == 6  # admin + 4 maintainer + viewer


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
        }

    with SessionLocal() as db:
        before = snapshot(db)
        run_seed(db)  # 重跑（lifespan 已播过一次）
        after = snapshot(db)
        assert before == after
        assert after["facts"] > 0


def test_manual_entry_granularity_unique():
    """补录粒度（spec §4）：团队 × 迭代 × 指标一条——关键活动重复插入应被拒。"""
    import pytest
    from sqlalchemy.exc import IntegrityError

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
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()
