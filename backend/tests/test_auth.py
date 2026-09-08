"""认证、session 和角色/团队权限 seam 的行为测试。"""

import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.auth import verify_password
from app.config import SEED_PASSWORD
from app.main import create_app
from app.migrations import ensure_auth_schema
from app.models import User


def login(client, username):
    return client.post(
        "/api/auth/login",
        json={"username": username, "password": SEED_PASSWORD},
    )


@pytest.mark.parametrize(
    ("username", "role"),
    [
        ("admin", "admin"),
        ("maintainer.团队A", "maintainer"),
        ("viewer", "viewer"),
    ],
)
def test_seeded_accounts_can_login_and_report_role(client, username, role):
    response = login(client, username)

    assert response.status_code == 200
    assert response.json()["username"] == username
    assert response.json()["role"] == role
    assert "password" not in response.json()

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == username
    assert me.json()["role"] == role


def test_invalid_credentials_and_unauthenticated_reads_are_rejected(client):
    invalid = client.post(
        "/api/auth/login",
        json={"username": "viewer", "password": "wrong-password"},
    )

    assert invalid.status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/catalog").status_code == 401


def test_logout_clears_session_and_login_restores_access(client):
    assert login(client, "viewer").status_code == 200
    assert client.get("/api/catalog").status_code == 200

    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/catalog").status_code == 401

    assert login(client, "viewer").status_code == 200
    assert client.get("/api/catalog").status_code == 200


def test_admin_user_list_is_forbidden_to_viewer(client):
    assert login(client, "viewer").status_code == 200
    assert client.get("/api/auth/users").status_code == 403

    client.post("/api/auth/logout")
    assert login(client, "admin").status_code == 200
    response = client.get("/api/auth/users")
    assert response.status_code == 200
    assert len(response.json()) == 6
    assert all("password_hash" not in user for user in response.json())


def test_expired_session_can_be_replaced_by_login(client):
    short_lived_app = create_app(session_max_age=1)

    with TestClient(short_lived_app) as short_client:
        assert login(short_client, "viewer").status_code == 200
        time.sleep(1.2)
        assert short_client.get("/api/auth/me").status_code == 401
        assert login(short_client, "viewer").status_code == 200
        assert short_client.get("/api/auth/me").status_code == 200


def test_legacy_users_table_gets_password_hash_during_migration():
    legacy_engine = create_engine("sqlite:///:memory:")
    with legacy_engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE users ("
            "id INTEGER PRIMARY KEY, username VARCHAR(50), role VARCHAR(15), "
            "maintainer_team_id INTEGER)"
        ))
        connection.execute(text(
            "INSERT INTO users (id, username, role) VALUES (1, 'admin', 'admin')"
        ))

    legacy_session_factory = sessionmaker(bind=legacy_engine)
    ensure_auth_schema(legacy_engine, legacy_session_factory)

    with legacy_session_factory() as db:
        user = db.get(User, 1)
        assert user is not None
        assert verify_password(SEED_PASSWORD, user.password_hash)


def test_role_and_team_dependencies_return_403_at_http_seam(client):
    assert login(client, "viewer").status_code == 200
    teams = client.get("/api/teams").json()
    team_a = next(team for team in teams if team["name"] == "团队A")
    team_b = next(team for team in teams if team["name"] == "团队B")
    assert client.get(f"/api/auth/teams/{team_a['id']}/users").status_code == 403

    client.post("/api/auth/logout")
    assert login(client, "maintainer.团队A").status_code == 200
    assert client.get(f"/api/auth/teams/{team_a['id']}/users").status_code == 200
    assert client.get(f"/api/auth/teams/{team_b['id']}/users").status_code == 403

    client.post("/api/auth/logout")
    assert login(client, "admin").status_code == 200
    assert client.get(f"/api/auth/teams/{team_b['id']}/users").status_code == 200
