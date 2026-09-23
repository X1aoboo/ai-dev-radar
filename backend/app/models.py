"""核心实体（spec §4）。率不落库，只存分子/分母原始数（ADR-0001）。

效率提升类指标：numerator = 预估人天，denominator = 实际人天，
由看板侧按 (Σ预估 − Σ实际) / Σ实际 计算。
布尔类指标：numerator = 1/0。
"""

from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, JSON, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
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

    members: Mapped[list["TeamMember"]] = relationship(
        back_populates="team", order_by="TeamMember.employee_id", cascade="all, delete-orphan"
    )
    products: Mapped[list["Product"]] = relationship(
        back_populates="team", order_by="Product.name", cascade="all, delete-orphan"
    )


class TeamMember(Base):
    """团队人员主数据；员工号允许被源数据直接引用。"""

    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    employee_id: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    team: Mapped[Team] = relationship(back_populates="members")


class Product(Base):
    """团队负责的产品；产品版本通过产品归属团队。"""

    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("team_id", "name", name="uq_product_team_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    team: Mapped[Team] = relationship(back_populates="products")
    versions: Mapped[list["ProductVersion"]] = relationship(
        back_populates="product", order_by="ProductVersion.sort_order", cascade="all, delete-orphan"
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
    # Nullable to keep the old dashboard's seeded versions readable before the
    # data-management seed is run; newly managed versions always require it.
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0)

    product: Mapped[Product | None] = relationship(back_populates="versions")
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
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(15))  # admin / maintainer / viewer
    maintainer_team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)


class MaturityRecord(Base):
    """团队按月维护的活动成熟度分值。

    ``score_decimal`` 使用规范化字符串而不是 Float/Numeric：SQLite 对 Numeric
    仍可能经过二进制浮点，成熟度的整数边界必须基于原始十进制计算。
    """

    __tablename__ = "maturity_records"
    __table_args__ = (
        UniqueConstraint(
            "team_id", "activity_id", "assessment_month", name="uq_maturity_team_activity_month"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    assessment_month: Mapped[date] = mapped_column(Date)
    score_decimal: Mapped[str] = mapped_column(String(8))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    maintained_by: Mapped[str] = mapped_column(String(100))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    team: Mapped[Team] = relationship()
    activity: Mapped[Activity] = relationship()


class IRRequirement(Base):
    """IR 源数据记录；首版按固定 SA/SE 活动字段保存工作量。"""

    __tablename__ = "ir_requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    requirement_no: Mapped[str] = mapped_column(String(100), unique=True)
    requirement_name: Mapped[str] = mapped_column(String(200))
    responsible_employee_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parent_requirement_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    version_id: Mapped[int] = mapped_column(ForeignKey("product_versions.id"))
    iteration_id: Mapped[int] = mapped_column(ForeignKey("iterations.id"))
    completed_at: Mapped[date] = mapped_column(Date)
    business_module: Mapped[str] = mapped_column(String(100))
    requirement_scenario: Mapped[str] = mapped_column(String(200))
    estimated_workload: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_workload: Mapped[float | None] = mapped_column(Float, nullable=True)
    sa_estimated_workload: Mapped[float | None] = mapped_column(Float, nullable=True)
    sa_actual_workload: Mapped[float | None] = mapped_column(Float, nullable=True)
    se_estimated_workload: Mapped[float | None] = mapped_column(Float, nullable=True)
    se_actual_workload: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_assisted: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    ai_attribute_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    record_source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    updated_by: Mapped[str] = mapped_column(String(100))

    product: Mapped[Product] = relationship()
    version: Mapped[ProductVersion] = relationship()
    iteration: Mapped[Iteration] = relationship()


class ImportBatch(Base):
    """一个待校验、待确认的导入或采集批次。"""

    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(20))
    source_kind: Mapped[str] = mapped_column(String(20))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_by: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    rows: Mapped[list["ImportRow"]] = relationship(
        back_populates="batch", order_by="ImportRow.row_number", cascade="all, delete-orphan"
    )


class ImportRow(Base):
    """导入批次中的一行标准化数据、校验结果和待执行差异。"""

    __tablename__ = "import_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("import_batches.id"))
    row_number: Mapped[int] = mapped_column()
    source_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_system: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    operation: Mapped[str] = mapped_column(String(20), default="insert")
    diff: Mapped[dict] = mapped_column(JSON, default=dict)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="valid")
    target_id: Mapped[int | None] = mapped_column(nullable=True)

    batch: Mapped[ImportBatch] = relationship(back_populates="rows")


class CollectionSchedule(Base):
    """Per-domain source collection schedule; only IR is configured initially."""

    __tablename__ = "collection_schedules"
    __table_args__ = (UniqueConstraint("domain", name="uq_collection_schedule_domain"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(20))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    cadence: Mapped[str] = mapped_column(String(10), default="daily")
    minute: Mapped[int] = mapped_column(Integer, default=0)
    hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Shanghai")
    updated_by: Mapped[str] = mapped_column(String(100), default="system")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )


class CollectionRun(Base):
    """A single source collection attempt and its isolated team outcomes."""

    __tablename__ = "collection_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(20))
    trigger_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="running")
    started_by: Mapped[str] = mapped_column(String(100))
    window_start_at: Mapped[str] = mapped_column(String(50))
    window_end_at: Mapped[str] = mapped_column(String(50))
    gateway_config_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gateway_base_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retryable: Mapped[bool] = mapped_column(Boolean, default=False)
    team_results: Mapped[list] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class GatewayConfiguration(Base):
    """At most one active and one draft client configuration."""

    __tablename__ = "gateway_configurations"
    __table_args__ = (
        UniqueConstraint("slot", name="uq_gateway_configuration_slot"),
        CheckConstraint("slot IN ('active', 'draft')", name="ck_gateway_configuration_slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slot: Mapped[str] = mapped_column(String(10))
    base_url: Mapped[str] = mapped_column(String(2000))
    bearer_token: Mapped[str] = mapped_column(Text)
    request_timeout_seconds: Mapped[float] = mapped_column(Float)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[str] = mapped_column(String(100))
    updated_by: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )


class GatewayHealthStatus(Base):
    """Latest readiness observation per Gateway config scope."""

    __tablename__ = "gateway_health_status"
    __table_args__ = (
        UniqueConstraint("scope", name="uq_gateway_health_scope"),
        CheckConstraint("scope IN ('active', 'draft')", name="ck_gateway_health_scope"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    scope: Mapped[str] = mapped_column(String(10))
    config_id: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30))
    last_known_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    service_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contract_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    consecutive_network_failures: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class GatewayConfigAudit(Base):
    """Sanitized human operations on Gateway runtime configuration."""

    __tablename__ = "gateway_config_audits"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(30))
    actor: Mapped[str] = mapped_column(String(100))
    config_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scope: Mapped[str] = mapped_column(String(10))
    changes: Mapped[dict] = mapped_column(JSON, default=dict)
    result_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


class DataMetricDefinition(Base):
    """源数据指标规则；复杂规则仍可由计算实现扩展。"""

    __tablename__ = "data_metric_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(20))
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    metric_type: Mapped[str] = mapped_column(String(20))
    activity_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    numerator_field: Mapped[str] = mapped_column(String(80))
    denominator_field: Mapped[str | None] = mapped_column(String(80), nullable=True)
    filter_definition: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )


class AuditLog(Base):
    """正式源数据的字段变更记录。"""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(20))
    record_id: Mapped[int] = mapped_column()
    action: Mapped[str] = mapped_column(String(30))
    actor: Mapped[str] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(20))
    changes: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
