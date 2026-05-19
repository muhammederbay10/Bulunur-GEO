# ai/services/optimization_service.py
"""Service wrapper for the GEO optimization workflow entrypoint."""

from __future__ import annotations

from typing import Any

from ai.agents.optimization import improve_product as run_optimization_workflow
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.geo_improvement_output import GeoImprovementOutput
from ai.api_contracts.product_input import ProductInput


class OptimizationService:
    """Thin service layer for optimization workflow orchestration."""

    def improve_product(
        self,
        product_input: ProductInput,
        analysis_output: GeoAnalysisOutput,
        user_facts: dict[str, Any] | None = None,
    ) -> GeoImprovementOutput:
        """Run the existing optimization workflow using shared contracts."""
        return run_optimization_workflow(
            product_input,
            analysis_output,
            user_facts=user_facts,
            metadata={"useSemanticContentJudgment": True},
        )

