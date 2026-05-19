# ai/api_contracts/geo_improvement_output.py
"""Defines GEO improvement output contracts for generated product updates."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ai.api_contracts.user_fact_questions import UserFactQuestion


SuggestedAttributeStatus = Literal["missing", "suggested", "confirmed"]


class SelectedStrategy(BaseModel):
    """Explainable strategy selected by the optimization flow."""

    name: str = Field(min_length=1)
    reason: str = Field(min_length=1)


class GeneratedFaqItem(BaseModel):
    """Grounded FAQ item generated for Turkish buyer intent coverage."""

    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    grounded_in: list[str] = Field(default_factory=list, alias="groundedIn")


class SuggestedAttribute(BaseModel):
    """Product attribute recommendation that should not be treated as fact yet."""

    name: str = Field(min_length=1)
    label: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    status: SuggestedAttributeStatus = "suggested"


class GeneratedProductContent(BaseModel):
    """Generated product content and structured outputs for user review."""

    model_config = ConfigDict(populate_by_name=True)

    title: str | None = None
    short_description: str | None = Field(default=None, alias="shortDescription")
    long_description: str | None = Field(default=None, alias="longDescription")
    faq: list[GeneratedFaqItem] = Field(default_factory=list)
    suggested_attributes: list[SuggestedAttribute] = Field(
        default_factory=list,
        alias="suggestedAttributes",
    )
    schema_json_ld: dict[str, Any] = Field(default_factory=dict, alias="schemaJsonLd")
    seo_title: str | None = Field(default=None, alias="seoTitle")
    meta_description: str | None = Field(default=None, alias="metaDescription")
    ai_answer_preview: str | None = Field(default=None, alias="aiAnswerPreview")


class ImprovementValidation(BaseModel):
    """Validation result for generated content and anti-hallucination checks."""

    passed: bool
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_passed_state(self) -> "ImprovementValidation":
        """Prevent a passing validation result from carrying hard errors."""
        if self.passed and self.errors:
            raise ValueError("passed validation cannot include errors")
        return self


class EstimatedLayerScore(BaseModel):
    """Compact after-improvement score for one GEO layer."""

    model_config = ConfigDict(populate_by_name=True)

    score: float = Field(ge=0, le=100)
    max_score: float = Field(default=100.0, ge=0, alias="maxScore")
    weighted_points: float = Field(ge=0, alias="weightedPoints")
    max_weighted_points: float = Field(gt=0, alias="maxWeightedPoints")


class ScoreEstimateLayers(BaseModel):
    """Estimated after-improvement scores for the four GEO layers."""

    model_config = ConfigDict(populate_by_name=True)

    retrieval: EstimatedLayerScore
    machine_understanding: EstimatedLayerScore = Field(alias="machineUnderstanding")
    reranking_strength: EstimatedLayerScore = Field(alias="rerankingStrength")
    ai_answer_readiness: EstimatedLayerScore = Field(alias="aiAnswerReadiness")


class ScoreEstimate(BaseModel):
    """Estimated GEO score after applying approved improvements."""

    model_config = ConfigDict(populate_by_name=True)

    after: float = Field(ge=0, le=100)
    layers: ScoreEstimateLayers
    expected_gain_reasons: list[str] = Field(
        default_factory=list,
        alias="expectedGainReasons",
    )


class BeforeAfterChange(BaseModel):
    """Reviewable before/after change for one product field."""

    before: str | None = None
    after: str | None = None


class GeoImprovementOutput(BaseModel):
    """Optimization output returned for user review before export or publishing."""

    model_config = ConfigDict(populate_by_name=True)

    selected_strategies: list[SelectedStrategy] = Field(
        default_factory=list,
        alias="selectedStrategies",
    )
    needs_user_input: list[UserFactQuestion] = Field(
        default_factory=list,
        alias="needsUserInput",
    )
    user_confirmed_facts: dict[str, Any] = Field(
        default_factory=dict,
        alias="userConfirmedFacts",
    )
    generated: GeneratedProductContent = Field(default_factory=GeneratedProductContent)
    validation: ImprovementValidation
    score_estimate: ScoreEstimate | None = Field(default=None, alias="scoreEstimate")
    before_after: dict[str, BeforeAfterChange] = Field(
        default_factory=dict,
        alias="beforeAfter",
    )

    @model_validator(mode="after")
    def validate_generation_state(self) -> "GeoImprovementOutput":
        """Separate missing-fact questions from final generated content."""
        if self.needs_user_input and self.validation.passed:
            raise ValueError("outputs needing user input cannot pass final validation")
        return self
