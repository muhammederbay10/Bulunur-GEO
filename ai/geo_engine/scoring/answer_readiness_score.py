# ai/geo_engine/scoring/answer_readiness_score.py
"""Scores whether a product can support grounded Turkish AI answers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import (
    DEFAULT_LAYER_RECOMMENDED_ACTIONS,
    LAYER_COMPONENT_MAX_POINTS,
    MAX_MISSING_SIGNALS_PER_LAYER,
    MAX_REASONS_PER_LAYER,
    MIN_FAQ_ITEM_COUNT_FOR_FULL_CREDIT,
    MIN_KNOWN_FACT_COUNT_FOR_GROUNDING,
    MIN_STRONG_DESCRIPTION_CHARS,
    MIN_USEFUL_DESCRIPTION_CHARS,
    SCORE_DECIMAL_PLACES,
    SEMANTIC_COMPONENT_NAME,
)
from ai.geo_engine.types import GeminiLayerJudgment, LayerScoreResult, ScoreComponentResult
from ai.schema_engine.schema_mapping import is_known_value
from ai.turkish_nlp.buyer_patterns import build_buyer_pattern_context
from ai.turkish_nlp.category_attributes import build_attribute_context
from ai.turkish_nlp.normalize import contains_any_phrase, normalize_text, tokenize
from ai.turkish_nlp.trust_signals import build_trust_signal_context


ANSWER_READINESS_LAYER = "ai_answer_readiness"
ANSWER_COMPONENTS = LAYER_COMPONENT_MAX_POINTS[ANSWER_READINESS_LAYER]

SUMMARY_USE_CASE_TERMS = (
    "için",
    "icin",
    "uygun",
    "kullanım",
    "kullanim",
    "aile",
    "hediye",
    "günlük",
    "gunluk",
)
ANSWER_HELPFUL_FACT_KEYS = (
    "title",
    "description",
    "shortDescription",
    "price",
    "currency",
    "availability",
    "brand",
    "category",
    "imageUrls",
    "attributes",
)


def score_answer_readiness(
    product: ProductInput,
    *,
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any],
    known_facts: Mapping[str, Any] | None = None,
    missing_facts: Sequence[str] | None = None,
    faq_items: Sequence[Mapping[str, Any]] | None = None,
) -> LayerScoreResult:
    """Score whether grounded Turkish product answers can be generated safely."""
    resolved_known_facts = _build_known_facts(product, known_facts)
    resolved_missing_facts = _build_missing_facts(
        product,
        known_facts=resolved_known_facts,
        missing_facts=missing_facts,
    )
    resolved_faq_items = _coerce_faq_items(faq_items) or _extract_faq_items(product)
    semantic_component, semantic_action = _score_semantic_judgment(semantic_judgment)

    components = [
        _score_answer_content_presence(product),
        _score_faq_readiness(resolved_faq_items, resolved_known_facts),
        _score_known_fact_grounding(resolved_known_facts),
        _score_missing_fact_control(resolved_missing_facts),
        semantic_component,
    ]

    return LayerScoreResult(
        layer=ANSWER_READINESS_LAYER,
        components=components,
        recommendedNextAction=_choose_recommended_action(components, semantic_action),
        metadata={
            "knownFactCount": len(resolved_known_facts),
            "missingFactCount": len(resolved_missing_facts),
            "faqItemCount": len(resolved_faq_items),
            "semanticJudgmentRequired": True,
        },
    )


def build_answer_readiness_semantic_context(
    product: ProductInput,
    *,
    known_facts: Mapping[str, Any] | None = None,
    missing_facts: Sequence[str] | None = None,
    faq_items: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return compact context for the answer-readiness SKILL.md prompt."""
    resolved_known_facts = _build_known_facts(product, known_facts)
    resolved_missing_facts = _build_missing_facts(
        product,
        known_facts=resolved_known_facts,
        missing_facts=missing_facts,
    )
    resolved_faq_items = _coerce_faq_items(faq_items) or _extract_faq_items(product)
    answer_text = _answer_text(product)

    return {
        "product": _product_fact_summary(product),
        "knownFacts": resolved_known_facts,
        "missingFacts": resolved_missing_facts,
        "faq": resolved_faq_items,
        "answerContentSignals": {
            "shortDescription": product.short_description,
            "description": product.description,
            "bodyText": product.raw_extracted.body_text,
            "metaDescription": product.raw_extracted.meta_description,
        },
        "attributeContext": build_attribute_context(
            category=product.category,
            attributes=product.attributes,
            product_facts=_product_fact_summary(product),
        ),
        "buyerPatternContext": build_buyer_pattern_context(
            answer_text,
            product_anchor=product.category or product.title,
        ),
        "trustSignalContext": build_trust_signal_context(answer_text),
    }


