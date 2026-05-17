# ai/api/dependencies.py
"""Dependency providers for API router services and internal auth."""

from __future__ import annotations

import os
import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from ai.services.analysis_service import AnalysisService
from ai.services.optimization_service import OptimizationService


SERVICE_SECRET_ENV = "SERVICE_AUTH_SECRET_KEY"
BEARER_PREFIX = "Bearer "


def verify_service_auth(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Verify server-to-server bearer auth for protected AI endpoints."""
    expected_secret = os.getenv(SERVICE_SECRET_ENV)
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service auth secret key is not configured",
        )

    if not authorization or not authorization.startswith(BEARER_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing internal service authorization",
        )

    provided_secret = authorization.removeprefix(BEARER_PREFIX).strip()
    if not secrets.compare_digest(provided_secret, expected_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service authorization",
        )


def get_analysis_service() -> AnalysisService:
    """Return the analysis service used by API endpoints."""
    return AnalysisService()


def get_optimization_service() -> OptimizationService:
    """Return the optimization service used by API endpoints."""
    return OptimizationService()


__all__ = [
    "SERVICE_SECRET_ENV",
    "get_analysis_service",
    "get_optimization_service",
    "verify_service_auth",
]
