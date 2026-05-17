# ai/agents/optimization/state.py
"""Defines state models for the LangGraph GEO optimization agent."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any, Required, TypedDict

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.geo_improvement_output import (
    BeforeAfterChange,
    GeneratedProductContent,
    GeoImprovementOutput,
)
from ai.api_contracts.product_input import ProductInput
from ai.api_contracts.user_fact_questions import UserFactQuestion
from ai.geo_engine.improvement.estimate_improved_score import ImprovedScoreEstimateResult
from ai.geo_engine.improvement.validate_improvement import ImprovementValidationResult
from ai.geo_engine.strategies.base import (
    ImprovementStrategySelection,
    StrategyExecutionResult,
    StrategySelectionResult,
)
from ai.geo_engine.types import GeoScoreLayer, TurkishNlpScoringSignals
from ai.schema_engine.types import SchemaValidationResult


class OptimizationFactState(BaseModel):
    """Known, missing, and user-confirmed facts used during optimization."""

    model_config = ConfigDict(populate_by_name=True)

    known_facts: dict[str, Any] = Field(default_factory=dict, alias="knownFacts")
    missing_facts: list[str] = Field(default_factory=list, alias="missingFacts")
    user_confirmed_facts: dict[str, Any] = Field(
        default_factory=dict,
        alias="userConfirmedFacts",
    )

    @field_validator("missing_facts", mode="before")
    @classmethod
    def normalize_missing_facts(cls, values: Any) -> list[str]:
        """Normalize missing fact names while preserving first-seen order."""
        return _dedupe_text(values)

    def merged_known_facts(self) -> dict[str, Any]:
        """Return known facts with user-confirmed facts taking precedence."""
        return _deep_merge_mappings(self.known_facts, self.user_confirmed_facts)

    def unresolved_missing_facts(self) -> list[str]:
        """Return missing facts not covered by user-confirmed facts."""
        confirmed_paths = set(_confirmed_fact_paths(self.user_confirmed_facts))
        unresolved: list[str] = []
        for fact in self.missing_facts:
            normalized = fact.strip()
            if not normalized or normalized in unresolved:
                continue
            if _fact_is_confirmed(normalized, confirmed_paths):
                continue
            unresolved.append(normalized)
        return unresolved


class OptimizationWeakness(BaseModel):
    """One weak GEO layer identified before strategy selection."""

    model_config = ConfigDict(populate_by_name=True)

    layer: GeoScoreLayer
    score: float = Field(ge=0, le=100)
    missing_signals: list[str] = Field(default_factory=list, alias="missingSignals")
    reason: str = Field(min_length=1)

    @field_validator("missing_signals", mode="before")
    @classmethod
    def normalize_missing_signals(cls, values: Any) -> list[str]:
        """Normalize weakness signal text."""
        return _dedupe_text(values)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        """Reject blank weakness reasons."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("reason cannot be blank")
        return normalized


class OptimizationGeneratedState(BaseModel):
    """Generated improvement content plus per-strategy execution details."""

    model_config = ConfigDict(populate_by_name=True)

    content: GeneratedProductContent = Field(default_factory=GeneratedProductContent)
    strategy_results: list[StrategyExecutionResult] = Field(
        default_factory=list,
        alias="strategyResults",
    )
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

    @field_validator("warnings", "errors", mode="before")
    @classmethod
    def normalize_messages(cls, values: Any) -> list[str]:
        """Normalize generated-content warning and error messages."""
        return _dedupe_text(values)


class OptimizationGraphState(TypedDict, total=False):
    """Incremental LangGraph state for the GEO optimization workflow."""

    product_input: Required[ProductInput]
    analysis_output: Required[GeoAnalysisOutput]
    fact_state: OptimizationFactState
    known_facts: dict[str, Any]
    missing_facts: list[str]
    weakness_list: list[OptimizationWeakness]
    # Keep this as a convenience copy of strategy_selection.selected_strategies.
    selected_strategies: list[ImprovementStrategySelection]
    strategy_selection: StrategySelectionResult
    user_fact_questions: list[UserFactQuestion]
    generated_improvements: OptimizationGeneratedState
    validation_results: ImprovementValidationResult
    schema_validation: SchemaValidationResult
    estimated_score: ImprovedScoreEstimateResult
    before_after: dict[str, BeforeAfterChange]
    final_output: GeoImprovementOutput
    turkish_nlp_signals: TurkishNlpScoringSignals
    metadata: dict[str, Any]
    errors: list[str]


def create_initial_optimization_state(
    product_input: ProductInput,
    analysis_output: GeoAnalysisOutput,
    *,
    user_confirmed_facts: Mapping[str, Any] | None = None,
) -> OptimizationGraphState:
    """Create the initial state passed into the compiled optimization graph."""
    fact_state = OptimizationFactState(
        knownFacts=analysis_output.known_facts,
        missingFacts=analysis_output.missing_facts,
        userConfirmedFacts=dict(user_confirmed_facts or {}),
    )
    return {
        "product_input": product_input,
        "analysis_output": analysis_output,
        "fact_state": fact_state,
        "known_facts": fact_state.merged_known_facts(),
        "missing_facts": fact_state.unresolved_missing_facts(),
        "weakness_list": [],
        "selected_strategies": [],
        "user_fact_questions": [],
        "generated_improvements": OptimizationGeneratedState(),
        "before_after": {},
        "metadata": {},
        "errors": [],
    }


def _dedupe_text(values: Any) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        iterable: Iterable[Any] = (values,)
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


def _deep_merge_mappings(*sources: Mapping[str, Any]) -> dict[str, Any]:
    """Merge nested mappings without dropping existing sibling facts."""
    merged: dict[str, Any] = {}
    for source in sources:
        for key, value in source.items():
            if isinstance(value, Mapping) and isinstance(merged.get(key), Mapping):
                merged[key] = _deep_merge_mappings(merged[key], value)
            else:
                merged[key] = value
    return merged


def _confirmed_fact_paths(source: Mapping[str, Any], prefix: str = "") -> list[str]:
    """Return confirmed fact paths and leaf names from a nested fact mapping."""
    paths: list[str] = []
    for key, value in source.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, Mapping):
            paths.extend(_confirmed_fact_paths(value, path))
            continue
        if value is None or str(value).strip() == "":
            continue
        paths.append(path)
        paths.append(str(key))
    return _dedupe_text(paths)


def _fact_is_confirmed(fact: str, confirmed_paths: set[str]) -> bool:
    """Return whether a missing fact is covered by confirmed fact paths."""
    return fact in confirmed_paths or any(
        path.startswith(f"{fact}.") or fact.startswith(f"{path}.")
        for path in confirmed_paths
    )


__all__ = [
    "OptimizationFactState",
    "OptimizationGeneratedState",
    "OptimizationGraphState",
    "OptimizationWeakness",
    "create_initial_optimization_state",
]
