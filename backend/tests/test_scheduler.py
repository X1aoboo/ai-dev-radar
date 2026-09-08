"""APScheduler 配置 seam 测试。"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.collectors import CollectorRegistry
from app.scheduler import COLLECTION_TIMEZONE, create_scheduler


def test_scheduler_configures_daily_collection_at_local_two_am():
    scheduler = create_scheduler(CollectorRegistry())
    scheduler.start(paused=True)
    try:
        job = scheduler.get_job("daily-collection")
        assert job is not None
        assert job.name == "daily fact collection"

        now = datetime(2026, 9, 8, 1, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
        assert job.trigger.get_next_fire_time(None, now) == datetime(
            2026, 9, 8, 2, 0, tzinfo=COLLECTION_TIMEZONE
        )
    finally:
        scheduler.shutdown(wait=False)


def test_scheduler_accepts_a_cron_expression_for_deployment_configuration():
    scheduler = create_scheduler(CollectorRegistry(), cron="15 4 * * *")
    scheduler.start(paused=True)
    try:
        job = scheduler.get_job("daily-collection")
        now = datetime(2026, 9, 8, 1, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
        assert job.trigger.get_next_fire_time(None, now) == datetime(
            2026, 9, 8, 4, 15, tzinfo=COLLECTION_TIMEZONE
        )
    finally:
        scheduler.shutdown(wait=False)
