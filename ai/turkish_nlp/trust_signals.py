# ai/turkish_nlp/trust_signals.py
"""Detects generic Turkish e-commerce trust-signal hints for agents."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from ai.turkish_nlp.normalize import (
    contains_phrase,
    normalize_for_matching,
    normalize_text,
    unique_normalized_terms,
)


TrustSignalGroups = Mapping[str, Iterable[str]]

TRUST_SIGNAL_SEEDS: dict[str, tuple[str, ...]] = {
    "return_policy": (
        "iade",
        "değişim",
        "degisim",
        "cayma hakkı",
        "kolay iade",
    ),
    "warranty": (
        "garanti",
        "garantili",
        "güvence",
        "guvence",
    ),
    "shipping": (
        "kargo",
        "ücretsiz kargo",
        "ucretsiz kargo",
        "gönderim",
        "gonderim",
    ),
    "delivery": (
        "teslimat",
        "hızlı teslimat",
        "hizli teslimat",
        "aynı gün teslimat",
        "ayni gun teslimat",
    ),
    "payment": (
        "ödeme",
        "odeme",
        "güvenli ödeme",
        "guvenli odeme",
        "kredi kartı",
        "kredi karti",
        "kapıda ödeme",
        "kapida odeme",
    ),
    "installment": (
        "taksit",
        "taksitli",
        "taksitli ödeme",
        "taksitli odeme",
    ),
    "stock": (
        "stok",
        "stokta",
        "mevcut",
        "hemen teslim",
        "hazır",
        "hazir",
    ),
    "authenticity": (
        "orijinal",
        "original",
        "faturalı",
        "faturali",
        "yetkili satıcı",
        "yetkili satici",
    ),
    "support": (
        "müşteri hizmetleri",
        "musteri hizmetleri",
        "destek",
        "canlı destek",
        "canli destek",
    ),
    "reviews": (
        "yorum",
        "yorumlar",
        "değerlendirme",
        "degerlendirme",
        "puan",
    ),
}

CORE_TRUST_SIGNALS: tuple[str, ...] = (
    "return_policy",
    "warranty",
    "shipping",
    "payment",
)


@dataclass(frozen=True)
class TrustSignalMatch:
    """A detected trust-signal seed phrase."""

    signal: str
    matched: str


@dataclass(frozen=True)
class TrustSignalSummary:
    """Trust-signal hints extracted from Turkish product or store text."""

    present_signals: list[str]
    missing_core_signals: list[str]
    matches: list[TrustSignalMatch] = field(default_factory=list)


def normalize_trust_signal_name(name: str | None) -> str:
    """Normalize a trust-signal name for deterministic lookup."""
    return normalize_for_matching(name).replace(" ", "_")


def build_trust_signal_index(
    signal_groups: TrustSignalGroups = TRUST_SIGNAL_SEEDS,
) -> dict[str, str]:
    """Build a normalized phrase-to-signal lookup table."""
    index: dict[str, str] = {}

    for signal, phrases in signal_groups.items():
        normalized_signal = normalize_trust_signal_name(signal)
        if not normalized_signal:
            continue
        index.setdefault(normalized_signal, normalized_signal)
        for phrase in phrases:
            normalized_phrase = normalize_for_matching(phrase)
            if normalized_phrase:
                index.setdefault(normalized_phrase, normalized_signal)

    return index


def find_trust_signal_matches(
    text: str | None,
    *,
    signal_groups: TrustSignalGroups = TRUST_SIGNAL_SEEDS,
) -> list[TrustSignalMatch]:
    """Find trust-signal seed phrases in text."""
    normalized_text = normalize_text(text)
    if not normalized_text:
        return []

    matches: list[TrustSignalMatch] = []
    seen: set[tuple[str, str]] = set()

    for phrase, signal in build_trust_signal_index(signal_groups).items():
        if not contains_phrase(normalized_text, phrase):
            continue
        key = (signal, phrase)
        if key in seen:
            continue
        seen.add(key)
        matches.append(TrustSignalMatch(signal=signal, matched=phrase))

    return sorted(matches, key=lambda match: (match.signal, match.matched))


def detect_trust_signals(
    text: str | None,
    *,
    signal_groups: TrustSignalGroups = TRUST_SIGNAL_SEEDS,
) -> list[str]:
    """Return unique trust-signal names found in text."""
    return unique_normalized_terms(
        match.signal for match in find_trust_signal_matches(text, signal_groups=signal_groups)
    )


def contains_trust_signal(
    text: str | None,
    signal: str,
    *,
    signal_groups: TrustSignalGroups = TRUST_SIGNAL_SEEDS,
) -> bool:
    """Return whether text contains a specific trust-signal hint."""
    normalized_signal = normalize_trust_signal_name(signal)
    if not normalized_signal:
        return False
    return normalized_signal in detect_trust_signals(text, signal_groups=signal_groups)


def summarize_trust_signals(
    text: str | None,
    *,
    core_signals: Iterable[str] = CORE_TRUST_SIGNALS,
    signal_groups: TrustSignalGroups = TRUST_SIGNAL_SEEDS,
) -> TrustSignalSummary:
    """Summarize present and missing generic trust signals for agent context."""
    matches = find_trust_signal_matches(text, signal_groups=signal_groups)
    present_signals = unique_normalized_terms(match.signal for match in matches)
    missing_core_signals = get_missing_core_trust_signals(
        present_signals,
        core_signals=core_signals,
    )

    return TrustSignalSummary(
        present_signals=present_signals,
        missing_core_signals=missing_core_signals,
        matches=matches,
    )


def get_missing_core_trust_signals(
    present_signals: Iterable[str],
    *,
    core_signals: Iterable[str] = CORE_TRUST_SIGNALS,
) -> list[str]:
    """Return generic core trust signals that were not detected."""
    present = {
        normalize_trust_signal_name(signal)
        for signal in present_signals
        if normalize_trust_signal_name(signal)
    }
    return [
        normalized
        for normalized in (
            normalize_trust_signal_name(signal) for signal in core_signals
        )
        if normalized and normalized not in present
    ]


def build_trust_signal_context(
    text: str | None,
    *,
    signal_groups: TrustSignalGroups = TRUST_SIGNAL_SEEDS,
) -> dict[str, list[str]]:
    """Return a compact signal-to-phrases map suitable for agent prompts."""
    context: dict[str, list[str]] = {}

    for match in find_trust_signal_matches(text, signal_groups=signal_groups):
        context.setdefault(match.signal, [])
        context[match.signal].append(match.matched)

    return {
        signal: unique_normalized_terms(matches)
        for signal, matches in context.items()
    }


def merge_trust_signal_groups(
    *signal_groups: TrustSignalGroups,
) -> dict[str, tuple[str, ...]]:
    """Merge custom trust-signal seed groups without mutating defaults."""
    merged: dict[str, list[str]] = {}

    for group in signal_groups:
        for signal, phrases in group.items():
            normalized_signal = normalize_trust_signal_name(signal)
            if not normalized_signal:
                continue
            merged.setdefault(normalized_signal, [])
            merged[normalized_signal].extend(phrases)

    return {
        signal: tuple(unique_normalized_terms(phrases))
        for signal, phrases in merged.items()
    }


__all__ = [
    "CORE_TRUST_SIGNALS",
    "TRUST_SIGNAL_SEEDS",
    "TrustSignalGroups",
    "TrustSignalMatch",
    "TrustSignalSummary",
    "build_trust_signal_context",
    "build_trust_signal_index",
    "contains_trust_signal",
    "detect_trust_signals",
    "find_trust_signal_matches",
    "get_missing_core_trust_signals",
    "merge_trust_signal_groups",
    "normalize_trust_signal_name",
    "summarize_trust_signals",
]
