"""Production frontend hosting behavior."""

from fastapi.testclient import TestClient


def test_frontend_build_is_served_and_client_routes_fall_back_to_index(tmp_path):
    from app.main import create_app

    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text(
        '<html><body><div id="root"></div></body></html>',
        encoding="utf-8",
    )
    (tmp_path / "assets" / "app.js").write_text(
        "console.log('ai-dev-radar')",
        encoding="utf-8",
    )

    application = create_app(static_dir=tmp_path)
    with TestClient(application) as client:
        index = client.get("/")
        client_route = client.get("/team/1")
        asset = client.get("/assets/app.js")
        api_route = client.get("/api/auth/me")

    assert index.status_code == 200
    assert index.text == client_route.text
    assert asset.status_code == 200
    assert "ai-dev-radar" in asset.text
    assert api_route.status_code == 401
