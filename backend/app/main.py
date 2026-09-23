"""FastAPI 入口。首次启动若目录为空则自动播种。"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from sqlalchemy import func, select
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware
from starlette.routing import Match, Mount
from starlette.staticfiles import StaticFiles

from .api import router
from .collection_api import router as collection_router
from .collectors import CollectorRegistry, SourceCollectorRegistry
from .config import SESSION_HTTPS_ONLY, SESSION_MAX_AGE, SESSION_SECRET, STATIC_DIR
from .data_api import router as data_management_router
from .gateway_api import redact_gateway_validation_errors, router as gateway_management_router
from .db import Base, SessionLocal, engine
from .migrations import (
    ensure_auth_schema,
    ensure_data_management_schema,
    ensure_fact_schema,
    ensure_gateway_schema,
    ensure_maturity_schema,
)
from .models import (  # noqa: F401
    Activity,
    AuditLog,
    DataMetricDefinition,
    FactRecord,
    GatewayConfigAudit,
    GatewayConfiguration,
    GatewayHealthStatus,
    IRRequirement,
    ImportBatch,
    ImportRow,
    Iteration,
    MaturityRecord,
    Metric,
    Product,
    ProductVersion,
    Team,
    TeamMember,
    User,
)
from .scheduler import create_scheduler
from .scheduler import load_source_collection_schedules
from .source_collection import ensure_ir_collection_schedule
from .gateway_health import mark_active_status_unknown, schedule_gateway_health_check


collector_registry = CollectorRegistry()
source_collector_registry = SourceCollectorRegistry()


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
    ensure_data_management_schema()
    ensure_maturity_schema()
    ensure_gateway_schema()
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Activity)) == 0:
            from .seed import run_seed
            run_seed(db)

    ensure_ir_collection_schedule()
    with SessionLocal() as db:
        mark_active_status_unknown(db)
    scheduler = create_scheduler(collector_registry)
    load_source_collection_schedules(scheduler)
    schedule_gateway_health_check(scheduler)
    scheduler.start()
    app.state.scheduler = scheduler
    app.state.source_collector_registry = source_collector_registry
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
    application.add_exception_handler(
        RequestValidationError,
        redact_gateway_validation_errors,
    )
    application.add_middleware(
        SessionMiddleware,
        secret_key=SESSION_SECRET,
        max_age=SESSION_MAX_AGE if session_max_age is None else session_max_age,
        same_site="lax",
        https_only=SESSION_HTTPS_ONLY,
    )
    application.include_router(router)
    application.include_router(data_management_router)
    application.include_router(gateway_management_router)
    application.include_router(collection_router)
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