def _score_answer_content_presence(product: ProductInput) -> ScoreComponentResult:
    summary_text = product.short_description or product.raw_extracted.meta_description
    long_text = _join_text(product.description, product.raw_extracted.body_text)
    answer_text = _answer_text(product)
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if is_known_value(product.title):
        points += 0.5
        reasons.append("Ürün başlığı cevapları temellendirmek için mevcut.")
    else:
        missing.append("Ürün başlığı")

    if len(normalize_text(summary_text)) >= MIN_USEFUL_DESCRIPTION_CHARS:
        points += 1.0
        reasons.append("Kısa özet veya meta açıklama hızlı cevapları destekleyebilir.")
    elif is_known_value(summary_text):
        points += 0.45
        missing.append("Net tek paragraf ürün özeti")
    else:
        missing.append("Kısa ürün özeti")

    if len(normalize_text(long_text)) >= MIN_STRONG_DESCRIPTION_CHARS:
        points += 1.0
        reasons.append("Uzun açıklama gerçeklere dayalı cevaplar için yeterli detay sunuyor.")
    elif len(normalize_text(long_text)) >= MIN_USEFUL_DESCRIPTION_CHARS:
        points += 0.65
        missing.append("Daha zengin uzun açıklama")
    else:
        missing.append("Detaylı ürün açıklaması")

    if contains_any_phrase(answer_text, SUMMARY_USE_CASE_TERMS):
        points += 0.8
        reasons.append("Kullanım senaryosu veya hedef kitle dili mevcut.")
    else:
        missing.append("Kullanım senaryosu veya hedef kitle bağlamı")

    if product.attributes:
        points += 0.4
        reasons.append("Özellikler cevaplanabilir ürün gerçekleri sağlıyor.")
    else:
        missing.append("Ürün özellikleri")

    if is_known_value(product.price) and product.availability != "unknown":
        points += 0.3
        reasons.append("Ticari bilgiler satın alma hazırlığı cevaplarını destekliyor.")
    else:
        missing.append("Fiyat ve stok bilgileri")

    return _component(
        "answer_content_presence",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={
            "summaryLength": len(normalize_text(summary_text)),
            "longTextLength": len(normalize_text(long_text)),
        },
    )


