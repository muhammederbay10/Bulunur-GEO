# ai/geo_engine/scoring/machine_understanding_score.py
"""Scores machine understanding from schema, product facts, and semantic consistency."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import (
    DEFAULT_LAYER_RECOMMENDED_ACTIONS,
    LAYER_COMPONENT_MAX_POINTS,
    MAX_MISSING_SIGNALS_PER_LAYER,
    MAX_REASONS_PER_LAYER,
    MIN_USEFUL_DESCRIPTION_CHARS,
    SCORE_DECIMAL_PLACES,
    SEMANTIC_COMPONENT_NAME,
)
from ai.geo_engine.types import GeminiLayerJudgment, LayerScoreResult, ScoreComponentResult
from ai.schema_engine.schema_mapping import is_known_value, normalize_availability
from ai.schema_engine.types import SchemaValidationResult
from ai.schema_engine.validate_schema import validate_schema
from ai.turkish_nlp.category_attributes import build_attribute_context
from ai.turkish_nlp.normalize import normalize_text


MACHINE_UNDERSTANDING_LAYER = "machine_understanding"
MACHINE_COMPONENTS = LAYER_COMPONENT_MAX_POINTS[MACHINE_UNDERSTANDING_LAYER]


def score_machine_understanding(
    product: ProductInput,
    *,
    schema_validation: SchemaValidationResult | Mapping[str, Any] | None = None,
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any],
) -> LayerScoreResult:
    """Score whether machines can understand trusted product and schema facts."""
    validation = _coerce_schema_validation(schema_validation, product)
    attribute_context = build_attribute_context(
        category=product.category,
        attributes=product.attributes,
        product_facts=_product_fact_summary(product),
    )
    semantic_component, semantic_action = _score_semantic_judgment(
        semantic_judgment,
    )

    components = [
        _score_schema_validation(validation),
        _score_offer_fact_completeness(product, validation),
        _score_product_fact_coverage(product),
        _score_attribute_normalization(attribute_context),
        semantic_component,
    ]

    return LayerScoreResult(
        layer=MACHINE_UNDERSTANDING_LAYER,
        components=components,
        recommendedNextAction=_choose_recommended_action(components, semantic_action),
        metadata={
            "productSchemaPresent": validation.product_schema_present,
            "offerSchemaPresent": validation.offer_schema_present,
            "schemaValid": validation.valid,
            "semanticJudgmentRequired": True,
        },
    )


def build_machine_understanding_semantic_context(
    product: ProductInput,
    *,
    schema_validation: SchemaValidationResult | Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Return compact context for the machine-understanding SKILL.md prompt."""
    validation = _coerce_schema_validation(schema_validation, product)
    return {
        "product": _product_fact_summary(product),
        "visiblePageFacts": {
            "pageTitle": product.raw_extracted.page_title,
            "metaDescription": product.raw_extracted.meta_description,
            "headings": product.raw_extracted.headings,
            "bodyText": product.raw_extracted.body_text,
        },
        "detectedSchema": product.raw_extracted.detected_schema
        or product.crawl_metadata.detected_structured_data,
        "schemaValidation": validation.model_dump(mode="json", by_alias=True),
        "attributeContext": build_attribute_context(
            category=product.category,
            attributes=product.attributes,
            product_facts=_product_fact_summary(product),
        ),
    }


def _score_schema_validation(
    validation: SchemaValidationResult,
) -> ScoreComponentResult:
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if validation.product_schema_present:
        points += 2.0
        reasons.append("Urun JSON-LD mevcut.")
    else:
        missing.append("Schema.org urun JSON-LD")

    if validation.valid and not validation.has_errors:
        points += 2.0
        reasons.append("Schema doğrulamasında engelleyici hata yok.")
    elif not validation.has_errors:
        points += 1.0
        reasons.append("Schema engelleyici hata içermiyor ancak tam geçerli değil.")
    else:
        missing.extend(validation.errors[:2])

    required_present, required_total = _field_presence(
        validation,
        ("@type", "name"),
    )
    if required_total:
        points += 2.0 * required_present / required_total
    if required_present == required_total and required_total:
        reasons.append("Gerekli urun schema alanlari mevcut.")
    else:
        missing.extend(_missing_fields(validation, ("@type", "name")))

    recommended_fields = ("description", "image", "brand", "offers")
    recommended_present, recommended_total = _field_presence(
        validation,
        recommended_fields,
    )
    if recommended_total:
        points += 2.0 * recommended_present / recommended_total
    if recommended_present:
        reasons.append("Onerilen urun schema alanlarinin bir kismi mevcut.")
    missing.extend(_missing_fields(validation, recommended_fields))

    offer_fields = ("offers.price", "offers.priceCurrency", "offers.availability")
    offer_present, offer_total = _field_presence(validation, offer_fields)
    if offer_total:
        points += 2.0 * offer_present / offer_total
    if offer_present == offer_total and offer_total:
        reasons.append("Teklif schema alanlari gecerli ve makine tarafindan okunabilir.")
    else:
        missing.extend(_missing_fields(validation, offer_fields))

    return _component(
        "schema_validation",
        "schema_validation",
        points,
        reasons,
        missing,
        metadata={
            "valid": validation.valid,
            "hasErrors": validation.has_errors,
            "issueCodes": [issue.code for issue in validation.issues],
        },
    )


