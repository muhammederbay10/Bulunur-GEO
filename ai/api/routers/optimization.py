# ai/api/routers/optimization.py
"""HTTP route scaffold for GEO optimization workflow execution."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from ai.api.dependencies import get_optimization_service, verify_service_auth
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.geo_improvement_output import GeoImprovementOutput
from ai.api_contracts.product_input import ProductInput
from ai.services.optimization_service import OptimizationService


logger = logging.getLogger(__name__)


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
        # [DEBUG]
        logger.warning(
            "[DEBUG] improve-product request productId=%s analysisScore=%s userFacts=%s",
            request.product.product_id,
            request.analysis.overall_score,
            request.user_facts,
        )
        output = optimization_service.improve_product(
            product_input=request.product,
            analysis_output=request.analysis,
            user_facts=request.user_facts,
        )
        # [DEBUG]
        logger.warning(
            "[DEBUG] improve-product response productId=%s validationPassed=%s scoreEstimate=%s needsUserInput=%s",
            request.product.product_id,
            output.validation.passed,
            output.score_estimate.model_dump(mode="json", by_alias=True)
            if output.score_estimate
            else None,
            [question.field for question in output.needs_user_input],
        )
        return output
    except Exception as exc:
        # [DEBUG]
        logger.exception(
            "[DEBUG] improve-product failed productId=%s analysisScore=%s userFacts=%s",
            request.product.product_id,
            request.analysis.overall_score,
            request.user_facts,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="optimization pipeline failed",
        ) from exc
