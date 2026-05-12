# ai/turkish_nlp/borrowed_terms.py
"""Handles borrowed-term and spelling variants in Turkish e-commerce text."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from ai.turkish_nlp.normalize import (
    contains_phrase,
    normalize_for_matching,
    normalize_text,
    unique_normalized_terms,
)
from ai.turkish_nlp.synonyms import SPELLING_VARIANT_GROUPS


BorrowedTermGroups = Mapping[str, Iterable[str]]

GENERIC_BORROWED_TERM_GROUPS: dict[str, tuple[str, ...]] = {
    "kablosuz": ("wireless", "wire-less", "kablosuz"),
    "şarj": ("sarj", "charge", "charging"),
    "touchscreen": ("touch screen", "dokunmatik ekran"),
}

DEFAULT_BORROWED_TERM_GROUPS: dict[str, tuple[str, ...]] = {
    **GENERIC_BORROWED_TERM_GROUPS,
    **SPELLING_VARIANT_GROUPS,
}

_DEFAULT_BORROWED_TERM_INDEX: dict[str, str] | None = None
_DEFAULT_BORROWED_REVERSE_INDEX: dict[str, list[str]] | None = None


@dataclass(frozen=True)
class BorrowedTermMatch:
    """A borrowed-term or spelling variant found in text."""

    canonical: str
    matched: str


def normalize_borrowed_term(term: str | None) -> str:
    """Normalize a borrowed term for lookup and matching."""
    return normalize_for_matching(term)


def build_borrowed_term_index(
    term_groups: BorrowedTermGroups = DEFAULT_BORROWED_TERM_GROUPS,
) -> dict[str, str]:
    """Build a normalized variant-to-canonical borrowed-term lookup."""
    global _DEFAULT_BORROWED_TERM_INDEX

    if term_groups is DEFAULT_BORROWED_TERM_GROUPS and _DEFAULT_BORROWED_TERM_INDEX is not None:
        return _DEFAULT_BORROWED_TERM_INDEX

    index: dict[str, str] = {}

    for canonical, variants in term_groups.items():
        normalized_canonical = normalize_borrowed_term(canonical)
        if not normalized_canonical:
            continue

        index.setdefault(normalized_canonical, normalized_canonical)
        for variant in variants:
            normalized_variant = normalize_borrowed_term(variant)
            if normalized_variant:
                index.setdefault(normalized_variant, normalized_canonical)

    if term_groups is DEFAULT_BORROWED_TERM_GROUPS:
        _DEFAULT_BORROWED_TERM_INDEX = index

    return index


def canonicalize_borrowed_term(
    term: str | None,
    *,
    term_groups: BorrowedTermGroups = DEFAULT_BORROWED_TERM_GROUPS,
) -> str:
    """Return the canonical borrowed-term spelling when known."""
    normalized = normalize_borrowed_term(term)
    if not normalized:
        return ""
    return build_borrowed_term_index(term_groups).get(normalized, normalized)


def canonicalize_borrowed_terms(
    terms: Iterable[str | None],
    *,
    term_groups: BorrowedTermGroups = DEFAULT_BORROWED_TERM_GROUPS,
) -> list[str]:
    """Canonicalize borrowed terms and remove duplicates."""
    return unique_normalized_terms(
        canonicalize_borrowed_term(term, term_groups=term_groups) for term in terms
    )


def expand_borrowed_terms(
    terms: Iterable[str | None],
    *,
    term_groups: BorrowedTermGroups = DEFAULT_BORROWED_TERM_GROUPS,
) -> list[str]:
    """Return canonical terms plus known borrowed and spelling variants."""
    reverse_index = _get_canonical_to_variants(term_groups)
    expanded: list[str | None] = []

    for term in terms:
        canonical = canonicalize_borrowed_term(term, term_groups=term_groups)
        if not canonical:
            continue
        expanded.append(canonical)
        expanded.extend(reverse_index.get(canonical, ()))

    return unique_normalized_terms(expanded)


def find_borrowed_term_matches(
    text: str | None,
    *,
    term_groups: BorrowedTermGroups = DEFAULT_BORROWED_TERM_GROUPS,
) -> list[BorrowedTermMatch]:
    """Find known borrowed-term variants in text."""
    normalized_text = normalize_text(text)
    if not normalized_text:
        return []

    matches: list[BorrowedTermMatch] = []
    seen: set[tuple[str, str]] = set()

    for variant, canonical in build_borrowed_term_index(term_groups).items():
        if not contains_phrase(normalized_text, variant):
            continue
        key = (canonical, variant)
        if key in seen:
            continue
        seen.add(key)
        matches.append(BorrowedTermMatch(canonical=canonical, matched=variant))

    return sorted(matches, key=lambda match: (match.canonical, match.matched))


def contains_borrowed_term(
    text: str | None,
    canonical: str,
    *,
    term_groups: BorrowedTermGroups = DEFAULT_BORROWED_TERM_GROUPS,
) -> bool:
    """Return whether text contains a canonical borrowed term or known variant."""
    normalized_canonical = canonicalize_borrowed_term(canonical, term_groups=term_groups)
    if not normalized_canonical:
        return False
    return any(
        match.canonical == normalized_canonical
        for match in find_borrowed_term_matches(text, term_groups=term_groups)
    )


def normalize_borrowed_terms_in_text(
    text: str | None,
    *,
    term_groups: BorrowedTermGroups = DEFAULT_BORROWED_TERM_GROUPS,
) -> str:
    """Return matching-normalized text with known variants replaced by canonicals."""
    normalized = normalize_for_matching(text)
    if not normalized:
        return ""

    replacements = sorted(
        build_borrowed_term_index(term_groups).items(),
        key=lambda item: len(item[0]),
        reverse=True,
    )

    result = f" {normalized} "
    for variant, canonical in replacements:
        result = result.replace(f" {variant} ", f" {canonical} ")

    return normalize_text(result)


def merge_borrowed_term_groups(
    *term_groups: BorrowedTermGroups,
) -> dict[str, tuple[str, ...]]:
    """Merge custom borrowed-term groups without mutating the defaults."""
    merged: dict[str, list[str]] = {}

    for group in term_groups:
        for canonical, variants in group.items():
            normalized_canonical = normalize_borrowed_term(canonical)
            if not normalized_canonical:
                continue
            merged.setdefault(normalized_canonical, [])
            merged[normalized_canonical].extend(variants)

    return {
        canonical: tuple(unique_normalized_terms(variants))
        for canonical, variants in merged.items()
    }


def _build_canonical_to_variants(
    term_groups: BorrowedTermGroups,
) -> dict[str, list[str]]:
    reverse_index: dict[str, list[str]] = {}

    for variant, canonical in build_borrowed_term_index(term_groups).items():
        reverse_index.setdefault(canonical, []).append(variant)

    return {
        canonical: unique_normalized_terms(variants)
        for canonical, variants in reverse_index.items()
    }


def _get_canonical_to_variants(
    term_groups: BorrowedTermGroups,
) -> dict[str, list[str]]:
    global _DEFAULT_BORROWED_REVERSE_INDEX

    if term_groups is DEFAULT_BORROWED_TERM_GROUPS:
        if _DEFAULT_BORROWED_REVERSE_INDEX is None:
            _DEFAULT_BORROWED_REVERSE_INDEX = _build_canonical_to_variants(term_groups)
        return _DEFAULT_BORROWED_REVERSE_INDEX

    return _build_canonical_to_variants(term_groups)


__all__ = [
    "DEFAULT_BORROWED_TERM_GROUPS",
    "GENERIC_BORROWED_TERM_GROUPS",
    "BorrowedTermGroups",
    "BorrowedTermMatch",
    "build_borrowed_term_index",
    "canonicalize_borrowed_term",
    "canonicalize_borrowed_terms",
    "contains_borrowed_term",
    "expand_borrowed_terms",
    "find_borrowed_term_matches",
    "merge_borrowed_term_groups",
    "normalize_borrowed_term",
    "normalize_borrowed_terms_in_text",
]