def _score_offer_fact_completeness(
    product: ProductInput,
    validation: SchemaValidationResult,
) -> ScoreComponentResult:
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if validation.offer_schema_present:
        points += 1.0
        reasons.append("Urun schema teklif verisi iceriyor.")
    else:
        missing.append("Urun teklif schema verisi")

    if is_known_value(product.price):
        points += 0.75
        reasons.append("Görünür ürün fiyatı mevcut.")
    else:
        missing.append("Görünür ürün fiyatı")
    if _field_is_present(validation, "offers.price"):
        points += 0.75
        reasons.append("Teklif fiyati schema icinde gecerli.")
    else:
        missing.append("Schema teklif fiyati")

    if is_known_value(product.currency):
        points += 0.5
        reasons.append("Görünür ürün para birimi mevcut.")
    else:
        missing.append("Görünür ürün para birimi")
    if _field_is_present(validation, "offers.priceCurrency"):
        points += 0.5
        reasons.append("Teklif para birimi schema icinde gecerli.")
    else:
        missing.append("Schema teklif para birimi")

    if product.availability != "unknown":
        points += 0.75
        reasons.append("Görünür stok durumu mevcut.")
    else:
        missing.append("Görünür stok durumu")
    if _field_is_present(validation, "offers.availability"):
        points += 0.75
        reasons.append("Teklif stok durumu schema icinde gecerli.")
    else:
        missing.append("Schema teklif stok durumu")

    return _component(
        "offer_fact_completeness",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={
            "pricePresent": is_known_value(product.price),
            "currencyPresent": is_known_value(product.currency),
            "availability": product.availability,
            "normalizedAvailability": normalize_availability(product.availability),
        },
    )


def _score_product_fact_coverage(product: ProductInput) -> ScoreComponentResult:
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if is_known_value(product.title):
        points += 0.45
        reasons.append("Ürün başlığı bilinen gerçek olarak mevcut.")
    else:
        missing.append("Ürün başlığı")

    description = _join_text(product.description, product.short_description)
    if len(normalize_text(description)) >= MIN_USEFUL_DESCRIPTION_CHARS:
        points += 0.6
        reasons.append("Ürün açıklaması makine bağlamı için yeterince detaylı.")
    elif is_known_value(description):
        points += 0.3
        missing.append("Detaylı ürün açıklaması")
    else:
        missing.append("Ürün açıklaması")

    if product.image_urls:
        points += 0.35
        reasons.append("Ürün görsel URL'leri mevcut.")
    else:
        missing.append("Ürün görselleri")

    if is_known_value(product.brand):
        points += 0.35
        reasons.append("Marka ürün gerçeği olarak mevcut.")
    else:
        missing.append("Ürün markası")

    if is_known_value(product.category):
        points += 0.35
        reasons.append("Kategori ürün gerçeği olarak mevcut.")
    else:
        missing.append("Ürün kategorisi")

    if product.attributes:
        points += 0.5
        reasons.append("Ürün özellikleri mevcut.")
    else:
        missing.append("Ürün özellikleri")

    body_text = product.raw_extracted.body_text
    if is_known_value(body_text):
        points += 0.4
        reasons.append("Görünür gövde metni ek ürün bağlamı sağlıyor.")
    else:
        missing.append("Görünür ürün gövde metni")

    return _component(
        "product_fact_coverage",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={
            "attributeCount": len(product.attributes),
            "imageCount": len(product.image_urls),
        },
    )


def _score_attribute_normalization(
    attribute_context: Mapping[str, Any],
) -> ScoreComponentResult:
    known_attributes = attribute_context.get("knownAttributes", {})
    unknown_attributes = attribute_context.get("unknownAttributes", {})
    missing_hints = attribute_context.get("suggestedMissingAttributes", [])
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if isinstance(known_attributes, Mapping) and known_attributes:
        points += min(1.2, 0.3 * len(known_attributes))
        reasons.append("Genel ürün özellikleri normalize edildi.")
    else:
        missing.append("Genel normalize ürün özellikleri")

    if isinstance(unknown_attributes, Mapping) and unknown_attributes:
        points += 0.4
        reasons.append("Bilinmeyen özellikler korunuyor, reddedilmiyor.")

    if missing_hints:
        points += 0.2
        missing.extend(_attribute_hint_names(missing_hints)[:3])
    else:
        points += 0.4
        reasons.append("Genel özellik tarafında belirgin boşluk bulunmadı.")

    return _component(
        "attribute_normalization",
        "turkish_nlp",
        points,
        reasons,
        missing,
        metadata={
            "knownAttributes": known_attributes,
            "unknownAttributeCount": len(unknown_attributes)
            if isinstance(unknown_attributes, Mapping)
            else 0,
            "missingAttributeHintCount": len(missing_hints)
            if isinstance(missing_hints, Sequence)
            else 0,
        },
    )


