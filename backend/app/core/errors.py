"""Centralized error model. Never expose stack traces to API clients."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

log = get_logger("errors")


class ScenarioError(ValueError):
    """400 - invalid scenario (unknown cargo/route combo, infeasible input)."""


class NotFoundError(LookupError):
    """404 - unknown port / vessel."""


class InferenceError(RuntimeError):
    """500 - internal model/inference failure (message sanitized)."""


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ScenarioError)
    async def _scenario(request: Request, exc: ScenarioError):
        log.warning("400 scenario error: %s", exc)
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(NotFoundError)
    async def _not_found(request: Request, exc: NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(InferenceError)
    async def _inference(request: Request, exc: InferenceError):
        log.exception("500 inference failure (sanitized to client)")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal model/inference error. Please retry later."},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        # 422 with structured, non-sensitive details (default FastAPI shape).
        return JSONResponse(
            status_code=422, content={"detail": jsonable_encoder(exc.errors())}
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.detail}
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("500 unhandled (sanitized to client)")
        return JSONResponse(
            status_code=500, content={"detail": "Internal server error."}
        )
