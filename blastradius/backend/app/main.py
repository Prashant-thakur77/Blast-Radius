import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401 — register SQLModel tables before create_all
from app.api.routes.admin import router as admin_router
from app.api.routes.analysis import router as analysis_router
from app.api.routes.auth import router as auth_router
from app.api.routes.graph import router as graph_router
from app.api.routes.health import router as health_router
from app.api.routes.chat import router as chat_router
from app.api.routes.repos import router as repos_router
from app.api.routes.search import router as search_router
from app.core.database import init_db
from app.core.logging import setup_logging

setup_logging()
logger = logging.getLogger("blastradius.http")

app = FastAPI(title="Blast Radius")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(repos_router)
app.include_router(graph_router)
app.include_router(analysis_router)
app.include_router(search_router)
app.include_router(chat_router)
app.include_router(admin_router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(f"{request.method} {request.url.path} {response.status_code} {elapsed_ms:.0f}ms")
    return response


@app.on_event("startup")
def on_startup():
    init_db()
