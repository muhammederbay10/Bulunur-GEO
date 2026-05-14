# ai/agents/analysis/nodes/detect_category.py
"""Detects a free-text product category without using a fixed taxonomy."""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai.agents.analysis.state import AnalysisGraphState
from ai.api_contracts.product_input import ProductInput
from ai.llm.structured_outputs import parse_json_object
from ai.turkish_nlp.intent_expansion import detect_intent_category, normalize_category_label
from ai.turkish_nlp.normalize import normalize_text, tokenize


CategoryClarifier = Callable[[dict[str, Any]], Mapping[str, Any] | str | None]

MIN_TITLE_DERIVED_CONFIDENCE = 0.65
MIN_LLM_CONFIDENCE = 0.55
TOO_GENERIC_CATEGORY_LABELS = {
    "ürün",
    "urun",
    "model",
    "modeller",
    "fiyat",
    "kampanya",
    "indirim",
}


class CategoryDetectionResult(BaseModel):
    """A free-text category candidate and its provenance."""

    model_config = ConfigDict(populate_by_name=True)

    category: str | None = None
    source: str = "unknown"
    confidence: float = Field(default=0.0, ge=0, le=1)
    reason: str | None = None
    clarification_used: bool = Field(default=False, alias="clarificationUsed")

    @field_validator("category", "reason")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional text values."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


def detect_category(state: AnalysisGraphState) -> AnalysisGraphState:
    """Detect or normalize a product category as an open free-text label."""
    product = _get_product_input(state)
    local_result = _detect_local_category(product)
    final_result = _maybe_clarify_with_llm(state, product, local_result)

    metadata = dict(state.get("metadata", {}))
    metadata["detectCategory"] = {
        "category": final_result.category,
        "source": final_result.source,
        "confidence": final_result.confidence,
        "reason": final_result.reason,
        "clarificationUsed": final_result.clarification_used,
        "taxonomyForced": False,
    }

    return {
        **state,
        "detected_category": final_result.category,
        "metadata": metadata,
    }


def _get_product_input(state: AnalysisGraphState) -> ProductInput:
    product = state.get("product_input")
    if not isinstance(product, ProductInput):
        raise ValueError("detect_category requires product_input in analysis state")
    return product


def _detect_local_category(product: ProductInput) -> CategoryDetectionResult:
    normalized_input_category = _normalize_free_text_category(product.category)
    if normalized_input_category:
        return CategoryDetectionResult(
            category=normalized_input_category,
            source="product_input.category",
            confidence=0.95,
            reason="The backend supplied a usable free-text category.",
        )

    title_category = _normalize_free_text_category(
        detect_intent_category(title=product.title, category=None)
    )
    if title_category:
        return CategoryDetectionResult(
            category=title_category,
            source="product_input.title",
            confidence=_title_category_confidence(product.title, title_category),
            reason="No category was supplied, so a compact product label was inferred from the title.",
        )

    return CategoryDetectionResult(
        category=None,
        source="none",
        confidence=0.0,
        reason="No usable category label was present in the supplied product facts.",
    )


def _maybe_clarify_with_llm(
    state: AnalysisGraphState,
    product: ProductInput,
    local_result: CategoryDetectionResult,
) -> CategoryDetectionResult:
    if not _needs_clarification(local_result):
        return local_result

    raw_result = _invoke_category_clarifier(
        state,
        _build_clarification_context(product, local_result, state),
    )
    clarified = _coerce_clarification(raw_result)
    if clarified is None:
        return local_result
    if clarified.confidence < MIN_LLM_CONFIDENCE:
        return local_result

    normalized_category = _normalize_free_text_category(clarified.category)
    if not normalized_category:
        return local_result

    return CategoryDetectionResult(
        category=normalized_category,
        source="gemini.category_clarification",
        confidence=clarified.confidence,
        reason=clarified.reason
        or "Gemini clarified the product category as a free-text label.",
        clarificationUsed=True,
    )


def _get_category_clarifier(state: AnalysisGraphState) -> CategoryClarifier | None:
    metadata = state.get("metadata", {})
    raw_clarifier = None
    if isinstance(metadata, Mapping):
        raw_clarifier = metadata.get("categoryClarifier") or metadata.get(
            "category_clarifier"
        )
    return raw_clarifier if callable(raw_clarifier) else None


