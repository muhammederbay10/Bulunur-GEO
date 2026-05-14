# ai/geo_engine/scoring/score_product.py
"""Aggregates the four GEO scoring layers into a validated weighted score."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import (
    EXPECTED_LAYER_ORDER,
    MAX_MAIN_PROBLEMS,
    WEAK_LAYER_SCORE_THRESHOLD,
)
from ai.geo_engine.scoring.answer_readiness_score import score_answer_readiness
from ai.geo_engine.scoring.machine_understanding_score import score_machine_understanding
from ai.geo_engine.scoring.reranking_score import score_reranking_strength
from ai.geo_engine.scoring.retrieval_score import (
    build_retrieval_nlp_signals,
    score_retrieval,
)
from ai.geo_engine.types import FourLayerGeoScore, GeminiLayerJudgment, LayerScoreResult
from ai.schema_engine.schema_mapping import is_known_value
from ai.schema_engine.types import SchemaValidationResult


SemanticJudgmentInput = GeminiLayerJudgment | Mapping[str, Any]
SemanticJudgmentMap = Mapping[str, SemanticJudgmentInput]

LAYER_ALIASES: dict[str, tuple[str, ...]] = {
    "retrieval": ("retrieval",),
    "machine_understanding": (
        "machine_understanding",
        "machineUnderstanding",
        "machine-understanding",
    ),
    "reranking_strength": (
        "reranking_strength",
        "rerankingStrength",
        "reranking-strength",
    ),
    "ai_answer_readiness": (
        "ai_answer_readiness",
        "aiAnswerReadiness",
        "ai-answer-readiness",
        "answer_readiness",
        "answerReadiness",
    ),
}


def score_product(
    product: ProductInput,
    *,
    semantic_judgments: SemanticJudgmentMap,
    schema_validation: SchemaValidationResult | Mapping[str, Any] | None = None,
    known_facts: Mapping[str, Any] | None = None,
    missing_facts: Sequence[str] | None = None,
    faq_items: Sequence[Mapping[str, Any]] | None = None,
) -> FourLayerGeoScore:
    """Run all four GEO scoring layers and aggregate weighted points."""
    _validate_semantic_judgments(semantic_judgments)

    retrieval_signals = build_retrieval_nlp_signals(product)
    resolved_known_facts = _build_known_facts(product, known_facts)

    retrieval = score_retrieval(
        product,
        nlp_signals=retrieval_signals,
        semantic_judgment=_semantic_judgment(semantic_judgments, "retrieval"),
    )
    machine_understanding = score_machine_understanding(
        product,
        schema_validation=schema_validation,
        semantic_judgment=_semantic_judgment(
            semantic_judgments,
            "machine_understanding",
        ),
    )
    reranking_strength = score_reranking_strength(
        product,
        semantic_judgment=_semantic_judgment(
            semantic_judgments,
            "reranking_strength",
        ),
    )
    ai_answer_readiness = score_answer_readiness(
        product,
        semantic_judgment=_semantic_judgment(
            semantic_judgments,
            "ai_answer_readiness",
        ),
        known_facts=resolved_known_facts,
        missing_facts=missing_facts,
        faq_items=faq_items,
    )

    layers = [
        retrieval,
        machine_understanding,
        reranking_strength,
        ai_answer_readiness,
    ]

    return FourLayerGeoScore(
        retrieval=retrieval,
        machineUnderstanding=machine_understanding,
        rerankingStrength=reranking_strength,
        aiAnswerReadiness=ai_answer_readiness,
        detectedCategory=product.category,
        buyerIntentVariants=retrieval_signals.buyer_intent_variants,
        knownFacts=resolved_known_facts,
        missingFacts=_build_missing_facts(layers, missing_facts),
        mainProblems=_build_main_problems(layers),
        recommendedAction=_choose_recommended_action(layers),
        metadata={
            "semanticJudgmentsRequired": list(EXPECTED_LAYER_ORDER),
            "deterministicAndSemanticScoring": True,
        },
    )


def score_product_analysis(
    product: ProductInput,
    *,
    semantic_judgments: SemanticJudgmentMap,
    schema_validation: SchemaValidationResult | Mapping[str, Any] | None = None,
    known_facts: Mapping[str, Any] | None = None,
    missing_facts: Sequence[str] | None = None,
    faq_items: Sequence[Mapping[str, Any]] | None = None,
) -> GeoAnalysisOutput:
    """Return the public API analysis output for a scored product."""
    return score_product(
        product,
        semantic_judgments=semantic_judgments,
        schema_validation=schema_validation,
        known_facts=known_facts,
        missing_facts=missing_facts,
        faq_items=faq_items,
    ).to_analysis_output()


def _validate_semantic_judgments(semantic_judgments: SemanticJudgmentMap) -> None:
    missing_layers = [
        layer
        for layer in EXPECTED_LAYER_ORDER
        if _lookup_semantic_judgment(semantic_judgments, layer) is None
    ]
    if missing_layers:
        joined = ", ".join(missing_layers)
        raise ValueError(f"semantic_judgments missing required layers: {joined}")


def _semantic_judgment(
    semantic_judgments: SemanticJudgmentMap,
    layer: str,
) -> SemanticJudgmentInput:
    judgment = _lookup_semantic_judgment(semantic_judgments, layer)
    if judgment is None:
        raise ValueError(f"semantic_judgment is required for {layer} scoring")
    return judgment


def _lookup_semantic_judgment(
    semantic_judgments: SemanticJudgmentMap,
    layer: str,
) -> SemanticJudgmentInput | None:
    for key in LAYER_ALIASES[layer]:
        if key in semantic_judgments:
            return semantic_judgments[key]
    return None


def _build_known_facts(
    product: ProductInput,
    known_facts: Mapping[str, Any] | None,
) -> dict[str, Any]:
    facts: dict[str, Any] = {
        "title": product.title,
        "description": product.description,
        "shortDescription": product.short_description,
        "price": product.price,
        "currency": product.currency,
        "availability": product.availability,
        "brand": product.brand,
        "category": product.category,
        "imageUrls": [str(url) for url in product.image_urls],
        "attributes": product.attributes,
    }
    facts.update(dict(known_facts or {}))
    return {key: value for key, value in facts.items() if is_known_value(value)}


def _build_missing_facts(
    layers: Sequence[LayerScoreResult],
    missing_facts: Sequence[str] | None,
) -> list[str]:
    missing = list(missing_facts or [])
    for layer in layers:
        missing.extend(layer.missing_signals)
    return _limit(missing, limit=12)


def _build_main_problems(layers: Sequence[LayerScoreResult]) -> list[str]:
    problems: list[str] = []
    for layer in sorted(layers, key=lambda item: item.score):
        if layer.score >= WEAK_LAYER_SCORE_THRESHOLD and not layer.missing_signals:
            continue

        if layer.missing_signals:
            problems.append(f"{layer.layer}: {layer.missing_signals[0]}")
        elif layer.recommended_next_action:
            problems.append(f"{layer.layer}: {layer.recommended_next_action}")

    return _limit(problems, limit=MAX_MAIN_PROBLEMS)


def _choose_recommended_action(layers: Sequence[LayerScoreResult]) -> str:
    weakest_layer = min(layers, key=lambda layer: layer.score)
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


__all__ = [
    "SemanticJudgmentInput",
    "SemanticJudgmentMap",
    "score_product",
    "score_product_analysis",
]
