# ai/turkish_nlp/normalize.py
"""Normalizes Turkish e-commerce text for deterministic GEO helpers."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable


_WHITESPACE_RE = re.compile(r"\s+")
_TOKEN_RE = re.compile(r"[0-9a-zçğıöşüâîû]+", re.IGNORECASE)

_TURKISH_LOWER_TRANSLATION = str.maketrans(
    {
        "I": "ı",
        "İ": "i",
    }
)

_TURKISH_DIACRITIC_FOLD_TRANSLATION = str.maketrans(
    {
        "ç": "c",
        "ğ": "g",
        "ı": "i",
        "ö": "o",
        "ş": "s",
        "ü": "u",
        "â": "a",
        "î": "i",
        "û": "u",
        "Ç": "C",
        "Ğ": "G",
        "İ": "I",
        "I": "I",
        "Ö": "O",
        "Ş": "S",
        "Ü": "U",
        "Â": "A",
        "Î": "I",
        "Û": "U",
    }
)

_TYPOGRAPHIC_TRANSLATION = str.maketrans(
    {
        "\u00a0": " ",
        "\u200b": "",
        "\u200c": "",
        "\u200d": "",
        "\ufeff": "",
        "“": '"',
        "”": '"',
        "„": '"',
        "’": "'",
        "‘": "'",
        "‚": "'",
        "‐": "-",
        "‑": "-",
        "–": "-",
        "—": "-",
        "−": "-",
    }
)

_MATCHING_PUNCTUATION_TRANSLATION = str.maketrans(
    {character: " " for character in "-/\\|,.;:!?()[]{}<>\"'`~*_+=#@&%"}
)


def normalize_unicode(text: str | None) -> str:
    """Return text with compatibility characters normalized."""
    if text is None:
        return ""
    return unicodedata.normalize("NFKC", str(text)).translate(_TYPOGRAPHIC_TRANSLATION)


def normalize_whitespace(text: str | None) -> str:
    """Collapse repeated whitespace and trim the result."""
    return _WHITESPACE_RE.sub(" ", normalize_unicode(text)).strip()


def turkish_lower(text: str | None) -> str:
    """Lowercase text using Turkish dotted and dotless I rules."""
    normalized = normalize_unicode(text).translate(_TURKISH_LOWER_TRANSLATION)
    lowered = normalized.lower()
    return lowered.replace("\u0307", "")


def normalize_text(text: str | None) -> str:
    """Normalize text for display-safe deterministic comparisons."""
    return normalize_whitespace(turkish_lower(text))


def fold_turkish_diacritics(text: str | None) -> str:
    """Fold Turkish-specific letters to ASCII approximations for fuzzy matching."""
    return normalize_unicode(text).translate(_TURKISH_DIACRITIC_FOLD_TRANSLATION)


def normalize_for_matching(
    text: str | None,
    *,
    fold_diacritics: bool = True,
) -> str:
    """Normalize text for phrase and token matching."""
    normalized = normalize_text(text)
    if fold_diacritics:
        normalized = fold_turkish_diacritics(normalized).lower()
    normalized = normalized.translate(_MATCHING_PUNCTUATION_TRANSLATION)
    return normalize_whitespace(normalized)


def tokenize(
    text: str | None,
    *,
    fold_diacritics: bool = True,
) -> list[str]:
    """Split normalized Turkish text into simple word and number tokens."""
    normalized = normalize_for_matching(text, fold_diacritics=fold_diacritics)
    return _TOKEN_RE.findall(normalized)


def contains_phrase(
    text: str | None,
    phrase: str | None,
    *,
    fold_diacritics: bool = True,
) -> bool:
    """Return whether text contains a phrase after Turkish-safe normalization."""
    normalized_text = normalize_for_matching(text, fold_diacritics=fold_diacritics)
    normalized_phrase = normalize_for_matching(phrase, fold_diacritics=fold_diacritics)

    if not normalized_text or not normalized_phrase:
        return False

    return f" {normalized_phrase} " in f" {normalized_text} "


def contains_any_phrase(
    text: str | None,
    phrases: Iterable[str],
    *,
    fold_diacritics: bool = True,
) -> bool:
    """Return whether text contains at least one normalized phrase."""
    return any(
        contains_phrase(text, phrase, fold_diacritics=fold_diacritics)
        for phrase in phrases
    )


def unique_normalized_terms(
    terms: Iterable[str | None],
    *,
    fold_diacritics: bool = False,
) -> list[str]:
    """Return unique normalized terms while preserving first-seen order."""
    seen: set[str] = set()
    unique_terms: list[str] = []

    for term in terms:
        normalized = (
            normalize_for_matching(term)
            if fold_diacritics
            else normalize_text(term)
        )
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique_terms.append(normalized)

    return unique_terms


__all__ = [
    "contains_any_phrase",
    "contains_phrase",
    "fold_turkish_diacritics",
    "normalize_for_matching",
    "normalize_text",
    "normalize_unicode",
    "normalize_whitespace",
    "tokenize",
    "turkish_lower",
    "unique_normalized_terms",
]
