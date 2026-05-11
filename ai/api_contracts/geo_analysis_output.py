# ai/api_contracts/geo_analysis_output.py
"""Defines GEO analysis output contracts for four-layer scoring."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class LayerScore(BaseModel):
    """Score details for one GEO scoring layer."""

    model_config = ConfigDict(populate_by_name=True)

    score: float = Field(ge=0, le=100)
    max_score: float = Field(default=100, ge=1, alias="maxScore")
    weighted_points: float = Field(ge=0, alias="weightedPoints")
    max_weighted_points: float = Field(gt=0, alias="maxWeightedPoints")
    reasons: list[str] = Field(default_factory=list)
    missing_signals: list[str] = Field(default_factory=list, alias="missingSignals")
    recommended_next_action: str | None = Field(
        default=None,
        alias="recommendedNextAction",
    )

    @model_validator(mode="after")
    def validate_weighted_points(self) -> "LayerScore":
        """Ensure weighted score cannot exceed its layer budget."""
        if self.weighted_points > self.max_weighted_points:
            raise ValueError("weightedPoints cannot exceed maxWeightedPoints")
        return self


class ScoreBreakdown(BaseModel):
    """Weighted score breakdown for Bulunur's four GEO layers."""

    model_config = ConfigDict(populate_by_name=True)

    retrieval: LayerScore
    machine_understanding: LayerScore = Field(alias="machineUnderstanding")
    reranking_strength: LayerScore = Field(alias="rerankingStrength")
    ai_answer_readiness: LayerScore = Field(alias="aiAnswerReadiness")

    @model_validator(mode="after")
    def validate_layer_weights(self) -> "ScoreBreakdown":
        """Keep layer budgets aligned with the agreed 100-point rubric."""
        expected_weights = {
            "retrieval": 25,
            "machine_understanding": 30,
            "reranking_strength": 25,
            "ai_answer_readiness": 20,
        }
        for field_name, expected_weight in expected_weights.items():
            layer = getattr(self, field_name)
            if layer.max_weighted_points != expected_weight:
                raise ValueError(
                    f"{field_name} maxWeightedPoints must be {expected_weight}"
                )
        return self

    @computed_field(alias="totalWeightedPoints")
    @property
    def total_weighted_points(self) -> float:
        """Return the summed weighted contribution across all layers."""
        return (
            self.retrieval.weighted_points
            + self.machine_understanding.weighted_points
            + self.reranking_strength.weighted_points
            + self.ai_answer_readiness.weighted_points
        )


class GeoAnalysisOutput(BaseModel):
    """Current GEO state returned after analyzing one product."""

    model_config = ConfigDict(populate_by_name=True)

    overall_score: float = Field(ge=0, le=100, alias="overallScore")
    scores: ScoreBreakdown
    detected_category: str | None = Field(default=None, alias="detectedCategory")
    buyer_intent_variants: list[str] = Field(
        default_factory=list,
        alias="buyerIntentVariants",
    )
    known_facts: dict[str, Any] = Field(default_factory=dict, alias="knownFacts")
    missing_facts: list[str] = Field(default_factory=list, alias="missingFacts")
    main_problems: list[str] = Field(default_factory=list, alias="mainProblems")
    recommended_action: str = Field(alias="recommendedAction")

    @model_validator(mode="after")
    def validate_overall_score(self) -> "GeoAnalysisOutput":
        """Keep the top-level score aligned with the weighted layer total."""
        total = round(self.scores.total_weighted_points, 2)
        if abs(self.overall_score - total) > 0.01:
            raise ValueError("overallScore must equal summed weighted layer points")
        return self
