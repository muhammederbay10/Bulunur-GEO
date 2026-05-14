# ai/agents/analysis/nodes/expand_turkish_intents.py
"""Expands Turkish buyer-intent variants for the GEO analysis graph."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai.agents.analysis.state import AnalysisGraphState
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import TURKISH_INTENT_SKILL_PATH
from ai.geo_engine.types import TurkishNlpScoringSignals
from ai.llm.skill_loader import build_skill_prompt, load_skill
from ai.llm.structured_outputs import parse_json_object
from ai.turkish_nlp.buyer_patterns import build_buyer_pattern_context, flatten_buyer_pattern_examples
from ai.turkish_nlp.intent_expansion import (
    DEFAULT_MAX_INTENTS,
    expand_buyer_intents,
    get_product_anchor_terms,
    group_intent_variants,
    merge_intent_variants,
    normalize_category_label,
    sanitize_llm_intent_variants,
)
from ai.turkish_nlp.normalize import normalize_text, unique_normalized_terms


IntentVariantGenerator = Callable[[str], Any]


class TurkishIntentExpansionOutput(BaseModel):
    """Structured JSON expected from the Turkish intent Gemini skill."""

    model_config = ConfigDict(populate_by_name=True)

    detected_category: str | None = Field(default=None, alias="detectedCategory")
    buyer_intent_variants: list[str] = Field(
        default_factory=list,
        alias="buyerIntentVariants",
    )
    borrowed_term_variants: list[str] = Field(
        default_factory=list,
        alias="borrowedTermVariants",
    )
    intent_groups: dict[str, list[str]] = Field(
        default_factory=dict,
        alias="intentGroups",
    )
    missing_signals: list[str] = Field(default_factory=list, alias="missingSignals")
    reasoning_summary: str | None = Field(default=None, alias="reasoningSummary")

    @field_validator(
        "buyer_intent_variants",
        "borrowed_term_variants",
        "missing_signals",
        mode="before",
    )
    @classmethod
    def normalize_text_list(cls, values: Any) -> list[str]:
        """Normalize LLM text lists while preserving first-seen order."""
        return _dedupe_text(values)

    @field_validator("intent_groups", mode="before")
    @classmethod
    def normalize_intent_groups(cls, values: Any) -> dict[str, list[str]]:
        """Accept only string-list intent groups from LLM JSON."""
        if not isinstance(values, Mapping):
            return {}
        groups: dict[str, list[str]] = {}
        for key, group_values in values.items():
            normalized_key = str(key).strip()
            normalized_values = _dedupe_text(group_values)
            if normalized_key and normalized_values:
                groups[normalized_key] = normalized_values
        return groups

    @field_validator("detected_category", "reasoning_summary")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional LLM text values."""
        if value is None:
            return None
        normalized = normalize_text(value)
        return normalized or None


def expand_turkish_intents(state: AnalysisGraphState) -> AnalysisGraphState:
    """Merge local Turkish buyer-intent seeds with sanitized Gemini variants."""
    product = _get_product_input(state)
    detected_category = state.get("detected_category") or product.category
    local_result = expand_buyer_intents(
        title=product.title,
        category=detected_category,
        brand=product.brand,
        attributes=product.attributes,
    )
    clean_anchor = (
        normalize_category_label(detected_category)
        or local_result.detected_category
        or normalize_category_label(product.category)
        or product.title
    )
    product_anchor = clean_anchor
    seed_examples = flatten_buyer_pattern_examples(product_anchor)
    llm_output, llm_error = _generate_llm_intents(
        state=state,
        product=product,
        local_variants=local_result.buyer_intent_variants,
        seed_examples=seed_examples,
    )

    anchor_terms = get_product_anchor_terms(
        clean_anchor or local_result.detected_category,
        title=product.title,
        category=clean_anchor,
    )
    llm_variants = _extract_llm_variants(llm_output)
    sanitized_llm_variants = sanitize_llm_intent_variants(
        llm_variants,
        anchor_terms=anchor_terms,
    )
    buyer_intent_variants = merge_intent_variants(
        local_result.buyer_intent_variants,
        sanitized_llm_variants,
        max_variants=DEFAULT_MAX_INTENTS,
    )
    final_category = (
        normalize_category_label(llm_output.detected_category)
        if llm_output and llm_output.detected_category
        else local_result.detected_category
    )
    final_category = final_category or normalize_category_label(state.get("detected_category"))
    missing_signals = _dedupe_text(
        [
            *local_result.missing_signals,
            *(llm_output.missing_signals if llm_output else []),
        ]
    )

    turkish_nlp_signals = _merge_nlp_signals(
        state.get("turkish_nlp_signals"),
        buyer_intent_variants=buyer_intent_variants,
        local_variants=local_result.local_variants,
        llm_variants=sanitized_llm_variants,
        intent_groups=group_intent_variants(buyer_intent_variants),
        missing_signals=missing_signals,
    )

    metadata = dict(state.get("metadata", {}))
    metadata["expandTurkishIntents"] = {
        "skillPath": TURKISH_INTENT_SKILL_PATH,
        "localVariantCount": len(local_result.buyer_intent_variants),
        "seedExamplesPassedAsExamples": seed_examples,
        "llmVariantCount": len(llm_variants),
        "sanitizedLlmVariantCount": len(sanitized_llm_variants),
        "finalVariantCount": len(buyer_intent_variants),
        "geminiUsed": llm_output is not None,
        "geminiError": llm_error,
        "reasoningSummary": llm_output.reasoning_summary if llm_output else None,
    }

    return {
        **state,
        "detected_category": final_category,
        "buyer_intent_variants": buyer_intent_variants,
        "turkish_nlp_signals": turkish_nlp_signals,
        "metadata": metadata,
    }


