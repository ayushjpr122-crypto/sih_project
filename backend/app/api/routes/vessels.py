"""GET /api/v1/vessels — vessel class reference."""
from __future__ import annotations

from fastapi import APIRouter

from app.services import reference_data as ref

router = APIRouter(tags=["reference"])


@router.get("/vessels", summary="List vessel classes with dimensions")
async def list_vessels():
    df = ref.load_vessels_df()
    vessels = df.to_dict(orient="records")
    return {"count": len(vessels), "vessels": vessels,
            "note": "Dimensions are class-representative medians, not single-ship specs."}
