"""FastAPI 入口。首次启动若目录为空则自动播种。"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy import func, select
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware
from starlette.routing import Match, Mount
from starlette.staticfiles import StaticFiles

from .api import router
from .collectors import CollectorRegistry
from .config import SESSION_HTTPS_ONLY, SESSION_MAX_AGE, SESSION_SECRET, STATIC_DIR
from .db import Base, SessionLocal, engine
from .migrations import ensure_auth_schema, ensure_fact_schema
from .models import Activity, FactRecord, Iteration, Metric, ProductVersion, Team, User  # noqa: F401
from .scheduler import create_scheduler


collector_registry = CollectorRegistry()


class FrontendStaticFiles(StaticFiles):
    """Serve the Vite build and let the client router handle application paths."""

    async def get_response(self, path: str, scope):
        normalized_path = path.replace("\\", "/")
        last_path_part = normalized_path.rsplit("/", 1)[-1]
        is_client_route = (
            scope["method"] == "GET"
            and normalized_path != "api"
            and not normalized_path.startswith("api/")
            and "." not in last_path_part
        )
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and is_client_route:
                return await super().get_response("index.html", scope)
            raise
        if response.status_code == 404 and is_client_route:
            return await super().get_response("index.html", scope)
        return response


class FrontendMount(Mount):
    """Keep API partial matches from being shadowed by the SPA mount."""

    def matches(self, scope):
        if scope["type"] == "http":
            normalized_path = scope["path"].replace("\\", "/")
            if normalized_path == "/api" or normalized_path.startswith("/api/"):
                return Match.NONE, {}
        return super().matches(scope)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    ensure_fact_schema()
    ensure_auth_schema()
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Activity)) == 0:
            from .seed import run_seed
            run_seed(db)

    scheduler = create_scheduler(collector_registry)
    scheduler.start()
    app.state.scheduler = scheduler
    try:
        yield
    finally:
        scheduler.shutdown(wait=True)


def create_app(
    *,
    session_max_age: int | None = None,
    static_dir: str | Path | None = None,
) -> FastAPI:
    application = FastAPI(title="ai-dev-radar", lifespan=lifespan)
    application.add_middleware(
        SessionMiddleware,
        secret_key=SESSION_SECRET,
        max_age=SESSION_MAX_AGE if session_max_age is None else session_max_age,
        same_site="lax",
        https_only=SESSION_HTTPS_ONLY,
    )
    application.include_router(router)
    frontend_dir = Path(static_dir) if static_dir is not None else STATIC_DIR
    if frontend_dir.is_dir():
        application.router.routes.append(
            FrontendMount(
                "/",
                app=FrontendStaticFiles(directory=frontend_dir, html=True),
                name="frontend",
            )
        )
    return application


app = create_app()