def _get_product_input(state: AnalysisGraphState) -> ProductInput:
    product = state.get("product_input")
    if not isinstance(product, ProductInput):
        raise ValueError("expand_turkish_intents requires product_input in analysis state")
    return product


def _generate_llm_intents(
    *,
    state: AnalysisGraphState,
    product: ProductInput,
    local_variants: Sequence[str],
    seed_examples: Sequence[str],
) -> tuple[TurkishIntentExpansionOutput | None, str | None]:
    prompt = _build_intent_prompt(
        state=state,
        product=product,
        local_variants=local_variants,
        seed_examples=seed_examples,
    )

    try:
        raw_output = _invoke_intent_generator(state, prompt)
        if raw_output is None:
            return None, "No Gemini intent generator was configured."
        parsed = parse_json_object(raw_output)
        return TurkishIntentExpansionOutput.model_validate(parsed), None
    except Exception as exc:
        return None, str(exc)


def _build_intent_prompt(
    *,
    state: AnalysisGraphState,
    product: ProductInput,
    local_variants: Sequence[str],
    seed_examples: Sequence[str],
) -> str:
    skill = load_skill(TURKISH_INTENT_SKILL_PATH)
    product_facts = state.get("product_facts")
    normalized_text = state.get("normalized_text")

    product_data = {
        "title": product.title,
        "category": state.get("detected_category") or product.category,
        "brand": product.brand,
        "description": product.description,
        "shortDescription": product.short_description,
        "attributes": product.attributes,
        "source": product.source,
        "knownFacts": product_facts.known_facts
        if hasattr(product_facts, "known_facts")
        else {},
        "missingFacts": state.get("missing_facts", []),
    }
    extra_context = {
        "localGenericIntentBaseline": list(local_variants),
        "turkishNlpSeedExamples": {
            "instruction": (
                "Bu örnekleri yalnızca doğal Türkçe buyer-intent biçimi için örnek olarak kullan; "
                "bunlar zorunlu kelime listesi veya kategori sınırı değildir."
            ),
            "examples": list(seed_examples),
            "patternContext": build_buyer_pattern_context(
                state.get("detected_category") or product.category or product.title,
                product_anchor=state.get("detected_category") or product.category or product.title,
            ),
        },
        "normalizedText": normalized_text.model_dump(mode="json", by_alias=True)
        if hasattr(normalized_text, "model_dump")
        else None,
        "outputReminder": "Sadece geçerli JSON döndür.",
    }
    return build_skill_prompt(skill, product_data=product_data, extra_context=extra_context)


def _invoke_intent_generator(state: AnalysisGraphState, prompt: str) -> Any | None:
    injected = _get_injected_generator(state)
    if injected is not None:
        return injected(prompt)

    try:
        from ai.llm.gemini_client import get_gemini_llm
    except ImportError as exc:
        raise ImportError("Gemini client dependencies are not installed.") from exc

    llm = get_gemini_llm(temperature=0.1, max_tokens=1024, json_mode=True)
    return llm.invoke(prompt)


def _get_injected_generator(state: AnalysisGraphState) -> IntentVariantGenerator | None:
    metadata = state.get("metadata", {})
    generator = None
    if isinstance(metadata, Mapping):
        generator = metadata.get("intentVariantGenerator") or metadata.get(
            "intent_variant_generator"
        )
    return generator if callable(generator) else None


def _extract_llm_variants(output: TurkishIntentExpansionOutput | None) -> list[str]:
    if output is None:
        return []
    return _dedupe_text(
        [
            *output.buyer_intent_variants,
            *output.borrowed_term_variants,
        ]
    )


def _merge_nlp_signals(
    existing: TurkishNlpScoringSignals | None,
    *,
    buyer_intent_variants: list[str],
    local_variants: list[str],
    llm_variants: list[str],
    intent_groups: Mapping[str, list[str]],
    missing_signals: list[str],
) -> TurkishNlpScoringSignals:
    if isinstance(existing, TurkishNlpScoringSignals):
        return existing.model_copy(
            update={
                "buyer_intent_variants": buyer_intent_variants,
                "local_buyer_intent_variants": local_variants,
                "llm_buyer_intent_variants": llm_variants,
                "intent_groups": dict(intent_groups),
                "missing_signals": _dedupe_text(
                    [*existing.missing_signals, *missing_signals]
                ),
            }
        )

    return TurkishNlpScoringSignals(
        buyerIntentVariants=buyer_intent_variants,
        localBuyerIntentVariants=local_variants,
        llmBuyerIntentVariants=llm_variants,
        intentGroups=dict(intent_groups),
        missingSignals=missing_signals,
    )


def _dedupe_text(values: Any) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        iterable = (values,)
    else:
        try:
            iterable = iter(values)
        except TypeError:
            iterable = (values,)
    return unique_normalized_terms(str(value) for value in iterable if value is not None)


__all__ = [
    "IntentVariantGenerator",
    "TurkishIntentExpansionOutput",
    "expand_turkish_intents",
]
