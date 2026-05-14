# ai/agents/analysis/nodes/build_analysis_output.py
"""Builds the public GeoAnalysisOutput from completed layer scores."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from ai.agents.analysis.state import AnalysisGraphState
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput, LayerScore, ScoreBreakdown
from ai.geo_engine.constants import (
    EXPECTED_LAYER_ORDER,
    LAYER_DISPLAY_NAMES,
    MAX_MAIN_PROBLEMS,
    MAX_VISIBLE_MISSING_SIGNALS_PER_LAYER,
    MAX_VISIBLE_REASONS_PER_LAYER,
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
            "rawLayerEvidence": {
                layer.layer: {
                    "reasons": list(layer.reasons),
                    "missingSignals": list(layer.missing_signals),
                }
                for layer in layer_scores.values()
            },
        },
    )
    final_output = _build_visible_output(final_score)

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

        layer_label = LAYER_DISPLAY_NAMES.get(layer.layer, layer.layer)
        if layer.missing_signals:
            problems.append(f"{layer_label}: {layer.missing_signals[0]}")
        elif layer.recommended_next_action:
            problems.append(f"{layer_label}: {layer.recommended_next_action}")

    return _limit(problems, limit=MAX_MAIN_PROBLEMS)


def _choose_recommended_action(
    layer_scores: Mapping[GeoScoreLayer, LayerScoreResult],
) -> str:
    weakest_layer = min(layer_scores.values(), key=lambda layer: layer.score)
    if weakest_layer.recommended_next_action:
        return weakest_layer.recommended_next_action
    layer_label = LAYER_DISPLAY_NAMES.get(weakest_layer.layer, weakest_layer.layer)
    return f"Once {layer_label} katmanini iyilestirin."


def _build_visible_output(final_score: FourLayerGeoScore) -> GeoAnalysisOutput:
    raw_output = final_score.to_analysis_output()
    breakdown = raw_output.scores

    visible_scores = ScoreBreakdown(
        retrieval=_compress_layer_score(breakdown.retrieval),
        machineUnderstanding=_compress_layer_score(breakdown.machine_understanding),
        rerankingStrength=_compress_layer_score(breakdown.reranking_strength),
        aiAnswerReadiness=_compress_layer_score(breakdown.ai_answer_readiness),
    )

    return GeoAnalysisOutput(
        overallScore=raw_output.overall_score,
        scores=visible_scores,
        detectedCategory=raw_output.detected_category,
        buyerIntentVariants=_limit(raw_output.buyer_intent_variants, limit=12),
        knownFacts=raw_output.known_facts,
        missingFacts=_limit(raw_output.missing_facts, limit=8),
        mainProblems=_limit(raw_output.main_problems, limit=MAX_MAIN_PROBLEMS),
        recommendedAction=raw_output.recommended_action,
    )


def _compress_layer_score(layer: LayerScore) -> LayerScore:
    return LayerScore(
        score=layer.score,
        maxScore=layer.max_score,
        weightedPoints=layer.weighted_points,
        maxWeightedPoints=layer.max_weighted_points,
        reasons=_limit(layer.reasons, limit=MAX_VISIBLE_REASONS_PER_LAYER),
        missingSignals=_limit(
            layer.missing_signals,
            limit=MAX_VISIBLE_MISSING_SIGNALS_PER_LAYER,
        ),
        recommendedNextAction=layer.recommended_next_action,
    )


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
