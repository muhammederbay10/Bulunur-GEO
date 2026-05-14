# ai/turkish_nlp/intent_expansion.py
"""Expands Turkish buyer intents with deterministic product-agnostic patterns."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from ai.turkish_nlp.normalize import (
    contains_any_phrase,
    normalize_for_matching,
    normalize_text,
    tokenize,
    unique_normalized_terms,
)


IntentGroupName = Literal[
    "product_type",
    "use_case",
    "audience",
    "problem_solution",
    "comparison",
    "recommendation",
    "trust",
    "price",
]

DEFAULT_MAX_INTENTS = 12
GENERAL_PRODUCT_CATEGORY = "general_product"
_CATEGORY_STOPWORDS = {
    "fritoz",
    "fritözü",
    "fritozu",
    "hava",
    "airfryer",
    "air",
    "kulaklik",
    "kulaklık",
    "sabun",
}

_GENERIC_ECOMMERCE_TERMS = (
    "ürün",
    "urun",
    "model",
    "modelleri",
    "fiyat",
    "fiyatı",
    "fiyati",
    "öneri",
    "oneri",
    "tavsiye",
    "satın",
    "satin",
    "al",
    "alınır",
    "alinir",
)

_GROUP_KEYWORDS: dict[IntentGroupName, tuple[str, ...]] = {
    "comparison": ("mı", "mi", "mu", "mü", "karşılaştır", "karsilastir", "vs", "farkı", "farki"),
    "recommendation": ("öneri", "oneri", "tavsiye", "en iyi", "alınır mı", "alinir mi"),
    "trust": ("iade", "garanti", "kargo", "taksit", "güvenilir", "guvenilir", "orijinal"),
    "price": ("fiyat", "fiyatı", "fiyati", "ucuz", "kampanya", "indirim"),
    "use_case": ("için", "icin", "kullanım", "kullanim", "uygun"),
    "problem_solution": ("kolay", "temiz", "hassas", "dayanıklı", "dayanikli", "pratik"),
    "audience": ("aile", "kişi", "kisi", "bebek", "çocuk", "cocuk", "hediye", "küçük", "kucuk"),
    "product_type": (),
}

_GENERIC_ATTRIBUTE_HINTS = (
    "marka",
    "model",
    "renk",
    "beden",
    "ölçü",
    "olcu",
    "boyut",
    "ağırlık",
    "agirlik",
    "malzeme",
    "materyal",
    "kapasite",
    "hacim",
    "güç",
    "guc",
    "uyumluluk",
    "paket",
)


@dataclass(frozen=True)
class IntentExpansionResult:
    """Buyer intent variants prepared for analysis and optimization prompts."""

    detected_category: str | None
    buyer_intent_variants: list[str]
    intent_groups: dict[IntentGroupName, list[str]]
    local_variants: list[str] = field(default_factory=list)
    llm_variants: list[str] = field(default_factory=list)
    missing_signals: list[str] = field(default_factory=list)


def expand_buyer_intents(
    *,
    title: str,
    category: str | None = None,
    brand: str | None = None,
    attributes: Mapping[str, Any] | None = None,
    llm_variants: Iterable[str | None] = (),
    max_variants: int = DEFAULT_MAX_INTENTS,
) -> IntentExpansionResult:
    """Combine universal local Turkish buyer patterns with optional LLM variants."""
    detected_category = detect_intent_category(title=title, category=category)
    product_terms = get_product_anchor_terms(detected_category, title=title, category=category)
    local_variants = build_local_intent_variants(
        title=title,
        category=detected_category or category,
        brand=brand,
        attributes=attributes or {},
        product_terms=product_terms,
    )
    sanitized_llm_variants = sanitize_llm_intent_variants(
        llm_variants,
        anchor_terms=product_terms,
    )
    buyer_intent_variants = merge_intent_variants(
        local_variants,
        sanitized_llm_variants,
        max_variants=max_variants,
    )

    return IntentExpansionResult(
        detected_category=detected_category,
        buyer_intent_variants=buyer_intent_variants,
        intent_groups=group_intent_variants(buyer_intent_variants),
        local_variants=local_variants,
        llm_variants=sanitized_llm_variants,
        missing_signals=build_missing_intent_signals(
            detected_category=detected_category,
            attributes=attributes or {},
            title=title,
            category=category,
        ),
    )


def normalize_category_label(category: str | None) -> str | None:
    """Return a clean category label without forcing it into a fixed taxonomy."""
    normalized = normalize_text(category)
    normalized = _strip_category_noise(normalized)
    if not normalized or _looks_too_broad(normalized):
        return None
    return normalized


def detect_intent_category(
    *,
    title: str | None = None,
    category: str | None = None,
) -> str | None:
    """Return the provided category as a normalized free-text label."""
    normalized_category = normalize_category_label(category)
    if normalized_category:
        return normalized_category

    # The title is not a taxonomy source. Use it only when it looks like a compact product type.
    title_phrase = _first_meaningful_title_phrase(title)
    if title_phrase and len(tokenize(title_phrase)) <= 3:
        return title_phrase

    return None


def get_product_anchor_terms(
    category_key: str | None,
    *,
    title: str | None = None,
    category: str | None = None,
) -> list[str]:
    """Return normalized product anchor terms without relying on fixed categories."""
    return unique_normalized_terms(
        (
            category_key,
            normalize_category_label(category),
            _first_meaningful_title_phrase(title),
        )
    )


def build_local_intent_variants(
    *,
    title: str,
    category: str | None = None,
    brand: str | None = None,
    attributes: Mapping[str, Any] | None = None,
    product_terms: Iterable[str] = (),
) -> list[str]:
    """Build deterministic Turkish buyer-intent variants for any product."""
    attributes = attributes or {}
    base_term = _select_base_term(category=category, product_terms=product_terms, title=title)
    variants: list[str] = [
        base_term,
        f"{base_term} fiyatı",
        f"{base_term} yorumları",
        f"{base_term} önerisi",
        f"{base_term} alınır mı",
        f"{base_term} alırken nelere dikkat edilmeli",
        f"en iyi {base_term}",
        f"{base_term} karşılaştırma",
        f"{base_term} güvenilir mi",
        f"{base_term} kargo ve iade",
    ]

    if brand:
        normalized_brand = normalize_text(brand)
        variants.append(f"{normalized_brand} {base_term}")

    variants.extend(_build_attribute_intents(base_term, attributes))

    return unique_normalized_terms(variants)


def sanitize_llm_intent_variants(
    variants: Iterable[str | None],
    *,
    anchor_terms: Iterable[str] = (),
    max_variants: int | None = None,
) -> list[str]:
    """Normalize and filter LLM-generated buyer intents for safe reuse."""
    normalized_anchor_terms = unique_normalized_terms(anchor_terms, fold_diacritics=True)
    sanitized: list[str] = []

    for variant in variants:
        normalized = normalize_text(variant)
        if not normalized or _looks_too_broad(normalized):
            continue
        if normalized_anchor_terms and not _matches_anchor(normalized, normalized_anchor_terms):
            continue
        sanitized.append(normalized)

    unique_variants = unique_normalized_terms(sanitized)
    if max_variants is None:
        return unique_variants
    return unique_variants[:max_variants]


def merge_intent_variants(
    local_variants: Iterable[str],
    llm_variants: Iterable[str],
    *,
    max_variants: int = DEFAULT_MAX_INTENTS,
) -> list[str]:
    """Merge local and LLM variants while preserving room for generic LLM phrasing."""
    if max_variants <= 0:
        return []

    local_unique = unique_normalized_terms(local_variants)
    llm_unique = unique_normalized_terms(llm_variants)
    local_head_count = min(len(local_unique), max(4, max_variants // 2))

    merged = unique_normalized_terms(
        [
            *local_unique[:local_head_count],
            *llm_unique,
            *local_unique[local_head_count:],
        ]
    )
    return merged[:max_variants]


def group_intent_variants(
    variants: Iterable[str],
) -> dict[IntentGroupName, list[str]]:
    """Group intent variants by the buyer need they appear to represent."""
    groups: dict[IntentGroupName, list[str]] = {
        "product_type": [],
        "use_case": [],
        "audience": [],
        "problem_solution": [],
        "comparison": [],
        "recommendation": [],
        "trust": [],
        "price": [],
    }

    for variant in unique_normalized_terms(variants):
        group_name = classify_intent_group(variant)
        groups[group_name].append(variant)

    return {name: values for name, values in groups.items() if values}


def classify_intent_group(variant: str) -> IntentGroupName:
    """Classify one normalized intent variant into a simple buyer-intent group."""
    normalized = normalize_for_matching(variant)
    for group_name, keywords in _GROUP_KEYWORDS.items():
        if keywords and contains_any_phrase(normalized, keywords):
            return group_name
    return "product_type"


def build_missing_intent_signals(
    *,
    detected_category: str | None,
    attributes: Mapping[str, Any],
    title: str | None = None,
    category: str | None = None,
) -> list[str]:
    """Explain which generic facts limited deterministic intent generation."""
    signals: list[str] = []

    if not normalize_text(title):
        signals.append("Ürün başlığı eksik olduğu için niyet üretimi genel ürün kalıplarıyla sınırlı tutuldu.")
    if not detected_category and not normalize_category_label(category):
        signals.append("Kategori bilgisi net olmadığı için kategori odaklı niyetler sınırlı tutuldu.")
    if not attributes:
        signals.append("Ürün attribute bilgileri verilmediği için özellik odaklı niyetler sınırlı tutuldu.")

    return signals


def _build_attribute_intents(
    base_term: str,
    attributes: Mapping[str, Any],
) -> list[str]:
    variants: list[str] = []

    for raw_key, raw_value in attributes.items():
        key = normalize_for_matching(str(raw_key))
        value = normalize_text(str(raw_value))
        if not value or value.lower() in {"none", "null", "nan"}:
            continue
        if not _is_useful_attribute_key(key):
            continue
        if len(tokenize(value)) > 4:
            continue
        variants.append(f"{value} {base_term}")

    return variants[:3]


def _select_base_term(
    *,
    category: str | None,
    product_terms: Iterable[str],
    title: str,
) -> str:
    terms = unique_normalized_terms(product_terms)
    if terms:
        return terms[0]

    normalized_category = normalize_category_label(category)
    if normalized_category:
        return normalized_category

    fallback = _first_meaningful_title_phrase(title)
    return fallback or "ürün"


def _first_meaningful_title_phrase(title: str | None) -> str | None:
    tokens = [
        token
        for token in tokenize(title, fold_diacritics=False)
        if len(token) > 1 and token not in _GENERIC_ECOMMERCE_TERMS
    ]
    if not tokens:
        return None
    return normalize_category_label(" ".join(tokens[:3]))


def _is_useful_attribute_key(key: str) -> bool:
    return contains_any_phrase(key, _GENERIC_ATTRIBUTE_HINTS)


def _looks_too_broad(variant: str) -> bool:
    tokens = tokenize(variant)
    if len(tokens) < 2:
        return tokens[0] not in _CATEGORY_STOPWORDS if tokens else True
    return normalize_for_matching(variant) in {
        "en iyi urun",
        "urun onerisi",
        "fiyat",
        "kampanya",
    }


def _strip_category_noise(value: str) -> str:
    if not value:
        return value

    tokens = tokenize(value, fold_diacritics=False)
    if not tokens:
        return ""

    cleaned_tokens: list[str] = []
    for token in tokens:
        if _is_modelish_token(token) and cleaned_tokens:
            continue
        cleaned_tokens.append(token)

    while len(cleaned_tokens) > 1 and _is_trailing_noise_token(cleaned_tokens[-1]):
        cleaned_tokens.pop()

    return " ".join(cleaned_tokens).strip()


def _is_modelish_token(token: str) -> bool:
    normalized = normalize_for_matching(token)
    if normalized.isdigit():
        return True
    if re.fullmatch(r"[a-z]*\d+[a-z\d-]*", normalized):
        return True
    return False


def _is_trailing_noise_token(token: str) -> bool:
    normalized = normalize_for_matching(token)
    if normalized.isdigit():
        return True
    if normalized in {"lt", "l", "w", "cm", "mm", "kg", "gr", "ml"}:
        return True
    return False


def _matches_anchor(variant: str, anchor_terms: Iterable[str]) -> bool:
    normalized_variant = normalize_for_matching(variant)
    variant_tokens = set(tokenize(normalized_variant))

    for anchor in anchor_terms:
        normalized_anchor = normalize_for_matching(anchor)
        if contains_any_phrase(normalized_variant, (normalized_anchor,)):
            return True
        anchor_tokens = set(tokenize(normalized_anchor)) - set(_GENERIC_ECOMMERCE_TERMS)
        if anchor_tokens and variant_tokens.intersection(anchor_tokens):
            return True

    return False


__all__ = [
    "DEFAULT_MAX_INTENTS",
    "GENERAL_PRODUCT_CATEGORY",
    "IntentExpansionResult",
    "IntentGroupName",
    "build_local_intent_variants",
    "build_missing_intent_signals",
    "classify_intent_group",
    "detect_intent_category",
    "expand_buyer_intents",
    "get_product_anchor_terms",
    "group_intent_variants",
    "merge_intent_variants",
    "normalize_category_label",
    "sanitize_llm_intent_variants",
]
