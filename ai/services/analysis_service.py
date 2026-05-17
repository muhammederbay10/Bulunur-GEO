# ai/services/analysis_service.py
"""Service wrapper for the GEO analysis workflow entrypoint."""

from __future__ import annotations

from ai.agents.analysis import analyze_product as run_analysis_workflow
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.product_input import ProductInput


class AnalysisService:
    """Thin service layer for analysis workflow orchestration."""

    def analyze_product(self, product_input: ProductInput) -> GeoAnalysisOutput:
        """Run the existing analysis workflow without duplicating GEO logic."""
        return run_analysis_workflow(product_input)

