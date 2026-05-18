# ai/api/routers/analysis.py
"""HTTP route for running GEO analysis on a single product payload."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from ai.api.dependencies import get_analysis_service, verify_service_auth
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.product_input import ProductInput
from ai.services.analysis_service import AnalysisService


logger = logging.getLogger(__name__)

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
        # [DEBUG]
        logger.warning(
            "[DEBUG] analyze-product request productId=%s source=%s url=%s crawlStatus=%s",
            product_input.product_id,
            product_input.source,
            product_input.url,
            product_input.crawl_metadata.crawl_status,
        )
        output = analysis_service.analyze_product(product_input)
        # [DEBUG]
        logger.warning(
            "[DEBUG] analyze-product response productId=%s overallScore=%s detectedCategory=%s missingFacts=%s",
            product_input.product_id,
            output.overall_score,
            output.detected_category,
            output.missing_facts,
        )
        return output
    except Exception as exc:
        # [DEBUG]
        logger.exception(
            "[DEBUG] analyze-product failed productId=%s source=%s",
            product_input.product_id,
            product_input.source,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="analysis pipeline failed",
        ) from exc
