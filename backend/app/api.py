"""认证端点，以及需要登录才能访问的 REST 端点。"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from .auth import (
    get_current_user,
    hash_password,
    require_roles,
    require_team_access,
    verify_password,
)
from .compute import build_series, select_current_facts
from .db import get_db
from .models import (
    Activity,
    FactRecord,
    FactSource,
    Iteration,
    Metric,
    ProductVersion,
    Team,
    User,
    UserRole,
)
from .schemas import (
    ActivityIn,
    ActivityOut,
    ActivityUpdateIn,
    AuthUserOut,
    ComputeOut,
    FactRecordOut,
    IterationOut,
    LoginIn,
    LogoutOut,
    ManualFactIn,
    MetricIn,
    MetricOut,
    MetricUpdateIn,
    TeamIn,
    TeamOut,
    TeamUpdateIn,
    UserIn,
    UserUpdateIn,
    VersionOut,
)

router = APIRouter(prefix="/api")


def _commit(db: Session, entity):
    """将唯一键等数据库约束转换成 API 的可预期冲突响应。"""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="resource already exists") from exc
    db.refresh(entity)
    return entity


def _get_or_404(db: Session, model, resource_id: int, detail: str):
    entity = db.get(model, resource_id)
    if entity is None:
        raise HTTPException(status_code=404, detail=detail)
    return entity


def _validate_user_assignment(db: Session, role: UserRole | str, team_id: int | None) -> None:
    if role == UserRole.MAINTAINER.value or role == UserRole.MAINTAINER:
        if team_id is None:
            raise HTTPException(status_code=422, detail="maintainer must be bound to a team")
        _get_or_404(db, Team, team_id, "team not found")
    elif team_id is not None:
        raise HTTPException(status_code=422, detail="only maintainers may be bound to a team")


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


@router.post("/teams", response_model=TeamOut, status_code=201)
def create_team(
    payload: TeamIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    team = Team(name=payload.name, source_mapping=payload.source_mapping.model_dump())
    db.add(team)
    return _commit(db, team)


@router.patch("/teams/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int,
    payload: TeamUpdateIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    team = _get_or_404(db, Team, team_id, "team not found")
    if payload.name is not None:
        team.name = payload.name
    if payload.source_mapping is not None:
        team.source_mapping = payload.source_mapping.model_dump()
    return _commit(db, team)


@router.delete("/teams/{team_id}", status_code=204)
def delete_team(
    team_id: int,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    team = _get_or_404(db, Team, team_id, "team not found")
    has_facts = db.scalar(
        select(func.count()).select_from(FactRecord).where(FactRecord.team_id == team.id)
    )
    has_maintainers = db.scalar(
        select(func.count()).select_from(User).where(User.maintainer_team_id == team.id)
    )
    if has_facts or has_maintainers:
        raise HTTPException(status_code=409, detail="team is referenced by facts or maintainers")
    db.delete(team)
    db.commit()


@router.post("/activities", response_model=ActivityOut, status_code=201)
def create_activity(
    payload: ActivityIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    sort_order = int(db.scalar(select(func.max(Activity.sort_order))) or -1) + 1
    activity = Activity(**payload.model_dump(), sort_order=sort_order)
    db.add(activity)
    return _commit(db, activity)


@router.patch("/activities/{activity_id}", response_model=ActivityOut)
def update_activity(
    activity_id: int,
    payload: ActivityUpdateIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    activity = _get_or_404(db, Activity, activity_id, "activity not found")
    changes = payload.model_dump(exclude_unset=True)
    if "kind" in changes and changes["kind"] != activity.kind:
        fact_count = db.scalar(
            select(func.count())
            .select_from(FactRecord)
            .join(Metric)
            .where(Metric.activity_id == activity.id)
        )
        if fact_count:
            raise HTTPException(status_code=409, detail="cannot change an activity kind with facts")
    for field, value in changes.items():
        setattr(activity, field, value)
    return _commit(db, activity)


@router.delete("/activities/{activity_id}", status_code=204)
def delete_activity(
    activity_id: int,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    activity = _get_or_404(db, Activity, activity_id, "activity not found")
    metric_count = db.scalar(
        select(func.count()).select_from(Metric).where(Metric.activity_id == activity.id)
    )
    if metric_count:
        raise HTTPException(status_code=409, detail="activity still has metrics")
    db.delete(activity)
    db.commit()


@router.post("/metrics", response_model=MetricOut, status_code=201)
def create_metric(
    payload: MetricIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    _get_or_404(db, Activity, payload.activity_id, "activity not found")
    sort_order = int(
        db.scalar(select(func.max(Metric.sort_order)).where(Metric.activity_id == payload.activity_id))
        or -1
    ) + 1
    metric = Metric(**payload.model_dump(), sort_order=sort_order)
    db.add(metric)
    return _commit(db, metric)


@router.patch("/metrics/{metric_id}", response_model=MetricOut)
def update_metric(
    metric_id: int,
    payload: MetricUpdateIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    metric = _get_or_404(db, Metric, metric_id, "metric not found")
    changes = payload.model_dump(exclude_unset=True)
    if "activity_id" in changes:
        _get_or_404(db, Activity, changes["activity_id"], "activity not found")
        if changes["activity_id"] != metric.activity_id:
            fact_count = db.scalar(
                select(func.count()).select_from(FactRecord).where(FactRecord.metric_id == metric.id)
            )
            if fact_count:
                raise HTTPException(status_code=409, detail="cannot move a metric with facts")
    for field, value in changes.items():
        setattr(metric, field, value)
    return _commit(db, metric)


@router.delete("/metrics/{metric_id}", status_code=204)
def delete_metric(
    metric_id: int,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    metric = _get_or_404(db, Metric, metric_id, "metric not found")
    fact_count = db.scalar(
        select(func.count()).select_from(FactRecord).where(FactRecord.metric_id == metric.id)
    )
    if fact_count:
        raise HTTPException(status_code=409, detail="metric is referenced by facts")
    db.delete(metric)
    db.commit()


@router.post("/users", response_model=AuthUserOut, status_code=201)
def create_user(
    payload: UserIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    _validate_user_assignment(db, payload.role, payload.maintainer_team_id)
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
        maintainer_team_id=payload.maintainer_team_id,
    )
    db.add(user)
    return _commit(db, user)


@router.patch("/users/{user_id}", response_model=AuthUserOut)
def update_user(
    user_id: int,
    payload: UserUpdateIn,
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = _get_or_404(db, User, user_id, "user not found")
    next_role = payload.role or UserRole(user.role)
    next_team_id = (
        payload.maintainer_team_id
        if "maintainer_team_id" in payload.model_fields_set
        else user.maintainer_team_id
    )
    _validate_user_assignment(db, next_role, next_team_id)
    if user.role == UserRole.ADMIN.value and next_role != UserRole.ADMIN:
        admin_count = db.scalar(
            select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)
        )
        if admin_count <= 1:
            raise HTTPException(status_code=409, detail="cannot demote the last admin")
    user.role = next_role.value
    user.maintainer_team_id = next_team_id
    return _commit(db, user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = _get_or_404(db, User, user_id, "user not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=409, detail="cannot delete the current user")
    if user.role == UserRole.ADMIN.value:
        admin_count = db.scalar(
            select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)
        )
        if admin_count <= 1:
            raise HTTPException(status_code=409, detail="cannot delete the last admin")
    db.delete(user)
    db.commit()


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


@router.get("/compute", response_model=ComputeOut)
def compute_metric(
    metric_id: int = Query(ge=1),
    team_id: list[int] | None = Query(default=None),
    iteration_id: list[int] | None = Query(default=None),
    version_id: str | None = Query(default=None, pattern="^(all|[1-9][0-9]*)$"),
    dim: str = Query(default="time", pattern="^(time|iteration|iter)$"),
    gran: str = Query(default="week", pattern="^(week|month)$"),
    time_field: str = Query(default="end_date", pattern="^(start_date|end_date)$"),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回一个目录指标在当前切片下的图表序列。

    team_id 和 iteration_id 可重复传入；不传 team_id 时返回全部团队曲线，
    全公司均值始终基于全部团队计算。通用研发能力不接受迭代维度，前端应切换
    到时间/月路径展示其固定时间趋势。
    """

    metric = db.scalar(
        select(Metric)
        .options(joinedload(Metric.activity))
        .where(Metric.id == metric_id)
    )
    if metric is None:
        raise HTTPException(status_code=404, detail="metric not found")

    teams = db.scalars(select(Team).order_by(Team.id)).all()
    team_by_id = {team.id: team for team in teams}
    selected_team_ids = None if team_id is None else list(dict.fromkeys(team_id))
    if selected_team_ids is not None:
        if any(item < 1 for item in selected_team_ids):
            raise HTTPException(status_code=422, detail="team_id must be positive")
        unknown_team_ids = [item for item in selected_team_ids if item not in team_by_id]
        if unknown_team_ids:
            raise HTTPException(status_code=404, detail="team not found")

    resolved_version_id = None if version_id in (None, "all") else int(version_id)
    if resolved_version_id is not None and db.get(ProductVersion, resolved_version_id) is None:
        raise HTTPException(status_code=404, detail="version not found")

    iterations = db.scalars(
        select(Iteration)
        .options(joinedload(Iteration.version))
        .join(ProductVersion)
        .order_by(ProductVersion.sort_order, Iteration.sort_order, Iteration.id)
    ).all()
    if iteration_id is not None:
        if any(item < 1 for item in iteration_id):
            raise HTTPException(status_code=422, detail="iteration_id must be positive")
        known_iteration_ids = {iteration.id for iteration in iterations}
        unknown_iteration_ids = [item for item in iteration_id if item not in known_iteration_ids]
        if unknown_iteration_ids:
            raise HTTPException(status_code=404, detail="iteration not found")

    facts = db.scalars(
        select(FactRecord)
        .where(FactRecord.metric_id == metric_id)
        .order_by(FactRecord.id)
    ).all()

    try:
        result = build_series(
            facts=facts,
            metric_type=metric.type,
            activity_kind=metric.activity.kind,
            teams=teams,
            iterations=iterations,
            dimension=dim,
            granularity=gran,
            version_id=resolved_version_id,
            iteration_ids=iteration_id,
            team_ids=selected_team_ids,
            company_team_ids=[team.id for team in teams],
            time_field=time_field,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "metric_id": metric.id,
        "activity_id": metric.activity_id,
        "dimension": "iteration" if dim == "iter" else dim,
        "granularity": gran,
        "time_field": time_field,
        **result,
    }


