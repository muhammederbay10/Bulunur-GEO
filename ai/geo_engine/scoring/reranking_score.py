# ai/geo_engine/scoring/reranking_score.py
"""Scores reranking strength from attributes, trust hints, and buyer signals."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import (
    DEFAULT_LAYER_RECOMMENDED_ACTIONS,
    LAYER_COMPONENT_MAX_POINTS,
    MAX_MISSING_SIGNALS_PER_LAYER,
    MAX_REASONS_PER_LAYER,
    MIN_ATTRIBUTE_COUNT_FOR_FULL_CREDIT,
    MIN_BUYER_PATTERN_COUNT_FOR_FULL_CREDIT,
    MIN_STRONG_DESCRIPTION_CHARS,
    MIN_TRUST_SIGNAL_COUNT_FOR_FULL_CREDIT,
    SCORE_DECIMAL_PLACES,
    SEMANTIC_COMPONENT_NAME,
)
from ai.geo_engine.types import GeminiLayerJudgment, LayerScoreResult, ScoreComponentResult
from ai.schema_engine.schema_mapping import is_known_value
from ai.turkish_nlp.buyer_patterns import (
    build_buyer_pattern_context,
    detect_buyer_patterns,
)
from ai.turkish_nlp.category_attributes import build_attribute_context
from ai.turkish_nlp.normalize import normalize_text, tokenize
from ai.turkish_nlp.trust_signals import (
    build_trust_signal_context,
    summarize_trust_signals,
)


RERANKING_LAYER = "reranking_strength"
RERANKING_COMPONENTS = LAYER_COMPONENT_MAX_POINTS[RERANKING_LAYER]

COMPARISON_ATTRIBUTE_KEYS = {
    "capacity",
    "color",
    "compatibility",
    "dimensions",
    "material",
    "model",
    "power",
    "size",
    "weight",
}
USE_CASE_WORDS = (
    "için",
    "icin",
    "kullanım",
    "kullanim",
    "uygun",
    "aile",
    "hediye",
    "günlük",
    "gunluk",
)


def score_reranking_strength(
    product: ProductInput,
    *,
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any],
) -> LayerScoreResult:
    """Score whether the product has enough evidence to win AI reranking."""
    reranking_text = _product_reranking_text(product)
    attribute_context = build_attribute_context(
        category=product.category,
        attributes=product.attributes,
        product_facts=_product_fact_summary(product),
    )
    trust_summary = summarize_trust_signals(reranking_text)
    buyer_patterns = detect_buyer_patterns(reranking_text)
    semantic_component, semantic_action = _score_semantic_judgment(
        semantic_judgment,
    )

    components = [
        _score_attribute_completeness(product, attribute_context),
        _score_trust_signal_presence(trust_summary),
        _score_buyer_pattern_coverage(buyer_patterns),
        _score_comparison_readiness_signals(
            product,
            attribute_context,
            buyer_patterns,
        ),
        semantic_component,
    ]

    return LayerScoreResult(
        layer=RERANKING_LAYER,
        components=components,
        recommendedNextAction=_choose_recommended_action(components, semantic_action),
        metadata={
            "attributeCount": len(product.attributes),
            "trustSignals": trust_summary.present_signals,
            "buyerPatterns": buyer_patterns,
            "semanticJudgmentRequired": True,
        },
    )


def build_reranking_semantic_context(product: ProductInput) -> dict[str, Any]:
    """Return compact context for the reranking SKILL.md prompt."""
    reranking_text = _product_reranking_text(product)
    product_anchor = product.category or product.title
    return {
        "product": _product_fact_summary(product),
        "contentSignals": {
            "title": product.title,
            "shortDescription": product.short_description,
            "description": product.description,
            "bodyText": product.raw_extracted.body_text,
        },
        "attributeContext": build_attribute_context(
            category=product.category,
            attributes=product.attributes,
            product_facts=_product_fact_summary(product),
        ),
        "trustSignalContext": build_trust_signal_context(reranking_text),
        "buyerPatternContext": build_buyer_pattern_context(
            reranking_text,
            product_anchor=product_anchor,
        ),
    }


def _score_attribute_completeness(
    product: ProductInput,
    attribute_context: Mapping[str, Any],
) -> ScoreComponentResult:
    known_attributes = _mapping_value(attribute_context, "knownAttributes")
    unknown_attributes = _mapping_value(attribute_context, "unknownAttributes")
    missing_hints = _sequence_value(attribute_context, "suggestedMissingAttributes")

    raw_attribute_count = len(product.attributes)
    known_count = len(known_attributes)
    unknown_count = len(unknown_attributes)
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if raw_attribute_count:
        points += min(2.0, 2.0 * raw_attribute_count / MIN_ATTRIBUTE_COUNT_FOR_FULL_CREDIT)
        reasons.append("Ürün özellikleri reranking kanıtı olarak mevcut.")
    else:
        missing.append("Ürün özellikleri")

    if known_count:
        points += min(1.5, 0.35 * known_count)
        reasons.append("Genel özellik etiketleri normalize edildi.")
    else:
        missing.append("Normalize genel özellikler")

    if unknown_count:
        points += min(0.75, 0.15 * unknown_count)
        reasons.append("Bilinmeyen özellikler semantik değerlendirme için korunuyor.")

    if is_known_value(product.brand):
        points += 0.6
        reasons.append("Marka ürünü ayırt etmeye yardımcı oluyor.")
    else:
        missing.append("Marka")

    if is_known_value(product.category):
        points += 0.6
        reasons.append("Kategori ürünü alternatiflerle karşılaştırmaya yardımcı oluyor.")
    else:
        missing.append("Kategori")

    if product.image_urls:
        points += 0.3
        reasons.append("Ürün görselleri reranking kanıtını destekliyor.")
    else:
        missing.append("Ürün görselleri")

    if missing_hints:
        missing.extend(_attribute_hint_names(missing_hints)[:3])

    return _component(
        "attribute_completeness",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={
            "rawAttributeCount": raw_attribute_count,
            "knownAttributeCount": known_count,
            "unknownAttributeCount": unknown_count,
            "missingAttributeHintCount": len(missing_hints),
        },
    )


def _score_trust_signal_presence(trust_summary: Any) -> ScoreComponentResult:
    present_signals = list(trust_summary.present_signals)
    missing_core_signals = list(trust_summary.missing_core_signals)
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if present_signals:
        points += min(
            2.0,
            2.0 * len(present_signals) / MIN_TRUST_SIGNAL_COUNT_FOR_FULL_CREDIT,
        )
        reasons.append("Ürün içeriğinde güven sinyali ipuçları mevcut.")
    else:
        missing.append("Güven sinyali ipuçları")

    core_present_count = max(0, 4 - len(missing_core_signals))
    points += min(1.2, 0.3 * core_present_count)
    if core_present_count:
        reasons.append("Temel ticari güven sinyallerinin bir kısmı mevcut.")

    if "reviews" in present_signals:
        points += 0.4
        reasons.append("Yorum veya puanlama dili mevcut.")
    else:
        missing.append("Yorum veya puanlama sinyali")

    if "stock" in present_signals:
        points += 0.4
        reasons.append("Stok veya bulunabilirlik dili mevcut.")
    else:
        missing.append("Stok veya bulunabilirlik sinyali")

    missing.extend(
        f"Temel guven sinyali: {signal}" for signal in missing_core_signals[:3]
    )

    return _component(
        "trust_signal_presence",
        "turkish_nlp",
        points,
        reasons,
        missing,
        metadata={
            "presentSignals": present_signals,
            "missingCoreSignals": missing_core_signals,
        },
    )


def _score_buyer_pattern_coverage(
    buyer_patterns: Sequence[str],
) -> ScoreComponentResult:
    pattern_set = set(buyer_patterns)
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if buyer_patterns:
        points += min(
            1.2,
            1.2 * len(pattern_set) / MIN_BUYER_PATTERN_COUNT_FOR_FULL_CREDIT,
        )
        reasons.append("Turkce alici sorgu kaliplari temsil ediliyor.")
    else:
        missing.append("Turkce alici sorgu kaliplari")

    for pattern, label in (
        ("use_case", "Kullanım senaryosu niyeti"),
        ("audience", "Hedef kitle niyeti"),
        ("problem_solution", "Problem çözme niyeti"),
        ("attribute_question", "Özellik sorusu niyeti"),
        ("comparison", "Karşılaştırma niyeti"),
        ("trust_question", "Güven sorusu niyeti"),
    ):
        if pattern in pattern_set:
            points += 0.3
            reasons.append(f"{label} kapsanıyor.")
        else:
            missing.append(label)

    return _component(
        "buyer_pattern_coverage",
        "turkish_nlp",
        points,
        reasons,
        missing,
        metadata={"buyerPatterns": list(buyer_patterns)},
    )


def _score_comparison_readiness_signals(
    product: ProductInput,
    attribute_context: Mapping[str, Any],
    buyer_patterns: Sequence[str],
) -> ScoreComponentResult:
    known_attributes = _mapping_value(attribute_context, "knownAttributes")
    comparison_attribute_count = sum(
        1 for key in known_attributes if key in COMPARISON_ATTRIBUTE_KEYS
    )
    description_text = _join_text(
        product.description,
        product.short_description,
        product.raw_extracted.body_text,
    )
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if comparison_attribute_count:
        points += min(0.6, 0.2 * comparison_attribute_count)
        reasons.append("Karşılaştırmaya uygun özellikler mevcut.")
    else:
        missing.append("Karşılaştırmaya uygun özellikler")

    if _contains_numbered_fact(product):
        points += 0.35
        reasons.append("Sayısal veya ölçülebilir gerçekler karşılaştırmayı destekliyor.")
    else:
        missing.append("Sayısal veya ölçülebilir ürün gerçekleri")

    if len(normalize_text(description_text)) >= MIN_STRONG_DESCRIPTION_CHARS:
        points += 0.35
        reasons.append("Açıklama reranking karşılaştırması için yeterince detaylı.")
    elif is_known_value(description_text):
        points += 0.15
        missing.append("Daha detaylı karşılaştırma odaklı açıklama")
    else:
        missing.append("Ürün açıklaması")

    if _contains_use_case_text(description_text):
        points += 0.35
        reasons.append("Kullanım senaryosu veya hedef kitle dili mevcut.")
    else:
        missing.append("Kullanım senaryosu veya hedef kitle dili")

    if "comparison" in set(buyer_patterns) or "attribute_question" in set(buyer_patterns):
        points += 0.35
        reasons.append("Alıcı kalıpları karşılaştırma veya özellik sorularını içeriyor.")
    else:
        missing.append("Karşılaştırma veya özellik sorusu kalıbı")

    return _component(
        "comparison_readiness_signals",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={
            "comparisonAttributeCount": comparison_attribute_count,
            "descriptionLength": len(normalize_text(description_text)),
        },
    )


def _score_semantic_judgment(
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any] | None,
) -> tuple[ScoreComponentResult, str | None]:
    max_points = RERANKING_COMPONENTS[SEMANTIC_COMPONENT_NAME]

    if semantic_judgment is None:
        raise ValueError("semantic_judgment is required for reranking strength scoring")

    judgment = _coerce_semantic_judgment(semantic_judgment)
    if judgment.layer is not None and judgment.layer != RERANKING_LAYER:
        raise ValueError("semantic_judgment layer must be reranking_strength")

    return judgment.to_component(max_points=max_points), judgment.recommended_next_action


def _coerce_semantic_judgment(
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any],
) -> GeminiLayerJudgment:
    if isinstance(semantic_judgment, GeminiLayerJudgment):
        return semantic_judgment

    data = dict(semantic_judgment)
    if "semanticScore" not in data and "semantic_score" not in data and "score" in data:
        raw_score = float(data["score"])
        max_score = data.get("maxScore", data.get("max_score"))
        if max_score is not None:
            data["semanticScore"] = raw_score / float(max_score) * 100.0
        elif raw_score <= 14.0:
            data["semanticScore"] = raw_score / 14.0 * 100.0
        else:
            data["semanticScore"] = raw_score

    data.setdefault("layer", RERANKING_LAYER)
    return GeminiLayerJudgment.model_validate(data)


def _choose_recommended_action(
    components: Sequence[ScoreComponentResult],
    semantic_action: str | None,
) -> str:
    if semantic_action:
        return semantic_action

    by_name = {component.name: component for component in components}
    if all(_component_ratio(component) >= 0.95 for component in components):
        return "Mevcut özellik, güven, alıcı niyeti ve karşılaştırma sinyallerini koruyun."
    if _component_ratio(by_name["attribute_completeness"]) < 0.75:
        return "Karşılaştırma ve filtreleme için daha spesifik ürün özellikleri ekleyin."
    if _component_ratio(by_name["trust_signal_presence"]) < 0.75:
        return "Yalnızca doğrulanmış kargo, garanti, iade veya yorum gibi güven sinyallerini ekleyin."
    if _component_ratio(by_name["buyer_pattern_coverage"]) < 0.75:
        return "Kullanım senaryosu, hedef kitle ve karşılaştırma gibi daha fazla Türkçe alıcı kalıbını kapsayın."
    if _component_ratio(by_name["comparison_readiness_signals"]) < 0.75:
        return "Ürünü karşılaştırılabilir kılacak ölçülebilir gerçekleri ve kullanım detaylarını ekleyin."
    return DEFAULT_LAYER_RECOMMENDED_ACTIONS[RERANKING_LAYER]


def _component(
    name: str,
    source: str,
    points: float,
    reasons: Sequence[str],
    missing: Sequence[str],
    *,
    metadata: Mapping[str, Any] | None = None,
) -> ScoreComponentResult:
    max_points = RERANKING_COMPONENTS[name]
    return ScoreComponentResult(
        name=name,
        kind="semantic" if name == SEMANTIC_COMPONENT_NAME else "deterministic",
        source=source,
        points=_bounded_points(points, max_points),
        maxPoints=max_points,
        reasons=_limit(reasons, MAX_REASONS_PER_LAYER),
        missingSignals=_limit(missing, MAX_MISSING_SIGNALS_PER_LAYER),
        metadata=dict(metadata or {}),
    )


def _product_reranking_text(product: ProductInput) -> str:
    return _join_text(
        product.title,
        product.short_description,
        product.description,
        product.category,
        product.brand,
        *product.attributes.values(),
        product.raw_extracted.page_title,
        product.raw_extracted.meta_description,
        product.raw_extracted.body_text,
        _flatten_headings(product.raw_extracted.headings),
        _flatten_headings(product.crawl_metadata.headings),
    )


def _product_fact_summary(product: ProductInput) -> dict[str, Any]:
    return {
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


def _mapping_value(source: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = source.get(key)
    return value if isinstance(value, Mapping) else {}


def _sequence_value(source: Mapping[str, Any], key: str) -> Sequence[Any]:
    value = source.get(key)
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return value
    return []


def _attribute_hint_names(hints: Sequence[Any]) -> list[str]:
    names: list[str] = []
    for hint in hints:
        if isinstance(hint, Mapping):
            name = hint.get("label") or hint.get("name")
            if name:
                names.append(f"Özellik ipucu: {name}")
    return names


def _contains_numbered_fact(product: ProductInput) -> bool:
    values = [
        product.title,
        product.description,
        product.short_description,
        product.raw_extracted.body_text,
        *[str(value) for value in product.attributes.values()],
    ]
    return any(any(token.isdigit() for token in tokenize(value)) for value in values)


def _contains_use_case_text(text: str | None) -> bool:
    normalized = normalize_text(text)
    return any(word in normalized for word in USE_CASE_WORDS)


def _flatten_headings(headings: Mapping[str, Sequence[str]]) -> str:
    values = [
        value
        for key, values in headings.items()
        if str(key).lower() in {"h1", "h2", "h3"}
        for value in values
    ]
    return _join_text(*values)


def _join_text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                parts.append(value.strip())
            continue
        if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
            parts.extend(str(item).strip() for item in value if is_known_value(item))
            continue
        if is_known_value(value):
            parts.append(str(value).strip())
    return " ".join(parts)


def _component_ratio(component: ScoreComponentResult) -> float:
    return component.points / component.max_points


def _bounded_points(points: float, max_points: float) -> float:
    return round(min(max(points, 0.0), max_points), SCORE_DECIMAL_PLACES)


def _limit(values: Sequence[str], limit: int) -> list[str]:
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
    "build_reranking_semantic_context",
    "score_reranking_strength",
]