def _score_faq_readiness(
    faq_items: Sequence[Mapping[str, Any]],
    known_facts: Mapping[str, Any],
) -> ScoreComponentResult:
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if faq_items:
        points += min(1.2, 1.2 * len(faq_items) / MIN_FAQ_ITEM_COUNT_FOR_FULL_CREDIT)
        reasons.append("Alıcı soruları için FAQ maddeleri mevcut.")
    else:
        missing.append("Alıcı niyeti odaklı FAQ maddeleri")

    complete_items = [
        item for item in faq_items if is_known_value(item.get("question"))
        and is_known_value(item.get("answer"))
    ]
    if complete_items:
        points += min(0.8, 0.8 * len(complete_items) / MIN_FAQ_ITEM_COUNT_FOR_FULL_CREDIT)
        reasons.append("FAQ maddeleri hem soru hem cevap içeriyor.")
    elif faq_items:
        missing.append("Tam FAQ soru-cevap çiftleri")

    grounded_items = [
        item for item in complete_items if _faq_item_looks_grounded(item, known_facts)
    ]
    if grounded_items:
        points += min(0.7, 0.7 * len(grounded_items) / MIN_FAQ_ITEM_COUNT_FOR_FULL_CREDIT)
        reasons.append("FAQ cevapları bilinen ürün gerçekleriyle örtüşüyor.")
    elif faq_items:
        missing.append("Bilinen ürün gerçeklerine dayalı FAQ cevapları")

    buyer_question_items = [
        item for item in complete_items if _is_buyer_question(item.get("question"))
    ]
    if buyer_question_items:
        points += 0.3
        reasons.append("FAQ doğal alıcı tarzı soruları kapsıyor.")
    elif faq_items:
        missing.append("Alıcı tarzı FAQ soruları")

    return _component(
        "faq_readiness",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={
            "faqItemCount": len(faq_items),
            "completeFaqItemCount": len(complete_items),
            "groundedFaqItemCount": len(grounded_items),
        },
    )


def _score_known_fact_grounding(
    known_facts: Mapping[str, Any],
) -> ScoreComponentResult:
    known_count = sum(1 for value in known_facts.values() if is_known_value(value))
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    points += min(1.2, 1.2 * known_count / MIN_KNOWN_FACT_COUNT_FOR_GROUNDING)
    if known_count:
        reasons.append("Gerçeklere dayalı cevaplar için bilinen ürün verileri mevcut.")
    else:
        missing.append("Bilinen ürün gerçekleri")

    commerce_keys = ("price", "currency", "availability")
    commerce_present = sum(1 for key in commerce_keys if is_known_value(known_facts.get(key)))
    points += 0.6 * commerce_present / len(commerce_keys)
    if commerce_present == len(commerce_keys):
        reasons.append("Ticari gercekler satin alma hazirligi cevaplari icin tamam.")
    else:
        missing.extend(
            f"Bilinen gerçek: {key}"
            for key in commerce_keys
            if not is_known_value(known_facts.get(key))
        )

    identity_keys = ("brand", "category")
    identity_present = sum(1 for key in identity_keys if is_known_value(known_facts.get(key)))
    points += 0.5 * identity_present / len(identity_keys)
    if identity_present:
        reasons.append("Marka veya kategori bilgisi ürünü bağlama oturtuyor.")
    else:
        missing.append("Marka veya kategori bilgisi")

    attributes = known_facts.get("attributes")
    if isinstance(attributes, Mapping) and attributes:
        points += 0.5
        reasons.append("Özellikler gerçeklere dayalı cevap desteği sağlıyor.")
    else:
        missing.append("Bilinen ürün özellikleri")

    images = known_facts.get("imageUrls")
    if isinstance(images, Sequence) and images:
        points += 0.2
        reasons.append("Ürün bağlamı için görsel bilgileri mevcut.")
    else:
        missing.append("Ürün görsel bilgileri")

    return _component(
        "known_fact_grounding",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={"knownFactCount": known_count},
    )


def _score_missing_fact_control(
    missing_facts: Sequence[str],
) -> ScoreComponentResult:
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []
    missing_count = len(missing_facts)

    if missing_count == 0:
        points += 1.4
        reasons.append("Cevap için kritik eksik bilgi tespit edilmedi.")
    elif missing_count <= 3:
        points += 1.0
        reasons.append("Eksik bilgiler açık şekilde takip ediliyor.")
        missing.extend(missing_facts)
    elif missing_count <= 6:
        points += 0.55
        reasons.append("Eksik bilgiler takip ediliyor ancak cevaplanabilirlik sınırlı.")
        missing.extend(missing_facts)
    else:
        points += 0.25
        missing.extend(missing_facts)

    if missing_count > 0:
        points += 0.4
        reasons.append("Bilinen boşluklar hedefli kullanıcı sorularına yönlendirilebilir.")
    else:
        points += 0.6
        reasons.append("Cevap üretimi ek boşluk soruları olmadan mevcut gerçeklere dayanabilir.")

    return _component(
        "missing_fact_control",
        "score_math",
        points,
        reasons,
        missing,
        metadata={"missingFactCount": missing_count},
    )


