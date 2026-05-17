# ai/agents/optimization/nodes/identify_weaknesses.py
"""Identifies weak GEO layers for the optimization workflow."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from ai.agents.optimization.state import OptimizationGraphState, OptimizationWeakness
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput, LayerScore
from ai.geo_engine.constants import (
    EXPECTED_LAYER_ORDER,
    LAYER_DISPLAY_NAMES,
    WEAK_LAYER_SCORE_THRESHOLD,
)
from ai.geo_engine.types import GeoScoreLayer


def identify_weaknesses(state: OptimizationGraphState) -> OptimizationGraphState:
    """Store weak GEO layers using analysis scores and missing signals."""
    analysis = state["analysis_output"]
    missing_facts = state.get("missing_facts", analysis.missing_facts)
    weaknesses = build_weakness_list(analysis, missing_facts=missing_facts)
    metadata = dict(state.get("metadata", {}))
    metadata["weakestLayers"] = [weakness.layer for weakness in weaknesses]
    metadata["weaknessIdentificationUsedFallback"] = not any(
        _layer_score(analysis, weakness.layer).score <= WEAK_LAYER_SCORE_THRESHOLD
        for weakness in weaknesses
    )

    return {
        **state,
        "weakness_list": weaknesses,
        "metadata": metadata,
    }


def build_weakness_list(
    analysis: GeoAnalysisOutput | Mapping[str, Any],
    *,
    missing_facts: Iterable[str] | None = None,
) -> list[OptimizationWeakness]:
    """Build ordered weakness records from layer scores and missing signals."""
    normalized_analysis = _coerce_analysis(analysis)
    unresolved_missing_facts = _dedupe_text(missing_facts or normalized_analysis.missing_facts)
    ordered_layer_scores = sorted(
        _layer_scores(normalized_analysis).items(),
        key=lambda item: (item[1].score, _layer_order_index(item[0])),
    )

    weaknesses = [
        _build_weakness(
            layer,
            layer_score,
            analysis=normalized_analysis,
            missing_facts=unresolved_missing_facts,
        )
        for layer, layer_score in ordered_layer_scores
        if layer_score.score <= WEAK_LAYER_SCORE_THRESHOLD
    ]
    if weaknesses:
        return weaknesses

    fallback_layer, fallback_score = ordered_layer_scores[0]
    return [
        _build_weakness(
            fallback_layer,
            fallback_score,
            analysis=normalized_analysis,
            missing_facts=unresolved_missing_facts,
        )
    ]


def _build_weakness(
    layer: GeoScoreLayer,
    layer_score: LayerScore,
    *,
    analysis: GeoAnalysisOutput,
    missing_facts: list[str],
) -> OptimizationWeakness:
    layer_missing_signals = _dedupe_text(
        [
            *layer_score.missing_signals,
            *_layer_relevant_missing_facts(layer, missing_facts),
        ]
    )
    return OptimizationWeakness(
        layer=layer,
        score=layer_score.score,
        missingSignals=layer_missing_signals,
        reason=_weakness_reason(layer, layer_score, analysis=analysis),
    )


def _weakness_reason(
    layer: GeoScoreLayer,
    layer_score: LayerScore,
    *,
    analysis: GeoAnalysisOutput,
) -> str:
    layer_name = LAYER_DISPLAY_NAMES.get(layer, layer)
    if layer_score.recommended_next_action:
        return (
            f"{layer_name} {layer_score.score:.0f}/100 seviyesinde; "
            f"{layer_score.recommended_next_action}"
        )
    if layer_score.reasons:
        return f"{layer_name} {layer_score.score:.0f}/100 seviyesinde; {layer_score.reasons[0]}"
    if analysis.main_problems:
        return f"{layer_name} {layer_score.score:.0f}/100 seviyesinde; {analysis.main_problems[0]}"
    return f"{layer_name} {layer_score.score:.0f}/100 ile optimizasyon icin oncelikli katmandir."


def _layer_relevant_missing_facts(
    layer: GeoScoreLayer,
    missing_facts: Iterable[str],
) -> list[str]:
    keywords = _layer_missing_fact_keywords(layer)
    if not keywords:
        return []

    relevant: list[str] = []
    for fact in missing_facts:
        normalized_fact = str(fact).strip()
        if not normalized_fact:
            continue
        fact_blob = normalized_fact.casefold()
        if any(keyword in fact_blob for keyword in keywords):
            relevant.append(normalized_fact)
    return _dedupe_text(relevant)


def _layer_missing_fact_keywords(layer: GeoScoreLayer) -> tuple[str, ...]:
    if layer == "retrieval":
        return ("title", "description", "meta", "body", "query", "intent", "aciklama")
    if layer == "machine_understanding":
        return (
            "schema",
            "offer",
            "price",
            "currency",
            "availability",
            "brand",
            "attribute",
            "structured",
        )
    if layer == "reranking_strength":
        return (
            "attribute",
            "feature",
            "trust",
            "warranty",
            "shipping",
            "return",
            "comparison",
            "use",
        )
    if layer == "ai_answer_readiness":
        return ("faq", "question", "answer", "description", "use", "trust", "grounding")
    return ()


def _coerce_analysis(analysis: GeoAnalysisOutput | Mapping[str, Any]) -> GeoAnalysisOutput:
    if isinstance(analysis, GeoAnalysisOutput):
        return analysis
    return GeoAnalysisOutput.model_validate(analysis)


def _layer_scores(analysis: GeoAnalysisOutput) -> dict[GeoScoreLayer, LayerScore]:
    return {
        "retrieval": analysis.scores.retrieval,
        "machine_understanding": analysis.scores.machine_understanding,
        "reranking_strength": analysis.scores.reranking_strength,
        "ai_answer_readiness": analysis.scores.ai_answer_readiness,
    }


def _layer_score(analysis: GeoAnalysisOutput, layer: GeoScoreLayer) -> LayerScore:
    return _layer_scores(analysis)[layer]


def _layer_order_index(layer: GeoScoreLayer) -> int:
    return EXPECTED_LAYER_ORDER.index(layer)


def _dedupe_text(values: Iterable[Any]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for raw_value in values:
        value = str(raw_value).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


__all__ = [
    "build_weakness_list",
    "identify_weaknesses",
]
