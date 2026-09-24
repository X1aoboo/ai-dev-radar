"""指标目录初始数据 + 演示数据种子。

- 目录：spec §2.1 的 15 个活动及全部指标，全部标记 `仅补录`（ADR-0002）
- 演示数据：4 团队、2 版本、近六个月各 1 迭代及完整事实/成熟度/IR 示例
- 幂等：先清后插；同一基准日期使用固定随机种子（20260908）重跑结果一致

用法：cd backend && python -m app.seed [--db URL]
"""

import argparse
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session, sessionmaker

from .auth import hash_password
from .config import SEED_PASSWORD
from .migrations import (
    ensure_auth_schema,
    ensure_data_management_schema,
    ensure_fact_schema,
    ensure_maturity_schema,
)
from .models import (
    Activity,
    AuditLog,
    DataMetricDefinition,
    FactRecord,
    IRRequirement,
    ImportBatch,
    ImportRow,
    Iteration,
    Metric,
    MaturityRecord,
    Product,
    ProductVersion,
    Team,
    TeamMember,
    User,
)

# ---------------------------------------------------------------- 指标目录（spec §2.1）

# (activity_code, activity_name, kind, [
#   (metric_code, metric_name, type, 分子语义, 分母语义 or None)
# ])
CATALOG = [
    ("sa", "SA设计", "key", [
        ("sa-ir-pen", "IR需求渗透率", "penetration", "使用AI设计的IR数", "IR总数"),
        ("sa-eff", "SA设计效率", "efficiency", "预估人天", "实际人天"),
    ]),
    ("se", "SE设计", "key", [
        ("se-ir-pen", "IR需求渗透率", "penetration", "使用AI设计的IR数", "IR总数"),
        ("se-eff", "SE设计效率", "efficiency", "预估人天", "实际人天"),
    ]),
    ("dd", "开发设计", "key", [
        ("dd-ar-pen", "AR需求渗透率", "penetration", "使用AI设计的AR数", "AR总数"),
        ("dd-eff", "开发设计效率", "efficiency", "预估人天", "实际人天"),
    ]),
    ("cd", "编码开发", "key", [
        ("cd-ar-pen", "AR需求渗透率", "penetration", "使用AI编码的AR数", "AR总数"),
        ("cd-eff", "编码效率", "efficiency", "预估人天", "实际人天"),
    ]),
    ("tcg", "测试用例生成", "key", [
        ("tcg-sr-pen", "SR需求渗透率", "penetration", "使用AI生成用例的SR数", "SR总数"),
        ("tcg-rate", "测试用例生成率", "ratio", "AI生成用例数", "用例总数"),
    ]),
    ("tce", "测试用例执行", "key", [
        ("tce-count", "用例执行数", "count", "执行用例数", None),
        ("tce-rate", "用例执行率", "ratio", "AI执行用例数", "执行用例总数"),
    ]),
    ("dta", "DTS缺陷分析", "key", [
        ("dta-count", "DTS分析数", "count", "分析缺陷数", None),
        ("dta-pen", "DTS渗透率", "penetration", "使用AI分析的缺陷数", "分析缺陷总数"),
    ]),
    ("dtf", "DTS缺陷修复", "key", [
        ("dtf-count", "DTS修复数", "count", "修复缺陷数", None),
        ("dtf-pen", "DTS渗透率", "penetration", "使用AI修复的缺陷数", "修复缺陷总数"),
    ]),
    ("mrr", "MR代码检视", "general", [
        ("mrr-count", "AI检视意见数", "count", "AI检视意见数", None),
        ("mrr-rate", "AI检视率", "ratio", "AI检视MR数", "MR总数"),
    ]),
    ("e2e", "MR-E2E能力", "general", [
        ("e2e-count", "AI-MR数量", "count", "AI-MR数量", None),
        ("e2e-rate", "AI-MR构建率", "ratio", "AI-MR构建成功数", "AI-MR总数"),
    ]),
    ("cc", "CodeCheck问题修复", "general", [
        ("cc-count", "AI修复数量", "count", "AI修复问题数", None),
        ("cc-rate", "AI修复率", "ratio", "AI修复问题数", "CodeCheck问题总数"),
    ]),
    ("third", "三方件治理", "general", [
        ("third-count", "治理数量", "count", "AI治理三方件数", None),
        ("third-rate", "治理率", "ratio", "AI治理三方件数", "三方件总数"),
    ]),
    ("vul", "漏洞修复", "general", [
        ("vul-count", "AI修复数量", "count", "AI修复漏洞数", None),
        ("vul-rate", "AI修复率", "ratio", "AI修复漏洞数", "漏洞总数"),
    ]),
    ("ad", "自动化构建部署", "general", [
        ("ad-bool", "能力是否具备", "boolean", "具备=1 / 不具备=0", None),
    ]),
    ("wb", "白盒安全问题修复", "general", [
        ("wb-count", "AI修复数量", "count", "AI修复白盒问题数", None),
        ("wb-rate", "AI修复率", "ratio", "AI修复白盒问题数", "白盒问题总数"),
    ]),
]

