# ai/geo_engine/strategies/base.py
"""Defines shared contracts for GEO improvement strategies."""

from __future__ import annotations

from typing import Any, Literal, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ai.api_contracts.geo_improvement_output import GeneratedProductContent, SelectedStrategy
from ai.geo_engine.types import GeoScoreLayer


StrategyId = Literal[
    "schema_repair",
    "attribute_completion",
    "turkish_buyer_intent_rewrite",
    "turkish_faq_enrichment",
]

STRATEGY_SCHEMA_REPAIR: StrategyId = "schema_repair"
STRATEGY_ATTRIBUTE_COMPLETION: StrategyId = "attribute_completion"
STRATEGY_BUYER_INTENT_REWRITE: StrategyId = "turkish_buyer_intent_rewrite"
STRATEGY_FAQ_ENRICHMENT: StrategyId = "turkish_faq_enrichment"

STRATEGY_DISPLAY_NAMES: dict[StrategyId, str] = {
    STRATEGY_SCHEMA_REPAIR: "Schema Repair",
    STRATEGY_ATTRIBUTE_COMPLETION: "Attribute Completion",
    STRATEGY_BUYER_INTENT_REWRITE: "Turkish Buyer Intent Rewrite",
    STRATEGY_FAQ_ENRICHMENT: "Turkish FAQ Enrichment",
}

STRATEGY_SKILL_PATHS: dict[StrategyId, str] = {
    STRATEGY_SCHEMA_REPAIR: "optimization/schema_repair",
    STRATEGY_ATTRIBUTE_COMPLETION: "optimization/attribute_completion",
    STRATEGY_BUYER_INTENT_REWRITE: "optimization/turkish_buyer_intent_rewrite",
    STRATEGY_FAQ_ENRICHMENT: "optimization/turkish_faq_enrichment",
}

STRATEGY_TARGET_LAYERS: dict[StrategyId, tuple[GeoScoreLayer, ...]] = {
    STRATEGY_SCHEMA_REPAIR: ("machine_understanding",),
    STRATEGY_ATTRIBUTE_COMPLETION: ("machine_understanding", "reranking_strength"),
    STRATEGY_BUYER_INTENT_REWRITE: ("retrieval", "ai_answer_readiness"),
    STRATEGY_FAQ_ENRICHMENT: ("ai_answer_readiness",),
}

STRATEGY_PRIORITY: dict[StrategyId, int] = {
    STRATEGY_SCHEMA_REPAIR: 10,
    STRATEGY_ATTRIBUTE_COMPLETION: 20,
    STRATEGY_FAQ_ENRICHMENT: 30,
    STRATEGY_BUYER_INTENT_REWRITE: 40,
}


class ImprovementStrategySelection(BaseModel):
    """One selected optimization strategy with execution metadata."""

    model_config = ConfigDict(populate_by_name=True)

    strategy_id: StrategyId = Field(alias="strategyId")
    name: str = Field(min_length=1)
    skill_path: str = Field(alias="skillPath", min_length=1)
    target_layers: list[GeoScoreLayer] = Field(alias="targetLayers", min_length=1)
    reason: str = Field(min_length=1)
    priority: int = Field(ge=0)

    @field_validator("name", "skill_path", "reason")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Reject blank strategy text fields."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("strategy text fields cannot be blank")
        return normalized

    @field_validator("target_layers", mode="before")
    @classmethod
    def normalize_target_layers(cls, values: Any) -> list[GeoScoreLayer]:
        """Normalize target layers while preserving first-seen order."""
        if isinstance(values, str):
            raw_values = (values,)
        else:
            raw_values = values or ()

        seen: set[str] = set()
        normalized_layers: list[GeoScoreLayer] = []
        for raw_value in raw_values:
            value = str(raw_value).strip()
            if not value or value in seen:
                continue
            seen.add(value)
            normalized_layers.append(cast(GeoScoreLayer, value))

        return normalized_layers

    def to_api_strategy(self) -> SelectedStrategy:
        """Convert this selection into the public improvement output shape."""
        return SelectedStrategy(name=self.name, reason=self.reason)


class StrategySelectionResult(BaseModel):
    """Deterministic strategy-selection output for the optimization flow."""

    model_config = ConfigDict(populate_by_name=True)

    selected_strategies: list[ImprovementStrategySelection] = Field(
        default_factory=list,
        alias="selectedStrategies",
    )
    weakest_layers: list[GeoScoreLayer] = Field(default_factory=list, alias="weakestLayers")
    strategy_reasons: dict[str, str] = Field(default_factory=dict, alias="strategyReasons")

    @model_validator(mode="after")
    def validate_strategy_reasons(self) -> "StrategySelectionResult":
        """Keep the reason lookup aligned with selected strategies."""
        if self.selected_strategies and not self.strategy_reasons:
            self.strategy_reasons = {
                strategy.strategy_id: strategy.reason
                for strategy in self.selected_strategies
            }
        return self

    def to_api_strategies(self) -> list[SelectedStrategy]:
        """Return selected strategies in the public API contract shape."""
        return [strategy.to_api_strategy() for strategy in self.selected_strategies]


class StrategyExecutionResult(BaseModel):
    """Mergeable output returned by one optimization strategy."""

    model_config = ConfigDict(populate_by_name=True)

    strategy_id: StrategyId = Field(alias="strategyId")
    name: str = Field(min_length=1)
    generated: GeneratedProductContent = Field(default_factory=GeneratedProductContent)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    missing_facts: list[str] = Field(default_factory=list, alias="missingFacts")
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Reject blank strategy names."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("strategy name cannot be blank")
        return normalized

    @field_validator("warnings", "errors", "missing_facts", mode="before")
    @classmethod
    def normalize_messages(cls, values: Any) -> list[str]:
        """Normalize user-visible strategy messages."""
        if values is None:
            return []
        if isinstance(values, str):
            raw_values = (values,)
        else:
            raw_values = values

        normalized_messages: list[str] = []
        seen: set[str] = set()
        for raw_value in raw_values:
            message = str(raw_value).strip()
            if not message or message in seen:
                continue
            seen.add(message)
            normalized_messages.append(message)
        return normalized_messages


__all__ = [
    "ImprovementStrategySelection",
    "STRATEGY_ATTRIBUTE_COMPLETION",
    "STRATEGY_BUYER_INTENT_REWRITE",
    "STRATEGY_DISPLAY_NAMES",
    "STRATEGY_FAQ_ENRICHMENT",
    "STRATEGY_PRIORITY",
    "STRATEGY_SCHEMA_REPAIR",
    "STRATEGY_SKILL_PATHS",
    "STRATEGY_TARGET_LAYERS",
    "StrategyExecutionResult",
    "StrategyId",
    "StrategySelectionResult",
]
