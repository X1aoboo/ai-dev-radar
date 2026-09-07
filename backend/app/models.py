"""核心实体（spec §4）。率不落库，只存分子/分母原始数（ADR-0001）。

效率提升类指标：numerator = 预估人天，denominator = 实际人天，
由看板侧按 (Σ预估 − Σ实际) / Σ实际 计算。
布尔类指标：numerator = 1/0。
"""

from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class ActivityKind(str, Enum):
    KEY = "key"  # 关键研发活动（有版本/迭代维度）
    GENERAL = "general"  # 通用研发能力（仅时间维度）


class MetricType(str, Enum):
    PENETRATION = "penetration"  # 渗透率
    EFFICIENCY = "efficiency"  # 效率提升
    COUNT = "count"  # 数量
    BOOLEAN = "boolean"  # 布尔
    RATIO = "ratio"  # 比率


class CollectMethod(str, Enum):
    MANUAL_ONLY = "manual_only"  # 仅补录
    AUTO = "auto"  # 自动采集


class FactSource(str, Enum):
    MANUAL = "manual"  # 手动补录
    AUTO = "auto"  # 自动采集


class UserRole(str, Enum):
    ADMIN = "admin"
    MAINTAINER = "maintainer"
    VIEWER = "viewer"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    # 数据源映射：产品版本号列表、代码仓地址等源系统标识
    source_mapping: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


class Activity(Base):
    """指标目录 - 活动条目。kind: key=关键研发活动（有版本/迭代维度），general=通用研发能力（仅时间维度）。"""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(10))
    sort_order: Mapped[int] = mapped_column(default=0)

    metrics: Mapped[list["Metric"]] = relationship(
        back_populates="activity", order_by="Metric.sort_order", cascade="all, delete-orphan"
    )


class Metric(Base):
    """指标目录 - 指标条目。type: penetration / efficiency / count / boolean / ratio。

    collect_method: manual_only=仅补录, auto=自动采集（第一版全部 manual_only，ADR-0002）。
    """

    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(15))
    numerator_semantic: Mapped[str] = mapped_column(String(100))
    denominator_semantic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    collect_method: Mapped[str] = mapped_column(String(15), default="manual_only")
    sort_order: Mapped[int] = mapped_column(default=0)

    activity: Mapped[Activity] = relationship(back_populates="metrics")


class ProductVersion(Base):
    __tablename__ = "product_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    sort_order: Mapped[int] = mapped_column(default=0)

    iterations: Mapped[list["Iteration"]] = relationship(
        back_populates="version", order_by="Iteration.sort_order"
    )


class Iteration(Base):
    __tablename__ = "iterations"

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("product_versions.id"))
    name: Mapped[str] = mapped_column(String(60), unique=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    sort_order: Mapped[int] = mapped_column(default=0)

    version: Mapped[ProductVersion] = relationship(back_populates="iterations")


class FactRecord(Base):
    """一条 团队 × 指标 × 迭代（关键活动）或纯时间（通用能力） 的分子/分母原始数。

    start_date/end_date = 需求开始/完成时间，周/月视图由时间字段聚合；
    iteration_id 为空表示通用研发能力（无迭代维度）。
    """

    __tablename__ = "fact_records"
    __table_args__ = (
        # 补录粒度（spec §4）：团队 × 迭代 × 指标一条——仅约束关键活动（迭代非空）；
        # 通用能力无迭代，按周期补录，不做唯一约束（SQLite 对含 NULL 的唯一约束也不生效）
        Index(
            "uq_fact_key_scope",
            "team_id", "metric_id", "iteration_id",
            unique=True,
            sqlite_where=text("iteration_id IS NOT NULL"),
            postgresql_where=text("iteration_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    metric_id: Mapped[int] = mapped_column(ForeignKey("metrics.id"))
    iteration_id: Mapped[int | None] = mapped_column(ForeignKey("iterations.id"), nullable=True)
    numerator: Mapped[float | None] = mapped_column(Float, nullable=True)
    denominator: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(10))  # manual / auto
    entered_by: Mapped[str] = mapped_column(String(50))
    entered_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    role: Mapped[str] = mapped_column(String(15))  # admin / maintainer / viewer
    maintainer_team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
