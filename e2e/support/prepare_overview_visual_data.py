"""Create the isolated, fixed Overview visual fixture used by browser captures."""

from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

if os.environ.get("APP_ENV") != "e2e":
    raise RuntimeError("Overview visual fixture preparation requires APP_ENV=e2e")
if not os.environ.get("DATABASE_URL", "").startswith("sqlite:///"):
    raise RuntimeError("Overview visual fixture preparation requires isolated SQLite")

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.migrations import (  # noqa: E402
    ensure_auth_schema,
    ensure_data_management_schema,
    ensure_fact_schema,
    ensure_maturity_schema,
)
from app.models import FactRecord, IRRequirement, Iteration, Metric, Product, ProductVersion, Team, TeamMember  # noqa: E402
from app.seed import run_seed  # noqa: E402


fixture = json.loads((ROOT / "e2e" / "support" / "overview-visual-dataset.json").read_text(encoding="utf-8"))
Base.metadata.create_all(engine)
ensure_fact_schema(engine)
ensure_auth_schema(engine, SessionLocal)
ensure_data_management_schema(engine)
ensure_maturity_schema(engine)

seed_date = date.fromisoformat(fixture["seedDate"])
with SessionLocal() as db:
    run_seed(db, today=seed_date)
    teams = db.query(Team).order_by(Team.id).all()
    months = [date(2026, month, 1) for month in range(4, 10)]
    stamp = datetime(2026, 9, 29, 12, tzinfo=timezone.utc).replace(tzinfo=None)
    missing_team = fixture["states"]["partial"]["missingTeam"]

    # The standard seed supplies complete facts for its first team. Extend the
    # same shape to the others, leaving two explicit missing-data examples.
    for team in teams[1:]:
        product = db.query(Product).filter(Product.team_id == team.id).one()
        member = db.query(TeamMember).filter(TeamMember.team_id == team.id).order_by(TeamMember.id).first()
        version = ProductVersion(name=f"Golden {team.name} 2026", product_id=product.id, sort_order=2)
        db.add(version)
        db.flush()

        for month_index, month in enumerate(months):
            next_month = date(month.year + (month.month == 12), month.month % 12 + 1, 1)
            end = next_month - timedelta(days=1)
            iteration = Iteration(
                version_id=version.id,
                name=f"Golden {team.name} {month:%Y-%m}",
                start_date=month,
                end_date=end,
                sort_order=month_index,
            )
            db.add(iteration)
            db.flush()

            if team.name == missing_team and month == date(2026, 8, 1):
                continue
            for sample_index in range(2):
                unknown_ai = team.name == "团队C" and month == date(2026, 8, 1) and sample_index == 1
                ai_assisted = None if unknown_ai else sample_index == 0
                metadata = {} if ai_assisted is None else {
                    "ai_assisted": {
                        "source": "manual",
                        "updated_by": "Golden Visual Dataset",
                        "updated_at": stamp.isoformat(),
                    }
                }
                db.add(IRRequirement(
                    requirement_no=f"OV-GOLDEN-{team.id}-{month:%Y%m}-{sample_index + 1}",
                    requirement_name=f"{team.name} visual sample {month:%Y-%m}-{sample_index + 1}",
                    responsible_employee_id=member.employee_id if member else None,
                    product_id=product.id,
                    version_id=version.id,
                    iteration_id=iteration.id,
                    completed_at=min(end, seed_date),
                    business_module="Overview visual fixture",
                    requirement_scenario="Fixed screenshot geometry sample",
                    estimated_workload=10.0 + sample_index,
                    actual_workload=5.0 + sample_index,
                    sa_estimated_workload=4.0 + sample_index,
                    sa_actual_workload=2.0 + sample_index,
                    se_estimated_workload=6.0 + sample_index,
                    se_actual_workload=3.0 + sample_index,
                    ai_assisted=ai_assisted,
                    ai_attribute_metadata=metadata,
                    record_source="seed",
                    updated_by="Golden Visual Dataset",
                    updated_at=stamp,
                ))

    # Add exact same-month prior-year IR history so the Activity workload
    # comparison has real fixture points to plot. Reuse each team's seeded
    # product version/iteration so this visual fixture does not create extra
    # version or iteration candidates in the browser checks.
    for team_index, team in enumerate(teams):
        product = db.query(Product).filter(Product.team_id == team.id).one()
        member = db.query(TeamMember).filter(TeamMember.team_id == team.id).order_by(TeamMember.id).first()
        version = (db.query(ProductVersion)
            .join(Product, ProductVersion.product_id == Product.id)
            .filter(Product.team_id == team.id)
            .order_by(ProductVersion.id)
            .first())
        iteration = db.query(Iteration).filter(Iteration.version_id == version.id).order_by(Iteration.id).first() if version else None
        if not version or not iteration:
            raise RuntimeError(f"Golden YoY fixture needs an existing version and iteration for {team.name}")

        for month_index, month_id in enumerate(fixture["yearOverYear"]["months"]):
            if month_id == fixture["yearOverYear"].get("missingMonth"):
                continue
            year, month_number = map(int, month_id.split("-"))
            month = date(year, month_number, 1)
            next_month = date(year + (month_number == 12), month_number % 12 + 1, 1)
            end = next_month - timedelta(days=1)
            estimated = 8.0 + team_index + month_index
            actual = 4.0 + team_index
            if month_id == fixture["yearOverYear"].get("zeroWorkloadMonth"):
                estimated = actual
            db.add(IRRequirement(
                requirement_no=f"OV-GOLDEN-YOY-{team.id}-{month:%Y%m}",
                requirement_name=f"{team.name} prior-year workload sample {month:%Y-%m}",
                responsible_employee_id=member.employee_id if member else None,
                product_id=product.id,
                version_id=version.id,
                iteration_id=iteration.id,
                completed_at=end,
                business_module="Overview visual fixture",
                requirement_scenario="Synthetic prior-year workload comparison",
                estimated_workload=estimated,
                actual_workload=actual,
                sa_estimated_workload=estimated / 2,
                sa_actual_workload=actual / 2,
                se_estimated_workload=estimated / 2,
                se_actual_workload=actual / 2,
                ai_assisted=True,
                ai_attribute_metadata={
                    "ai_assisted": {
                        "source": "manual",
                        "updated_by": "Golden Visual Dataset",
                        "updated_at": stamp.isoformat(),
                    }
                },
                record_source="seed",
                updated_by="Golden Visual Dataset",
                updated_at=stamp,
            ))

    legacy = fixture["productlessVersion"]
    legacy_team = next(team for team in teams if team.name == legacy["team"])
    legacy_metric = db.query(Metric).filter(Metric.code == legacy["metricCode"]).one()
    legacy_version = ProductVersion(name=legacy["name"], product_id=None, sort_order=99)
    db.add(legacy_version)
    db.flush()
    legacy_start = date.fromisoformat(legacy["startDate"])
    legacy_end = date.fromisoformat(legacy["endDate"])
    legacy_iteration = Iteration(
        version_id=legacy_version.id,
        name=legacy["iterationName"],
        start_date=legacy_start,
        end_date=legacy_end,
        sort_order=0,
    )
    db.add(legacy_iteration)
    db.flush()
    db.add(FactRecord(
        team_id=legacy_team.id,
        metric_id=legacy_metric.id,
        iteration_id=legacy_iteration.id,
        numerator=legacy["numerator"],
        denominator=legacy["denominator"],
        start_date=legacy_start,
        end_date=legacy_end,
        source="manual",
        entered_by="Golden Visual Dataset",
        entered_at=stamp,
    ))

    db.commit()

engine.dispose()
