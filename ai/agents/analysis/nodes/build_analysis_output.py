# ai/agents/analysis/nodes/build_analysis_output.py
"""Builds the public GeoAnalysisOutput from completed layer scores."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from ai.agents.analysis.state import AnalysisGraphState
from ai.geo_engine.constants import (
    EXPECTED_LAYER_ORDER,
    MAX_MAIN_PROBLEMS,
    WEAK_LAYER_SCORE_THRESHOLD,
)
from ai.geo_engine.types import FourLayerGeoScore, GeoScoreLayer, LayerScoreResult


def build_analysis_output(state: AnalysisGraphState) -> AnalysisGraphState:
    """Convert scored graph state into the public GeoAnalysisOutput contract."""
    layer_scores = _require_layer_scores(state)
    product_facts = state.get("product_facts")
    known_facts = product_facts.known_facts if hasattr(product_facts, "known_facts") else {}
    missing_facts = state.get("missing_facts")
    if not missing_facts and hasattr(product_facts, "missing_facts"):
        missing_facts = product_facts.missing_facts

    final_score = FourLayerGeoScore(
        retrieval=layer_scores["retrieval"],
        machineUnderstanding=layer_scores["machine_understanding"],
        rerankingStrength=layer_scores["reranking_strength"],
        aiAnswerReadiness=layer_scores["ai_answer_readiness"],
        detectedCategory=state.get("detected_category"),
        buyerIntentVariants=state.get("buyer_intent_variants", []),
        knownFacts=dict(known_facts),
        missingFacts=list(missing_facts or []),
        mainProblems=_build_main_problems(layer_scores),
        recommendedAction=_choose_recommended_action(layer_scores),
        metadata={
            "graphNodeOrder": list(EXPECTED_LAYER_ORDER),
            "builtFromLayerScores": True,
        },
    )
    final_output = final_score.to_analysis_output()

    metadata = dict(state.get("metadata", {}))
    metadata["buildAnalysisOutput"] = {
        "overallScore": final_output.overall_score,
        "layerCount": len(layer_scores),
        "mainProblemCount": len(final_output.main_problems),
        "finalOutputModel": "GeoAnalysisOutput",
    }

    return {
        **state,
        "final_score": final_score,
        "final_output": final_output,
        "metadata": metadata,
    }


def _require_layer_scores(
    state: AnalysisGraphState,
) -> dict[GeoScoreLayer, LayerScoreResult]:
    raw_scores = state.get("layer_scores", {})
    if not isinstance(raw_scores, Mapping):
        raise ValueError("analysis output requires layer_scores in graph state")

    missing_layers = [
        layer for layer in EXPECTED_LAYER_ORDER if layer not in raw_scores
    ]
    if missing_layers:
        joined = ", ".join(missing_layers)
        raise ValueError(f"analysis output missing layer scores: {joined}")

    layer_scores: dict[GeoScoreLayer, LayerScoreResult] = {}
    for layer in EXPECTED_LAYER_ORDER:
        score = raw_scores[layer]
        if not isinstance(score, LayerScoreResult):
            score = LayerScoreResult.model_validate(score)
        layer_scores[layer] = score
    return layer_scores


def _build_main_problems(
    layer_scores: Mapping[GeoScoreLayer, LayerScoreResult],
) -> list[str]:
    problems: list[str] = []
    for layer in sorted(layer_scores.values(), key=lambda item: item.score):
        if layer.score >= WEAK_LAYER_SCORE_THRESHOLD and not layer.missing_signals:
            continue

        if layer.missing_signals:
            problems.append(f"{layer.layer}: {layer.missing_signals[0]}")
        elif layer.recommended_next_action:
            problems.append(f"{layer.layer}: {layer.recommended_next_action}")

    return _limit(problems, limit=MAX_MAIN_PROBLEMS)


def _choose_recommended_action(
    layer_scores: Mapping[GeoScoreLayer, LayerScoreResult],
) -> str:
    weakest_layer = min(layer_scores.values(), key=lambda layer: layer.score)
    if weakest_layer.recommended_next_action:
        return weakest_layer.recommended_next_action
    return f"Improve {weakest_layer.layer} first."


def _limit(values: Sequence[str], *, limit: int) -> list[str]:
    seen: set[str] = set()
    limited: list[str] = []
    for value in values:
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        limited.append(normalized)
        if len(limited) >= limit:
            break
    return limited


__all__ = ["build_analysis_output"]
