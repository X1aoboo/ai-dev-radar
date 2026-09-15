"""成熟度月度存储的校验和领域聚合。

这个模块是成熟度查询接口和总览页面之间的深模块：HTTP 层只负责权限、持久化
和响应模型，所有分值边界、等级和缺失语义在这里保持一致。
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_FLOOR, ROUND_HALF_UP
from typing import Any, Iterable, Sequence


SCORE_QUANTUM = Decimal("0.01")
SCORE_MIN = Decimal("0")
SCORE_MAX = Decimal("5")
LEVEL_LABELS = (
    "L0 未建设",
    "L1 建设中",
    "L2 试点中",
    "L3 推广中",
    "L4 规模使用",
    "L5 成熟运营",
)


def normalise_month(value: str | date | datetime) -> date:
    """把 YYYY-MM 或当月日期规范化成该月第一天。"""

    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.replace(day=1)
    if not isinstance(value, str):
        raise ValueError("assessment month must use YYYY-MM")
    try:
        parsed = date.fromisoformat(f"{value}-01")
    except ValueError as exc:
        raise ValueError("assessment month must use YYYY-MM") from exc
    if len(value) != 7:
        raise ValueError("assessment month must use YYYY-MM")
    return parsed


def month_label(value: str | date | datetime) -> str:
    return normalise_month(value).strftime("%Y-%m")


def parse_score(value: Any) -> Decimal:
    """校验并规范化一个 0..5、最多两位小数的成熟度分值。"""

    if isinstance(value, bool) or value is None:
        raise ValueError("score must be a finite decimal between 0 and 5")
    try:
        score = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("score must be a finite decimal between 0 and 5") from exc
    if not score.is_finite() or score < SCORE_MIN or score > SCORE_MAX:
        raise ValueError("score must be between 0 and 5")
    if score.as_tuple().exponent < -2:
        raise ValueError("score supports at most two decimal places")
    return score.quantize(SCORE_QUANTUM)


def score_text(value: Any) -> str:
    return format(parse_score(value), ".2f")


def grade_for_score(value: Any) -> int:
    """等级只取未四舍五入分值的 floor。"""

    score = value if isinstance(value, Decimal) else parse_score(value)
    return int(score.to_integral_value(rounding=ROUND_FLOOR))


def level_label(grade: int | None) -> str | None:
    if grade is None:
        return None
    if grade < 0 or grade >= len(LEVEL_LABELS):
        raise ValueError("grade must be between 0 and 5")
    return LEVEL_LABELS[grade]


def _field(item: Any, name: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def _value(value: Any) -> Any:
    return getattr(value, "value", value)


def _record_score(record: Any) -> Decimal:
    return parse_score(_field(record, "score_decimal", _field(record, "score")))


def _score_payload(score: Decimal | None) -> dict[str, Any]:
    if score is None:
        return {
            "score": None,
            "score_raw": None,
            "score_display": None,
            "grade": None,
            "level": None,
        }
    grade = grade_for_score(score)
    display_score = score.quantize(SCORE_QUANTUM, rounding=ROUND_HALF_UP)
    return {
        "score": float(score),
        "score_raw": format(score, "f"),
        "score_display": format(display_score, ".2f"),
        "grade": grade,
        "level": level_label(grade),
    }


def _record_payload(record: Any, *, activity: Any | None = None) -> dict[str, Any]:
    record_activity = activity or _field(record, "activity")
    score = _record_score(record)
    return {
        "id": _field(record, "id"),
        "team_id": _field(record, "team_id"),
        "activity_id": _field(record, "activity_id"),
        "activity_code": _field(record_activity, "code"),
        "activity_name": _field(record_activity, "name"),
        "kind": _value(_field(record_activity, "kind")),
        "month": month_label(_field(record, "assessment_month")),
        **_score_payload(score),
        "note": _field(record, "note"),
        "maintained_by": _field(record, "maintained_by"),
        "updated_at": _field(record, "updated_at"),
    }


def build_maturity_overview(
    *,
    teams: Sequence[Any],
    activities: Sequence[Any],
    records: Iterable[Any],
    month: str | date | datetime,
    kind: str,
) -> dict[str, Any]:
    """为一个分类和月份生成完整矩阵及领域聚合。

    缺失单元保留在矩阵中但不进入平均；真实 0 仍是已评估值。领域平均使用
    Decimal 的未舍入结果计算等级，展示值才单独做两位小数的 half-up 格式化。
    """

    assessment_month = normalise_month(month)
    selected_activities = [
        activity for activity in activities if _value(_field(activity, "kind")) == _value(kind)
    ]
    selected_activities.sort(key=lambda item: (_field(item, "sort_order", 0), _field(item, "id", 0)))
    selected_teams = list(teams)
    selected_teams.sort(key=lambda item: (_field(item, "id", 0), _field(item, "name", "")))
    activity_by_id = {_field(activity, "id"): activity for activity in selected_activities}
    records_by_key: dict[tuple[Any, Any], Any] = {}
    for record in records:
        record_month = _field(record, "assessment_month")
        if record_month is not None and normalise_month(record_month) != assessment_month:
            continue
        activity_id = _field(record, "activity_id")
        if activity_id in activity_by_id:
            records_by_key[(_field(record, "team_id"), activity_id)] = record

    summaries: list[dict[str, Any]] = []
    averages: dict[Any, Decimal | None] = {}
    for activity in selected_activities:
        activity_id = _field(activity, "id")
        assessed_records = [
            record for (team_id, current_activity_id), record in records_by_key.items()
            if current_activity_id == activity_id and team_id in {
                _field(team, "id") for team in selected_teams
            }
        ]
        scores = [_record_score(record) for record in assessed_records]
        average = sum(scores, Decimal("0")) / Decimal(len(scores)) if scores else None
        averages[activity_id] = average
        distribution = {f"L{index}": 0 for index in range(6)}
        for score in scores:
            distribution[f"L{grade_for_score(score)}"] += 1
        summary = {
            "activity_id": activity_id,
            "activity_code": _field(activity, "code"),
            "activity_name": _field(activity, "name"),
            "kind": _value(_field(activity, "kind")),
            "assessed_team_count": len(scores),
            "grade_distribution": distribution,
            "order": _field(activity, "sort_order", 0),
            "average_raw": format(average, "f") if average is not None else None,
            **_score_payload(average),
        }
        summaries.append(summary)

    team_rows: list[dict[str, Any]] = []
    for team in selected_teams:
        team_id = _field(team, "id")
        cells = []
        for activity in selected_activities:
            record = records_by_key.get((team_id, _field(activity, "id")))
            cell = {
                "activity_id": _field(activity, "id"),
                "activity_code": _field(activity, "code"),
                "activity_name": _field(activity, "name"),
                "kind": _value(_field(activity, "kind")),
                "record_id": _field(record, "id") if record else None,
                **_score_payload(_record_score(record) if record else None),
                "note": _field(record, "note") if record else None,
                "maintained_by": _field(record, "maintained_by") if record else None,
                "updated_at": _field(record, "updated_at") if record else None,
            }
            cells.append(cell)
        team_rows.append({"team_id": team_id, "team_name": _field(team, "name"), "cells": cells})

    assessed_cells = sum(summary["assessed_team_count"] for summary in summaries)
    total_cells = len(selected_teams) * len(selected_activities)
    populated = [summary for summary in summaries if summary["score"] is not None]
    highest = max((averages[summary["activity_id"]] for summary in populated), default=None)
    lowest = min((averages[summary["activity_id"]] for summary in populated), default=None)

    return {
        "month": month_label(assessment_month),
        "kind": kind,
        "team_count": len(selected_teams),
        "assessed_cell_count": assessed_cells,
        "total_cell_count": total_cells,
        "coverage_rate": assessed_cells / total_cells if total_cells else 0,
        "activities": summaries,
        "teams": team_rows,
        "strength_activity_ids": [
            summary["activity_id"] for summary in populated if averages[summary["activity_id"]] == highest
        ],
        "weakness_activity_ids": [
            summary["activity_id"] for summary in populated if averages[summary["activity_id"]] == lowest
        ],
        "level_labels": list(LEVEL_LABELS),
    }


def record_payload(record: Any, *, activity: Any | None = None) -> dict[str, Any]:
    """公开原始成熟度记录的响应形态，供 records/save 接口共用。"""

    return _record_payload(record, activity=activity)
