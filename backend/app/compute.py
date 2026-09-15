"""事实记录的纯函数计算层。

数据库查询和 HTTP 参数解析留在调用方；本模块只接收事实记录与维度元数据，
负责周期切分、分子/分母聚合和指标值计算。这样总览页、下钻页以及测试都共享
同一套口径。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, Literal, Sequence
from zoneinfo import ZoneInfo


Dimension = Literal["time", "iteration"]
Granularity = Literal["week", "month"]
TimeField = Literal["start_date", "end_date"]

_LOCAL_ZONE = ZoneInfo("Asia/Shanghai")
_VALID_METRIC_TYPES = {"penetration", "efficiency", "count", "boolean", "ratio"}


@dataclass(frozen=True, slots=True)
class MetricSums:
    """一个计算切片内的原始数汇总。

    效率提升指标沿用事实记录的存储约定：numerator 是预估人天，
    denominator 是实际人天。
    """

    numerator: float = 0.0
    denominator: float = 0.0


def _enum_value(value: Any) -> Any:
    return getattr(value, "value", value)


def _normalise_dimension(dimension: str) -> Dimension:
    value = _enum_value(dimension)
    if value == "iter":
        value = "iteration"
    if value not in {"time", "iteration"}:
        raise ValueError("dimension must be 'time' or 'iteration'")
    return value  # type: ignore[return-value]


def _normalise_granularity(granularity: str) -> Granularity:
    value = _enum_value(granularity)
    if value not in {"week", "month"}:
        raise ValueError("granularity must be 'week' or 'month'")
    return value  # type: ignore[return-value]


def _normalise_time_field(time_field: str) -> TimeField:
    value = _enum_value(time_field)
    if value not in {"start_date", "end_date"}:
        raise ValueError("time_field must be 'start_date' or 'end_date'")
    return value  # type: ignore[return-value]


def _as_local_date(value: date | datetime | str) -> date:
    """将 date/datetime 统一为 Asia/Shanghai 下的日期。

    当前 ORM 字段是 date；支持 datetime 是为了让纯计算 seam 对采集器输入保持
    宽容，并明确处理 UTC 时间跨本地日期的情况。
    """

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.date()
        return value.astimezone(_LOCAL_ZONE).date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError("fact dates must be date, datetime, or ISO date strings")


def _fact_date(fact: Any, time_field: TimeField) -> date:
    value = getattr(fact, time_field, None)
    if value is None:
        raise ValueError(f"fact is missing {time_field}")
    return _as_local_date(value)


def _period_date(period: dict[str, Any], field: str) -> date:
    value = period.get(field)
    if value is None:
        raise ValueError(f"period is missing {field}")
    return _as_local_date(value)


def _week_period(monday: date) -> dict[str, Any]:
    iso = monday.isocalendar()
    period_id = f"{iso.year}-W{iso.week:02d}"
    return {
        "id": period_id,
        "label": period_id,
        "kind": "week",
        "start_date": monday,
        "end_date": monday + timedelta(days=6),
    }


def _month_period(first_day: date) -> dict[str, Any]:
    if first_day.month == 12:
        next_month = date(first_day.year + 1, 1, 1)
    else:
        next_month = date(first_day.year, first_day.month + 1, 1)
    last_day = next_month - timedelta(days=1)
    period_id = f"{first_day.year}-{first_day.month:02d}"
    return {
        "id": period_id,
        "label": period_id,
        "kind": "month",
        "start_date": first_day,
        "end_date": last_day,
    }


def _next_month(first_day: date) -> date:
    if first_day.month == 12:
        return date(first_day.year + 1, 1, 1)
    return date(first_day.year, first_day.month + 1, 1)


def _iteration_value(iteration: Any, field: str, default: Any = None) -> Any:
    value = getattr(iteration, field, None)
    if value is not None:
        return value
    mapping = iteration if isinstance(iteration, dict) else None
    if mapping is not None and field in mapping:
        return mapping[field]
    if field == "version_sort_order":
        version = getattr(iteration, "version", None)
        if version is None and mapping is not None:
            version = mapping.get("version")
        if version is not None:
            nested_value = getattr(version, "sort_order", None)
            if nested_value is None and isinstance(version, dict):
                nested_value = version.get("sort_order")
            if nested_value is not None:
                return nested_value
    return default


def periods_for(
    facts: Iterable[Any],
    *,
    dimension: Dimension | str,
    granularity: Granularity | str = "week",
    iterations: Iterable[Any] = (),
    version_id: int | str | None = None,
    iteration_ids: Sequence[int | str] | None = None,
    time_field: TimeField | str = "end_date",
) -> list[dict[str, Any]]:
    """返回当前维度下有序的周期定义。

    时间周期覆盖输入事实的最小到最大日期，包含中间没有事实的空周期；迭代周期
    来自目录元数据，因此即使某个迭代暂时没有事实也会保留在序列中。
    """

    resolved_dimension = _normalise_dimension(dimension)
    resolved_time_field = _normalise_time_field(time_field)

    if resolved_dimension == "time":
        resolved_granularity = _normalise_granularity(granularity)
        fact_list = list(facts)
        if not fact_list:
            return []
        dates = [_fact_date(fact, resolved_time_field) for fact in fact_list]
        first_date = min(dates)
        last_date = max(dates)

        if resolved_granularity == "week":
            current = first_date - timedelta(days=first_date.weekday())
            last_monday = last_date - timedelta(days=last_date.weekday())
            periods = []
            while current <= last_monday:
                periods.append(_week_period(current))
                current += timedelta(days=7)
            return periods

        current = first_date.replace(day=1)
        last_month = last_date.replace(day=1)
        periods = []
        while current <= last_month:
            periods.append(_month_period(current))
            current = _next_month(current)
        return periods

    selected_iteration_ids = None if iteration_ids is None else set(iteration_ids)
    selected = []
    for item in iterations:
        item_id = _iteration_value(item, "id")
        item_version_id = _iteration_value(item, "version_id")
        if (
            version_id is not None
            and str(version_id) != "all"
            and str(item_version_id) != str(version_id)
        ):
            continue
        if (
            selected_iteration_ids is not None
            and not any(str(item_id) == str(selected_id) for selected_id in selected_iteration_ids)
        ):
            continue
        selected.append(item)

    def sort_key(item: Any) -> tuple[Any, ...]:
        version_sort = _iteration_value(item, "version_sort_order", 0)
        return (
            version_sort,
            _iteration_value(item, "sort_order", 0),
            str(_iteration_value(item, "id", "")),
        )

    periods = []
    for item in sorted(selected, key=sort_key):
        item_id = _iteration_value(item, "id")
        start_date = _iteration_value(item, "start_date")
        end_date = _iteration_value(item, "end_date")
        periods.append({
            "id": item_id,
            "label": _iteration_value(item, "name", str(item_id)),
            "kind": "iteration",
            "iteration_id": item_id,
            "start_date": _as_local_date(start_date) if start_date is not None else None,
            "end_date": _as_local_date(end_date) if end_date is not None else None,
        })
    return periods


def in_scope(
    fact: Any,
    period: dict[str, Any] | None,
    *,
    dimension: Dimension | str,
    time_field: TimeField | str = "end_date",
) -> bool:
    """判断事实记录是否落入某个周期。

    迭代视图按事实记录的 iteration_id 归属，不按日期重新切分；时间视图按指定
    时间字段落在周期的闭区间内。period=None 表示当前筛选下的全部周期。
    """

    resolved_dimension = _normalise_dimension(dimension)
    if period is None:
        return True
    if resolved_dimension == "iteration":
        iteration_id = period.get("iteration_id", period.get("id"))
        return getattr(fact, "iteration_id", None) == iteration_id

    resolved_time_field = _normalise_time_field(time_field)
    value = _fact_date(fact, resolved_time_field)
    return _period_date(period, "start_date") <= value <= _period_date(period, "end_date")


def calculate_metric_value(metric_type: str, sums: MetricSums) -> float | bool | None:
    """按指标目录类型把一个切片的原始数汇总转换为展示值。"""

    resolved_type = _enum_value(metric_type)
    if resolved_type not in _VALID_METRIC_TYPES:
        raise ValueError(f"unsupported metric type: {resolved_type}")

    if resolved_type in {"penetration", "ratio"}:
        return sums.numerator / sums.denominator if sums.denominator > 0 else None
    if resolved_type == "efficiency":
        if sums.numerator == 0 and sums.denominator == 0:
            return None
        divisor = sums.denominator if sums.denominator > 0 else 0.5
        return (sums.numerator - sums.denominator) / divisor
    if resolved_type == "count":
        return sums.numerator
    return bool(sums.numerator)


def _number(value: Any) -> float:
    return 0.0 if value is None else float(value)


def _sum_facts(facts: Iterable[Any]) -> MetricSums:
    numerator = 0.0
    denominator = 0.0
    for fact in facts:
        numerator += _number(getattr(fact, "numerator", None))
        denominator += _number(getattr(fact, "denominator", None))
    return MetricSums(numerator=numerator, denominator=denominator)


def _fact_order_key(fact: Any) -> tuple[float, int]:
    entered_at = getattr(fact, "entered_at", None)
    if entered_at is None:
        timestamp = float("-inf")
    elif isinstance(entered_at, datetime):
        if entered_at.tzinfo is None:
            entered_at = entered_at.replace(tzinfo=timezone.utc)
        timestamp = entered_at.astimezone(timezone.utc).timestamp()
    else:
        timestamp = float("-inf")
    fact_id = getattr(fact, "id", 0) or 0
    return timestamp, int(fact_id)


def _fact_scope_key(fact: Any) -> tuple[Any, ...]:
    """返回事实记录的逻辑键，不把 manual 修正记录折叠成数据库唯一键。"""

    team_id = getattr(fact, "team_id", None)
    metric_id = getattr(fact, "metric_id", None)
    iteration_id = getattr(fact, "iteration_id", None)
    if iteration_id is not None:
        return ("iteration", team_id, metric_id, iteration_id)
    return (
        "period",
        team_id,
        metric_id,
        _as_local_date(getattr(fact, "start_date")),
        _as_local_date(getattr(fact, "end_date")),
    )


def select_current_facts(
    facts: Iterable[Any],
    *,
    source: str | None = None,
) -> list[Any]:
    """选择每个逻辑键当前生效的事实记录。

    manual 记录表示人工修正，因此只要同键存在 manual，就优先取最新 manual；
    否则取最新 auto。传入 source 时只在该来源内取最新记录，用于历史筛选。
    """

    grouped: dict[tuple[Any, ...], list[Any]] = {}
    for fact in facts:
        fact_source = _enum_value(getattr(fact, "source", None))
        if source is not None and fact_source != _enum_value(source):
            continue
        grouped.setdefault(_fact_scope_key(fact), []).append(fact)

    selected = []
    for candidates in grouped.values():
        if source is None:
            manual = [
                fact
                for fact in candidates
                if _enum_value(getattr(fact, "source", None)) == "manual"
            ]
            candidates = manual or candidates
        selected.append(max(candidates, key=_fact_order_key))
    return sorted(selected, key=lambda fact: int(getattr(fact, "id", 0) or 0))


def _snapshot_value(facts: Iterable[Any]) -> bool | None:
    fact_list = select_current_facts(facts)
    if not fact_list:
        return None
    latest = max(fact_list, key=_fact_order_key)
    numerator = getattr(latest, "numerator", None)
    return None if numerator is None else bool(numerator)


def _team_id(team: Any) -> Any:
    return team.get("id") if isinstance(team, dict) else getattr(team, "id")


def _team_name(team: Any) -> str:
    return team.get("name", str(_team_id(team))) if isinstance(team, dict) else getattr(team, "name")


def _point(period: dict[str, Any], sums: MetricSums, value: float | bool | None) -> dict[str, Any]:
    return {
        "period_id": period["id"],
        "value": value,
        "numerator": sums.numerator,
        "denominator": sums.denominator,
        "estimated": sums.numerator,
        "actual": sums.denominator,
    }


def build_series(
    *,
    facts: Iterable[Any],
    metric_type: str,
    activity_kind: str,
    teams: Sequence[Any],
    iterations: Iterable[Any],
    dimension: Dimension | str,
    granularity: Granularity | str = "week",
    version_id: int | str | None = None,
    iteration_ids: Sequence[int | str] | None = None,
    team_ids: Sequence[int | str] | None = None,
    company_team_ids: Sequence[int | str] | None = None,
    time_field: TimeField | str = "end_date",
) -> dict[str, Any]:
    """组装团队趋势序列和全公司均值序列。

    team_ids 只控制返回哪些团队曲线；company_team_ids 控制全公司均值的分母，
    默认使用传入的全部团队。因此页面可以隐藏团队曲线而不改变全公司对照线。
    全公司均值沿用原型：对每个团队先计算指标值，再对非空团队值取算术平均。
    """

    resolved_dimension = _normalise_dimension(dimension)
    resolved_kind = _enum_value(activity_kind)
    resolved_metric_type = _enum_value(metric_type)
    _normalise_time_field(time_field)
    if resolved_metric_type not in _VALID_METRIC_TYPES:
        raise ValueError(f"unsupported metric type: {resolved_metric_type}")
    if resolved_dimension == "iteration" and resolved_kind == "general":
        raise ValueError("general activity has no iteration dimension")

    fact_list = select_current_facts(facts)
    team_list = list(teams)
    all_team_ids = [_team_id(team) for team in team_list]
    selected_ids = set(all_team_ids if team_ids is None else team_ids)
    company_ids = all_team_ids if company_team_ids is None else list(company_team_ids)
    output_teams = [team for team in team_list if _team_id(team) in selected_ids]

    periods = periods_for(
        fact_list,
        dimension=resolved_dimension,
        granularity=granularity,
        iterations=iterations,
        version_id=version_id,
        iteration_ids=iteration_ids,
        time_field=time_field,
    )

    if resolved_metric_type == "boolean":
        return {
            "periods": periods,
            "series": [
                {
                    "team_id": _team_id(team),
                    "team_name": _team_name(team),
                    "values": [],
                    "snapshot": _snapshot_value(
                        fact for fact in fact_list if getattr(fact, "team_id", None) == _team_id(team)
                    ),
                }
                for team in output_teams
            ],
            "company_average": [],
            "domain_summary": [],
        }

    values_by_team: dict[Any, list[dict[str, Any]]] = {}
    for team in team_list:
        current_team_id = _team_id(team)
        team_facts = [
            fact for fact in fact_list if getattr(fact, "team_id", None) == current_team_id
        ]
        values = []
        for period in periods:
            scoped_facts = [
                fact for fact in team_facts
                if in_scope(fact, period, dimension=resolved_dimension, time_field=time_field)
            ]
            sums = _sum_facts(scoped_facts)
            value = calculate_metric_value(resolved_metric_type, sums)
            values.append(_point(period, sums, value))
        values_by_team[current_team_id] = values

    series = []
    for team in output_teams:
        current_team_id = _team_id(team)
        series.append({
            "team_id": current_team_id,
            "team_name": _team_name(team),
            "values": values_by_team[current_team_id],
        })

    company_average = []
    for index, period in enumerate(periods):
        team_values = [
            values_by_team[current_team_id][index]["value"]
            for current_team_id in company_ids
            if current_team_id in values_by_team
            and isinstance(values_by_team[current_team_id][index]["value"], (int, float))
            and not isinstance(values_by_team[current_team_id][index]["value"], bool)
        ]
        average = sum(team_values) / len(team_values) if team_values else None
        company_average.append({"period_id": period["id"], "value": average})

    # 新总览的领域指标按全部团队的原始分子/分母合并计算；这和上面的
    # company_average（先算团队值、再对团队值取算术平均）刻意保持两种独立语义。
    domain_summary = []
    company_id_set = set(company_ids)
    for period in periods:
        domain_facts = [
            fact for fact in fact_list
            if getattr(fact, "team_id", None) in company_id_set
            and in_scope(fact, period, dimension=resolved_dimension, time_field=time_field)
        ]
        sums = _sum_facts(domain_facts)
        domain_point = _point(
            period,
            sums,
            calculate_metric_value(resolved_metric_type, sums),
        )
        domain_point["fact_count"] = len(domain_facts)
        domain_point["sample_count"] = (
            sums.denominator
            if resolved_metric_type in {"penetration", "ratio"}
            else len(domain_facts)
        )
        domain_summary.append(domain_point)

    return {
        "periods": periods,
        "series": series,
        "company_average": company_average,
        "domain_summary": domain_summary,
    }
