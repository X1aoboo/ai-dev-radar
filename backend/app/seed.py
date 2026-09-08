"""指标目录初始数据 + 演示数据种子。

- 目录：spec §2.1 的 15 个活动及全部指标，全部标记 `仅补录`（ADR-0002）
- 演示数据：4 团队、2 版本、各 2 迭代，按 spec 口径生成事实记录（含负值效率、实际=0 样例）
- 幂等：先清后插；随机数为固定种子（20260908，参照原型 seed），重跑结果一致

用法：cd backend && python -m app.seed [--db URL]
"""

import argparse
from datetime import date, datetime, timedelta

from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session, sessionmaker

from .auth import hash_password
from .config import SEED_PASSWORD
from .migrations import ensure_auth_schema
from .models import Activity, FactRecord, Iteration, Metric, ProductVersion, Team, User

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
WEEKS = 34  # 2026 年 W1–W34（1–8 月）
W1_MONDAY = date(2026, 1, 5)  # 2026-01-05 是周一（Asia/Shanghai 周口径）


def week_monday(n: int) -> date:
    return W1_MONDAY + timedelta(days=7 * (n - 1))


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

# (版本名, [(迭代名, 起始周, 结束周)])
VERSIONS = [
    ("SCC 27.1.RC1", [
        ("SCC 27.1.RC1-迭代一", 1, 9),
        ("SCC 27.1.RC1-迭代二", 10, 18),
    ]),
    ("SCC 27.2.RC1", [
        ("SCC 27.2.RC1-迭代一", 19, 27),
        ("SCC 27.2.RC1-迭代二", 28, 34),
    ]),
]

ENTERED_AT = datetime(2026, 9, 8, 12, 0, 0)

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


