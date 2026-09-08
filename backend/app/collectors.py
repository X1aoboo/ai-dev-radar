"""采集器公共接口与进程内注册表。

采集器只知道数据源映射和时间窗口，不感知 CLI、MCP、API 或数据库会话。
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class CollectionWindow:
    """一次批量采集覆盖的闭区间日期窗口。"""

    start_date: date
    end_date: date

    def __post_init__(self) -> None:
        if self.start_date > self.end_date:
            raise ValueError("collection window start_date must not be after end_date")


@dataclass(frozen=True, slots=True)
class CollectedFact:
    """采集器产出的事实记录草稿，不携带数据库生成字段。"""

    metric_code: str
    numerator: float | None
    denominator: float | None
    start_date: date
    end_date: date
    iteration_id: int | None = None

    def __post_init__(self) -> None:
        if not self.metric_code:
            raise ValueError("collected fact metric_code must not be empty")
        if self.start_date > self.end_date:
            raise ValueError("collected fact start_date must not be after end_date")


class Collector(Protocol):
    """平台适配器必须实现的最小接口。"""

    def collect(
        self,
        source_mapping: Mapping[str, Any],
        window: CollectionWindow,
    ) -> Iterable[CollectedFact]:
        """按团队数据源映射和时间窗口返回事实记录草稿。"""


@dataclass(frozen=True, slots=True)
class CollectorRegistration:
    collector: Collector
    metric_codes: frozenset[str]
    activity_codes: frozenset[str]

    def matches(self, *, metric_code: str, activity_code: str) -> bool:
        return metric_code in self.metric_codes or activity_code in self.activity_codes


def _normalize_codes(codes: Iterable[str] | str) -> frozenset[str]:
    if isinstance(codes, str):
        codes = (codes,)
    normalized = frozenset(code for code in codes if code)
    return normalized


class CollectorRegistry:
    """采集器绑定表；注册只存在于当前进程，不落库。"""

    def __init__(self) -> None:
        self._registrations: list[CollectorRegistration] = []

    def register(
        self,
        collector: Collector,
        *,
        metric_codes: Iterable[str] | str = (),
        activity_codes: Iterable[str] | str = (),
    ) -> None:
        normalized_metric_codes = _normalize_codes(metric_codes)
        normalized_activity_codes = _normalize_codes(activity_codes)
        if not normalized_metric_codes and not normalized_activity_codes:
            raise ValueError("collector registration requires a metric or activity code")

        registration = CollectorRegistration(
            collector=collector,
            metric_codes=normalized_metric_codes,
            activity_codes=normalized_activity_codes,
        )
        if registration in self._registrations:
            raise ValueError("collector registration already exists")
        self._registrations.append(registration)

    @property
    def registrations(self) -> tuple[CollectorRegistration, ...]:
        return tuple(self._registrations)
