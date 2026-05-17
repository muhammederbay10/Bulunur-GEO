# ai/turkish_nlp/synonyms.py
"""Provides product-agnostic Turkish synonym helpers for GEO text analysis."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from ai.turkish_nlp.normalize import (
    contains_phrase,
    normalize_for_matching,
    normalize_text,
    tokenize,
    unique_normalized_terms,
)


SynonymGroups = Mapping[str, Iterable[str]]

COMMERCE_SYNONYM_GROUPS: dict[str, tuple[str, ...]] = {
    "fiyat": ("fiyat", "fiyatı", "fiyati", "ücret", "ucret", "bedel", "tutar"),
    "indirim": ("indirim", "kampanya", "fırsat", "firsat", "iskonto"),
    "kargo": ("kargo", "teslimat", "gönderim", "gonderim", "nakliye"),
    "iade": ("iade", "değişim", "degisim", "cayma hakkı", "cayma hakki"),
    "garanti": ("garanti", "güvence", "guvence", "garantili"),
    "taksit": ("taksit", "taksitli", "peşin", "pesin", "ödeme", "odeme"),
    "stok": ("stok", "stokta", "mevcut", "bulunur", "hazır", "hazir"),
    "yorum": ("yorum", "yorumlar", "değerlendirme", "degerlendirme", "puan"),
    "öneri": ("öneri", "oneri", "tavsiye", "önerilen", "onerilen"),
    "orijinal": ("orijinal", "original", "özgün", "ozgun", "sahte değil", "sahte degil"),
}

ATTRIBUTE_SYNONYM_GROUPS: dict[str, tuple[str, ...]] = {
    "brand": ("brand", "marka", "üretici", "uretici"),
    "model": ("model", "seri", "versiyon", "sürüm", "surum"),
    "color": ("color", "renk", "rengi"),
    "size": ("size", "beden", "ölçü", "olcu", "ebat", "boyut"),
    "material": ("material", "malzeme", "materyal", "içerik", "icerik"),
    "dimensions": ("dimensions", "boyut", "ölçü", "olcu", "en", "boy", "yükseklik", "yukseklik"),
    "weight": ("weight", "ağırlık", "agirlik", "gramaj", "gr", "gram", "kg"),
    "capacity": ("capacity", "kapasite", "hacim", "litre", "lt", "ml"),
    "power": ("power", "güç", "guc", "watt", "w"),
    "compatibility": ("compatibility", "uyumluluk", "uyumlu", "destekler"),
    "warranty": ("warranty", "garanti", "güvence", "guvence"),
    "shipping": ("shipping", "kargo", "teslimat", "gönderim", "gonderim"),
    "return_policy": ("return_policy", "return policy", "iade", "değişim", "degisim", "cayma hakkı"),
}

SPELLING_VARIANT_GROUPS: dict[str, tuple[str, ...]] = {
    "wifi": ("wifi", "wi-fi", "wireless"),
    "bluetooth": ("bluetooth", "blue tooth", "bt"),
    "usb c": ("usb c", "usb-c", "type c", "type-c", "typ-c"),
    "led": ("led", "l.e.d"),
    "hdmi": ("hdmi", "h.d.m.i"),
    "lityum iyon": ("lityum iyon", "li-ion", "lion", "lithium ion"),
}

DEFAULT_SYNONYM_GROUPS: dict[str, tuple[str, ...]] = {
    **COMMERCE_SYNONYM_GROUPS,
    **ATTRIBUTE_SYNONYM_GROUPS,
    **SPELLING_VARIANT_GROUPS,
}

_DEFAULT_SYNONYM_INDEX: dict[str, str] | None = None
_DEFAULT_REVERSE_INDEX: dict[str, list[str]] | None = None


@dataclass(frozen=True)
class SynonymMatch:
    """A synonym phrase found in text with its canonical term."""

    canonical: str
    matched: str


def normalize_synonym_term(term: str | None) -> str:
    """Normalize a synonym or canonical term for deterministic lookup."""
    return normalize_for_matching(term)


def build_synonym_index(
    synonym_groups: SynonymGroups = DEFAULT_SYNONYM_GROUPS,
) -> dict[str, str]:
    """Build a normalized synonym-to-canonical lookup table."""
    global _DEFAULT_SYNONYM_INDEX

    if synonym_groups is DEFAULT_SYNONYM_GROUPS and _DEFAULT_SYNONYM_INDEX is not None:
        return _DEFAULT_SYNONYM_INDEX

    index: dict[str, str] = {}

    for canonical, synonyms in synonym_groups.items():
        normalized_canonical = normalize_synonym_term(canonical)
        if not normalized_canonical:
            continue

        index.setdefault(normalized_canonical, normalized_canonical)
        for synonym in synonyms:
            normalized_synonym = normalize_synonym_term(synonym)
            if normalized_synonym:
                index.setdefault(normalized_synonym, normalized_canonical)

    if synonym_groups is DEFAULT_SYNONYM_GROUPS:
        _DEFAULT_SYNONYM_INDEX = index

    return index


def canonicalize_term(
    term: str | None,
    *,
    synonym_groups: SynonymGroups = DEFAULT_SYNONYM_GROUPS,
) -> str:
    """Return a canonical synonym key when one is known."""
    normalized = normalize_synonym_term(term)
    if not normalized:
        return ""
    return build_synonym_index(synonym_groups).get(normalized, normalized)


def canonicalize_terms(
    terms: Iterable[str | None],
    *,
    synonym_groups: SynonymGroups = DEFAULT_SYNONYM_GROUPS,
) -> list[str]:
    """Canonicalize terms and remove duplicates while preserving order."""
    return unique_normalized_terms(
        canonicalize_term(term, synonym_groups=synonym_groups) for term in terms
    )


def expand_with_synonyms(
    terms: Iterable[str | None],
    *,
    synonym_groups: SynonymGroups = DEFAULT_SYNONYM_GROUPS,
) -> list[str]:
    """Return each term plus known synonyms for broader deterministic matching."""
    reverse_index = _get_canonical_to_synonyms(synonym_groups)
    expanded: list[str | None] = []

    for term in terms:
        canonical = canonicalize_term(term, synonym_groups=synonym_groups)
        if not canonical:
            continue
        expanded.append(canonical)
        expanded.extend(reverse_index.get(canonical, ()))

    return unique_normalized_terms(expanded)


def find_synonym_matches(
    text: str | None,
    *,
    synonym_groups: SynonymGroups = DEFAULT_SYNONYM_GROUPS,
) -> list[SynonymMatch]:
    """Find known synonym phrases in free text."""
    normalized_text = normalize_text(text)
    if not normalized_text:
        return []

    matches: list[SynonymMatch] = []
    seen: set[tuple[str, str]] = set()

    for synonym, canonical in build_synonym_index(synonym_groups).items():
        if not contains_phrase(normalized_text, synonym):
            continue
        key = (canonical, synonym)
        if key in seen:
            continue
        seen.add(key)
        matches.append(SynonymMatch(canonical=canonical, matched=synonym))

    return sorted(matches, key=lambda match: (match.canonical, match.matched))


def contains_synonym(
    text: str | None,
    canonical: str,
    *,
    synonym_groups: SynonymGroups = DEFAULT_SYNONYM_GROUPS,
) -> bool:
    """Return whether text contains a canonical term or one of its synonyms."""
    normalized_canonical = canonicalize_term(canonical, synonym_groups=synonym_groups)
    if not normalized_canonical:
        return False
    return any(
        match.canonical == normalized_canonical
        for match in find_synonym_matches(text, synonym_groups=synonym_groups)
    )


def canonicalize_attribute_key(key: str | None) -> str:
    """Canonicalize a generic product attribute label."""
    canonical = canonicalize_term(key, synonym_groups=ATTRIBUTE_SYNONYM_GROUPS)
    if canonical == "return policy":
        return "return_policy"
    return canonical


def canonicalize_attribute_keys(
    attributes: Mapping[str, object],
) -> dict[str, object]:
    """Return attributes keyed by generic canonical labels where possible."""
    canonicalized: dict[str, object] = {}

    for raw_key, value in attributes.items():
        canonical_key = canonicalize_attribute_key(raw_key)
        if not canonical_key:
            continue
        canonicalized.setdefault(canonical_key, value)

    return canonicalized


def normalize_query_terms(text: str | None) -> list[str]:
    """Tokenize text and canonicalize known commerce or attribute synonyms."""
    return canonicalize_terms(tokenize(text))


def _build_canonical_to_synonyms(
    synonym_groups: SynonymGroups,
) -> dict[str, list[str]]:
    reverse_index: dict[str, list[str]] = {}

    for synonym, canonical in build_synonym_index(synonym_groups).items():
        reverse_index.setdefault(canonical, []).append(synonym)

    return {
        canonical: unique_normalized_terms(synonyms)
        for canonical, synonyms in reverse_index.items()
    }


def _get_canonical_to_synonyms(
    synonym_groups: SynonymGroups,
) -> dict[str, list[str]]:
    global _DEFAULT_REVERSE_INDEX

    if synonym_groups is DEFAULT_SYNONYM_GROUPS:
        if _DEFAULT_REVERSE_INDEX is None:
            _DEFAULT_REVERSE_INDEX = _build_canonical_to_synonyms(synonym_groups)
        return _DEFAULT_REVERSE_INDEX

    return _build_canonical_to_synonyms(synonym_groups)


__all__ = [
    "ATTRIBUTE_SYNONYM_GROUPS",
    "COMMERCE_SYNONYM_GROUPS",
    "DEFAULT_SYNONYM_GROUPS",
    "SPELLING_VARIANT_GROUPS",
    "SynonymGroups",
    "SynonymMatch",
    "build_synonym_index",
    "canonicalize_attribute_key",
    "canonicalize_attribute_keys",
    "canonicalize_term",
    "canonicalize_terms",
    "contains_synonym",
    "expand_with_synonyms",
    "find_synonym_matches",
    "normalize_query_terms",
    "normalize_synonym_term",
]
