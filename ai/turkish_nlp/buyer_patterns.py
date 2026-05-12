# ai/turkish_nlp/buyer_patterns.py
"""Provides generic Turkish buyer-query pattern hints for agents."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Literal

from ai.turkish_nlp.normalize import (
    contains_any_phrase,
    contains_phrase,
    normalize_for_matching,
    normalize_text,
    tokenize,
    unique_normalized_terms,
)


BuyerPatternName = Literal[
    "product_search",
    "recommendation",
    "comparison",
    "price",
    "use_case",
    "audience",
    "problem_solution",
    "attribute_question",
    "trust_question",
    "purchase_readiness",
]

BuyerPatternGroups = Mapping[BuyerPatternName, Iterable[str]]

BUYER_PATTERN_SEEDS: dict[BuyerPatternName, tuple[str, ...]] = {
    "product_search": (
        "{product}",
        "{product} modelleri",
        "{product} çeşitleri",
        "{product} cesitleri",
    ),
    "recommendation": (
        "{product} önerisi",
        "{product} onerisi",
        "en iyi {product}",
        "{product} tavsiye",
    ),
    "comparison": (
        "{product} karşılaştırma",
        "{product} karsilastirma",
        "{product} vs",
        "{product} farkı",
        "{product} farki",
    ),
    "price": (
        "{product} fiyatı",
        "{product} fiyati",
        "uygun fiyatlı {product}",
        "indirimli {product}",
    ),
    "use_case": (
        "{product} ne için kullanılır",
        "{product} ne icin kullanilir",
        "{product} kullanım alanı",
        "{product} kullanim alani",
        "{product} için uygun mu",
        "{product} icin uygun mu",
    ),
    "audience": (
        "kimler için {product}",
        "kimler icin {product}",
        "hediyelik {product}",
        "günlük kullanım için {product}",
        "gunluk kullanim icin {product}",
    ),
    "problem_solution": (
        "{product} hangi sorunu çözer",
        "{product} hangi sorunu cozer",
        "pratik {product}",
        "dayanıklı {product}",
        "dayanikli {product}",
    ),
    "attribute_question": (
        "{product} özellikleri",
        "{product} ozellikleri",
        "{product} ölçüleri",
        "{product} olculeri",
        "{product} malzemesi",
        "{product} uyumlu mu",
    ),
    "trust_question": (
        "{product} güvenilir mi",
        "{product} guvenilir mi",
        "{product} iade var mı",
        "{product} iade var mi",
        "{product} garantili mi",
        "{product} kargo",
    ),
    "purchase_readiness": (
        "{product} alınır mı",
        "{product} alinir mi",
        "{product} almadan önce",
        "{product} almadan once",
        "{product} alırken nelere dikkat edilmeli",
    ),
}

PATTERN_KEYWORDS: dict[BuyerPatternName, tuple[str, ...]] = {
    "recommendation": ("öneri", "oneri", "önerisi", "onerisi", "tavsiye", "en iyi"),
    "comparison": (
        "karşılaştır",
        "karsilastir",
        "karşılaştırma",
        "karsilastirma",
        "vs",
        "farkı",
        "farki",
        "mi daha iyi",
    ),
    "price": ("fiyat", "fiyatı", "fiyati", "ucuz", "uygun fiyat", "indirim", "kampanya"),
    "use_case": ("ne için", "ne icin", "kullanım", "kullanim", "uygun mu", "nerede kullanılır"),
    "audience": ("kimler için", "kimler icin", "hediye", "günlük", "gunluk", "çocuk", "cocuk"),
    "problem_solution": ("hangi sorunu", "çözer", "cozer", "pratik", "dayanıklı", "dayanikli"),
    "attribute_question": ("özellik", "ozellik", "ölçü", "olcu", "malzeme", "uyumlu", "kaç", "kac"),
    "trust_question": ("güvenilir", "guvenilir", "iade", "garanti", "kargo", "taksit", "orijinal"),
    "purchase_readiness": ("alınır mı", "alinir mi", "almadan önce", "almadan once", "dikkat edilmeli"),
    "product_search": (),
}


@dataclass(frozen=True)
class BuyerPatternMatch:
    """A detected Turkish buyer-query pattern."""

    pattern: BuyerPatternName
    matched: str


@dataclass(frozen=True)
class BuyerPatternSummary:
    """Buyer-query pattern hints for agent context."""

    present_patterns: list[BuyerPatternName]
    matches: list[BuyerPatternMatch] = field(default_factory=list)


def normalize_buyer_pattern_name(name: str | None) -> str:
    """Normalize a buyer-pattern name for deterministic lookup."""
    return normalize_for_matching(name).replace(" ", "_")


def classify_buyer_pattern(query: str | None) -> BuyerPatternName:
    """Classify a Turkish buyer query into a generic query-shape pattern."""
    normalized_query = normalize_for_matching(query)
    if not normalized_query:
        return "product_search"

    for pattern, keywords in PATTERN_KEYWORDS.items():
        if keywords and _contains_any_pattern_keyword(normalized_query, keywords):
            return pattern

    return "product_search"


def find_buyer_pattern_matches(
    text: str | None,
    *,
    pattern_keywords: BuyerPatternGroups = PATTERN_KEYWORDS,
) -> list[BuyerPatternMatch]:
    """Find generic buyer-query pattern hints in text."""
    normalized_text = normalize_text(text)
    if not normalized_text:
        return []

    matches: list[BuyerPatternMatch] = []
    seen: set[tuple[str, str]] = set()

    for pattern, keywords in pattern_keywords.items():
        for keyword in keywords:
            normalized_keyword = normalize_for_matching(keyword)
            if not normalized_keyword or not _contains_pattern_keyword(normalized_text, normalized_keyword):
                continue
            key = (pattern, normalized_keyword)
            if key in seen:
                continue
            seen.add(key)
            matches.append(BuyerPatternMatch(pattern=pattern, matched=normalized_keyword))

    if not matches and normalized_text:
        return [BuyerPatternMatch(pattern="product_search", matched=normalized_text)]

    return sorted(matches, key=lambda match: (match.pattern, match.matched))


def detect_buyer_patterns(
    text: str | None,
    *,
    pattern_keywords: BuyerPatternGroups = PATTERN_KEYWORDS,
) -> list[BuyerPatternName]:
    """Return unique buyer-query patterns found in text."""
    patterns = [match.pattern for match in find_buyer_pattern_matches(text, pattern_keywords=pattern_keywords)]
    return list(dict.fromkeys(patterns))


def summarize_buyer_patterns(
    text: str | None,
    *,
    pattern_keywords: BuyerPatternGroups = PATTERN_KEYWORDS,
) -> BuyerPatternSummary:
    """Summarize buyer-query pattern hints for agent context."""
    matches = find_buyer_pattern_matches(text, pattern_keywords=pattern_keywords)
    return BuyerPatternSummary(
        present_patterns=list(dict.fromkeys(match.pattern for match in matches)),
        matches=matches,
    )


def build_buyer_pattern_examples(
    product_anchor: str | None,
    *,
    pattern_groups: BuyerPatternGroups = BUYER_PATTERN_SEEDS,
    max_per_pattern: int = 2,
) -> dict[BuyerPatternName, list[str]]:
    """Build seed query examples around any normalized product anchor text."""
    product = normalize_text(product_anchor) or "ürün"
    examples: dict[BuyerPatternName, list[str]] = {}

    for pattern, templates in pattern_groups.items():
        rendered = [
            normalize_text(template.format(product=product))
            for template in templates
            if normalize_text(template)
        ]
        examples[pattern] = unique_normalized_terms(rendered)[:max_per_pattern]

    return examples


def flatten_buyer_pattern_examples(
    product_anchor: str | None,
    *,
    pattern_groups: BuyerPatternGroups = BUYER_PATTERN_SEEDS,
    max_total: int = 12,
) -> list[str]:
    """Return a flat list of seed buyer-query examples for prompts."""
    examples = build_buyer_pattern_examples(
        product_anchor,
        pattern_groups=pattern_groups,
        max_per_pattern=1,
    )
    flattened = [
        example
        for pattern_examples in examples.values()
        for example in pattern_examples
    ]
    return unique_normalized_terms(flattened)[:max_total]


def build_buyer_pattern_context(
    text: str | None,
    *,
    product_anchor: str | None = None,
) -> dict[str, list[str]]:
    """Return detected patterns and seed examples for an agent prompt."""
    summary = summarize_buyer_patterns(text)
    examples = build_buyer_pattern_examples(product_anchor)

    context: dict[str, list[str]] = {
        pattern: []
        for pattern in BUYER_PATTERN_SEEDS
    }
    for match in summary.matches:
        context.setdefault(match.pattern, [])
        context[match.pattern].append(match.matched)
    for pattern, pattern_examples in examples.items():
        context.setdefault(pattern, [])
        context[pattern].extend(pattern_examples)

    return {
        pattern: unique_normalized_terms(values)
        for pattern, values in context.items()
        if values
    }


def merge_buyer_pattern_groups(
    *pattern_groups: BuyerPatternGroups,
) -> dict[BuyerPatternName, tuple[str, ...]]:
    """Merge custom buyer-pattern seed groups without mutating defaults."""
    merged: dict[BuyerPatternName, list[str]] = {}

    for group in pattern_groups:
        for pattern, templates in group.items():
            merged.setdefault(pattern, [])
            merged[pattern].extend(templates)

    return {
        pattern: tuple(unique_normalized_terms(templates))
        for pattern, templates in merged.items()
    }


def _contains_any_pattern_keyword(text: str | None, keywords: Iterable[str]) -> bool:
    return any(_contains_pattern_keyword(text, keyword) for keyword in keywords)


def _contains_pattern_keyword(text: str | None, keyword: str | None) -> bool:
    """Return whether text contains a buyer-pattern seed with light suffix tolerance."""
    normalized_text = normalize_for_matching(text)
    normalized_keyword = normalize_for_matching(keyword)

    if not normalized_text or not normalized_keyword:
        return False

    if contains_phrase(normalized_text, normalized_keyword):
        return True

    keyword_tokens = tokenize(normalized_keyword)
    text_tokens = tokenize(normalized_text)
    if not keyword_tokens or not text_tokens:
        return False

    if len(keyword_tokens) == 1:
        return any(_token_matches_seed(token, keyword_tokens[0]) for token in text_tokens)

    return _contains_token_sequence(text_tokens, keyword_tokens)


def _contains_token_sequence(text_tokens: list[str], keyword_tokens: list[str]) -> bool:
    if len(keyword_tokens) > len(text_tokens):
        return False

    window_size = len(keyword_tokens)
    for start in range(len(text_tokens) - window_size + 1):
        window = text_tokens[start : start + window_size]
        if all(
            _token_matches_seed(text_token, keyword_token)
            for text_token, keyword_token in zip(window, keyword_tokens, strict=True)
        ):
            return True

    return False


def _token_matches_seed(token: str, seed: str) -> bool:
    if token == seed:
        return True
    if len(seed) < 4:
        return False
    return token.startswith(seed) and len(token) <= len(seed) + 8


__all__ = [
    "BUYER_PATTERN_SEEDS",
    "PATTERN_KEYWORDS",
    "BuyerPatternGroups",
    "BuyerPatternMatch",
    "BuyerPatternName",
    "BuyerPatternSummary",
    "build_buyer_pattern_context",
    "build_buyer_pattern_examples",
    "classify_buyer_pattern",
    "detect_buyer_patterns",
    "find_buyer_pattern_matches",
    "flatten_buyer_pattern_examples",
    "merge_buyer_pattern_groups",
    "normalize_buyer_pattern_name",
    "summarize_buyer_patterns",
]