def _score_semantic_judgment(
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any] | None,
) -> tuple[ScoreComponentResult, str | None]:
    max_points = ANSWER_COMPONENTS[SEMANTIC_COMPONENT_NAME]

    if semantic_judgment is None:
        raise ValueError("semantic_judgment is required for AI answer readiness scoring")

    judgment = _coerce_semantic_judgment(semantic_judgment)
    if judgment.layer is not None and judgment.layer != ANSWER_READINESS_LAYER:
        raise ValueError("semantic_judgment layer must be ai_answer_readiness")

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
        elif raw_score <= 15.0:
            data["semanticScore"] = raw_score / 15.0 * 100.0
        else:
            data["semanticScore"] = raw_score

    data.setdefault("layer", ANSWER_READINESS_LAYER)
    return GeminiLayerJudgment.model_validate(data)


def _choose_recommended_action(
    components: Sequence[ScoreComponentResult],
    semantic_action: str | None,
) -> str:
    if semantic_action:
        return semantic_action

    by_name = {component.name: component for component in components}
    if all(_component_ratio(component) >= 0.95 for component in components):
        return "Mevcut FAQ, özet ve gerçeklere dayalı cevap desteğini koruyun."
    if _component_ratio(by_name["answer_content_presence"]) < 0.75:
        return "Kısa bir özet, detaylı açıklama ve kullanım bağlamı ekleyin."
    if _component_ratio(by_name["faq_readiness"]) < 0.75:
        return "Alıcı niyeti odaklı FAQ'ı yalnızca bilinen ürün gerçeklerinden üretin."
    if _component_ratio(by_name["known_fact_grounding"]) < 0.75:
        return "Gerçeklere dayalı AI cevapları için gerekli güvenilir bilgileri ekleyin."
    if _component_ratio(by_name["missing_fact_control"]) < 0.75:
        return "Cevap için kritik eksik bilgiler adına hedefli sorular sorun."
    return DEFAULT_LAYER_RECOMMENDED_ACTIONS[ANSWER_READINESS_LAYER]


def _component(
    name: str,
    source: str,
    points: float,
    reasons: Sequence[str],
    missing: Sequence[str],
    *,
    metadata: Mapping[str, Any] | None = None,
) -> ScoreComponentResult:
    max_points = ANSWER_COMPONENTS[name]
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


def _build_known_facts(
    product: ProductInput,
    known_facts: Mapping[str, Any] | None,
) -> dict[str, Any]:
    facts = _product_fact_summary(product)
    facts.update(dict(known_facts or {}))
    return {key: value for key, value in facts.items() if is_known_value(value)}


def _build_missing_facts(
    product: ProductInput,
    *,
    known_facts: Mapping[str, Any],
    missing_facts: Sequence[str] | None,
) -> list[str]:
    missing = list(missing_facts or [])

    for key in ANSWER_HELPFUL_FACT_KEYS:
        if not is_known_value(known_facts.get(key)):
            missing.append(f"Bilinen gerçek: {key}")

    attribute_context = build_attribute_context(
        category=product.category,
        attributes=product.attributes,
        product_facts=_product_fact_summary(product),
    )
    for hint in attribute_context.get("suggestedMissingAttributes", [])[:3]:
        if isinstance(hint, Mapping):
            name = hint.get("label") or hint.get("name")
            if name:
                missing.append(f"Cevap temellendirme özelliği: {name}")

    return _limit(missing, MAX_MISSING_SIGNALS_PER_LAYER)


def _coerce_faq_items(
    faq_items: Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, Any]]:
    if faq_items is None:
        return []

    return [
        dict(item)
        for item in faq_items
        if isinstance(item, Mapping)
        and (is_known_value(item.get("question")) or is_known_value(item.get("answer")))
    ]


