# ai/api/routers/__init__.py
"""FastAPI router exports for AI/GEO HTTP endpoints."""

from ai.api.routers.analysis import router as analysis_router
from ai.api.routers.health import router as health_router
from ai.api.routers.optimization import router as optimization_router

__all__ = ["analysis_router", "health_router", "optimization_router"]
