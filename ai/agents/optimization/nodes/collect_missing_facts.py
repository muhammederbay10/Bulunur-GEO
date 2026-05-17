# ai/agents/optimization/nodes/collect_missing_facts.py
"""Collects high-impact missing fact questions for optimization."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.agents.optimization.state import OptimizationGraphState
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.geo_improvement_output import SelectedStrategy
from ai.api_contracts.user_fact_questions import UserFactQuestion
from ai.geo_engine.improvement.collect_missing_facts import (
    DEFAULT_MAX_USER_FACT_QUESTIONS,
    collect_missing_facts as collect_high_impact_missing_facts,
)
from ai.geo_engine.strategies.base import (
    ImprovementStrategySelection,
    StrategySelectionResult,
)


MAX_QUESTIONS_METADATA_KEY = "maxUserFactQuestions"


def collect_missing_facts(state: OptimizationGraphState) -> OptimizationGraphState:
    """Store targeted user questions for unresolved high-impact facts."""
    metadata = dict(state.get("metadata", {}))
    max_questions = int(
        metadata.get(MAX_QUESTIONS_METADATA_KEY, DEFAULT_MAX_USER_FACT_QUESTIONS)
    )
    questions = build_user_fact_questions(state, max_questions=max_questions)
    metadata["needsUserInput"] = bool(questions)
    metadata["userFactQuestionCount"] = len(questions)
    metadata["userFactQuestionLimit"] = max_questions

    return {
        **state,
        "user_fact_questions": questions,
        "metadata": metadata,
    }


def build_user_fact_questions(
    state: OptimizationGraphState,
    *,
    max_questions: int = DEFAULT_MAX_USER_FACT_QUESTIONS,
) -> list[UserFactQuestion]:
    """Return only high-impact fact questions still blocking safe generation."""
    analysis = _analysis_with_graph_facts(state)
    selected_strategies = _selected_strategy_source(state)
    return collect_high_impact_missing_facts(
        analysis,
        selected_strategies,
        max_questions=max_questions,
    )


def _analysis_with_graph_facts(state: OptimizationGraphState) -> GeoAnalysisOutput:
    analysis = state["analysis_output"]
    known_facts = dict(state.get("known_facts", analysis.known_facts))
    missing_facts = list(state.get("missing_facts", analysis.missing_facts))
    return analysis.model_copy(
        update={
            "known_facts": known_facts,
            "missing_facts": missing_facts,
        }
    )


def _selected_strategy_source(
    state: OptimizationGraphState,
) -> StrategySelectionResult | Sequence[ImprovementStrategySelection] | Sequence[SelectedStrategy] | Sequence[Mapping[str, Any]] | None:
    strategy_selection = state.get("strategy_selection")
    if strategy_selection is not None:
        return strategy_selection
    selected_strategies = state.get("selected_strategies")
    if selected_strategies:
        return selected_strategies
    return None


__all__ = [
    "build_user_fact_questions",
    "collect_missing_facts",
]
