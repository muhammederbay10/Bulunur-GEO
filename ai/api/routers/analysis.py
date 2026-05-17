# ai/api/routers/analysis.py
"""HTTP route for running GEO analysis on a single product payload."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ai.api.dependencies import get_analysis_service, verify_service_auth
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.product_input import ProductInput
from ai.services.analysis_service import AnalysisService


router = APIRouter(
    prefix="/ai",
    tags=["analysis"],
    dependencies=[Depends(verify_service_auth)],
)


@router.post("/analyze-product", response_model=GeoAnalysisOutput)
def analyze_product(
    product_input: ProductInput,
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> GeoAnalysisOutput:
    """Run the analysis workflow for one product and return public output."""
    try:
        return analysis_service.analyze_product(product_input)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="analysis pipeline failed",
        ) from exc
