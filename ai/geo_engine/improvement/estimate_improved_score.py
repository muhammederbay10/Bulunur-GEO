# ai/geo_engine/improvement/estimate_improved_score.py
"""Estimates improved GEO score by rerunning the scoring engine."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field

from ai.api_contracts.geo_improvement_output import (
    EstimatedLayerScore,
    GeneratedFaqItem,
    GeneratedProductContent,
    ScoreEstimate,
    ScoreEstimateLayers,
)
from ai.api_contracts.product_input import ProductInput, RawExtractedData
from ai.geo_engine.constants import EXPECTED_LAYER_ORDER, LAYER_DISPLAY_NAMES
from ai.geo_engine.scoring.score_product import SemanticJudgmentMap, score_product
from ai.geo_engine.types import FourLayerGeoScore, GeoScoreLayer, LayerScoreResult
from ai.schema_engine.schema_mapping import is_known_value
from ai.schema_engine.types import SchemaValidationResult
from ai.schema_engine.validate_schema import validate_schema


class ImprovedScoreEstimateResult(BaseModel):
    """Actual before/after scoring result for generated improvements."""

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    before_score: FourLayerGeoScore = Field(alias="beforeScore")
    after_score: FourLayerGeoScore = Field(alias="afterScore")
    improved_product: ProductInput = Field(alias="improvedProduct")
    schema_validation: SchemaValidationResult | None = Field(default=None, alias="schemaValidation")
    expected_gain_reasons: list[str] = Field(default_factory=list, alias="expectedGainReasons")
    metadata: dict[str, Any] = Field(default_factory=dict)

    @computed_field(alias="before")
    @property
    def before(self) -> float:
        """Return the actual before score from the scoring engine."""
        return self.before_score.overall_score

    @computed_field(alias="after")
    @property
    def after(self) -> float:
        """Return the actual after score from the scoring engine."""
        return self.after_score.overall_score

    @computed_field(alias="gain")
    @property
    def gain(self) -> float:
        """Return the actual score movement from the scoring engine."""
        return round(self.after - self.before, 2)

    def to_api_score_estimate(self) -> ScoreEstimate:
        """Convert to the public score-estimate contract."""
        return ScoreEstimate(
            after=self.after,
            layers=_api_estimate_layers(self.after_score),
            expectedGainReasons=self.expected_gain_reasons,
        )


def estimate_improved_score(
    product: ProductInput | Mapping[str, Any],
    generated: GeneratedProductContent | Mapping[str, Any],
    *,
    semantic_judgments: SemanticJudgmentMap,
    before_semantic_judgments: SemanticJudgmentMap | None = None,
    known_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
    missing_facts: Sequence[str] | None = None,
) -> ImprovedScoreEstimateResult:
    """Apply generated improvements and rerun the real scoring engine."""
    original_product = _coerce_product(product)
    generated_content = _coerce_generated_content(generated)
    improved_product = _apply_generated_content(
        original_product,
        generated_content,
        user_confirmed_facts=user_confirmed_facts,
    )
    schema_validation = _schema_validation_for(generated_content, improved_product)
    merged_known_facts = _merge_known_facts(
        improved_product,
        known_facts=known_facts,
        user_confirmed_facts=user_confirmed_facts,
    )
    resolved_missing_facts = _resolved_missing_facts(missing_facts, generated_content, user_confirmed_facts)
    faq_items = _faq_items(generated_content)

    before_score = score_product(
        original_product,
        semantic_judgments=before_semantic_judgments or semantic_judgments,
        known_facts=known_facts,
        missing_facts=missing_facts,
    )
    after_score = score_product(
        improved_product,
        semantic_judgments=semantic_judgments,
        schema_validation=schema_validation,
        known_facts=merged_known_facts,
        missing_facts=resolved_missing_facts,
        faq_items=faq_items,
    )

    return ImprovedScoreEstimateResult(
        beforeScore=before_score,
        afterScore=after_score,
        improvedProduct=improved_product,
        schemaValidation=schema_validation,
        expectedGainReasons=_expected_gain_reasons(before_score, after_score),
        metadata={
            "scoringEngineReused": True,
            "semanticJudgmentsRequired": list(EXPECTED_LAYER_ORDER),
            "generatedFieldsApplied": _generated_fields_applied(generated_content),
            "actualGain": round(after_score.overall_score - before_score.overall_score, 2),
        },
    )


def _api_estimate_layers(score: FourLayerGeoScore) -> ScoreEstimateLayers:
    """Convert the after-score layers into the public estimate contract."""
    return ScoreEstimateLayers(
        retrieval=_api_estimate_layer(score.retrieval),
        machineUnderstanding=_api_estimate_layer(score.machine_understanding),
        rerankingStrength=_api_estimate_layer(score.reranking_strength),
        aiAnswerReadiness=_api_estimate_layer(score.ai_answer_readiness),
    )


def _api_estimate_layer(layer: LayerScoreResult) -> EstimatedLayerScore:
    """Return compact score data for one estimated after layer."""
    return EstimatedLayerScore(
        score=layer.score,
        maxScore=layer.max_score,
        weightedPoints=layer.weighted_points,
        maxWeightedPoints=layer.max_weighted_points,
    )


def _apply_generated_content(
    product: ProductInput,
    generated: GeneratedProductContent,
    *,
    user_confirmed_facts: Mapping[str, Any] | None,
) -> ProductInput:
    updates: dict[str, Any] = {}
    if generated.title:
        updates["title"] = generated.title
    if generated.short_description:
        updates["short_description"] = generated.short_description
    if generated.long_description:
        updates["description"] = generated.long_description

    confirmed = dict(user_confirmed_facts or {})
    for field in ("price", "currency", "availability", "brand", "category"):
        if is_known_value(confirmed.get(field)):
            updates[field] = confirmed[field]

    attributes = _merged_attributes(product.attributes, generated, confirmed)
    if attributes:
        updates["attributes"] = attributes

    updates["raw_extracted"] = _updated_raw_extracted(product, generated)
    return product.model_copy(update=updates, deep=True)


def _updated_raw_extracted(product: ProductInput, generated: GeneratedProductContent) -> RawExtractedData:
    raw_data = product.raw_extracted.model_dump(by_alias=False)
    if generated.seo_title or generated.title:
        raw_data["page_title"] = generated.seo_title or generated.title
    if generated.meta_description or generated.short_description:
        raw_data["meta_description"] = generated.meta_description or generated.short_description

    body_parts = [
        product.raw_extracted.body_text,
        generated.short_description,
        generated.long_description,
        _faq_text(generated.faq),
    ]
    body_text = " ".join(part.strip() for part in body_parts if isinstance(part, str) and part.strip())
    if body_text:
        raw_data["body_text"] = body_text

    detected_schema = list(product.raw_extracted.detected_schema)
    if generated.schema_json_ld:
        detected_schema = [generated.schema_json_ld, *detected_schema]
    raw_data["detected_schema"] = detected_schema

    return RawExtractedData.model_validate(raw_data)


def _schema_validation_for(
    generated: GeneratedProductContent,
    improved_product: ProductInput,
) -> SchemaValidationResult:
    if generated.schema_json_ld:
        return validate_schema(generated.schema_json_ld)
    return validate_schema(improved_product)


def _merge_known_facts(
    product: ProductInput,
    *,
    known_facts: Mapping[str, Any] | None,
    user_confirmed_facts: Mapping[str, Any] | None,
) -> dict[str, Any]:
    facts = {
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
    facts.update({key: value for key, value in dict(user_confirmed_facts or {}).items() if is_known_value(value)})
    facts["attributes"] = _merge_attribute_maps(
        product.attributes,
        _mapping_value(known_facts or {}, "attributes"),
        _mapping_value(user_confirmed_facts or {}, "attributes"),
    )
    return {key: value for key, value in facts.items() if is_known_value(value)}


def _resolved_missing_facts(
    missing_facts: Sequence[str] | None,
    generated: GeneratedProductContent,
    user_confirmed_facts: Mapping[str, Any] | None,
) -> list[str]:
    resolved = set(_confirmed_fact_keys(user_confirmed_facts or {}))
    resolved.update(suggestion.name for suggestion in generated.suggested_attributes if suggestion.status == "confirmed")

    filtered: list[str] = []
    for fact in missing_facts or ():
        normalized = str(fact).strip()
        if not normalized or normalized in filtered:
            continue
        if normalized in resolved:
            continue
        filtered.append(normalized)
    return filtered


def _expected_gain_reasons(
    before_score: FourLayerGeoScore,
    after_score: FourLayerGeoScore,
) -> list[str]:
    reasons: list[str] = []
    before_layers = {layer.layer: layer for layer in before_score.ordered_layers()}
    for after_layer in after_score.ordered_layers():
        before_layer = before_layers[after_layer.layer]
        delta = round(after_layer.weighted_points - before_layer.weighted_points, 2)
        if delta <= 0:
            continue
        layer_name = LAYER_DISPLAY_NAMES.get(after_layer.layer, after_layer.layer)
        reasons.append(f"{layer_name} +{delta} puan: {_best_layer_gain_reason(before_layer, after_layer)}")

    if not reasons:
        if after_score.overall_score == before_score.overall_score:
            reasons.append("Skor aynı kaldı; öneri mevcut kaliteyi koruyor ancak ölçülebilir ek puan üretmedi.")
        else:
            reasons.append("Skor düştü; öneri yayınlanmadan önce doğrulama ve içerik kapsamı tekrar kontrol edilmeli.")

    return reasons


def _best_layer_gain_reason(before_layer: LayerScoreResult, after_layer: LayerScoreResult) -> str:
    before_components = {component.name: component for component in before_layer.components}
    best_reason = after_layer.recommended_next_action or "Katman sinyalleri güçlendi."
    best_delta = 0.0
    for component in after_layer.components:
        before_component = before_components.get(component.name)
        if before_component is None:
            continue
        delta = component.points - before_component.points
        if delta <= best_delta:
            continue
        best_delta = delta
        if component.reasons:
            best_reason = component.reasons[0]
    return best_reason


def _merged_attributes(
    product_attributes: Mapping[str, Any],
    generated: GeneratedProductContent,
    user_confirmed_facts: Mapping[str, Any] | None,
) -> dict[str, Any]:
    attributes = dict(product_attributes)
    confirmed_attributes = _mapping_value(user_confirmed_facts or {}, "attributes")
    attributes.update({key: value for key, value in confirmed_attributes.items() if is_known_value(value)})
    for suggestion in generated.suggested_attributes:
        if suggestion.status == "confirmed" and is_known_value(suggestion.label):
            attributes.setdefault(suggestion.name, suggestion.label)
    return attributes


def _faq_items(generated: GeneratedProductContent) -> list[dict[str, Any]]:
    return [
        item.model_dump(mode="json", by_alias=True)
        for item in generated.faq
        if is_known_value(item.question) and is_known_value(item.answer)
    ]


def _faq_text(items: Sequence[GeneratedFaqItem]) -> str:
    return " ".join(f"{item.question} {item.answer}" for item in items)


def _generated_fields_applied(generated: GeneratedProductContent) -> list[str]:
    fields: list[str] = []
    for field, value in (
        ("title", generated.title),
        ("shortDescription", generated.short_description),
        ("longDescription", generated.long_description),
        ("faq", generated.faq),
        ("suggestedAttributes", generated.suggested_attributes),
        ("schemaJsonLd", generated.schema_json_ld),
        ("seoTitle", generated.seo_title),
        ("metaDescription", generated.meta_description),
    ):
        if is_known_value(value):
            fields.append(field)
    return fields


def _confirmed_fact_keys(source: Mapping[str, Any], prefix: str = "") -> list[str]:
    keys: list[str] = []
    for key, value in source.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, Mapping):
            keys.extend(_confirmed_fact_keys(value, path))
        elif is_known_value(value):
            keys.append(path)
            keys.append(str(key))
    return keys


def _merge_attribute_maps(*sources: Mapping[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for source in sources:
        merged.update({str(key): value for key, value in source.items() if is_known_value(value)})
    return merged


def _mapping_value(source: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = source.get(key)
    return value if isinstance(value, Mapping) else {}


def _coerce_product(product: ProductInput | Mapping[str, Any]) -> ProductInput:
    if isinstance(product, ProductInput):
        return product
    return ProductInput.model_validate(product)


def _coerce_generated_content(
    generated: GeneratedProductContent | Mapping[str, Any],
) -> GeneratedProductContent:
    if isinstance(generated, GeneratedProductContent):
        return generated
    return GeneratedProductContent.model_validate(generated)


__all__ = [
    "ImprovedScoreEstimateResult",
    "estimate_improved_score",
]