def _score_semantic_judgment(
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any] | None,
) -> tuple[ScoreComponentResult, str | None]:
    max_points = MACHINE_COMPONENTS[SEMANTIC_COMPONENT_NAME]

    if semantic_judgment is None:
        raise ValueError(
            "semantic_judgment is required for machine understanding scoring"
        )

    judgment = _coerce_semantic_judgment(semantic_judgment)
    if judgment.layer is not None and judgment.layer != MACHINE_UNDERSTANDING_LAYER:
        raise ValueError("semantic_judgment layer must be machine_understanding")

    return judgment.to_component(max_points=max_points), judgment.recommended_next_action


def _coerce_schema_validation(
    schema_validation: SchemaValidationResult | Mapping[str, Any] | None,
    product: ProductInput,
) -> SchemaValidationResult:
    if isinstance(schema_validation, SchemaValidationResult):
        return schema_validation
    if isinstance(schema_validation, Mapping):
        return SchemaValidationResult.model_validate(dict(schema_validation))
    return validate_schema(product)


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
        elif raw_score <= 6.0:
            data["semanticScore"] = raw_score / 6.0 * 100.0
        elif raw_score <= 10.0:
            data["semanticScore"] = raw_score * 10.0
        else:
            data["semanticScore"] = raw_score

    data.setdefault("layer", MACHINE_UNDERSTANDING_LAYER)
    return GeminiLayerJudgment.model_validate(data)


def _choose_recommended_action(
    components: Sequence[ScoreComponentResult],
    semantic_action: str | None,
) -> str:
    if semantic_action:
        return semantic_action

    by_name = {component.name: component for component in components}
    if all(_component_ratio(component) >= 0.95 for component in components):
        return "Mevcut schema tutarlılığını ve ürün gerçeklerini koruyun."
    if _component_ratio(by_name["schema_validation"]) < 0.75:
        return "Optimizasyondan once urun JSON-LD dogrulama sorunlarini duzeltin."
    if _component_ratio(by_name["offer_fact_completeness"]) < 0.75:
        return "Urun teklif verisindeki guvenilir fiyat, para birimi ve stok alanlarini tamamlayin."
    if _component_ratio(by_name["product_fact_coverage"]) < 0.75:
        return "Makine anlayışı için eksik ürün gerçeklerini ekleyin."
    if _component_ratio(by_name["attribute_normalization"]) < 0.75:
        return "Marka, model, ölçü ve malzeme gibi genel özellikleri normalize edin."
    return DEFAULT_LAYER_RECOMMENDED_ACTIONS[MACHINE_UNDERSTANDING_LAYER]


def _component(
    name: str,
    source: str,
    points: float,
    reasons: Sequence[str],
    missing: Sequence[str],
    *,
    metadata: Mapping[str, Any] | None = None,
) -> ScoreComponentResult:
    max_points = MACHINE_COMPONENTS[name]
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


def _field_presence(
    validation: SchemaValidationResult,
    fields: Sequence[str],
) -> tuple[int, int]:
    return (
        sum(1 for field in fields if _field_is_present(validation, field)),
        len(fields),
    )


def _field_is_present(validation: SchemaValidationResult, field: str) -> bool:
    return any(
        status.field == field and status.is_present
        for status in validation.field_statuses
    )


def _missing_fields(
    validation: SchemaValidationResult,
    fields: Sequence[str],
) -> list[str]:
    return [
        f"Schema alanı: {field}"
        for field in fields
        if not _field_is_present(validation, field)
    ]


def _attribute_hint_names(hints: Any) -> list[str]:
    if not isinstance(hints, Sequence) or isinstance(hints, (str, bytes, bytearray)):
        return []

    names: list[str] = []
    for hint in hints:
        if isinstance(hint, Mapping):
            name = hint.get("label") or hint.get("name")
            if name:
                names.append(f"Özellik ipucu: {name}")
    return names


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


def _component_ratio(component: ScoreComponentResult) -> float:
    return component.points / component.max_points


def _bounded_points(points: float, max_points: float) -> float:
    return round(min(max(points, 0.0), max_points), SCORE_DECIMAL_PLACES)


def _join_text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
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
    "build_machine_understanding_semantic_context",
    "score_machine_understanding",
]
