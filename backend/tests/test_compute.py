"""计算层的公开纯函数 seam 测试。"""

from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.compute import (
    MetricSums,
    build_series,
    calculate_metric_value,
    in_scope,
    periods_for,
)


def fact(
    fact_id,
    *,
    team_id=1,
    metric_id=1,
    iteration_id=None,
    numerator=0,
    denominator=0,
    start_date=date(2026, 1, 1),
    end_date=date(2026, 1, 1),
    entered_at=None,
    source=None,
):
    return SimpleNamespace(
        id=fact_id,
        team_id=team_id,
        metric_id=metric_id,
        iteration_id=iteration_id,
        numerator=numerator,
        denominator=denominator,
        start_date=start_date,
        end_date=end_date,
        entered_at=entered_at,
        source=source,
    )


def team(team_id, name):
    return SimpleNamespace(id=team_id, name=name)


def iteration(iteration_id, name, version_id, sort_order, start_date, end_date):
    return SimpleNamespace(
        id=iteration_id,
        name=name,
        version_id=version_id,
        sort_order=sort_order,
        start_date=start_date,
        end_date=end_date,
    )


def test_metric_values_follow_spec_and_have_deterministic_zero_boundaries():
    assert calculate_metric_value("penetration", MetricSums(10, 20)) == 0.5
    assert calculate_metric_value("ratio", MetricSums(3, 4)) == 0.75
    assert calculate_metric_value("count", MetricSums(7, 0)) == 7
    assert calculate_metric_value("efficiency", MetricSums(10, 5)) == 1
    assert calculate_metric_value("efficiency", MetricSums(5, 10)) == pytest.approx(-0.5)
    assert calculate_metric_value("efficiency", MetricSums(10, 0)) == 20
    assert calculate_metric_value("efficiency", MetricSums(0, 0)) is None
    assert calculate_metric_value("penetration", MetricSums(10, 0)) is None


def test_week_periods_keep_cross_year_iso_week_boundaries():
    facts = [
        fact(1, end_date=date(2026, 12, 31)),
        fact(2, end_date=date(2027, 1, 1)),
        fact(3, end_date=date(2027, 1, 4)),
    ]

    periods = periods_for(facts, dimension="time", granularity="week")

    assert [period["id"] for period in periods] == ["2026-W53", "2027-W01"]
    assert periods[0]["start_date"] == date(2026, 12, 28)
    assert periods[0]["end_date"] == date(2027, 1, 3)
    assert in_scope(facts[1], periods[0], dimension="time")
    assert not in_scope(facts[2], periods[0], dimension="time")


def test_time_periods_normalize_aware_datetimes_to_asia_shanghai():
    facts = [
        fact(1, end_date=datetime(2026, 1, 4, 15, 59, tzinfo=timezone.utc)),
        fact(2, end_date=datetime(2026, 1, 4, 16, 1, tzinfo=timezone.utc)),
    ]

    periods = periods_for(facts, dimension="time", granularity="week")

    assert [period["id"] for period in periods] == ["2026-W01", "2026-W02"]


def test_month_periods_keep_cross_year_month_boundaries():
    facts = [
        fact(1, end_date=date(2025, 12, 31)),
        fact(2, end_date=date(2026, 1, 1)),
    ]

    periods = periods_for(facts, dimension="time", granularity="month")

    assert [period["id"] for period in periods] == ["2025-12", "2026-01"]
    assert periods[0]["start_date"] == date(2025, 12, 1)
    assert periods[0]["end_date"] == date(2025, 12, 31)


def test_iteration_periods_use_latest_record_by_label_even_when_they_cross_months():
    first = iteration(
        10,
        "版本一-迭代一",
        100,
        0,
        date(2026, 1, 26),
        date(2026, 2, 8),
    )
    second = iteration(
        11,
        "版本一-迭代二",
        100,
        1,
        date(2026, 2, 9),
        date(2026, 3, 1),
    )
    facts = [
        fact(1, iteration_id=10, numerator=1, denominator=2, end_date=date(2026, 1, 30)),
        fact(2, iteration_id=10, numerator=3, denominator=4, end_date=date(2026, 2, 6)),
        fact(3, iteration_id=11, numerator=2, denominator=5, end_date=date(2026, 2, 20)),
    ]

    result = build_series(
        facts=facts,
        metric_type="penetration",
        activity_kind="key",
        teams=[team(1, "团队A")],
        iterations=[first, second],
        dimension="iteration",
        version_id=100,
    )

    assert [period["label"] for period in result["periods"]] == ["版本一-迭代一", "版本一-迭代二"]
    assert [point["value"] for point in result["series"][0]["values"]] == [pytest.approx(3 / 4), pytest.approx(2 / 5)]
    assert result["series"][0]["values"][0]["numerator"] == 3
    assert result["series"][0]["values"][0]["denominator"] == 4