def _extract_faq_items(product: ProductInput) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for schema in [
        *product.raw_extracted.detected_schema,
        *product.crawl_metadata.detected_structured_data,
    ]:
        items.extend(_extract_faq_items_from_schema(schema))
    return items


def _extract_faq_items_from_schema(schema: Any) -> list[dict[str, Any]]:
    if isinstance(schema, Mapping):
        schema_type = schema.get("@type") or schema.get("type")
        if _schema_type_matches(schema_type, "FAQPage"):
            return _extract_question_items(schema.get("mainEntity"))

        if _schema_type_matches(schema_type, "Question"):
            return [_question_schema_to_faq_item(schema)]

        items: list[dict[str, Any]] = []
        for value in schema.values():
            items.extend(_extract_faq_items_from_schema(value))
        return items

    if isinstance(schema, Sequence) and not isinstance(schema, (str, bytes, bytearray)):
        items: list[dict[str, Any]] = []
        for item in schema:
            items.extend(_extract_faq_items_from_schema(item))
        return items

    return []


def _extract_question_items(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, Mapping):
        return [_question_schema_to_faq_item(value)]
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [
            _question_schema_to_faq_item(item)
            for item in value
            if isinstance(item, Mapping)
        ]
    return []


def _question_schema_to_faq_item(schema: Mapping[str, Any]) -> dict[str, Any]:
    answer = schema.get("acceptedAnswer")
    if isinstance(answer, Mapping):
        answer_text = answer.get("text") or answer.get("answer")
    else:
        answer_text = None
    return {
        "question": schema.get("name") or schema.get("question"),
        "answer": answer_text,
    }


def _schema_type_matches(value: Any, expected: str) -> bool:
    if isinstance(value, str):
        return value.strip().casefold().endswith(expected.casefold())
    if isinstance(value, Sequence):
        return any(_schema_type_matches(item, expected) for item in value)
    return False


def _faq_item_looks_grounded(
    item: Mapping[str, Any],
    known_facts: Mapping[str, Any],
) -> bool:
    answer_tokens = set(_meaningful_tokens(str(item.get("answer", ""))))
    fact_values = [
        value
        for key, value in known_facts.items()
        if key not in {"imageUrls"}
    ]
    fact_tokens = set(_meaningful_tokens(_join_text(*fact_values)))
    return bool(answer_tokens.intersection(fact_tokens))


def _is_buyer_question(value: Any) -> bool:
    normalized = normalize_text(str(value))
    return contains_any_phrase(
        normalized,
        (
            "kimler için",
            "kimler icin",
            "ne için",
            "ne icin",
            "uygun mu",
            "neden",
            "farkı",
            "farki",
            "alınır mı",
            "alinir mi",
            "garanti",
            "kargo",
            "iade",
        ),
    )


def _answer_text(product: ProductInput) -> str:
    return _join_text(
        product.title,
        product.short_description,
        product.description,
        product.category,
        product.brand,
        *product.attributes.values(),
        product.raw_extracted.meta_description,
        product.raw_extracted.body_text,
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


def _meaningful_tokens(text: str | None) -> list[str]:
    return [token for token in tokenize(text) if len(token) > 2]


def _component_ratio(component: ScoreComponentResult) -> float:
    return component.points / component.max_points


def _bounded_points(points: float, max_points: float) -> float:
    return round(min(max(points, 0.0), max_points), SCORE_DECIMAL_PLACES)


def _join_text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                parts.append(value.strip())
            continue
        if isinstance(value, Mapping):
            parts.extend(str(item).strip() for item in value.values() if is_known_value(item))
            continue
        if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
            parts.extend(str(item).strip() for item in value if is_known_value(item))
            continue
        if is_known_value(value):
            parts.append(str(value).strip())
    return " ".join(parts)


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
    "build_answer_readiness_semantic_context",
    "score_answer_readiness",
]
