"""FastAPI 入口。首次启动若目录为空则自动播种。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import func, select
from starlette.middleware.sessions import SessionMiddleware

from .api import router
from .collectors import CollectorRegistry
from .config import SESSION_HTTPS_ONLY, SESSION_MAX_AGE, SESSION_SECRET
from .db import Base, SessionLocal, engine
from .migrations import ensure_auth_schema
from .models import Activity, FactRecord, Iteration, Metric, ProductVersion, Team, User  # noqa: F401
from .scheduler import create_scheduler


collector_registry = CollectorRegistry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
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


def create_app(*, session_max_age: int | None = None) -> FastAPI:
    application = FastAPI(title="ai-dev-radar", lifespan=lifespan)
    application.add_middleware(
        SessionMiddleware,
        secret_key=SESSION_SECRET,
        max_age=SESSION_MAX_AGE if session_max_age is None else session_max_age,
        same_site="lax",
        https_only=SESSION_HTTPS_ONLY,
    )
    application.include_router(router)
    return application


app = create_app()
