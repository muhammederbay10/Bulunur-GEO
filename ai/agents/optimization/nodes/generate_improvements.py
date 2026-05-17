# ai/agents/optimization/nodes/generate_improvements.py
"""Runs selected optimization strategies to generate reviewable improvements."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.agents.optimization.state import (
    OptimizationGeneratedState,
    OptimizationGraphState,
)
from ai.api_contracts.geo_improvement_output import (
    GeneratedFaqItem,
    GeneratedProductContent,
    SuggestedAttribute,
)
from ai.geo_engine.strategies.attribute_completion import (
    run_attribute_completion_strategy,
)
from ai.geo_engine.strategies.base import (
    ImprovementStrategySelection,
    STRATEGY_ATTRIBUTE_COMPLETION,
    STRATEGY_BUYER_INTENT_REWRITE,
    STRATEGY_FAQ_ENRICHMENT,
    STRATEGY_SCHEMA_REPAIR,
    StrategyExecutionResult,
)
from ai.geo_engine.strategies.schema_repair import run_schema_repair_strategy
from ai.geo_engine.strategies.turkish_buyer_intent_rewrite import (
    run_turkish_buyer_intent_rewrite_strategy,
)
from ai.geo_engine.strategies.turkish_faq_enrichment import (
    run_turkish_faq_enrichment_strategy,
)
from ai.llm.skill_loader import SkillLoaderError, load_skill


FORCE_GENERATION_METADATA_KEY = "forceGenerationWithMissingFacts"


def generate_improvements(state: OptimizationGraphState) -> OptimizationGraphState:
    """Generate safe content using selected strategies and trusted facts."""
    metadata = dict(state.get("metadata", {}))
    pending_questions = state.get("user_fact_questions", [])
    if pending_questions and not metadata.get(FORCE_GENERATION_METADATA_KEY, False):
        metadata["generationSkipped"] = True
        metadata["generationSkipReason"] = "pending_user_fact_questions"
        return {
            **state,
            "generated_improvements": OptimizationGeneratedState(),
            "metadata": metadata,
        }

    generated_state, generation_metadata = run_selected_generation_strategies(state)
    metadata.update(generation_metadata)
    return {
        **state,
        "generated_improvements": generated_state,
        "metadata": metadata,
    }


def run_selected_generation_strategies(
    state: OptimizationGraphState,
) -> tuple[OptimizationGeneratedState, dict[str, Any]]:
    """Execute selected strategies and merge their generated content."""
    selected_strategies = _selected_strategies(state)
    loaded_skill_paths, skill_errors = _load_selected_strategy_skills(selected_strategies)
    trusted_facts = dict(state.get("known_facts", state["analysis_output"].known_facts))
    user_confirmed_facts = _user_confirmed_facts(state)
    missing_facts = list(state.get("missing_facts", state["analysis_output"].missing_facts))
    buyer_intent_variants = _buyer_intent_variants(state)
    turkish_nlp_context = _turkish_nlp_seed_context(state)

    results: list[StrategyExecutionResult] = []
    for strategy in selected_strategies:
        results.append(
            _run_strategy(
                strategy,
                state=state,
                trusted_facts=trusted_facts,
                user_confirmed_facts=user_confirmed_facts,
                missing_facts=missing_facts,
                buyer_intent_variants=buyer_intent_variants,
                turkish_nlp_context=turkish_nlp_context,
            )
        )

    generated_state = OptimizationGeneratedState(
        content=_merge_generated_content(result.generated for result in results),
        strategyResults=results,
        warnings=_dedupe_text(
            [
                *skill_errors,
                *(warning for result in results for warning in result.warnings),
            ]
        ),
        errors=_dedupe_text(error for result in results for error in result.errors),
    )
    return generated_state, {
        "generationSkipped": False,
        "loadedOptimizationSkillPaths": loaded_skill_paths,
        "generationStrategyCount": len(selected_strategies),
        "generationUsedTrustedFactKeys": sorted(_flatten_fact_keys(trusted_facts)),
        "generationUsedUserConfirmedFactKeys": sorted(_flatten_fact_keys(user_confirmed_facts)),
        "turkishNlpSeedContextPassed": bool(turkish_nlp_context),
    }


def _run_strategy(
    strategy: ImprovementStrategySelection,
    *,
    state: OptimizationGraphState,
    trusted_facts: Mapping[str, Any],
    user_confirmed_facts: Mapping[str, Any],
    missing_facts: Sequence[str],
    buyer_intent_variants: Sequence[str],
    turkish_nlp_context: Mapping[str, Any],
) -> StrategyExecutionResult:
    product = state["product_input"]
    try:
        if strategy.strategy_id == STRATEGY_SCHEMA_REPAIR:
            return run_schema_repair_strategy(
                product,
                trusted_facts=trusted_facts,
                user_confirmed_facts=user_confirmed_facts,
            )
        if strategy.strategy_id == STRATEGY_ATTRIBUTE_COMPLETION:
            return run_attribute_completion_strategy(
                product,
                trusted_facts=trusted_facts,
                user_confirmed_facts=user_confirmed_facts,
            )
        if strategy.strategy_id == STRATEGY_BUYER_INTENT_REWRITE:
            return run_turkish_buyer_intent_rewrite_strategy(
                product,
                buyer_intent_variants=buyer_intent_variants,
                missing_facts=missing_facts,
                trusted_facts=trusted_facts,
                user_confirmed_facts=user_confirmed_facts,
                turkish_nlp_context=turkish_nlp_context,
                rewrite_generator=_metadata_callable(state, "rewriteGenerator"),
                llm=_metadata_value(state, "llm"),
            )
        if strategy.strategy_id == STRATEGY_FAQ_ENRICHMENT:
            return run_turkish_faq_enrichment_strategy(
                product,
                buyer_intent_variants=buyer_intent_variants,
                missing_facts=missing_facts,
                trusted_facts=trusted_facts,
                user_confirmed_facts=user_confirmed_facts,
                turkish_nlp_context=turkish_nlp_context,
                faq_generator=_metadata_callable(state, "faqGenerator"),
                llm=_metadata_value(state, "llm"),
            )
    except Exception as exc:
        return StrategyExecutionResult(
            strategyId=strategy.strategy_id,
            name=strategy.name,
            errors=[f"{strategy.name} stratejisi calisirken hata olustu: {exc}"],
            metadata={"strategyExecutionFailed": True},
        )

    return StrategyExecutionResult(
        strategyId=strategy.strategy_id,
        name=strategy.name,
        errors=[f"Secilen strateji desteklenmiyor veya henuz uygulanmadi: {strategy.strategy_id}"],
        metadata={"strategyExecutionFailed": True},
    )


def _merge_generated_content(
    generated_items: Sequence[GeneratedProductContent],
) -> GeneratedProductContent:
    merged_schema: dict[str, Any] = {}
    faq: list[GeneratedFaqItem] = []
    suggested_attributes: list[SuggestedAttribute] = []
    title: str | None = None
    short_description: str | None = None
    long_description: str | None = None
    seo_title: str | None = None
    meta_description: str | None = None
    ai_answer_preview: str | None = None

    for generated in generated_items:
        title = generated.title or title
        short_description = generated.short_description or short_description
        long_description = generated.long_description or long_description
        seo_title = generated.seo_title or seo_title
        meta_description = generated.meta_description or meta_description
        ai_answer_preview = generated.ai_answer_preview or ai_answer_preview
        faq.extend(generated.faq)
        suggested_attributes.extend(generated.suggested_attributes)
        if generated.schema_json_ld:
            merged_schema = generated.schema_json_ld

    return GeneratedProductContent(
        title=title,
        shortDescription=short_description,
        longDescription=long_description,
        faq=_dedupe_faq(faq),
        suggestedAttributes=_dedupe_suggested_attributes(suggested_attributes),
        schemaJsonLd=merged_schema,
        seoTitle=seo_title,
        metaDescription=meta_description,
        aiAnswerPreview=ai_answer_preview,
    )


def _load_selected_strategy_skills(
    selected_strategies: Sequence[ImprovementStrategySelection],
) -> tuple[list[str], list[str]]:
    loaded: list[str] = []
    errors: list[str] = []
    for strategy in selected_strategies:
        try:
            skill = load_skill(strategy.skill_path)
            loaded.append(skill.relative_name)
        except SkillLoaderError as exc:
            errors.append(f"{strategy.name} skill dosyasi yuklenemedi: {exc}")
    return loaded, errors


def _selected_strategies(
    state: OptimizationGraphState,
) -> list[ImprovementStrategySelection]:
    strategy_selection = state.get("strategy_selection")
    if strategy_selection is not None:
        return list(strategy_selection.selected_strategies)
    return list(state.get("selected_strategies", []))


def _user_confirmed_facts(state: OptimizationGraphState) -> dict[str, Any]:
    fact_state = state.get("fact_state")
    if fact_state is None:
        return {}
    return dict(fact_state.user_confirmed_facts)


def _buyer_intent_variants(state: OptimizationGraphState) -> list[str]:
    analysis = state["analysis_output"]
    nlp_signals = state.get("turkish_nlp_signals")
    variants = list(analysis.buyer_intent_variants)
    if nlp_signals is not None:
        variants.extend(nlp_signals.buyer_intent_variants)
        variants.extend(nlp_signals.local_buyer_intent_variants)
        variants.extend(nlp_signals.llm_buyer_intent_variants)
    return _dedupe_text(variants)


def _turkish_nlp_seed_context(state: OptimizationGraphState) -> dict[str, Any]:
    nlp_signals = state.get("turkish_nlp_signals")
    if nlp_signals is None:
        return {}
    data = nlp_signals.model_dump(mode="json", by_alias=True)
    return {
        "instruction": (
            "Bu sinyaller yalnizca Turkce dil, alici niyeti ve terim tohumu olarak "
            "kullanilir; dogrulanmis urun gercegi sayilmaz."
        ),
        "signals": data,
    }


def _metadata_value(state: OptimizationGraphState, key: str) -> Any:
    return state.get("metadata", {}).get(key)


def _metadata_callable(state: OptimizationGraphState, key: str) -> Any | None:
    value = _metadata_value(state, key)
    return value if callable(value) else None


def _dedupe_faq(items: Sequence[GeneratedFaqItem]) -> list[GeneratedFaqItem]:
    seen: set[tuple[str, str]] = set()
    deduped: list[GeneratedFaqItem] = []
    for item in items:
        key = (item.question.strip(), item.answer.strip())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _dedupe_suggested_attributes(
    items: Sequence[SuggestedAttribute],
) -> list[SuggestedAttribute]:
    seen: set[str] = set()
    deduped: list[SuggestedAttribute] = []
    for item in items:
        key = item.name.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _flatten_fact_keys(source: Mapping[str, Any], prefix: str = "") -> list[str]:
    keys: list[str] = []
    for key, value in source.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        keys.append(path)
        if isinstance(value, Mapping):
            keys.extend(_flatten_fact_keys(value, path))
    return _dedupe_text(keys)


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

    seen: set[str] = set()
    deduped: list[str] = []
    for raw_value in iterable:
        value = str(raw_value).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


__all__ = [
    "generate_improvements",
    "run_selected_generation_strategies",
]
