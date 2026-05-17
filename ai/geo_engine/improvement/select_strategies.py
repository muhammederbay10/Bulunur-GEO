# ai/geo_engine/improvement/select_strategies.py
"""Selects explainable GEO improvement strategies from analysis results."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any, cast

from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput, LayerScore
from ai.api_contracts.geo_improvement_output import SelectedStrategy
from ai.geo_engine.constants import (
    EXPECTED_LAYER_ORDER,
    GOOD_LAYER_SCORE_THRESHOLD,
    WEAK_LAYER_SCORE_THRESHOLD,
)
from ai.geo_engine.strategies.base import (
    ImprovementStrategySelection,
    STRATEGY_ATTRIBUTE_COMPLETION,
    STRATEGY_BUYER_INTENT_REWRITE,
    STRATEGY_DISPLAY_NAMES,
    STRATEGY_FAQ_ENRICHMENT,
    STRATEGY_PRIORITY,
    STRATEGY_SCHEMA_REPAIR,
    STRATEGY_SKILL_PATHS,
    STRATEGY_TARGET_LAYERS,
    StrategyId,
    StrategySelectionResult,
)
from ai.geo_engine.types import GeoScoreLayer


DEFAULT_MAX_STRATEGIES = 4
MAX_AUTO_STRATEGIES = 3

LAYER_TO_FALLBACK_STRATEGY: dict[GeoScoreLayer, StrategyId] = {
    "retrieval": STRATEGY_BUYER_INTENT_REWRITE,
    "machine_understanding": STRATEGY_SCHEMA_REPAIR,
    "reranking_strength": STRATEGY_ATTRIBUTE_COMPLETION,
    "ai_answer_readiness": STRATEGY_FAQ_ENRICHMENT,
}

SCHEMA_SIGNAL_KEYWORDS: tuple[str, ...] = (
    "schema",
    "json-ld",
    "json ld",
    "structured data",
    "product schema",
    "offer",
    "pricecurrency",
    "availability",
    "@type",
    "schema.org",
    "yapilandirilmis",
    "urun semasi",
    "teklif",
)

ATTRIBUTE_SIGNAL_KEYWORDS: tuple[str, ...] = (
    "attribute",
    "attributes",
    "ozellik",
    "nitelik",
    "kategori ozelligi",
    "category attribute",
    "product fact",
    "fact coverage",
    "kullanim alani",
    "malzeme",
    "olcu",
    "boyut",
    "kapasite",
)

FAQ_SIGNAL_KEYWORDS: tuple[str, ...] = (
    "faq",
    "soru",
    "cevap",
    "question",
    "answer",
    "answer readiness",
    "cevaplanabilir",
    "buyer question",
    "alici sorusu",
)

BUYER_INTENT_SIGNAL_KEYWORDS: tuple[str, ...] = (
    "description",
    "short description",
    "long description",
    "generic",
    "thin content",
    "buyer intent",
    "intent",
    "query",
    "turkish query",
    "alici niyeti",
    "sorgu",
    "aciklama",
    "genel",
    "zayif icerik",
)


def select_strategies(
    analysis: GeoAnalysisOutput | Mapping[str, Any],
    *,
    max_strategies: int = DEFAULT_MAX_STRATEGIES,
) -> StrategySelectionResult:
    """Select deterministic optimization strategies for one analysis result."""
    normalized_analysis = _coerce_analysis(analysis)
    if max_strategies < 1:
        raise ValueError("max_strategies must be at least 1")

    layer_scores = _layer_scores(normalized_analysis)
    weakest_layers = identify_weakest_layers(normalized_analysis)
    analysis_signals = _build_analysis_signals(normalized_analysis)

    selected: dict[StrategyId, ImprovementStrategySelection] = {}

    if _should_select_schema_repair(layer_scores, analysis_signals):
        selected[STRATEGY_SCHEMA_REPAIR] = _build_strategy(
            STRATEGY_SCHEMA_REPAIR,
            _schema_repair_reason(
                layer_scores["machine_understanding"],
                analysis_signals.machine_understanding,
            ),
        )

    if _should_select_attribute_completion(layer_scores, analysis_signals):
        selected[STRATEGY_ATTRIBUTE_COMPLETION] = _build_strategy(
            STRATEGY_ATTRIBUTE_COMPLETION,
            _attribute_completion_reason(
                layer_scores["reranking_strength"],
                analysis_signals.reranking_strength,
            ),
        )

    if _should_select_faq_enrichment(layer_scores, analysis_signals):
        selected[STRATEGY_FAQ_ENRICHMENT] = _build_strategy(
            STRATEGY_FAQ_ENRICHMENT,
            _faq_enrichment_reason(
                layer_scores["ai_answer_readiness"],
                analysis_signals.ai_answer_readiness,
            ),
        )

    if _should_select_buyer_intent_rewrite(layer_scores, analysis_signals):
        selected[STRATEGY_BUYER_INTENT_REWRITE] = _build_strategy(
            STRATEGY_BUYER_INTENT_REWRITE,
            _buyer_intent_rewrite_reason(
                layer_scores["retrieval"],
                analysis_signals.retrieval,
            ),
        )

    if not selected:
        fallback_strategy_id = LAYER_TO_FALLBACK_STRATEGY[weakest_layers[0]]
        selected[fallback_strategy_id] = _build_strategy(
            fallback_strategy_id,
            _fallback_reason(fallback_strategy_id, layer_scores, weakest_layers[0]),
        )

    ordered_strategies = sorted(
        selected.values(),
        key=lambda strategy: (strategy.priority, strategy.name),
    )[: min(max_strategies, MAX_AUTO_STRATEGIES)]

    return StrategySelectionResult(
        selectedStrategies=ordered_strategies,
        weakestLayers=weakest_layers,
        strategyReasons={
            strategy.strategy_id: strategy.reason for strategy in ordered_strategies
        },
    )


def identify_weakest_layers(
    analysis: GeoAnalysisOutput | Mapping[str, Any],
    *,
    minimum_count: int = 1,
) -> list[GeoScoreLayer]:
    """Return weak layers ordered by score, with a deterministic fallback."""
    normalized_analysis = _coerce_analysis(analysis)
    if minimum_count < 1:
        raise ValueError("minimum_count must be at least 1")

    sorted_layers = sorted(
        _layer_scores(normalized_analysis).items(),
        key=lambda item: (item[1].score, _layer_order_index(item[0])),
    )
    weak_layers = [
        layer
        for layer, score in sorted_layers
        if score.score <= WEAK_LAYER_SCORE_THRESHOLD
    ]

    if len(weak_layers) >= minimum_count:
        return weak_layers

    fallback_layers = [layer for layer, _score in sorted_layers[:minimum_count]]
    return _dedupe_layer_names([*weak_layers, *fallback_layers])


def get_api_selected_strategies(
    analysis: GeoAnalysisOutput | Mapping[str, Any],
    *,
    max_strategies: int = DEFAULT_MAX_STRATEGIES,
) -> list[SelectedStrategy]:
    """Select strategies and return only the public API strategy objects."""
    return select_strategies(analysis, max_strategies=max_strategies).to_api_strategies()


def _should_select_schema_repair(
    layer_scores: Mapping[GeoScoreLayer, LayerScore],
    analysis_signals: "AnalysisSignals",
) -> bool:
    machine_layer = layer_scores["machine_understanding"]
    if _is_weak(machine_layer):
        return True
    return _is_below_good(machine_layer) and _has_any_keyword(
        analysis_signals.machine_understanding,
        SCHEMA_SIGNAL_KEYWORDS,
    )


def _should_select_attribute_completion(
    layer_scores: Mapping[GeoScoreLayer, LayerScore],
    analysis_signals: "AnalysisSignals",
) -> bool:
    reranking_layer = layer_scores["reranking_strength"]
    machine_layer = layer_scores["machine_understanding"]
    return (
        _is_weak(reranking_layer)
        or (
            _is_below_good(reranking_layer)
            and _has_any_keyword(
                analysis_signals.reranking_strength,
                ATTRIBUTE_SIGNAL_KEYWORDS,
            )
        )
        or (
            _is_weak(machine_layer)
            and _has_any_keyword(
                analysis_signals.machine_understanding,
                ATTRIBUTE_SIGNAL_KEYWORDS,
            )
        )
    )


def _should_select_faq_enrichment(
    layer_scores: Mapping[GeoScoreLayer, LayerScore],
    analysis_signals: "AnalysisSignals",
) -> bool:
    answer_layer = layer_scores["ai_answer_readiness"]
    if _is_weak(answer_layer):
        return True
    return _is_below_good(answer_layer) and _has_any_keyword(
        analysis_signals.ai_answer_readiness,
        FAQ_SIGNAL_KEYWORDS,
    )


def _should_select_buyer_intent_rewrite(
    layer_scores: Mapping[GeoScoreLayer, LayerScore],
    analysis_signals: "AnalysisSignals",
) -> bool:
    retrieval_layer = layer_scores["retrieval"]
    answer_layer = layer_scores["ai_answer_readiness"]
    return (
        _is_weak(retrieval_layer)
        or (
            _is_below_good(retrieval_layer)
            and _has_any_keyword(
                analysis_signals.retrieval,
                BUYER_INTENT_SIGNAL_KEYWORDS,
            )
        )
        or (
            _is_weak(answer_layer)
            and _has_any_keyword(
                analysis_signals.ai_answer_readiness,
                BUYER_INTENT_SIGNAL_KEYWORDS,
            )
        )
    )


def _build_strategy(strategy_id: StrategyId, reason: str) -> ImprovementStrategySelection:
    return ImprovementStrategySelection(
        strategyId=strategy_id,
        name=STRATEGY_DISPLAY_NAMES[strategy_id],
        skillPath=STRATEGY_SKILL_PATHS[strategy_id],
        targetLayers=list(STRATEGY_TARGET_LAYERS[strategy_id]),
        reason=reason,
        priority=STRATEGY_PRIORITY[strategy_id],
    )


def _schema_repair_reason(machine_layer: LayerScore, signal_blob: str) -> str:
    if _has_any_keyword(signal_blob, SCHEMA_SIGNAL_KEYWORDS):
        return (
            "Schema Repair secildi cunku Product JSON-LD veya Offer bilgileri "
            "eksik, hatali ya da sayfa gercekleriyle zayif eslesiyor."
        )
    return (
        "Schema Repair secildi cunku Makine Anlayisi skoru "
        f"{machine_layer.score:.0f}/100 ve yapisal urun verisi once guclendirilmeli."
    )


def _attribute_completion_reason(reranking_layer: LayerScore, signal_blob: str) -> str:
    if _has_any_keyword(signal_blob, ATTRIBUTE_SIGNAL_KEYWORDS):
        return (
            "Attribute Completion secildi cunku kategoriye ozel urun ozellikleri "
            "eksik veya yeterince acik degil."
        )
    return (
        "Attribute Completion secildi cunku Reranking Guclugu skoru "
        f"{reranking_layer.score:.0f}/100 ve urun karsilastirmasi icin daha fazla "
        "somut ozellik gerekiyor."
    )


def _faq_enrichment_reason(answer_layer: LayerScore, signal_blob: str) -> str:
    if _has_any_keyword(signal_blob, FAQ_SIGNAL_KEYWORDS):
        return (
            "Turkish FAQ Enrichment secildi cunku urun sayfasi alici sorularini "
            "dogrudan cevaplayacak FAQ icerigine sahip degil."
        )
    return (
        "Turkish FAQ Enrichment secildi cunku AI Cevap Hazirligi skoru "
        f"{answer_layer.score:.0f}/100 ve urun icin cevaplanabilir Turkce bilgi "
        "guclendirilmeli."
    )


def _buyer_intent_rewrite_reason(retrieval_layer: LayerScore, signal_blob: str) -> str:
    if _has_any_keyword(signal_blob, BUYER_INTENT_SIGNAL_KEYWORDS):
        return (
            "Turkish Buyer Intent Rewrite secildi cunku aciklama ve sorgu uyumu "
            "Turkce alici niyetlerini yeterince yakalamiyor."
        )
    return (
        "Turkish Buyer Intent Rewrite secildi cunku Retrieval skoru "
        f"{retrieval_layer.score:.0f}/100 ve urun metni Turkce arama niyetleriyle "
        "daha net eslestirilmeli."
    )


def _fallback_reason(
    strategy_id: StrategyId,
    layer_scores: Mapping[GeoScoreLayer, LayerScore],
    weakest_layer: GeoScoreLayer,
) -> str:
    strategy_name = STRATEGY_DISPLAY_NAMES[strategy_id]
    layer_score = layer_scores[weakest_layer]
    return (
        f"{strategy_name} secildi cunku {weakest_layer} katmani "
        f"{layer_score.score:.0f}/100 ile en zayif gelisim alanidir."
    )


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


class AnalysisSignals:
    """Layer-scoped text signals used for deterministic strategy rules."""

    def __init__(
        self,
        *,
        retrieval: str,
        machine_understanding: str,
        reranking_strength: str,
        ai_answer_readiness: str,
    ) -> None:
        self.retrieval = retrieval
        self.machine_understanding = machine_understanding
        self.reranking_strength = reranking_strength
        self.ai_answer_readiness = ai_answer_readiness


def _build_analysis_signals(analysis: GeoAnalysisOutput) -> AnalysisSignals:
    return AnalysisSignals(
        retrieval=_layer_signal_blob(
            analysis.scores.retrieval,
            analysis=analysis,
        ),
        machine_understanding=_layer_signal_blob(
            analysis.scores.machine_understanding,
            analysis=analysis,
        ),
        reranking_strength=_layer_signal_blob(
            analysis.scores.reranking_strength,
            analysis=analysis,
        ),
        ai_answer_readiness=_layer_signal_blob(
            analysis.scores.ai_answer_readiness,
            analysis=analysis,
        ),
    )


def _layer_signal_blob(layer: LayerScore, *, analysis: GeoAnalysisOutput) -> str:
    values: list[Any] = [
        analysis.detected_category,
        analysis.main_problems,
        analysis.recommended_action,
        layer.reasons,
        layer.missing_signals,
        layer.recommended_next_action,
    ]
    return " | ".join(_normalize_text(value) for value in _flatten_values(values))


def _flatten_values(values: Iterable[Any]) -> Iterable[Any]:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            yield value
            continue
        if isinstance(value, Mapping):
            yield from _flatten_values(value.keys())
            yield from _flatten_values(value.values())
            continue
        if isinstance(value, Iterable):
            yield from _flatten_values(value)
            continue
        yield value


def _has_any_keyword(text: str, keywords: Iterable[str]) -> bool:
    normalized_text = _normalize_text(text)
    return any(_normalize_text(keyword) in normalized_text for keyword in keywords)


def _is_weak(layer_score: LayerScore) -> bool:
    return layer_score.score <= WEAK_LAYER_SCORE_THRESHOLD


def _is_below_good(layer_score: LayerScore) -> bool:
    return layer_score.score < GOOD_LAYER_SCORE_THRESHOLD


def _layer_order_index(layer: GeoScoreLayer) -> int:
    return EXPECTED_LAYER_ORDER.index(layer)


def _normalize_text(value: Any) -> str:
    return str(value).strip().casefold()


def _dedupe_layer_names(values: Any) -> list[GeoScoreLayer]:
    seen: set[str] = set()
    deduped: list[GeoScoreLayer] = []

    for raw_value in _flatten_values(_coerce_iterable(values)):
        value = _normalize_text(raw_value)
        if value not in EXPECTED_LAYER_ORDER or value in seen:
            continue
        seen.add(value)
        deduped.append(cast(GeoScoreLayer, value))

    return deduped


def _coerce_iterable(values: Any) -> Iterable[Any]:
    if values is None:
        return ()
    if isinstance(values, str):
        return (values,)
    if isinstance(values, Iterable):
        return values
    return (values,)


__all__ = [
    "DEFAULT_MAX_STRATEGIES",
    "ImprovementStrategySelection",
    "STRATEGY_ATTRIBUTE_COMPLETION",
    "STRATEGY_BUYER_INTENT_REWRITE",
    "STRATEGY_DISPLAY_NAMES",
    "STRATEGY_FAQ_ENRICHMENT",
    "STRATEGY_SCHEMA_REPAIR",
    "STRATEGY_SKILL_PATHS",
    "STRATEGY_TARGET_LAYERS",
    "StrategyId",
    "StrategySelectionResult",
    "get_api_selected_strategies",
    "identify_weakest_layers",
    "select_strategies",
]
