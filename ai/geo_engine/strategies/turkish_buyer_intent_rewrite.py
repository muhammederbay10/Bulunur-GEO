# ai/geo_engine/strategies/turkish_buyer_intent_rewrite.py
"""Generates Turkish buyer-intent title and description improvements."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai.api_contracts.geo_improvement_output import GeneratedProductContent
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.strategies.base import (
    STRATEGY_BUYER_INTENT_REWRITE,
    STRATEGY_DISPLAY_NAMES,
    StrategyExecutionResult,
)
from ai.llm.gemini_client import get_gemini_llm
from ai.llm.safety import invoke_with_safety
from ai.llm.skill_loader import build_skill_prompt
from ai.llm.structured_outputs import parse_structured_output
from ai.schema_engine.schema_mapping import is_known_value
from ai.turkish_nlp.normalize import normalize_text


BuyerIntentRewriteInput = ProductInput | Mapping[str, Any]
RewriteGenerator = Callable[[dict[str, Any]], Any]

SKILL_PATH = "optimization/turkish_buyer_intent_rewrite"

UNSUPPORTED_CLAIM_KEYWORDS: tuple[str, ...] = (
    "organik",
    "sertifika",
    "sertifikali",
    "garanti",
    "kargo",
    "ucretsiz kargo",
    "ayni gun",
    "bulasik makinesi",
    "dishwasher",
    "saglik",
    "premium",
    "en iyi",
    "orijinal",
)


class BuyerIntentRewriteJudgment(BaseModel):
    """Structured JSON returned by the buyer-intent rewrite skill."""

    model_config = ConfigDict(populate_by_name=True)

    improved_title: str | None = Field(default=None, alias="improvedTitle")
    improved_short_description: str | None = Field(
        default=None,
        alias="improvedShortDescription",
    )
    improved_long_description: str | None = Field(
        default=None,
        alias="improvedLongDescription",
    )
    preserved_facts: list[str] = Field(default_factory=list, alias="preservedFacts")
    blocked_by_missing_facts: list[str] = Field(
        default_factory=list,
        alias="blockedByMissingFacts",
    )
    recommended_next_action: str | None = Field(
        default=None,
        alias="recommendedNextAction",
    )

    @field_validator(
        "improved_title",
        "improved_short_description",
        "improved_long_description",
        "recommended_next_action",
    )
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional generated text."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("preserved_facts", "blocked_by_missing_facts", mode="before")
    @classmethod
    def normalize_text_list(cls, values: Any) -> list[str]:
        """Normalize list fields while preserving order."""
        if values is None:
            return []
        if isinstance(values, str):
            raw_values = (values,)
        else:
            raw_values = values

        normalized_values: list[str] = []
        seen: set[str] = set()
        for raw_value in raw_values:
            value = str(raw_value).strip()
            if not value or value in seen:
                continue
            seen.add(value)
            normalized_values.append(value)
        return normalized_values


def run_turkish_buyer_intent_rewrite_strategy(
    product: BuyerIntentRewriteInput,
    *,
    buyer_intent_variants: Sequence[str] | None = None,
    missing_facts: Sequence[str] | None = None,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
    turkish_nlp_context: Mapping[str, Any] | None = None,
    rewrite_generator: RewriteGenerator | None = None,
    llm: Any | None = None,
) -> StrategyExecutionResult:
    """Generate reviewable Turkish title and description improvements."""
    context = _build_context(
        product,
        buyer_intent_variants=buyer_intent_variants,
        missing_facts=missing_facts,
        trusted_facts=trusted_facts,
        user_confirmed_facts=user_confirmed_facts,
        turkish_nlp_context=turkish_nlp_context,
    )
    judgment = _run_rewrite(context, rewrite_generator=rewrite_generator, llm=llm)
    generated = GeneratedProductContent(
        title=judgment.improved_title,
        shortDescription=judgment.improved_short_description,
        longDescription=judgment.improved_long_description,
    )

    warnings = list(judgment.blocked_by_missing_facts)
    errors = _unsupported_claim_errors(generated, context["knownFacts"])
    if errors:
        generated = GeneratedProductContent()

    return StrategyExecutionResult(
        strategyId=STRATEGY_BUYER_INTENT_REWRITE,
        name=STRATEGY_DISPLAY_NAMES[STRATEGY_BUYER_INTENT_REWRITE],
        generated=generated,
        warnings=warnings,
        errors=errors,
        missingFacts=judgment.blocked_by_missing_facts,
        metadata={
            "preservedFacts": judgment.preserved_facts,
            "recommendedNextAction": judgment.recommended_next_action,
            "skillPath": SKILL_PATH,
            "llmBacked": True,
        },
    )


def _run_rewrite(
    context: dict[str, Any],
    *,
    rewrite_generator: RewriteGenerator | None,
    llm: Any | None,
) -> BuyerIntentRewriteJudgment:
    if rewrite_generator is not None:
        raw_output = rewrite_generator(context)
        if isinstance(raw_output, BuyerIntentRewriteJudgment):
            return raw_output
        return BuyerIntentRewriteJudgment.model_validate(raw_output)

    resolved_llm = llm or get_gemini_llm(json_mode=True)
    prompt = build_skill_prompt(SKILL_PATH, product_data=context["product"], extra_context=context)
    response = invoke_with_safety(
        resolved_llm,
        prompt,
        operation="turkish_buyer_intent_rewrite",
    )
    return parse_structured_output(response, BuyerIntentRewriteJudgment)


def _build_context(
    product: BuyerIntentRewriteInput,
    *,
    buyer_intent_variants: Sequence[str] | None,
    missing_facts: Sequence[str] | None,
    trusted_facts: Mapping[str, Any] | None,
    user_confirmed_facts: Mapping[str, Any] | None,
    turkish_nlp_context: Mapping[str, Any] | None,
) -> dict[str, Any]:
    product_facts = _product_to_facts(product)
    known_facts = _merge_facts(product_facts, trusted_facts, user_confirmed_facts)
    return {
        "product": product_facts,
        "knownFacts": known_facts,
        "buyerIntentVariants": list(buyer_intent_variants or ()),
        "missingFacts": _dedupe_text(missing_facts or ()),
        "turkishNlpSeedContext": dict(turkish_nlp_context or {}),
        "antiHallucination": {
            "useOnlyKnownOrUserConfirmedFacts": True,
            "unsupportedClaimsMustGoToBlockedByMissingFacts": True,
            "turkishNlpContextIsSeedOnly": True,
        },
    }


def _product_to_facts(product: BuyerIntentRewriteInput) -> dict[str, Any]:
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


def _unsupported_claim_errors(
    generated: GeneratedProductContent,
    known_facts: Mapping[str, Any],
) -> list[str]:
    generated_text = normalize_text(
        " ".join(
            value
            for value in (
                generated.title,
                generated.short_description,
                generated.long_description,
            )
            if value
        )
    )
    known_text = normalize_text(_known_fact_text(known_facts))

    errors: list[str] = []
    for keyword in UNSUPPORTED_CLAIM_KEYWORDS:
        normalized_keyword = normalize_text(keyword)
        if normalized_keyword in generated_text and normalized_keyword not in known_text:
            errors.append(f"Unsupported claim detected in rewrite output: {keyword}.")
    return _dedupe_text(errors)


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
    "BuyerIntentRewriteInput",
    "BuyerIntentRewriteJudgment",
    "RewriteGenerator",
    "run_turkish_buyer_intent_rewrite_strategy",
]
