"""Seed the isolated E2E SQLite database with only the required IR hierarchy."""

import os
from datetime import date
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

if os.environ.get("APP_ENV") != "e2e":
    raise RuntimeError("E2E fixture preparation requires APP_ENV=e2e")
database_url = os.environ.get("DATABASE_URL", "")
if not database_url.startswith("sqlite:///"):
    raise RuntimeError("E2E fixture preparation requires a temporary SQLite database")

from app.auth import hash_password  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import Activity, Iteration, Product, ProductVersion, Team, User  # noqa: E402


Base.metadata.create_all(engine)
with SessionLocal() as db:
    team_a = Team(
        name="Team A",
        source_mapping={"product_versions": ["SCC 27.1.RC1"]},
    )
    team_b = Team(name="Team B", source_mapping={"product_versions": []})
    db.add_all([team_a, team_b])
    db.flush()

    product = Product(team_id=team_a.id, name="团队A产品")
    db.add(product)
    db.flush()
    version = ProductVersion(name="SCC 27.1.RC1", product_id=product.id)
    db.add(version)
    db.flush()
    db.add(Iteration(
        version_id=version.id,
        name="SCC 27.1.RC1-迭代一",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 28),
        sort_order=0,
    ))
    # The application skips its demo seed when the activity catalog is non-empty.
    db.add(Activity(code="e2e-fixture", name="E2E Fixture", kind="key", sort_order=0))
    db.add(User(
        username="admin",
        password_hash=hash_password("e2e-password"),
        role="admin",
    ))
    db.add(User(
        username="viewer",
        password_hash=hash_password("e2e-password"),
        role="viewer",
    ))
    db.commit()

engine.dispose()