@router.post("/facts", response_model=FactRecordOut, status_code=201)
def create_manual_fact(
    payload: ManualFactIn,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MAINTAINER)),
    db: Session = Depends(get_db),
):
    """追加一条人工事实记录；修正不覆盖历史行。"""

    team = _get_or_404(db, Team, payload.team_id, "team not found")
    if (
        current_user.role == UserRole.MAINTAINER.value
        and current_user.maintainer_team_id != team.id
    ):
        raise HTTPException(status_code=403, detail="team access denied")

    metric = db.scalar(
        select(Metric)
        .options(joinedload(Metric.activity))
        .where(Metric.id == payload.metric_id)
    )
    if metric is None:
        raise HTTPException(status_code=404, detail="metric not found")

    if metric.activity.kind == "key":
        if payload.iteration_id is None:
            raise HTTPException(status_code=422, detail="key activity requires iteration_id")
        if payload.start_date is not None or payload.end_date is not None:
            raise HTTPException(
                status_code=422,
                detail="key activity dates are taken from the iteration",
            )
        iteration = _get_or_404(db, Iteration, payload.iteration_id, "iteration not found")
        start_date = iteration.start_date
        end_date = iteration.end_date
    else:
        if payload.iteration_id is not None:
            raise HTTPException(
                status_code=422,
                detail="general activity cannot have iteration_id",
            )
        if payload.start_date is None or payload.end_date is None:
            raise HTTPException(
                status_code=422,
                detail="general activity requires start_date and end_date",
            )
        if payload.start_date > payload.end_date:
            raise HTTPException(status_code=422, detail="start_date must not be after end_date")
        start_date = payload.start_date
        end_date = payload.end_date

    if metric.denominator_semantic is None and payload.denominator is not None:
        raise HTTPException(status_code=422, detail="metric does not accept a denominator")
    if metric.denominator_semantic is not None and payload.denominator is None:
        raise HTTPException(status_code=422, detail="metric requires a denominator")
    if metric.type == "boolean" and payload.numerator not in (0, 1):
        raise HTTPException(status_code=422, detail="boolean metric numerator must be 0 or 1")

    fact = FactRecord(
        team_id=team.id,
        metric_id=metric.id,
        iteration_id=payload.iteration_id,
        numerator=payload.numerator,
        denominator=payload.denominator,
        start_date=start_date,
        end_date=end_date,
        source=FactSource.MANUAL.value,
        entered_by=current_user.username,
        entered_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(fact)
    return _commit(db, fact)


@router.get("/facts", response_model=list[FactRecordOut])
def list_facts(
    team_id: int | None = None,
    metric_id: int | None = None,
    iteration_id: int | None = None,
    source: str | None = Query(None, pattern="^(manual|auto)$"),
    start_date: date | None = None,
    end_date: date | None = None,
    history: bool = False,
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
    if start_date is not None:
        stmt = stmt.where(FactRecord.start_date == start_date)
    if end_date is not None:
        stmt = stmt.where(FactRecord.end_date == end_date)
    facts = db.scalars(stmt).all()
    if not history:
        facts = select_current_facts(facts, source=source)
    return facts[:limit]


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
