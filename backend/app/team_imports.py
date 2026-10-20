"""Validation and application of team/member Excel imports."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Team, TeamMember


TEAM_IMPORT_HEADERS = ("团队名称", "工号", "姓名", "角色")
TEAM_ROLES = ("SA", "SE", "MDE", "开发", "测试")


class TeamImportError(ValueError):
    def __init__(self, message: str, rows: list[dict[str, Any]] | None = None) -> None:
        super().__init__(message)
        self.rows = rows or []


def _text(value: Any) -> str:
    return str(value or "").strip()


def _team_by_name(db: Session, name: str) -> Team | None:
    return db.scalar(select(Team).where(Team.name == name))


def _member_by_employee_id(db: Session, employee_id: str) -> TeamMember | None:
    return db.scalar(select(TeamMember).where(TeamMember.employee_id == employee_id))


def analyze_team_rows(db: Session, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build a preview for every non-empty imported row without writing anything."""

    preview: list[dict[str, Any]] = []
    seen_employee_ids: set[str] = set()
    team_cache: dict[str, Team | None] = {}

    for index, raw in enumerate(rows, start=2):
        team_name = _text(raw.get("团队名称"))
        employee_id = _text(raw.get("工号"))
        name = _text(raw.get("姓名"))
        role = _text(raw.get("角色"))
        errors: list[str] = []
        warnings: list[str] = []

        missing_headers = [header for header in TEAM_IMPORT_HEADERS if header not in raw]
        if missing_headers:
            errors.append(f"缺少列：{'、'.join(missing_headers)}")
        if not team_name:
            errors.append("团队名称不能为空")
        elif len(team_name) > 100:
            errors.append("团队名称不能超过 100 个字符")
        if not employee_id:
            errors.append("工号不能为空")
        elif len(employee_id) > 50:
            errors.append("工号不能超过 50 个字符")
        if not name:
            errors.append("姓名不能为空")
        elif len(name) > 100:
            errors.append("姓名不能超过 100 个字符")
        if not role:
            errors.append("角色不能为空")
        elif role not in TEAM_ROLES:
            errors.append(f"角色必须是 {' / '.join(TEAM_ROLES)}")
        if employee_id and employee_id in seen_employee_ids:
            errors.append("工号在文件中重复")
        if employee_id:
            seen_employee_ids.add(employee_id)

        team = team_cache.get(team_name) if team_name else None
        if team_name and team_name not in team_cache:
            team = _team_by_name(db, team_name)
            team_cache[team_name] = team

        member = _member_by_employee_id(db, employee_id) if employee_id else None
        action = "invalid"
        changes: dict[str, str] = {}
        target_member_id: int | None = None
        if not errors:
            if member is None:
                action = "create"
            else:
                target_member_id = member.id
                current_team = db.get(Team, member.team_id)
                current_team_name = current_team.name if current_team else ""
                if current_team_name != team_name:
                    changes["team_name"] = team_name
                if member.name != name:
                    changes["name"] = name
                if member.role != role:
                    changes["role"] = role
                action = "update" if changes else "unchanged"

        preview.append({
            "row_number": index,
            "team_name": team_name,
            "employee_id": employee_id,
            "name": name,
            "role": role,
            "action": action,
            "team_action": "create" if team_name and team is None else "existing",
            "changes": changes,
            "errors": errors,
            "warnings": warnings,
            "target_member_id": target_member_id,
        })
    return preview


def apply_team_rows(db: Session, rows: list[dict[str, Any]]) -> dict[str, int]:
    """Validate and apply all rows in one transaction. Any row error aborts the batch."""

    preview = analyze_team_rows(db, rows)
    invalid = [row for row in preview if row["action"] == "invalid"]
    if invalid:
        raise TeamImportError("导入数据校验失败，请修正错误行后重试。", invalid)

    try:
        teams = {team.name: team for team in db.scalars(select(Team)).all()}
        created_teams = 0
        for row in preview:
            team_name = row["team_name"]
            if team_name not in teams:
                team = Team(name=team_name, source_mapping={})
                db.add(team)
                db.flush()
                teams[team_name] = team
                created_teams += 1

        created_members = 0
        updated_members = 0
        unchanged_members = 0
        for row, source in zip(preview, rows, strict=True):
            team = teams[row["team_name"]]
            member = _member_by_employee_id(db, row["employee_id"])
            if member is None:
                db.add(TeamMember(
                    team_id=team.id,
                    employee_id=row["employee_id"],
                    name=row["name"],
                    role=row["role"],
                ))
                created_members += 1
                continue
            if row["action"] == "unchanged":
                unchanged_members += 1
                continue
            member.team_id = team.id
            member.name = row["name"]
            member.role = row["role"]
            updated_members += 1

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "created_teams": created_teams,
        "existing_teams": len(teams) - created_teams,
        "created_members": created_members,
        "updated_members": updated_members,
        "unchanged_members": unchanged_members,
    }
