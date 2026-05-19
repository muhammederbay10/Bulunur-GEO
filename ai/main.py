# ai/main.py
"""FastAPI application entrypoint for the Bulunur AI/GEO service."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai.api.routers import analysis_router, health_router, optimization_router


DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://amount-dallying-approve.ngrok-free.dev",
    "https://bulunur-btk-hackathon.vercel.app/",
    "https://bulunur.shop/",
)
CORS_ORIGINS_ENV = "AI_CORS_ALLOW_ORIGINS"


def create_app() -> FastAPI:
    """Build and configure the AI/GEO FastAPI application."""
    app = FastAPI(
        title="Bulunur AI Service",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(analysis_router)
    app.include_router(optimization_router)
    return app


def _cors_origins() -> list[str]:
    """Return allowed browser origins for local or deployed frontend clients."""
    configured_origins = os.getenv(CORS_ORIGINS_ENV)
    if not configured_origins:
        return list(DEFAULT_CORS_ORIGINS)

    return [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]


app = create_app()


__all__ = ["CORS_ORIGINS_ENV", "app", "create_app"]
