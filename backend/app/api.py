"""只读 REST 端点：目录、团队、版本、迭代、事实记录、用户。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .db import get_db
from .models import Activity, FactRecord, Iteration, ProductVersion, Team
from .schemas import ActivityOut, FactRecordOut, IterationOut, TeamOut, VersionOut

router = APIRouter(prefix="/api")


@router.get("/catalog", response_model=list[ActivityOut])
def list_catalog(db: Session = Depends(get_db)):
    return db.scalars(
        select(Activity).options(selectinload(Activity.metrics)).order_by(Activity.sort_order)
    ).all()


@router.get("/teams", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db)):
    return db.scalars(select(Team).order_by(Team.id)).all()


@router.get("/versions", response_model=list[VersionOut])
def list_versions(db: Session = Depends(get_db)):
    return db.scalars(
        select(ProductVersion)
        .options(selectinload(ProductVersion.iterations))
        .order_by(ProductVersion.sort_order)
    ).all()


@router.get("/iterations", response_model=list[IterationOut])
def list_iterations(version_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(Iteration).order_by(Iteration.sort_order)
    if version_id is not None:
        stmt = stmt.where(Iteration.version_id == version_id)
    return db.scalars(stmt).all()


@router.get("/facts", response_model=list[FactRecordOut])
def list_facts(
    team_id: int | None = None,
    metric_id: int | None = None,
    iteration_id: int | None = None,
    source: str | None = Query(None, pattern="^(manual|auto)$"),
    limit: int = Query(default=10000, ge=1, le=50000),
    db: Session = Depends(get_db),
):
    stmt = select(FactRecord).order_by(FactRecord.id).limit(limit)
    if team_id is not None:
        stmt = stmt.where(FactRecord.team_id == team_id)
    if metric_id is not None:
        stmt = stmt.where(FactRecord.metric_id == metric_id)
    if iteration_id is not None:
        stmt = stmt.where(FactRecord.iteration_id == iteration_id)
    if source is not None:
        stmt = stmt.where(FactRecord.source == source)
    return db.scalars(stmt).all()


@router.get("/facts/{fact_id}", response_model=FactRecordOut)
def get_fact(fact_id: int, db: Session = Depends(get_db)):
    fact = db.get(FactRecord, fact_id)
    if fact is None:
        raise HTTPException(status_code=404, detail="fact not found")
    return fact
