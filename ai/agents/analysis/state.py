# ai/agents/analysis/state.py
"""Defines state models for the LangGraph GEO analysis agent."""

from __future__ import annotations

from typing import Any, Required, TypedDict

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.types import (
    FourLayerGeoScore,
    GeminiLayerJudgment,
    GeoScoreLayer,
    LayerScoreResult,
    TurkishNlpScoringSignals,
)
from ai.schema_engine.types import SchemaValidationResult


class AnalysisNormalizedText(BaseModel):
    """Normalized product and crawler text prepared before LLM calls."""

    model_config = ConfigDict(populate_by_name=True)

    title: str = ""
    description: str = ""
    short_description: str = Field(default="", alias="shortDescription")
    page_title: str = Field(default="", alias="pageTitle")
    meta_description: str = Field(default="", alias="metaDescription")
    body_text: str = Field(default="", alias="bodyText")
    borrowed_terms_normalized_text: str = Field(
        default="",
        alias="borrowedTermsNormalizedText",
    )

    @field_validator(
        "title",
        "description",
        "short_description",
        "page_title",
        "meta_description",
        "body_text",
        "borrowed_terms_normalized_text",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: Any) -> str:
        """Coerce optional text values into stripped strings."""
        if value is None:
            return ""
        return str(value).strip()


class AnalysisProductFacts(BaseModel):
    """Known and missing product facts gathered for scoring context."""

    model_config = ConfigDict(populate_by_name=True)

    known_facts: dict[str, Any] = Field(default_factory=dict, alias="knownFacts")
    missing_facts: list[str] = Field(default_factory=list, alias="missingFacts")
    known_attributes: dict[str, Any] = Field(
        default_factory=dict,
        alias="knownAttributes",
    )
    unknown_attributes: dict[str, Any] = Field(
        default_factory=dict,
        alias="unknownAttributes",
    )
    missing_attribute_hints: list[str] = Field(
        default_factory=list,
        alias="missingAttributeHints",
    )

    @field_validator("missing_facts", "missing_attribute_hints", mode="before")
    @classmethod
    def normalize_fact_lists(cls, values: Any) -> list[str]:
        """Normalize fact lists while preserving first-seen order."""
        return _dedupe_text(values)


class AnalysisSchemaSummary(BaseModel):
    """Compact schema state that graph nodes can pass to scoring and prompts."""

    model_config = ConfigDict(populate_by_name=True)

    has_structured_data: bool = Field(default=False, alias="hasStructuredData")
    product_schema_present: bool = Field(default=False, alias="productSchemaPresent")
    offer_schema_present: bool = Field(default=False, alias="offerSchemaPresent")
    valid: bool = False
    issue_codes: list[str] = Field(default_factory=list, alias="issueCodes")
    missing_fields: list[str] = Field(default_factory=list, alias="missingFields")
    warning_messages: list[str] = Field(default_factory=list, alias="warningMessages")

    @field_validator("issue_codes", "missing_fields", "warning_messages", mode="before")
    @classmethod
    def normalize_schema_lists(cls, values: Any) -> list[str]:
        """Normalize schema summary lists while preserving first-seen order."""
        return _dedupe_text(values)

    @classmethod
    def from_validation(
        cls,
        validation: SchemaValidationResult,
        *,
        has_structured_data: bool,
    ) -> "AnalysisSchemaSummary":
        """Build the prompt-safe summary from a schema validation result."""
        return cls(
            hasStructuredData=has_structured_data,
            productSchemaPresent=validation.product_schema_present,
            offerSchemaPresent=validation.offer_schema_present,
            valid=validation.valid,
            issueCodes=[issue.code for issue in validation.issues],
            missingFields=[
                status.field
                for status in validation.field_statuses
                if status.status == "missing"
            ],
            warningMessages=validation.warnings,
        )


LayerScoreMap = dict[GeoScoreLayer, LayerScoreResult]
SemanticJudgmentMap = dict[GeoScoreLayer, GeminiLayerJudgment]


class AnalysisGraphState(TypedDict, total=False):
    """Incremental LangGraph state for the GEO analysis workflow."""

    product_input: Required[ProductInput]
    normalized_text: AnalysisNormalizedText
    product_facts: AnalysisProductFacts
    missing_facts: list[str]
    detected_category: str | None
    buyer_intent_variants: list[str]
    schema_summary: AnalysisSchemaSummary
    schema_validation: SchemaValidationResult
    turkish_nlp_signals: TurkishNlpScoringSignals
    semantic_judgments: SemanticJudgmentMap
    layer_scores: LayerScoreMap
    final_score: FourLayerGeoScore
    final_output: GeoAnalysisOutput
    metadata: dict[str, Any]
    errors: list[str]


def create_initial_analysis_state(product_input: ProductInput) -> AnalysisGraphState:
    """Create the initial state passed into the compiled analysis graph."""
    return {
        "product_input": product_input,
        "missing_facts": [],
        "buyer_intent_variants": [],
        "semantic_judgments": {},
        "layer_scores": {},
        "metadata": {},
        "errors": [],
    }


def _dedupe_text(values: Any) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        iterable = (values,)
    else:
        try:
            iterable = iter(values)
        except TypeError:
            iterable = (values,)

    seen: set[str] = set()
    normalized_values: list[str] = []
    for value in iterable:
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        normalized_values.append(normalized)
    return normalized_values


__all__ = [
    "AnalysisGraphState",
    "AnalysisNormalizedText",
    "AnalysisProductFacts",
    "AnalysisSchemaSummary",
    "LayerScoreMap",
    "SemanticJudgmentMap",
    "create_initial_analysis_state",
]
