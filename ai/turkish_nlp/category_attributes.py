# ai/turkish_nlp/category_attributes.py
"""Builds generic product attribute hints without fixed category taxonomy."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from ai.turkish_nlp.normalize import normalize_text, unique_normalized_terms
from ai.turkish_nlp.synonyms import canonicalize_attribute_key


AttributePriority = Literal["core", "useful", "commerce"]


@dataclass(frozen=True)
class AttributeHint:
    """A generic attribute hint agents can use as context, not a requirement."""

    name: str
    label: str
    priority: AttributePriority
    reason: str


@dataclass(frozen=True)
class AttributeCoverage:
    """Normalized attribute coverage summary for one product."""

    normalized_category: str | None
    known_attributes: dict[str, Any]
    unknown_attributes: dict[str, Any] = field(default_factory=dict)
    suggested_missing_attributes: list[AttributeHint] = field(default_factory=list)


GENERIC_ATTRIBUTE_HINTS: tuple[AttributeHint, ...] = (
    AttributeHint(
        name="brand",
        label="Marka",
        priority="core",
        reason="Marka bilgisi ürünün makine tarafından tanınmasını kolaylaştırır.",
    ),
    AttributeHint(
        name="model",
        label="Model",
        priority="core",
        reason="Model bilgisi benzer ürünlerden ayrıştırmaya yardımcı olur.",
    ),
    AttributeHint(
        name="color",
        label="Renk",
        priority="useful",
        reason="Renk bilgisi karşılaştırma ve filtreleme niyetlerinde yararlıdır.",
    ),
    AttributeHint(
        name="size",
        label="Beden veya ölçü",
        priority="useful",
        reason="Boyut veya beden bilgisi satın alma kararını netleştirir.",
    ),
    AttributeHint(
        name="material",
        label="Malzeme veya içerik",
        priority="useful",
        reason="Malzeme bilgisi ürün kalitesi ve uygunluk değerlendirmesine yardımcı olur.",
    ),
    AttributeHint(
        name="dimensions",
        label="Boyutlar",
        priority="useful",
        reason="Fiziksel boyutlar ürünün kullanım alanına uygunluğunu açıklar.",
    ),
    AttributeHint(
        name="weight",
        label="Ağırlık",
        priority="useful",
        reason="Ağırlık bilgisi taşınabilirlik ve teslimat beklentileri için yararlıdır.",
    ),
    AttributeHint(
        name="capacity",
        label="Kapasite",
        priority="useful",
        reason="Kapasite bilgisi ürünün kullanım ölçeğini açıklar.",
    ),
    AttributeHint(
        name="compatibility",
        label="Uyumluluk",
        priority="useful",
        reason="Uyumluluk bilgisi yanlış satın alma riskini azaltır.",
    ),
    AttributeHint(
        name="warranty",
        label="Garanti",
        priority="commerce",
        reason="Garanti bilgisi güven ve satın alma hazırlığı sinyali sağlar.",
    ),
    AttributeHint(
        name="shipping",
        label="Kargo",
        priority="commerce",
        reason="Kargo bilgisi yerel e-ticaret kararlarında güçlü güven sinyalidir.",
    ),
    AttributeHint(
        name="return_policy",
        label="İade politikası",
        priority="commerce",
        reason="İade bilgisi satın alma öncesi tereddütleri azaltır.",
    ),
)

CORE_ATTRIBUTE_NAMES: tuple[str, ...] = ("brand", "model")
DEFAULT_SUGGESTED_ATTRIBUTE_NAMES: tuple[str, ...] = (
    "brand",
    "model",
    "color",
    "size",
    "material",
    "dimensions",
    "weight",
    "capacity",
    "compatibility",
    "warranty",
    "shipping",
    "return_policy",
)


def normalize_category_label(category: str | None) -> str | None:
    """Normalize a free-text category label without taxonomy matching."""
    normalized = normalize_text(category)
    return normalized or None


def get_generic_attribute_hints(
    *,
    names: Iterable[str] = DEFAULT_SUGGESTED_ATTRIBUTE_NAMES,
) -> list[AttributeHint]:
    """Return generic attribute hints by canonical name."""
    requested = set(unique_normalized_terms(names))
    return [hint for hint in GENERIC_ATTRIBUTE_HINTS if hint.name in requested]


def canonicalize_product_attributes(
    attributes: Mapping[str, Any] | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Split product attributes into known generic keys and preserved unknown keys."""
    known: dict[str, Any] = {}
    unknown: dict[str, Any] = {}

    for raw_key, value in (attributes or {}).items():
        normalized_key = normalize_text(str(raw_key))
        if not normalized_key:
            continue

        canonical_key = canonicalize_attribute_key(normalized_key)
        if canonical_key in DEFAULT_SUGGESTED_ATTRIBUTE_NAMES:
            known.setdefault(canonical_key, value)
        else:
            unknown.setdefault(normalized_key, value)

    return known, unknown


