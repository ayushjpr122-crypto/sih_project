"""FastAPI application: versioned API, CORS for local React, safe errors."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import decision, health, models, ports, scenario, vessels
from app.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import get_logger
from app.db.database import init_db

log = get_logger("main", settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    log.info("%s started", settings.app_name)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description=(
            "Intelligent freight forecasting for optimized vessel chartering "
            "and bulk cargo procurement (overseas -> East Coast of India). "
            + settings.data_disclosure
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(ports.router, prefix="/api/v1")
    app.include_router(vessels.router, prefix="/api/v1")
    app.include_router(models.router, prefix="/api/v1")
    app.include_router(scenario.router, prefix="/api/v1")
    app.include_router(decision.router, prefix="/api/v1")

    @app.get("/", tags=["root"])
    async def root():
        return {"app": settings.app_name, "docs": "/docs",
                "health": "/api/v1/health"}

    return app


app = create_app()