def _invoke_category_clarifier(
    state: AnalysisGraphState,
    context: dict[str, Any],
) -> Mapping[str, Any] | str | None:
    """Run an injected clarifier or a small Gemini JSON clarification call."""
    clarifier = _get_category_clarifier(state)
    if clarifier is not None:
        return clarifier(context)

    try:
        from ai.llm.gemini_client import get_gemini_llm

        llm = get_gemini_llm(temperature=0.1, max_tokens=512, json_mode=True)
        return parse_json_object(llm.invoke(_build_gemini_clarification_prompt(context)))
    except Exception:
        return None


def _build_gemini_clarification_prompt(context: Mapping[str, Any]) -> str:
    """Build the Turkish free-text category clarification prompt."""
    return (
        "Sen Turkiye e-ticaret urunleri icin GEO kategori netlestirme yardimcisisin.\n"
        "Gorev: Urunun desteklenen bilgilere gore kisa, serbest metin bir Turkce "
        "kategori etiketini bul.\n"
        "Kurallar:\n"
        "- Sabit taksonomi kullanma.\n"
        "- Desteklenmeyen bilgi uydurma.\n"
        "- Marka, fiyat veya kampanya metnini kategori gibi yazma.\n"
        "- Emin degilsen category null dondur.\n"
        "Sadece su sekilde gecerli JSON dondur:\n"
        "{\"category\": string|null, \"confidence\": number, \"reason\": string}\n"
        "Baglam:\n"
        + json.dumps(context, ensure_ascii=False, indent=2, default=str)
    )


def _needs_clarification(local_result: CategoryDetectionResult) -> bool:
    if local_result.category is None:
        return True
    return local_result.confidence < 0.75


def _build_clarification_context(
    product: ProductInput,
    local_result: CategoryDetectionResult,
    state: AnalysisGraphState,
) -> dict[str, Any]:
    normalized_text = state.get("normalized_text")
    product_facts = state.get("product_facts")

    return {
        "instruction": (
            "Return a concise Turkish free-text product category. "
            "Do not map it to a fixed taxonomy and do not invent unsupported facts."
        ),
        "product": {
            "title": product.title,
            "category": product.category,
            "brand": product.brand,
            "description": product.description,
            "shortDescription": product.short_description,
            "attributes": product.attributes,
        },
        "normalizedText": normalized_text.model_dump(mode="json", by_alias=True)
        if hasattr(normalized_text, "model_dump")
        else None,
        "knownFacts": product_facts.known_facts
        if hasattr(product_facts, "known_facts")
        else {},
        "localCandidate": local_result.model_dump(mode="json", by_alias=True),
        "expectedJsonShape": {
            "category": "kısa serbest metin kategori etiketi veya null",
            "confidence": "0 ile 1 arasında sayı",
            "reason": "kısa gerekçe",
        },
    }


def _coerce_clarification(raw_result: Mapping[str, Any] | str | None) -> CategoryDetectionResult | None:
    if raw_result is None:
        return None
    if isinstance(raw_result, str):
        category = _normalize_free_text_category(raw_result)
        if not category:
            return None
        return CategoryDetectionResult(
            category=category,
            source="gemini.category_clarification",
            confidence=MIN_LLM_CONFIDENCE,
            reason="Clarifier returned a category label.",
            clarificationUsed=True,
        )
    if not isinstance(raw_result, Mapping):
        return None

    candidate = raw_result.get("category") or raw_result.get("detectedCategory")
    category = _normalize_free_text_category(
        str(candidate) if candidate is not None else None
    )
    if not category:
        return None

    confidence = raw_result.get("confidence", MIN_LLM_CONFIDENCE)
    try:
        confidence_value = float(confidence)
    except (TypeError, ValueError):
        confidence_value = MIN_LLM_CONFIDENCE

    return CategoryDetectionResult(
        category=category,
        source="gemini.category_clarification",
        confidence=min(max(confidence_value, 0.0), 1.0),
        reason=_optional_text(raw_result.get("reason")),
        clarificationUsed=True,
    )


def _title_category_confidence(title: str | None, category: str) -> float:
    title_tokens = tokenize(title, fold_diacritics=False)
    category_tokens = tokenize(category, fold_diacritics=False)
    if not title_tokens or not category_tokens:
        return MIN_TITLE_DERIVED_CONFIDENCE
    if len(category_tokens) <= 2:
        return 0.72
    if len(category_tokens) <= 3 and normalize_text(category) in normalize_text(title):
        return 0.68
    return MIN_TITLE_DERIVED_CONFIDENCE


def _normalize_free_text_category(category: str | None) -> str | None:
    normalized = normalize_category_label(category)
    if not normalized or normalized in TOO_GENERIC_CATEGORY_LABELS:
        return None
    return normalized


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


__all__ = [
    "CategoryClarifier",
    "CategoryDetectionResult",
    "detect_category",
]
