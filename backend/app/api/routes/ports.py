"""GET /api/v1/ports — East-coast India port constraints."""
from __future__ import annotations

from fastapi import APIRouter

from app.services import reference_data as ref

router = APIRouter(tags=["reference"])


@router.get("/ports", summary="List east-coast India ports with constraints")
async def list_ports():
    df = ref.load_ports_df()
    ports = df.to_dict(orient="records")
    return {"count": len(ports), "ports": ports,
            "note": "max_draft_m/max_loa_m/max_beam_m are proxy-representative; "
                    "verify berth-wise notices for operations."}
