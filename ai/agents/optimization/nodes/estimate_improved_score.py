# ai/agents/optimization/nodes/estimate_improved_score.py
"""Estimates before/after GEO score by rerunning the scoring engine."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ai.agents.optimization.state import OptimizationGraphState
from ai.geo_engine.constants import EXPECTED_LAYER_ORDER
from ai.geo_engine.improvement.estimate_improved_score import (
    estimate_improved_score as run_score_estimation,
)
from ai.geo_engine.scoring.score_product import SemanticJudgmentMap


SEMANTIC_JUDGMENTS_METADATA_KEYS = (
    "semanticJudgments",
    "semantic_judgments",
    "afterSemanticJudgments",
    "after_semantic_judgments",
)
BEFORE_SEMANTIC_JUDGMENTS_METADATA_KEYS = (
    "beforeSemanticJudgments",
    "before_semantic_judgments",
)


def estimate_improved_score(state: OptimizationGraphState) -> OptimizationGraphState:
    """Estimate score movement for validated generated improvements."""
    metadata = dict(state.get("metadata", {}))
    validation = state.get("validation_results")
    if validation is not None and not validation.passed:
        metadata["scoreEstimation"] = {
            "skipped": True,
            "reason": "validation_failed",
        }
        return {**state, "metadata": metadata}

    generated_state = state.get("generated_improvements")
    if generated_state is None:
        return _with_score_error(
            state,
            "score_estimation_missing_generated_content",
            "Skor tahmini icin graph state icinde generated_improvements bulunmali.",
        )

    semantic_judgments = _semantic_judgments_from_metadata(
        metadata,
        keys=SEMANTIC_JUDGMENTS_METADATA_KEYS,
    )
    if semantic_judgments is None:
        return _with_score_error(
            state,
            "score_estimation_missing_semantic_judgments",
            "Skor tahmini icin dort GEO katmaninin semantik yargilari gerekli.",
        )

    before_semantic_judgments = _semantic_judgments_from_metadata(
        metadata,
        keys=BEFORE_SEMANTIC_JUDGMENTS_METADATA_KEYS,
        required=False,
    )
    fact_state = state.get("fact_state")

    try:
        estimate = run_score_estimation(
            state["product_input"],
            generated_state.content,
            semantic_judgments=semantic_judgments,
            before_semantic_judgments=before_semantic_judgments,
            known_facts=state.get("known_facts", state["analysis_output"].known_facts),
            user_confirmed_facts=fact_state.user_confirmed_facts if fact_state else None,
            missing_facts=state.get("missing_facts", state["analysis_output"].missing_facts),
        )
    except Exception as exc:
        return _with_score_error(
            state,
            "score_estimation_failed",
            f"Skor tahmini basarisiz oldu: {exc}",
        )

    metadata["scoreEstimation"] = {
        "skipped": False,
        "scoringEngineReused": estimate.metadata.get("scoringEngineReused", True),
        "before": estimate.before,
        "after": estimate.after,
        "gain": estimate.gain,
        "expectedGainReasons": estimate.expected_gain_reasons,
    }
    return {
        **state,
        "estimated_score": estimate,
        "metadata": metadata,
    }


def _semantic_judgments_from_metadata(
    metadata: Mapping[str, Any],
    *,
    keys: tuple[str, ...],
    required: bool = True,
) -> SemanticJudgmentMap | None:
    for key in keys:
        value = metadata.get(key)
        if isinstance(value, Mapping):
            if required:
                _validate_semantic_layers(value)
            return value
    return None


def _validate_semantic_layers(semantic_judgments: Mapping[str, Any]) -> None:
    missing = [layer for layer in EXPECTED_LAYER_ORDER if layer not in semantic_judgments]
    if missing:
        joined = ", ".join(missing)
        raise ValueError(f"semantic judgments missing layers: {joined}")


def _with_score_error(
    state: OptimizationGraphState,
    code: str,
    message: str,
) -> OptimizationGraphState:
    metadata = dict(state.get("metadata", {}))
    metadata["scoreEstimation"] = {
        "skipped": True,
        "reason": code,
        "error": message,
    }
    errors = [*state.get("errors", []), message]
    return {
        **state,
        "metadata": metadata,
        "errors": errors,
    }


__all__ = ["estimate_improved_score"]
