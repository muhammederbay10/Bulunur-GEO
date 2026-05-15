# ai/geo_engine/strategies/turkish_faq_enrichment.py
"""Generates grounded Turkish FAQ items for product answer-readiness."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai.api_contracts.geo_improvement_output import GeneratedFaqItem, GeneratedProductContent
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.strategies.base import (
    STRATEGY_DISPLAY_NAMES,
    STRATEGY_FAQ_ENRICHMENT,
    StrategyExecutionResult,
)
from ai.llm.gemini_client import get_gemini_llm
from ai.llm.safety import invoke_with_safety
from ai.llm.skill_loader import build_skill_prompt
from ai.llm.structured_outputs import parse_structured_output
from ai.schema_engine.schema_mapping import is_known_value
from ai.turkish_nlp.normalize import normalize_text, tokenize


FaqEnrichmentInput = ProductInput | Mapping[str, Any]
FaqGenerator = Callable[[dict[str, Any]], Any]

SKILL_PATH = "optimization/turkish_faq_enrichment"
DEFAULT_MAX_FAQ_ITEMS = 6

UNSUPPORTED_CLAIM_KEYWORDS: tuple[str, ...] = (
    "organik",
    "sertifika",
    "sertifikali",
    "garanti",
    "ücretsiz kargo",
    "ucretsiz kargo",
    "aynı gün",
    "ayni gun",
    "su gecirmez",
    "su geçirmez",
    "bulasik makinesi",
    "dishwasher",
    "saglik",
    "sağlık",
    "premium",
    "en iyi",
    "orijinal",
)


class FaqEnrichmentItem(BaseModel):
    """One FAQ item returned by the Turkish FAQ enrichment skill."""

    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    source_facts: list[str] = Field(default_factory=list, alias="sourceFacts")

    @field_validator("question", "answer")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Reject blank FAQ text."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("FAQ text cannot be blank")
        return normalized

    @field_validator("source_facts", mode="before")
    @classmethod
    def normalize_source_facts(cls, values: Any) -> list[str]:
        """Normalize source fact labels."""
        return _dedupe_text(_coerce_text_values(values))

    def to_generated_item(self) -> GeneratedFaqItem:
        """Convert the skill item into the public generated FAQ contract."""
        return GeneratedFaqItem(
            question=self.question,
            answer=self.answer,
            groundedIn=self.source_facts,
        )


class FaqEnrichmentJudgment(BaseModel):
    """Structured JSON returned by the FAQ enrichment skill."""

    model_config = ConfigDict(populate_by_name=True)

    faq_items: list[FaqEnrichmentItem] = Field(default_factory=list, alias="faqItems")
    blocked_questions: list[str] = Field(default_factory=list, alias="blockedQuestions")
    missing_facts_to_answer_better: list[str] = Field(
        default_factory=list,
        alias="missingFactsToAnswerBetter",
    )
    recommended_next_action: str | None = Field(
        default=None,
        alias="recommendedNextAction",
    )

    @field_validator(
        "blocked_questions",
        "missing_facts_to_answer_better",
        mode="before",
    )
    @classmethod
    def normalize_text_list(cls, values: Any) -> list[str]:
        """Normalize string lists while preserving order."""
        return _dedupe_text(_coerce_text_values(values))

    @field_validator("recommended_next_action")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional next action text."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


def run_turkish_faq_enrichment_strategy(
    product: FaqEnrichmentInput,
    *,
    buyer_intent_variants: Sequence[str] | None = None,
    missing_facts: Sequence[str] | None = None,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
    faq_generator: FaqGenerator | None = None,
    llm: Any | None = None,
    max_faq_items: int = DEFAULT_MAX_FAQ_ITEMS,
) -> StrategyExecutionResult:
    """Generate grounded FAQ items and discard unsafe or unsupported answers."""
    if max_faq_items < 1:
        raise ValueError("max_faq_items must be at least 1")

    context = _build_context(
        product,
        buyer_intent_variants=buyer_intent_variants,
        missing_facts=missing_facts,
        trusted_facts=trusted_facts,
        user_confirmed_facts=user_confirmed_facts,
    )
    judgment = _run_faq_generation(context, faq_generator=faq_generator, llm=llm)
    safe_items, validation_warnings = _safe_faq_items(
        judgment.faq_items,
        context["knownFacts"],
        max_items=max_faq_items,
    )

    warnings = [
        *judgment.blocked_questions,
        *judgment.missing_facts_to_answer_better,
        *validation_warnings,
    ]
    errors: list[str] = []
    if judgment.faq_items and not safe_items:
        errors.append("FAQ enrichment output did not include any safely grounded FAQ item.")

    return StrategyExecutionResult(
        strategyId=STRATEGY_FAQ_ENRICHMENT,
        name=STRATEGY_DISPLAY_NAMES[STRATEGY_FAQ_ENRICHMENT],
        generated=GeneratedProductContent(faq=[item.to_generated_item() for item in safe_items]),
        warnings=warnings,
        errors=errors,
        missingFacts=judgment.missing_facts_to_answer_better,
        metadata={
            "blockedQuestions": judgment.blocked_questions,
            "recommendedNextAction": judgment.recommended_next_action,
            "skillPath": SKILL_PATH,
            "llmBacked": True,
        },
    )


def _run_faq_generation(
    context: dict[str, Any],
    *,
    faq_generator: FaqGenerator | None,
    llm: Any | None,
) -> FaqEnrichmentJudgment:
    if faq_generator is not None:
        raw_output = faq_generator(context)
        if isinstance(raw_output, FaqEnrichmentJudgment):
            return raw_output
        return FaqEnrichmentJudgment.model_validate(raw_output)

    resolved_llm = llm or get_gemini_llm(json_mode=True)
    prompt = build_skill_prompt(SKILL_PATH, product_data=context["product"], extra_context=context)
    response = invoke_with_safety(
        resolved_llm,
        prompt,
        operation="turkish_faq_enrichment",
    )
    return parse_structured_output(response, FaqEnrichmentJudgment)


def _build_context(
    product: FaqEnrichmentInput,
    *,
    buyer_intent_variants: Sequence[str] | None,
    missing_facts: Sequence[str] | None,
    trusted_facts: Mapping[str, Any] | None,
    user_confirmed_facts: Mapping[str, Any] | None,
) -> dict[str, Any]:
    product_facts = _product_to_facts(product)
    known_facts = _merge_facts(product_facts, trusted_facts, user_confirmed_facts)
    return {
        "product": product_facts,
        "knownFacts": known_facts,
        "buyerIntentVariants": list(buyer_intent_variants or ()),
        "missingFacts": _dedupe_text(_coerce_text_values(missing_facts)),
        "antiHallucination": {
            "useOnlyKnownOrUserConfirmedFacts": True,
            "dropUngroundedFaqAnswers": True,
        },
    }


def _safe_faq_items(
    faq_items: Sequence[FaqEnrichmentItem],
    known_facts: Mapping[str, Any],
    *,
    max_items: int,
) -> tuple[list[FaqEnrichmentItem], list[str]]:
    safe_items: list[FaqEnrichmentItem] = []
    warnings: list[str] = []

    for item in faq_items:
        unsafe_reason = _unsafe_faq_reason(item, known_facts)
        if unsafe_reason:
            warnings.append(unsafe_reason)
            continue

        safe_items.append(item)
        if len(safe_items) >= max_items:
            break

    return safe_items, _dedupe_text(warnings)


def _unsafe_faq_reason(
    item: FaqEnrichmentItem,
    known_facts: Mapping[str, Any],
) -> str | None:
    if not item.source_facts:
        return f"FAQ skipped because it did not cite source facts: {item.question}"

    unsupported_claim = _unsupported_claim(item, known_facts)
    if unsupported_claim is not None:
        return f"FAQ skipped because it contains an unsupported claim: {unsupported_claim}"

    if not _faq_answer_looks_grounded(item, known_facts):
        return f"FAQ skipped because its answer is not grounded in known facts: {item.question}"

    return None


def _unsupported_claim(
    item: FaqEnrichmentItem,
    known_facts: Mapping[str, Any],
) -> str | None:
    answer_text = normalize_text(item.answer)
    source_text = normalize_text(" ".join(item.source_facts))
    for keyword in UNSUPPORTED_CLAIM_KEYWORDS:
        normalized_keyword = normalize_text(keyword)
        if normalized_keyword in answer_text and normalized_keyword not in source_text:
            return keyword
    return None


def _faq_answer_looks_grounded(
    item: FaqEnrichmentItem,
    known_facts: Mapping[str, Any],
) -> bool:
    answer_tokens = set(_meaningful_tokens(item.answer))
    known_text = normalize_text(_known_fact_text(known_facts))
    fact_tokens = set(_meaningful_tokens(known_text))
    source_fact_supported = any(
        normalize_text(source_fact) in known_text
        for source_fact in item.source_facts
        if normalize_text(source_fact)
    )
    return source_fact_supported and bool(answer_tokens.intersection(fact_tokens))


def _product_to_facts(product: FaqEnrichmentInput) -> dict[str, Any]:
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
    merged: dict[str, Any] = {}
    for source in (product_facts, trusted_facts or {}, user_confirmed_facts or {}):
        for key, value in source.items():
            if is_known_value(value):
                merged[key] = value

    merged["attributes"] = _merge_nested_mappings(
        product_facts.get("attributes"),
        (trusted_facts or {}).get("attributes"),
        (user_confirmed_facts or {}).get("attributes"),
    )
    return merged


def _merge_nested_mappings(*values: Any) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for value in values:
        if not isinstance(value, Mapping):
            continue
        for key, item in value.items():
            if is_known_value(item):
                merged[str(key)] = item
    return merged


def _known_fact_text(known_facts: Mapping[str, Any]) -> str:
    parts: list[str] = []
    for value in known_facts.values():
        if isinstance(value, Mapping):
            parts.append(_known_fact_text(value))
        elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            parts.extend(str(item) for item in value if is_known_value(item))
        elif is_known_value(value):
            parts.append(str(value))
    return " ".join(parts)


def _meaningful_tokens(text: str | None) -> list[str]:
    return [token for token in tokenize(text) if len(token) > 2]


def _coerce_text_values(values: Any) -> tuple[str, ...]:
    if values is None:
        return ()
    if isinstance(values, str):
        return (values,)
    if isinstance(values, Sequence):
        return tuple(str(value) for value in values if value is not None)
    return (str(values),)


def _dedupe_text(values: Sequence[str] | Sequence[Any]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for raw_value in values:
        value = str(raw_value).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


__all__ = [
    "DEFAULT_MAX_FAQ_ITEMS",
    "FaqEnrichmentInput",
    "FaqEnrichmentItem",
    "FaqEnrichmentJudgment",
    "FaqGenerator",
    "run_turkish_faq_enrichment_strategy",
]
