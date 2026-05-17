# ai/main.py
"""FastAPI application entrypoint for the Bulunur AI/GEO service."""

from __future__ import annotations

from fastapi import FastAPI

from ai.api.routers import analysis_router, health_router, optimization_router


def create_app() -> FastAPI:
    """Build and configure the AI/GEO FastAPI application."""
    app = FastAPI(
        title="Bulunur AI Service",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.include_router(health_router)
    app.include_router(analysis_router)
    app.include_router(optimization_router)
    return app


app = create_app()


__all__ = ["app", "create_app"]