# ---------------------------------------------------------------- 演示数据参数


def mulberry32(seed):
    """种子随机（与原型 prototype/src/data/mock.js 同算法），保证重跑稳定。"""
    a = [seed & 0xFFFFFFFF]

    def rnd():
        a[0] = (a[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = a[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rnd


SEED = 20260908
WINDOW_MONTHS = 6


def month_start(value: date, offset: int = 0) -> date:
    index = value.year * 12 + value.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def month_end(value: date) -> date:
    return month_start(value, 1) - timedelta(days=1)


# 团队画像（演示假设）：m = AI 成熟度基线，size = 规模（分母量级）
TEAMS = [
    ("团队A", {"m": 0.82, "size": 1.0}),
    ("团队B", {"m": 0.63, "size": 1.3}),
    ("团队C", {"m": 0.47, "size": 0.85}),
    ("团队D", {"m": 0.27, "size": 0.6}),
]

# 每个活动的采纳系数（编码/检视类高，白盒/三方件类低），沿用原型取值
ACT_FACTOR = {
    "sa": 0.6, "se": 0.7, "dd": 0.8, "cd": 1.0, "tcg": 0.85, "tce": 0.7,
    "dta": 0.55, "dtf": 0.75, "mrr": 0.9, "e2e": 0.5, "cc": 0.8,
    "third": 0.45, "vul": 0.6, "ad": 1, "wb": 0.4,
}

# ---------------------------------------------------------------- 种子实现


def seed_catalog(db: Session) -> None:
    for ai, (acode, aname, kind, metrics) in enumerate(CATALOG):
        activity = Activity(code=acode, name=aname, kind=kind, sort_order=ai)
        db.add(activity)
        db.flush()
        for mi, (mcode, mname, mtype, num_sem, den_sem) in enumerate(metrics):
            db.add(Metric(
                activity_id=activity.id, code=mcode, name=mname, type=mtype,
                numerator_semantic=num_sem, denominator_semantic=den_sem,
                collect_method="manual_only", sort_order=mi,
            ))


def seed_demo(db: Session, today: date) -> None:
    rnd = mulberry32(SEED)
    months = [month_start(today, offset) for offset in range(1 - WINDOW_MONTHS, 1)]
    # 人工补录必须晚于演示种子，才能按既有“最新人工事实”规则覆盖。
    entered_at = datetime.combine(date(2000, 1, 1), time(12))
    version_names = [f"演示版本 {months[0]:%Y-%m}—{months[2]:%Y-%m}",
                     f"演示版本 {months[3]:%Y-%m}—{months[5]:%Y-%m}"]

    def rr(lo, hi):
        return lo + rnd() * (hi - lo)

    def clamp(v, lo, hi):
        return max(lo, min(hi, v))

    teams = []
    for name, _meta in TEAMS:
        team = Team(name=name, source_mapping={
            "product_versions": version_names,
            "repos": [f"https://git.example.com/{name}/main.git"],
        })
        db.add(team)
        teams.append(team)
    db.flush()

    products = []
    for team in teams:
        product = Product(team_id=team.id, name=f"{team.name}产品")
        db.add(product)
        products.append(product)
        for index in range(1, 3):
            db.add(TeamMember(
                team_id=team.id,
                employee_id=f"{team.name[-1]}{index:03d}",
                name=f"{team.name}成员{index}",
                role="研发工程师" if index == 1 else "测试工程师",
            ))
    db.flush()

    # 用户：1 admin + 每团队 1 maintainer + 1 viewer。密码仅保存 Argon2 哈希。
    db.add(User(username="admin", password_hash=hash_password(SEED_PASSWORD), role="admin"))
    for team in teams:
        db.add(User(
            username=f"maintainer.{team.name}",
            password_hash=hash_password(SEED_PASSWORD),
            role="maintainer",
            maintainer_team_id=team.id,
        ))
    db.add(User(username="viewer", password_hash=hash_password(SEED_PASSWORD), role="viewer"))

    iterations = []  # (Iteration, 月份, 事实完成日期)
    versions = []
    for vi, vname in enumerate(version_names):
        # 演示数据只为第一支团队挂载一套产品版本；旧版事实看板仍可跨团队展示。
        version = ProductVersion(name=vname, product_id=products[0].id, sort_order=vi)
        db.add(version)
        versions.append(version)
        db.flush()
        for ii, start in enumerate(months[vi * 3:(vi + 1) * 3]):
            end = min(month_end(start), today)
            fact_date = today if start == months[-1] else min(start + timedelta(days=14), end)
            it = Iteration(version_id=version.id, name=f"{vname}-迭代{ii + 1} ({start:%Y-%m})",
                           sort_order=ii, start_date=start, end_date=end)
            db.add(it)
            iterations.append((it, start, fact_date))
    db.flush()

    activities = db.query(Activity).order_by(Activity.sort_order).all()
    metric_by_code = {m.code: m for m in db.query(Metric).all()}

    def fact(team_id, metric, num, den, start, end, iteration_id=None):
        db.add(FactRecord(
            team_id=team_id, metric_id=metric.id, iteration_id=iteration_id,
            numerator=num, denominator=den,
            start_date=start, end_date=end,
            source="manual",  # 第一版全部仅补录（ADR-0002）
            entered_by="演示种子", entered_at=entered_at,
        ))

    # 关键研发活动：团队 × 活动 × 指标 × 迭代
    for team, (_name, meta) in zip(teams, TEAMS):
        for act in activities:
            if act.kind != "key":
                continue
            factor = ACT_FACTOR[act.code]
            for month_index, (it, _month, fact_date) in enumerate(iterations):
                m = meta["m"]
                grow = month_index / (WINDOW_MONTHS - 1) * 0.12
                rate = clamp(m * factor + grow + rr(-0.07, 0.07), 0.02, 0.98)
                eff = clamp(m * 0.7 - 0.15 + grow * 0.8 + rr(-0.16, 0.16), -0.35, 0.8)
                for metric in act.metrics:
                    if metric.type in ("penetration", "ratio"):
                        den = round(rr(15, 70) * meta["size"])
                        fact(team.id, metric, round(den * rate), den, fact_date, fact_date, it.id)
                    elif metric.type == "count":
                        fact(team.id, metric, round(rr(30, 180) * meta["size"] * (0.3 + rate)),
                             None, fact_date, fact_date, it.id)
                    elif metric.type == "efficiency":
                        items = round(rr(8, 26) * meta["size"])
                        est = round(items * rr(2, 8), 1)
                        act_days = round(est * (1 - eff), 1)
                        fact(team.id, metric, est, act_days, fact_date, fact_date, it.id)

    # 通用研发能力：六个月每周有事实，近 30 天每天有事实；不依赖迭代。
    weekly_dates = []
    cursor = months[0]
    while cursor <= today:
        weekly_dates.append(cursor)
        cursor += timedelta(days=7)
    recent_start = max(months[0], today - timedelta(days=29))
    daily_dates = [recent_start + timedelta(days=offset)
                   for offset in range((today - recent_start).days + 1)]
    time_dates = sorted(set(weekly_dates + daily_dates))
    for team, (_name, meta) in zip(teams, TEAMS):
        for act in activities:
            if act.kind != "general" or act.code == "ad":
                continue
            factor = ACT_FACTOR[act.code]
            for index, point_date in enumerate(time_dates):
                m = meta["m"]
                rate = clamp(m * factor + (index / max(1, len(time_dates) - 1)) * 0.12 + rr(-0.09, 0.09), 0.01, 0.98)
                for metric in act.metrics:
                    if metric.type == "boolean":
                        continue
                    if metric.type == "ratio":
                        den = round(rr(8, 45) * meta["size"])
                        fact(team.id, metric, round(den * rate), den, point_date, point_date)
                    else:  # count
                        fact(team.id, metric, round(rr(4, 30) * meta["size"] * (0.3 + rate)),
                             None, point_date, point_date)

    # 布尔型：每月状态，团队D 不具备；显式选择当前月也能读取状态。
    ad_bool = metric_by_code["ad-bool"]
    for team in teams:
        for start in months:
            point_date = today if start == months[-1] else start + timedelta(days=14)
            fact(team.id, ad_bool, 0 if team.name == "团队D" else 1, None,
                 point_date, point_date)

    # ---- 边界样例（验收项）：实际=0、负值效率提升 ----
    db.flush()  # 上面的 insert 都在 pending，先落库再改

    def facts_of(team, iteration):
        return db.query(FactRecord).join(Metric).filter(
            Metric.type == "efficiency",
            FactRecord.team_id == team.id,
            FactRecord.iteration_id == iteration.id,
        ).all()

    # 实际=0（看板侧按 0.5 人天计分母的口径样例）。
    team_c = next(t for t in teams if t.name == "团队C")
    for rec in facts_of(team_c, iterations[3][0]):
        rec.denominator = 0.0
    # 负值效率提升（实际 > 预估，(预估-实际)/实际 = -28.6%）。
    team_d = next(t for t in teams if t.name == "团队D")
    for rec in facts_of(team_d, iterations[0][0]):
        rec.denominator = round(rec.numerator * 1.4, 1)

    # 成熟度是独立的模拟人工判断，不从事实指标计算。
    for team, (_name, meta) in zip(teams, TEAMS):
        for month_index, start in enumerate(months):
            for activity_index, activity in enumerate(activities):
                score = clamp(meta["m"] * 5 + (month_index - 2) * 0.12
                              + (ACT_FACTOR[activity.code] - 0.7) * 0.8
                              + (activity_index % 3 - 1) * 0.08, 0, 5)
                db.add(MaturityRecord(
                    team_id=team.id, activity_id=activity.id, assessment_month=start,
                    score_decimal=f"{score:.2f}", note="演示评估（模拟人工判断）",
                    maintained_by="演示种子", updated_at=entered_at,
                ))

    # IR 工作台：每月两条正式源记录，AI 与非 AI 样例均覆盖。
    for month_index, (it, _start, fact_date) in enumerate(iterations):
        version = next(version for version in versions if version.id == it.version_id)
        for sample_index in range(2):
            index = month_index * 2 + sample_index
            db.add(IRRequirement(
                requirement_no=f"IR-DEMO-{index + 1:03d}",
                requirement_name=f"CNAE 演示需求 {index + 1}",
                responsible_employee_id=f"A{sample_index + 1:03d}",
                product_id=products[0].id,
                version_id=version.id,
                iteration_id=it.id,
                completed_at=fact_date,
                business_module="CNAE",
                requirement_scenario="AI研发效能数据管理",
                estimated_workload=10.0 + sample_index,
                actual_workload=5.0 + sample_index,
                sa_estimated_workload=4.0,
                sa_actual_workload=2.0,
                se_estimated_workload=6.0 + sample_index,
                se_actual_workload=3.0 + sample_index,
                ai_assisted=sample_index == 0,
                ai_attribute_metadata={
                    "ai_assisted": {
                        "source": "manual",
                        "updated_by": "演示种子",
                        "updated_at": entered_at.isoformat(),
                    }
                },
                record_source="seed",
                updated_by="演示种子",
                updated_at=entered_at,
            ))


def seed_data_metrics(db: Session) -> None:
    definitions = [
        DataMetricDefinition(
            domain="ir",
            code="ir-ai-penetration",
            name="IR需求AI渗透率",
            metric_type="penetration",
            numerator_field="ai_assisted",
            denominator_field="record_count",
            filter_definition={},
        ),
        DataMetricDefinition(
            domain="ir",
            code="ir-sa-efficiency",
            name="SA设计效率提升",
            metric_type="efficiency",
            activity_code="sa",
            numerator_field="sa_estimated_workload",
            denominator_field="sa_actual_workload",
            filter_definition={},
        ),
        DataMetricDefinition(
            domain="ir",
            code="ir-se-efficiency",
            name="SE设计效率提升",
            metric_type="efficiency",
            activity_code="se",
            numerator_field="se_estimated_workload",
            denominator_field="se_actual_workload",
            filter_definition={},
        ),
    ]
    db.add_all(definitions)


def clear(db: Session) -> None:
    """先清后插：按外键依赖逆序清空。"""
    db.execute(delete(AuditLog))
    db.execute(delete(ImportRow))
    db.execute(delete(ImportBatch))
    db.execute(delete(IRRequirement))
    db.execute(delete(DataMetricDefinition))
    db.execute(delete(MaturityRecord))
    db.execute(delete(FactRecord))
    db.execute(delete(Iteration))
    db.execute(delete(ProductVersion))
    db.execute(delete(User))
    db.execute(delete(TeamMember))
    db.execute(delete(Product))
    db.execute(delete(Team))
    db.execute(delete(Metric))
    db.execute(delete(Activity))


def run_seed(db: Session, today: date | None = None) -> None:
    today = today or datetime.now(ZoneInfo("Asia/Shanghai")).date()
    clear(db)
    seed_catalog(db)
    seed_demo(db, today)
    seed_data_metrics(db)
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="重建指标目录与演示数据（先清后插，幂等）")
    parser.add_argument("--db", default=None, help="数据库连接串，默认取 DATABASE_URL / SQLite")
    args = parser.parse_args()

    from .db import Base, SessionLocal, engine
    if args.db:
        seed_engine = create_engine(args.db)
        session_factory = sessionmaker(bind=seed_engine)
        Base.metadata.create_all(seed_engine)
        ensure_fact_schema(seed_engine)
        ensure_auth_schema(seed_engine, session_factory)
        ensure_data_management_schema(seed_engine)
        ensure_maturity_schema(seed_engine)
        db = session_factory()
    else:
        Base.metadata.create_all(engine)
        ensure_fact_schema()
        ensure_auth_schema()
        ensure_data_management_schema()
        ensure_maturity_schema()
        db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()
    print("种子完成：目录 + 演示数据已重建。")


if __name__ == "__main__":
    main()
