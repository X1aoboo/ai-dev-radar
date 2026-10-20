"""Team/member Excel import, template and export contracts."""

from app.data_management import _xlsx_rows


TEAM_HEADERS = ["团队名称", "工号", "姓名", "角色"]


def login(client, username):
    from app.config import SEED_PASSWORD

    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": SEED_PASSWORD},
    )
    assert response.status_code == 200
    return client


def csv_bytes(rows: list[list[str]]) -> bytes:
    return "\n".join(",".join(values) for values in rows).encode("utf-8")


def preview(client, rows: list[list[str]]):
    return client.post(
        "/api/teams/imports/preview",
        content=csv_bytes([TEAM_HEADERS, *rows]),
        headers={"content-type": "text/csv", "x-filename": "team.csv"},
    )


def confirm(client, preview_body: dict):
    rows = [
        {
            "team_name": row["team_name"],
            "employee_id": row["employee_id"],
            "name": row["name"],
            "role": row["role"],
        }
        for row in preview_body["rows"]
    ]
    return client.post("/api/teams/imports/confirm", json={"rows": rows})


def cleanup_team(client, team_name: str):
    teams = client.get("/api/teams").json()
    team = next((item for item in teams if item["name"] == team_name), None)
    if team is None:
        return
    members = client.get("/api/team-members", params={"team_id": team["id"]}).json()
    for member in members:
        client.delete(f"/api/team-members/{member['id']}")
    client.delete(f"/api/teams/{team['id']}")


def test_team_template_and_export_are_excel_workbooks(client):
    login(client, "admin")

    template = client.get("/api/teams/import-template")
    assert template.status_code == 200
    assert template.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert _xlsx_rows(template.content)[0] == TEAM_HEADERS

    exported = client.get("/api/teams/export")
    assert exported.status_code == 200
    rows = _xlsx_rows(exported.content)
    assert rows[0] == TEAM_HEADERS
    assert any(row[0] == "团队A" for row in rows[1:])


def test_team_import_preview_confirm_and_update(client):
    login(client, "admin")
    cleanup_team(client, "导入测试团队")

    first = preview(client, [
        ["导入测试团队", "IMP001", "导入成员1", "SA"],
        ["导入测试团队", "IMP002", "导入成员2", "测试"],
        ["团队A", "IMP003", "导入成员3", "开发"],
    ])
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["total_rows"] == 3
    assert body["valid_rows"] == 3
    assert body["summary"]["create"] == 3
    assert body["summary"]["teams_create"] == 1

    confirmed = confirm(client, body)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["created_teams"] == 1
    assert confirmed.json()["created_members"] == 3

    update = preview(client, [
        ["导入测试团队", "IMP001", "导入成员1（更新）", "SE"],
    ])
    assert update.status_code == 200
    update_body = update.json()
    assert update_body["rows"][0]["action"] == "update"
    assert update_body["rows"][0]["changes"] == {"name": "导入成员1（更新）", "role": "SE"}
    updated = confirm(client, update_body)
    assert updated.status_code == 200
    assert updated.json()["updated_members"] == 1

    teams = client.get("/api/teams").json()
    team = next(item for item in teams if item["name"] == "导入测试团队")
    members = client.get("/api/team-members", params={"team_id": team["id"]}).json()
    assert {member["employee_id"] for member in members} == {"IMP001", "IMP002"}
    assert next(member for member in members if member["employee_id"] == "IMP001")["role"] == "SE"

    cleanup_team(client, "导入测试团队")
    team_a = next(item for item in client.get("/api/teams").json() if item["name"] == "团队A")
    imported = next(member for member in client.get("/api/team-members", params={"team_id": team_a["id"]}).json() if member["employee_id"] == "IMP003")
    client.delete(f"/api/team-members/{imported['id']}")


def test_team_import_rejects_invalid_role_and_duplicate_employee_id(client):
    login(client, "admin")
    cleanup_team(client, "错误测试团队")

    response = preview(client, [
        ["错误测试团队", "BAD001", "错误成员", "研发工程师"],
        ["错误测试团队", "BAD002", "重复成员", "开发"],
        ["错误测试团队", "BAD002", "重复成员2", "测试"],
    ])
    assert response.status_code == 200
    body = response.json()
    assert body["invalid_rows"] == 2
    assert body["rows"][0]["action"] == "invalid"
    assert body["rows"][1]["action"] == "create"
    assert body["rows"][2]["action"] == "invalid"
    assert any("角色必须是" in error for error in body["rows"][0]["errors"])
    assert any("工号在文件中重复" in error for error in body["rows"][2]["errors"])

    rejected = confirm(client, body)
    assert rejected.status_code == 422
    assert not any(team["name"] == "错误测试团队" for team in client.get("/api/teams").json())


def test_team_import_requires_admin_but_template_and_export_allow_readers(client):
    login(client, "viewer")
    assert client.get("/api/teams/import-template").status_code == 200
    assert client.get("/api/teams/export").status_code == 200

    response = preview(client, [["团队A", "VIEW001", "只读成员", "开发"]])
    assert response.status_code == 403


def test_team_export_is_scoped_for_maintainer(client):
    login(client, "maintainer.团队A")
    exported = client.get("/api/teams/export")
    assert exported.status_code == 200
    rows = _xlsx_rows(exported.content)
    team_names = {row[0] for row in rows[1:] if row}
    assert team_names == {"团队A"}
