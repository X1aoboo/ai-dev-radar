"""每日采集任务与事实记录持久化。"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, sessionmaker

from .collectors import CollectedFact, CollectionWindow, CollectorRegistry
from .db import SessionLocal
from .models import ActivityKind, CollectMethod, FactRecord, FactSource, Metric, Team


LOGGER = logging.getLogger(__name__)
COLLECTION_TIMEZONE = ZoneInfo("Asia/Shanghai")
DAILY_COLLECTION_HOUR = 2
SCHEDULED_ACTOR = "scheduled-collector"
SessionFactory = Callable[[], Session]


@dataclass(frozen=True, slots=True)
class CollectionSummary:
    window: CollectionWindow
    registrations_seen: int
    registrations_run: int
    teams_processed: int
    facts_written: int
    facts_updated: int
    facts_skipped_manual: int


def daily_collection_window(
    run_date: date | None = None,
    *,
    timezone: ZoneInfo = COLLECTION_TIMEZONE,
) -> CollectionWindow:
    """返回本地日历日的前一天，作为每日批量采集窗口。"""

    today = run_date or datetime.now(timezone).date()
    collection_date = today - timedelta(days=1)
    return CollectionWindow(collection_date, collection_date)


def _existing_fact(
    db: Session,
    *,
    team_id: int,
    metric_id: int,
    collected_fact: CollectedFact,
) -> FactRecord | None:
    conditions = [
        FactRecord.team_id == team_id,
        FactRecord.metric_id == metric_id,
    ]
    if collected_fact.iteration_id is None:
        conditions.extend([
            FactRecord.iteration_id.is_(None),
            FactRecord.start_date == collected_fact.start_date,
            FactRecord.end_date == collected_fact.end_date,
        ])
    else:
        conditions.append(FactRecord.iteration_id == collected_fact.iteration_id)

    return db.scalars(
        select(FactRecord)
        .where(*conditions)
        .order_by(FactRecord.id.desc())
    ).first()


def _save_fact(
    db: Session,
    *,
    team: Team,
    metric: Metric,
    collected_fact: CollectedFact,
) -> str:
    existing = _existing_fact(
        db,
        team_id=team.id,
        metric_id=metric.id,
        collected_fact=collected_fact,
    )
    if existing is not None:
        if existing.source == FactSource.MANUAL.value:
            return "skipped_manual"
        existing.numerator = collected_fact.numerator
        existing.denominator = collected_fact.denominator
        existing.start_date = collected_fact.start_date
        existing.end_date = collected_fact.end_date
        existing.entered_at = datetime.now(timezone.utc).replace(tzinfo=None)
        return "updated"

    db.add(
        FactRecord(
            team_id=team.id,
            metric_id=metric.id,
            iteration_id=collected_fact.iteration_id,
            numerator=collected_fact.numerator,
            denominator=collected_fact.denominator,
            start_date=collected_fact.start_date,
            end_date=collected_fact.end_date,
            source=FactSource.AUTO.value,
            entered_by=SCHEDULED_ACTOR,
        )
    )
    db.flush()
    return "written"


def run_daily_collection(
    db: Session,
    registry: CollectorRegistry,
    *,
    run_date: date | None = None,
) -> CollectionSummary:
    """运行一次批量采集；仅目录中标记为自动的指标会触发 collector。"""

    window = daily_collection_window(run_date)
    registrations = registry.registrations
    metrics = db.scalars(
        select(Metric)
        .options(joinedload(Metric.activity))
        .where(Metric.collect_method == CollectMethod.AUTO.value)
        .order_by(Metric.id)
    ).all()
    metrics_by_code = {metric.code: metric for metric in metrics}
    eligible = tuple(
        registration
        for registration in registrations
        if any(
            registration.matches(
                metric_code=metric.code,
                activity_code=metric.activity.code,
            )
            for metric in metrics
        )
    )

    if not eligible:
        LOGGER.info("daily collection skipped: no automatic metrics are configured")
        return CollectionSummary(
            window=window,
            registrations_seen=len(registrations),
            registrations_run=0,
            teams_processed=0,
            facts_written=0,
            facts_updated=0,
            facts_skipped_manual=0,
        )

    teams = db.scalars(select(Team).order_by(Team.id)).all()
    facts_written = 0
    facts_updated = 0
    facts_skipped_manual = 0

    for registration in eligible:
        for team in teams:
            for collected_fact in registration.collector.collect(team.source_mapping, window):
                metric = metrics_by_code.get(collected_fact.metric_code)
                if metric is None:
                    LOGGER.warning(
                        "collector returned a non-automatic metric: %s",
                        collected_fact.metric_code,
                    )
                    continue
                if not registration.matches(
                    metric_code=metric.code,
                    activity_code=metric.activity.code,
                ):
                    LOGGER.warning(
                        "collector returned an unregistered metric: %s",
                        collected_fact.metric_code,
                    )
                    continue
                if metric.activity.kind == ActivityKind.KEY.value and collected_fact.iteration_id is None:
                    raise ValueError(
                        f"key activity metric {metric.code} requires iteration_id"
                    )
                if (
                    metric.activity.kind == ActivityKind.GENERAL.value
                    and collected_fact.iteration_id is not None
                ):
                    raise ValueError(
                        f"general activity metric {metric.code} cannot have iteration_id"
                    )

                result = _save_fact(
                    db,
                    team=team,
                    metric=metric,
                    collected_fact=collected_fact,
                )
                if result == "written":
                    facts_written += 1
                elif result == "updated":
                    facts_updated += 1
                else:
                    facts_skipped_manual += 1

    db.commit()
    LOGGER.info(
        "daily collection completed: registrations=%d teams=%d written=%d updated=%d skipped_manual=%d",
        len(eligible),
        len(teams),
        facts_written,
        facts_updated,
        facts_skipped_manual,
    )
    return CollectionSummary(
        window=window,
        registrations_seen=len(registrations),
        registrations_run=len(eligible),
        teams_processed=len(teams),
        facts_written=facts_written,
        facts_updated=facts_updated,
        facts_skipped_manual=facts_skipped_manual,
    )


def scheduled_collection_job(
    registry: CollectorRegistry,
    session_factory: SessionFactory = SessionLocal,
) -> CollectionSummary:
    """APScheduler 调用的同步包装：每次任务使用独立数据库会话。"""

    with session_factory() as db:
        return run_daily_collection(db, registry)


def create_scheduler(
    registry: CollectorRegistry,
    session_factory: SessionFactory = SessionLocal,
    *,
    hour: int = DAILY_COLLECTION_HOUR,
    minute: int = 0,
    timezone: ZoneInfo = COLLECTION_TIMEZONE,
) -> BackgroundScheduler:
    """创建已配置但尚未启动的每日批量采集 scheduler。"""

    scheduler = BackgroundScheduler(timezone=timezone)
    scheduler.add_job(
        scheduled_collection_job,
        trigger="cron",
        hour=hour,
        minute=minute,
        timezone=timezone,
        args=[registry, session_factory],
        id="daily-collection",
        name="daily fact collection",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    return scheduler
