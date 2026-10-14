"""AI MR review-opinion metric definitions and daily fact projection."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Iterable


EFFECTIVE_REVIEW_METRIC_DEFINITIONS = (
    ("mrr-effective-count", "AI有效检视数", "count", "AI检视有效意见数", None),
    ("mrr-effective-rate", "AI检视有效率", "ratio", "AI检视有效意见数", "AI检视意见总数"),
)
EFFECTIVE_REVIEW_METRIC_CODES = frozenset(
    definition[0] for definition in EFFECTIVE_REVIEW_METRIC_DEFINITIONS
)


@dataclass(frozen=True, slots=True)
class OpinionMetricFact:
    """One team/day aggregate adapted to the existing time-series builder."""

    id: int
    team_id: int
    metric_id: int
    iteration_id: None
    numerator: float
    denominator: float | None
    start_date: date
    end_date: date
    source: str = "auto"
    entered_by: str = "AI review opinion source"
    sample_count: int = 1


def build_opinion_metric_facts(
    opinions: Iterable[object],
    *,
    metric_id: int,
    metric_code: str,
) -> list[OpinionMetricFact]:
    """Aggregate AI opinions by team/day so repeated opinions are not deduplicated as facts."""

    if metric_code not in EFFECTIVE_REVIEW_METRIC_CODES:
        raise ValueError(f"unsupported AI review opinion metric: {metric_code}")

    daily_counts: dict[tuple[int, date], list[int]] = defaultdict(lambda: [0, 0])
    for opinion in opinions:
        key = (int(getattr(opinion, "team_id")), getattr(opinion, "opinion_date"))
        effective, total = daily_counts[key]
        daily_counts[key] = [effective + int(bool(getattr(opinion, "ai_effective"))), total + 1]

    facts = []
    for fact_id, ((team_id, opinion_date), (effective_count, opinion_count)) in enumerate(
        sorted(daily_counts.items()),
        start=1,
    ):
        is_rate = metric_code == "mrr-effective-rate"
        facts.append(OpinionMetricFact(
            id=fact_id,
            team_id=team_id,
            metric_id=metric_id,
            iteration_id=None,
            numerator=float(effective_count),
            denominator=float(opinion_count) if is_rate else None,
            start_date=opinion_date,
            end_date=opinion_date,
            sample_count=opinion_count,
        ))
    return facts
