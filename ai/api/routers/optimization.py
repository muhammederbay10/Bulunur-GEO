# ai/api/routers/optimization.py
"""HTTP route scaffold for GEO optimization workflow execution."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from ai.api.dependencies import get_optimization_service, verify_service_auth
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.geo_improvement_output import GeoImprovementOutput
from ai.api_contracts.product_input import ProductInput
from ai.services.optimization_service import OptimizationService


class ImproveProductRequest(BaseModel):
    """Request payload for the GEO optimization endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    product: ProductInput
    analysis: GeoAnalysisOutput
    user_facts: dict[str, Any] | None = Field(default=None, alias="userFacts")


router = APIRouter(
    prefix="/ai",
    tags=["optimization"],
    dependencies=[Depends(verify_service_auth)],
)


@router.post("/improve-product", response_model=GeoImprovementOutput)
def improve_product(
    request: ImproveProductRequest,
    optimization_service: OptimizationService = Depends(get_optimization_service),
) -> GeoImprovementOutput:
    """Run the optimization workflow with optional user-confirmed facts."""
    try:
        return optimization_service.improve_product(
            product_input=request.product,
            analysis_output=request.analysis,
            user_facts=request.user_facts,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="optimization pipeline failed",
        ) from exc
