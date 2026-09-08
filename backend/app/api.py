"""认证端点，以及需要登录才能访问的只读 REST 端点。"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .auth import get_current_user, require_roles, require_team_access, verify_password
from .db import get_db
from .models import Activity, FactRecord, Iteration, ProductVersion, Team, User, UserRole
from .schemas import (
    ActivityOut,
    AuthUserOut,
    FactRecordOut,
    IterationOut,
    LoginIn,
    LogoutOut,
    TeamOut,
    VersionOut,
)

router = APIRouter(prefix="/api")


@router.post("/auth/login", response_model=AuthUserOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")

    request.session.clear()
    request.session["user_id"] = user.id
    return user


@router.get("/auth/me", response_model=AuthUserOut)
def current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/auth/logout", response_model=LogoutOut)
def logout(request: Request):
    request.session.clear()
    return {"detail": "logged out"}


@router.get("/auth/users", response_model=list[AuthUserOut])
def list_auth_users(
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """管理员可查看账号角色，供后续配置页复用；不返回密码哈希。"""
    return db.scalars(select(User).order_by(User.id)).all()


@router.get("/auth/teams/{team_id}/users", response_model=list[AuthUserOut])
def list_team_users(
    team_id: int,
    _current_user: User = Depends(require_team_access),
    db: Session = Depends(get_db),
):
    """管理员可查看任意团队，maintainer 仅可查看自己的团队账号。"""
    return db.scalars(
        select(User)
        .where(User.maintainer_team_id == team_id)
        .order_by(User.id)
    ).all()


@router.get("/catalog", response_model=list[ActivityOut])
def list_catalog(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Activity).options(selectinload(Activity.metrics)).order_by(Activity.sort_order)
    ).all()


@router.get("/teams", response_model=list[TeamOut])
def list_teams(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Team).order_by(Team.id)).all()


@router.get("/versions", response_model=list[VersionOut])
def list_versions(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(ProductVersion)
        .options(selectinload(ProductVersion.iterations))
        .order_by(ProductVersion.sort_order)
    ).all()


@router.get("/iterations", response_model=list[IterationOut])
def list_iterations(
    version_id: int | None = None,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
    _current_user: User = Depends(get_current_user),
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
def get_fact(
    fact_id: int,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fact = db.get(FactRecord, fact_id)
    if fact is None:
        raise HTTPException(status_code=404, detail="fact not found")
    return fact
