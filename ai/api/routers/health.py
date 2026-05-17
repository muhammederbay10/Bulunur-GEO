# ai/api/routers/health.py
"""Health endpoint for deployment checks and basic service diagnostics."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Minimal health response for infrastructure checks."""

    status: Literal["ok"]
    service: str


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Return a deployment-safe health payload."""
    return HealthResponse(status="ok", service="bulunur-ai")