def test_iteration_periods_follow_product_version_order_before_iteration_order():
    facts = [fact(1, iteration_id=21), fact(2, iteration_id=11)]
    iterations = [
        SimpleNamespace(
            id=21,
            name="版本二-迭代一",
            version_id=200,
            version_sort_order=1,
            sort_order=0,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 7),
        ),
        SimpleNamespace(
            id=11,
            name="版本一-迭代二",
            version_id=100,
            version_sort_order=0,
            sort_order=1,
            start_date=date(2026, 1, 8),
            end_date=date(2026, 1, 14),
        ),
    ]

    periods = periods_for(facts, dimension="iteration", iterations=iterations)

    assert [period["id"] for period in periods] == [11, 21]


def test_iteration_periods_can_be_restricted_to_an_iteration_set():
    facts = [fact(1, iteration_id=10), fact(2, iteration_id=11)]
    iterations = [
        iteration(10, "迭代一", 100, 0, date(2026, 1, 1), date(2026, 1, 7)),
        iteration(11, "迭代二", 100, 1, date(2026, 1, 8), date(2026, 1, 14)),
    ]

    periods = periods_for(
        facts,
        dimension="iteration",
        iterations=iterations,
        iteration_ids=["10"],
    )

    assert [period["id"] for period in periods] == [10]


def test_time_series_uses_completion_date_and_calculates_company_average_from_team_values():
    facts = [
        fact(1, team_id=1, numerator=1, denominator=1, start_date=date(2026, 1, 1), end_date=date(2026, 1, 8)),
        fact(2, team_id=2, numerator=0, denominator=100, start_date=date(2026, 1, 1), end_date=date(2026, 1, 8)),
    ]

    result = build_series(
        facts=facts,
        metric_type="penetration",
        activity_kind="key",
        teams=[team(1, "团队A"), team(2, "团队B")],
        iterations=[],
        dimension="time",
        granularity="week",
        team_ids=[1],
    )

    assert [series["team_id"] for series in result["series"]] == [1]
    assert result["series"][0]["values"][0]["value"] == 1
    # 原型定义的全公司均值是各团队值的算术平均，而不是按分母加权的比例。
    assert result["company_average"][0]["value"] == 0.5


def test_series_sums_efficiency_records_and_returns_null_for_empty_rates():
    facts = [
        fact(1, numerator=10, denominator=0, end_date=date(2026, 1, 8)),
        fact(2, numerator=0, denominator=0, end_date=date(2026, 1, 15)),
    ]

    result = build_series(
        facts=facts,
        metric_type="efficiency",
        activity_kind="key",
        teams=[team(1, "团队A")],
        iterations=[],
        dimension="time",
        granularity="week",
    )

    values = result["series"][0]["values"]
    assert values[0]["value"] == 20
    assert values[0]["numerator"] == 10
    assert values[0]["denominator"] == 0
    assert values[1]["value"] is None
    assert result["company_average"][1]["value"] is None


def test_general_activity_cannot_be_aggregated_by_iteration():
    with pytest.raises(ValueError, match="no iteration dimension"):
        build_series(
            facts=[],
            metric_type="ratio",
            activity_kind="general",
            teams=[team(1, "团队A")],
            iterations=[],
            dimension="iteration",
        )


def test_boolean_value_uses_latest_fact_as_a_snapshot():
    facts = [
        fact(1, numerator=1, entered_at=datetime(2026, 1, 1, 12, 0)),
        fact(2, numerator=0, entered_at=datetime(2026, 2, 1, 12, 0)),
    ]

    result = build_series(
        facts=facts,
        metric_type="boolean",
        activity_kind="general",
        teams=[team(1, "团队A")],
        iterations=[],
        dimension="time",
        granularity="month",
    )

    assert result["periods"] == []
    assert result["series"][0]["snapshot"] is False
    assert result["company_average"] == []


def test_manual_fact_overrides_auto_fact_for_the_same_scope():
    facts = [
        fact(1, numerator=1, denominator=2, source="auto"),
        fact(2, numerator=9, denominator=10, source="manual"),
    ]

    result = build_series(
        facts=facts,
        metric_type="penetration",
        activity_kind="general",
        teams=[team(1, "团队A")],
        iterations=[],
        dimension="time",
        granularity="week",
    )

    assert result["series"][0]["values"][0]["value"] == 0.9
