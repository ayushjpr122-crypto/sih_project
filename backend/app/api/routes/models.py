"""GET /api/v1/models — which trained models serve each horizon."""
from __future__ import annotations

from fastapi import APIRouter

from app.services import forecast_service

router = APIRouter(tags=["models"])


@router.get("/models", summary="Trained-model selection per horizon")
async def list_models():
    info = forecast_service.get_model_info()
    return {
        **info,
        "data_disclosure": "Prototype uses synthetic/domain-informed data for "
                           "demonstration. Production deployment requires "
                           "validated historical freight, vessel, port, "
                           "procurement, and voyage datasets.",
    }