def seed_demo(db: Session) -> None:
    rnd = mulberry32(SEED)

    def rr(lo, hi):
        return lo + rnd() * (hi - lo)

    def clamp(v, lo, hi):
        return max(lo, min(hi, v))

    teams = []
    for name, _meta in TEAMS:
        team = Team(name=name, source_mapping={
            "product_versions": ["SCC 27.1.RC1", "SCC 27.2.RC1"],
            "repos": [f"https://git.example.com/{name}/main.git"],
        })
        db.add(team)
        teams.append(team)
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

    iterations = []  # (Iteration, week_lo, week_hi)
    for vi, (vname, its) in enumerate(VERSIONS):
        version = ProductVersion(name=vname, sort_order=vi)
        db.add(version)
        db.flush()
        for ii, (iname, w_lo, w_hi) in enumerate(its):
            it = Iteration(version_id=version.id, name=iname, sort_order=ii,
                           start_date=week_monday(w_lo),
                           end_date=week_monday(w_hi) + timedelta(days=6))
            db.add(it)
            iterations.append((it, w_lo, w_hi))
    db.flush()

    activities = db.query(Activity).order_by(Activity.sort_order).all()
    metric_by_code = {m.code: m for m in db.query(Metric).all()}

    def fact(team_id, metric, num, den, start, end, iteration_id=None):
        db.add(FactRecord(
            team_id=team_id, metric_id=metric.id, iteration_id=iteration_id,
            numerator=num, denominator=den,
            start_date=start, end_date=end,
            source="manual",  # 第一版全部仅补录（ADR-0002）
            entered_by="演示种子", entered_at=ENTERED_AT,
        ))

    # 关键研发活动：团队 × 活动 × 指标 × 迭代
    for ti, (team, (_name, meta)) in enumerate(zip(teams, TEAMS)):
        for act in activities:
            if act.kind != "key":
                continue
            factor = ACT_FACTOR[act.code]
            for it, w_lo, w_hi in iterations:
                m = meta["m"]
                grow = (w_lo - 1) / WEEKS * 0.12  # 随时间缓慢爬升
                rate = clamp(m * factor + grow + rr(-0.07, 0.07), 0.02, 0.98)
                eff = clamp(m * 0.7 - 0.15 + grow * 0.8 + rr(-0.16, 0.16), -0.35, 0.8)
                week = w_lo + int(rr(0, w_hi - w_lo + 1))
                start = week_monday(week)
                end = start + timedelta(days=4)  # 完成时间落在该周内
                for metric in act.metrics:
                    if metric.type in ("penetration", "ratio"):
                        den = round(rr(15, 70) * meta["size"])
                        fact(team.id, metric, round(den * rate), den, start, end, it.id)
                    elif metric.type == "count":
                        fact(team.id, metric, round(rr(30, 180) * meta["size"] * (0.3 + rate)),
                             None, start, end, it.id)
                    elif metric.type == "efficiency":
                        items = round(rr(8, 26) * meta["size"])
                        est = round(items * rr(2, 8), 1)
                        act_days = round(est * (1 - eff), 1)
                        fact(team.id, metric, est, act_days, start, end, it.id)

    # 通用研发能力：团队 × 活动 × 指标 × 周（仅时间维度，无迭代）
    for team, (_name, meta) in zip(teams, TEAMS):
        for act in activities:
            if act.kind != "general" or act.code == "ad":
                continue
            factor = ACT_FACTOR[act.code]
            for w in range(1, WEEKS + 1):
                m = meta["m"]
                rate = clamp(m * factor + (w / WEEKS) * 0.12 + rr(-0.09, 0.09), 0.01, 0.98)
                start = week_monday(w)
                end = start + timedelta(days=4)
                for metric in act.metrics:
                    if metric.type == "boolean":
                        continue
                    if metric.type == "ratio":
                        den = round(rr(8, 45) * meta["size"])
                        fact(team.id, metric, round(den * rate), den, start, end)
                    else:  # count
                        fact(team.id, metric, round(rr(4, 30) * meta["size"] * (0.3 + rate)),
                             None, start, end)

    # 布尔型：一次性事实（自动化构建部署），团队D 不具备
    ad_bool = metric_by_code["ad-bool"]
    for team in teams:
        fact(team.id, ad_bool, 0 if team.name == "团队D" else 1, None,
             W1_MONDAY, W1_MONDAY)

    # ---- 边界样例（验收项）：实际=0、负值效率提升 ----
    db.flush()  # 上面的 insert 都在 pending，先落库再改

    def facts_of(team, iteration):
        return db.query(FactRecord).join(Metric).filter(
            Metric.type == "efficiency",
            FactRecord.team_id == team.id,
            FactRecord.iteration_id == iteration.id,
        ).all()

    # 实际=0（看板侧按 0.5 人天计分母的口径样例）：团队C 在 27.2.RC1-迭代一 的全部效率指标
    team_c = next(t for t in teams if t.name == "团队C")
    it_272_1 = next(it for it, _lo, _hi in iterations if it.name == "SCC 27.2.RC1-迭代一")
    for rec in facts_of(team_c, it_272_1):
        rec.denominator = 0.0
    # 负值效率提升（实际 > 预估，(预估-实际)/实际 = -28.6%）：团队D 在 27.1.RC1-迭代一
    team_d = next(t for t in teams if t.name == "团队D")
    it_271_1 = next(it for it, _lo, _hi in iterations if it.name == "SCC 27.1.RC1-迭代一")
    for rec in facts_of(team_d, it_271_1):
        rec.denominator = round(rec.numerator * 1.4, 1)


def clear(db: Session) -> None:
    """先清后插：按外键依赖逆序清空。"""
    db.execute(delete(FactRecord))
    db.execute(delete(Iteration))
    db.execute(delete(ProductVersion))
    db.execute(delete(User))
    db.execute(delete(Team))
    db.execute(delete(Metric))
    db.execute(delete(Activity))


def run_seed(db: Session) -> None:
    clear(db)
    seed_catalog(db)
    seed_demo(db)
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
        ensure_auth_schema(seed_engine, session_factory)
        db = session_factory()
    else:
        Base.metadata.create_all(engine)
        ensure_auth_schema()
        db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()
    print("种子完成：目录 + 演示数据已重建。")


if __name__ == "__main__":
    main()
