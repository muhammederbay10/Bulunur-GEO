# ai/api_contracts/__init__.py
"""Public API contract models for backend and AI/GEO integration."""

from ai.api_contracts.crawl_metadata import CrawlMetadata
from ai.api_contracts.geo_analysis_output import (
    GeoAnalysisOutput,
    LayerScore,
    ScoreBreakdown,
)
from ai.api_contracts.geo_improvement_output import (
    BeforeAfterChange,
    GeneratedFaqItem,
    GeneratedProductContent,
    GeoImprovementOutput,
    ImprovementValidation,
    ScoreEstimate,
    SelectedStrategy,
    SuggestedAttribute,
)
from ai.api_contracts.product_input import ProductInput, RawExtractedData
from ai.api_contracts.user_fact_questions import UserFactQuestion

__all__ = [
    "BeforeAfterChange",
    "CrawlMetadata",
    "GeneratedFaqItem",
    "GeneratedProductContent",
    "GeoAnalysisOutput",
    "GeoImprovementOutput",
    "ImprovementValidation",
    "LayerScore",
    "ProductInput",
    "RawExtractedData",
    "ScoreEstimate",
    "ScoreBreakdown",
    "SelectedStrategy",
    "SuggestedAttribute",
    "UserFactQuestion",
]