def get_missing_attribute_hints(
    known_attributes: Mapping[str, Any],
    *,
    suggested_names: Iterable[str] = DEFAULT_SUGGESTED_ATTRIBUTE_NAMES,
) -> list[AttributeHint]:
    """Return generic missing attribute hints without claiming requirements."""
    present = {
        canonicalize_attribute_key(key)
        for key, value in known_attributes.items()
        if _has_value(value)
    }
    requested = set(unique_normalized_terms(suggested_names))

    return [
        hint
        for hint in GENERIC_ATTRIBUTE_HINTS
        if hint.name in requested and hint.name not in present
    ]


def summarize_attribute_coverage(
    *,
    category: str | None = None,
    attributes: Mapping[str, Any] | None = None,
    product_facts: Mapping[str, Any] | None = None,
) -> AttributeCoverage:
    """Summarize generic attribute coverage for agent context."""
    merged_attributes: dict[str, Any] = {}
    merged_attributes.update(attributes or {})
    merged_attributes.update(_extract_product_fact_attributes(product_facts or {}))

    known, unknown = canonicalize_product_attributes(merged_attributes)

    return AttributeCoverage(
        normalized_category=normalize_category_label(category),
        known_attributes=known,
        unknown_attributes=unknown,
        suggested_missing_attributes=get_missing_attribute_hints(known),
    )


def build_attribute_context(
    *,
    category: str | None = None,
    attributes: Mapping[str, Any] | None = None,
    product_facts: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a compact serializable attribute context for agents."""
    coverage = summarize_attribute_coverage(
        category=category,
        attributes=attributes,
        product_facts=product_facts,
    )

    return {
        "normalizedCategory": coverage.normalized_category,
        "knownAttributes": coverage.known_attributes,
        "unknownAttributes": coverage.unknown_attributes,
        "suggestedMissingAttributes": [
            {
                "name": hint.name,
                "label": hint.label,
                "priority": hint.priority,
                "reason": hint.reason,
            }
            for hint in coverage.suggested_missing_attributes
        ],
    }


def get_core_missing_attribute_names(
    known_attributes: Mapping[str, Any],
) -> list[str]:
    """Return missing generic core attribute names."""
    present = {
        canonicalize_attribute_key(key)
        for key, value in known_attributes.items()
        if _has_value(value)
    }
    return [name for name in CORE_ATTRIBUTE_NAMES if name not in present]


def merge_attribute_hints(
    *hint_groups: Iterable[AttributeHint],
) -> tuple[AttributeHint, ...]:
    """Merge custom attribute hints while preserving first-seen definitions."""
    merged: dict[str, AttributeHint] = {}

    for hints in hint_groups:
        for hint in hints:
            normalized_name = canonicalize_attribute_key(hint.name)
            if not normalized_name:
                continue
            merged.setdefault(
                normalized_name,
                AttributeHint(
                    name=normalized_name,
                    label=hint.label,
                    priority=hint.priority,
                    reason=hint.reason,
                ),
            )

    return tuple(merged.values())


def _extract_product_fact_attributes(product_facts: Mapping[str, Any]) -> dict[str, Any]:
    facts: dict[str, Any] = {}

    for key in ("brand", "model", "color", "size", "material"):
        value = product_facts.get(key)
        if _has_value(value):
            facts[key] = value

    return facts


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(normalize_text(value)) and normalize_text(value) not in {
            "none",
            "null",
            "nan",
            "unknown",
            "bilinmiyor",
        }
    return True


__all__ = [
    "CORE_ATTRIBUTE_NAMES",
    "DEFAULT_SUGGESTED_ATTRIBUTE_NAMES",
    "GENERIC_ATTRIBUTE_HINTS",
    "AttributeCoverage",
    "AttributeHint",
    "AttributePriority",
    "build_attribute_context",
    "canonicalize_product_attributes",
    "get_core_missing_attribute_names",
    "get_generic_attribute_hints",
    "get_missing_attribute_hints",
    "merge_attribute_hints",
    "normalize_category_label",
    "summarize_attribute_coverage",
]
