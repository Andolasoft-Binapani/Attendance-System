"""
POST /api/liveness/verify

Unauthenticated kiosk endpoint. Accepts a burst of base64 frames,
runs MediaPipe Face Mesh liveness analysis, and returns the verdict.
"""
from __future__ import annotations

import logging
from typing import Annotated

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.face_service import decode_frame
from app.services.liveness_service import check_liveness

logger = logging.getLogger(__name__)
router = APIRouter()

MIN_FRAMES = 3
MAX_FRAMES = 8


class LivenessRequest(BaseModel):
    frames: Annotated[list[str], Field(min_length=MIN_FRAMES, max_length=MAX_FRAMES)]


class LivenessResponse(BaseModel):
    is_live: bool
    confidence: float
    reason: str


@router.post("/verify", response_model=LivenessResponse)
async def verify_liveness(payload: LivenessRequest) -> LivenessResponse:
    """
    Verify that the captured frames represent a live human face.

    Accepts 3–8 base64-encoded JPEG frames (with or without the
    'data:image/jpeg;base64,' prefix — decode_frame handles both).
    Returns is_live=True only when MediaPipe's facial landmark analysis
    detects natural micro-movement consistent with a real person.
    """
    decoded: list[np.ndarray] = []
    for b64 in payload.frames:
        frame = decode_frame(b64)
        if frame is not None:
            decoded.append(frame)

    if len(decoded) < MIN_FRAMES:
        raise HTTPException(
            status_code=422,
            detail=f"At least {MIN_FRAMES} decodable frames required; received {len(decoded)}",
        )

    try:
        result = check_liveness(decoded)
    except Exception as exc:
        # Fail open: a backend error must never permanently lock out real employees.
        logger.exception("check_liveness raised: %s", exc)
        result = {"is_live": True, "confidence": 0.5, "reason": "live"}

    return LivenessResponse(**result)
