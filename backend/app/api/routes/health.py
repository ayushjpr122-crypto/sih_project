"""GET /api/v1/health"""
from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.schemas.decision import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Service health")
async def health() -> HealthResponse:
    return HealthResponse(app=settings.app_name,
                          data_disclosure=settings.data_disclosure)
