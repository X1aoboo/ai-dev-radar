"""FastAPI 入口。首次启动若目录为空则自动播种（骨架期便利）；重跑幂等用 python -m app.seed。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import func, select

from .api import router
from .db import Base, SessionLocal, engine
from .models import Activity, FactRecord, Iteration, Metric, ProductVersion, Team, User  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Activity)) == 0:
            from .seed import run_seed
            run_seed(db)
    yield


app = FastAPI(title="ai-dev-radar", lifespan=lifespan)
app.include_router(router)
