# ai/geo_engine/strategies/attribute_completion.py
"""Surfaces missing product attributes without inventing values."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ai.api_contracts.geo_improvement_output import GeneratedProductContent, SuggestedAttribute
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.strategies.base import (
    STRATEGY_ATTRIBUTE_COMPLETION,
    STRATEGY_DISPLAY_NAMES,
    StrategyExecutionResult,
)
from ai.schema_engine.schema_mapping import is_known_value
from ai.turkish_nlp.category_attributes import build_attribute_context
from ai.turkish_nlp.synonyms import canonicalize_attribute_key


AttributeCompletionInput = ProductInput | Mapping[str, Any]
DEFAULT_MAX_SUGGESTED_ATTRIBUTES = 6

ATTRIBUTE_PRIORITY_ORDER: dict[str, int] = {
    "core": 10,
    "useful": 20,
    "commerce": 30,
}
ATTRIBUTE_NAME_ORDER: dict[str, int] = {
    "brand": 10,
    "model": 20,
    "capacity": 30,
    "material": 40,
    "color": 50,
    "size": 60,
    "dimensions": 70,
    "weight": 80,
    "compatibility": 90,
    "warranty": 100,
    "shipping": 110,
    "return_policy": 120,
}


def run_attribute_completion_strategy(
    product: AttributeCompletionInput,
    *,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
    max_suggestions: int = DEFAULT_MAX_SUGGESTED_ATTRIBUTES,
) -> StrategyExecutionResult:
    """Return important missing attributes as suggestions, not generated facts."""
    if max_suggestions < 1:
        raise ValueError("max_suggestions must be at least 1")

    product_facts = _product_to_facts(product)
    merged_facts = _merge_facts(product_facts, trusted_facts, user_confirmed_facts)
    attribute_context = build_attribute_context(
        category=_string_fact(merged_facts, "category"),
        attributes=_mapping_fact(merged_facts, "attributes"),
        product_facts=merged_facts,
    )
    suggestions = _suggested_attributes(attribute_context)[:max_suggestions]

    warnings = []
    if not suggestions:
        warnings.append("Eksik kategori ozelligi onerisi bulunmadi; mevcut dogrulanmis alanlar yeterli gorunuyor.")

    return StrategyExecutionResult(
        strategyId=STRATEGY_ATTRIBUTE_COMPLETION,
        name=STRATEGY_DISPLAY_NAMES[STRATEGY_ATTRIBUTE_COMPLETION],
        generated=GeneratedProductContent(suggestedAttributes=suggestions),
        warnings=warnings,
        errors=[],
        missingFacts=[suggestion.name for suggestion in suggestions],
        metadata={
            "attributeContext": attribute_context,
            "maxSuggestions": max_suggestions,
            "deterministicAttributeHints": True,
        },
    )


def _suggested_attributes(attribute_context: Mapping[str, Any]) -> list[SuggestedAttribute]:
    raw_hints = attribute_context.get("suggestedMissingAttributes")
    if not isinstance(raw_hints, list):
        return []

    ordered_hints = sorted(
        (hint for hint in raw_hints if isinstance(hint, Mapping)),
        key=lambda hint: (
            ATTRIBUTE_PRIORITY_ORDER.get(str(hint.get("priority", "")), 99),
            ATTRIBUTE_NAME_ORDER.get(str(hint.get("name") or ""), 999),
            str(hint.get("label") or hint.get("name") or ""),
        ),
    )

    suggestions: list[SuggestedAttribute] = []
    seen: set[str] = set()
    for hint in ordered_hints:
        name = str(hint.get("name") or "").strip()
        label = str(hint.get("label") or name).strip()
        reason = str(hint.get("reason") or "").strip()
        if not name or not label or not reason or name in seen:
            continue

        seen.add(name)
        suggestions.append(
            SuggestedAttribute(
                name=name,
                label=label,
                reason=reason,
                status="missing",
            )
        )

    return suggestions


def _product_to_facts(product: AttributeCompletionInput) -> dict[str, Any]:
    if isinstance(product, ProductInput):
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
            "attributes": dict(product.attributes),
        }

    return dict(product)


def _merge_facts(
    product_facts: Mapping[str, Any],
    trusted_facts: Mapping[str, Any] | None,
    user_confirmed_facts: Mapping[str, Any] | None,
) -> dict[str, Any]:
    merged: dict[str, Any] = dict(product_facts)
    merged.update({key: value for key, value in dict(trusted_facts or {}).items() if is_known_value(value)})
    merged.update(
        {key: value for key, value in dict(user_confirmed_facts or {}).items() if is_known_value(value)}
    )

    merged["attributes"] = _merge_attribute_maps(
        _mapping_fact(product_facts, "attributes"),
        _mapping_fact(trusted_facts or {}, "attributes"),
        _mapping_fact(user_confirmed_facts or {}, "attributes"),
    )
    return {key: value for key, value in merged.items() if is_known_value(value)}


def _merge_attribute_maps(*sources: Mapping[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for source in sources:
        for key, value in source.items():
            canonical_key = _canonical_attribute_key(str(key))
            if not canonical_key or not is_known_value(value):
                continue
            merged[canonical_key] = value
    return merged


def _canonical_attribute_key(key: str) -> str:
    direct_key = key.strip()
    if direct_key in ATTRIBUTE_NAME_ORDER:
        return direct_key
    return canonicalize_attribute_key(direct_key.replace("_", " "))


def _mapping_fact(source: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = source.get(key)
    return value if isinstance(value, Mapping) else {}


def _string_fact(source: Mapping[str, Any], key: str) -> str | None:
    value = source.get(key)
    return str(value).strip() if is_known_value(value) else None


__all__ = [
    "AttributeCompletionInput",
    "DEFAULT_MAX_SUGGESTED_ATTRIBUTES",
    "run_attribute_completion_strategy",
]
