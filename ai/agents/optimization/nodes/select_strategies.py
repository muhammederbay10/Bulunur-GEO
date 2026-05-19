# ai/agents/optimization/nodes/select_strategies.py
"""Selects and optionally prioritizes GEO optimization strategies."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ai.agents.optimization.state import OptimizationGraphState, OptimizationWeakness
from ai.geo_engine.improvement.select_strategies import select_strategies as select_rules
from ai.geo_engine.strategies.base import (
    ImprovementStrategySelection,
    STRATEGY_BUYER_INTENT_REWRITE,
    STRATEGY_DISPLAY_NAMES,
    STRATEGY_PRIORITY,
    STRATEGY_SKILL_PATHS,
    STRATEGY_TARGET_LAYERS,
    StrategyId,
    StrategySelectionResult,
)
from ai.geo_engine.types import GeoScoreLayer
from ai.llm.gemini_client import get_gemini_llm
from ai.llm.safety import LLMError, invoke_with_safety
from ai.llm.skill_loader import build_skill_prompt
from ai.llm.structured_outputs import parse_structured_output


STRATEGY_SELECTION_SKILL_PATH = "optimization/strategy_selection"
USE_GEMINI_METADATA_KEY = "useGeminiStrategyPrioritization"
USE_SEMANTIC_CONTENT_JUDGMENT_METADATA_KEY = "useSemanticContentJudgment"
MAX_STRATEGIES_METADATA_KEY = "maxStrategies"
IMPLEMENTED_STRATEGY_IDS = set(STRATEGY_DISPLAY_NAMES)
StrategyPrioritizer = Callable[[dict[str, Any]], Any]
SemanticContentEvaluator = Callable[[dict[str, Any]], Any]


class SemanticContentJudgment(BaseModel):
    """Gemini judgment for whether product copy is semantically thin."""

    model_config = ConfigDict(populate_by_name=True)

    is_thin: bool = Field(alias="isThin")
    confidence: float = Field(default=0.0, ge=0, le=1)
    reasons: list[str] = Field(default_factory=list)
    recommended_strategy: StrategyId | None = Field(
        default=None,
        alias="recommendedStrategy",
    )

    @field_validator("reasons", mode="before")
    @classmethod
    def normalize_reasons(cls, values: Any) -> list[str]:
        """Normalize semantic thin-content reasons."""
        return _dedupe_text(values)


class GeminiStrategyChoice(BaseModel):
    """One Gemini prioritization choice constrained to deterministic candidates."""

    model_config = ConfigDict(populate_by_name=True)

    strategy_key: StrategyId = Field(alias="strategyKey")
    priority: int = Field(ge=1, le=6)
    target_layer: GeoScoreLayer | None = Field(default=None, alias="targetLayer")
    reason: str = Field(min_length=1)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        """Reject blank prioritization reasons."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("reason cannot be blank")
        return normalized


class GeminiStrategyPrioritization(BaseModel):
    """Structured Gemini response for strategy ordering and explanations."""

    model_config = ConfigDict(populate_by_name=True)

    selected_strategies: list[GeminiStrategyChoice] = Field(
        default_factory=list,
        alias="selectedStrategies",
    )
    strategy_summary: str | None = Field(default=None, alias="strategySummary")
    missing_facts_to_confirm: list[str] = Field(
        default_factory=list,
        alias="missingFactsToConfirm",
    )

    @field_validator("missing_facts_to_confirm", mode="before")
    @classmethod
    def normalize_missing_facts(cls, values: Any) -> list[str]:
        """Normalize missing fact suggestions from Gemini."""
        return _dedupe_text(values)

    @field_validator("strategy_summary")
    @classmethod
    def strip_optional_summary(cls, value: str | None) -> str | None:
        """Normalize optional strategy summary text."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_unique_strategy_keys(self) -> "GeminiStrategyPrioritization":
        """Prevent duplicate strategy choices from changing deterministic intent."""
        seen: set[str] = set()
        deduped: list[GeminiStrategyChoice] = []
        for strategy in self.selected_strategies:
            if strategy.strategy_key in seen:
                continue
            seen.add(strategy.strategy_key)
            deduped.append(strategy)
        self.selected_strategies = deduped
        return self


def select_strategies(state: OptimizationGraphState) -> OptimizationGraphState:
    """Select optimization strategies from weakness patterns."""
    metadata = dict(state.get("metadata", {}))
    max_strategies = int(metadata.get(MAX_STRATEGIES_METADATA_KEY, 4))
    return select_optimization_strategies(
        state,
        max_strategies=max_strategies,
        use_gemini_prioritization=bool(metadata.get(USE_GEMINI_METADATA_KEY, False)),
        use_semantic_content_judgment=bool(
            metadata.get(USE_SEMANTIC_CONTENT_JUDGMENT_METADATA_KEY, False),
        ),
    )


def select_optimization_strategies(
    state: OptimizationGraphState,
    *,
    max_strategies: int = 4,
    use_gemini_prioritization: bool = False,
    use_semantic_content_judgment: bool = False,
    prioritizer: StrategyPrioritizer | None = None,
    semantic_content_evaluator: SemanticContentEvaluator | None = None,
    llm: Any | None = None,
) -> OptimizationGraphState:
    """Run deterministic selection and optionally let Gemini reprioritize it."""
    deterministic_selection = select_rules(
        state["analysis_output"],
        max_strategies=max_strategies,
    )
    weakness_list = _state_weaknesses(state, deterministic_selection)
    selection = deterministic_selection
    metadata = dict(state.get("metadata", {}))
    metadata["strategySelectionMode"] = "deterministic"
    metadata["strategySelectionProductAgnostic"] = True

    if use_semantic_content_judgment:
        try:
            content_judgment = _run_semantic_content_judgment(
                _semantic_content_context(state),
                evaluator=semantic_content_evaluator,
                llm=llm,
            )
            metadata["semanticContentJudgment"] = content_judgment.model_dump(
                mode="json",
                by_alias=True,
            )
            selection = _apply_semantic_content_judgment(selection, content_judgment)
        except LLMError as exc:
            metadata["semanticContentJudgmentError"] = str(exc)
            metadata["semanticContentJudgmentRetryable"] = exc.retryable
        except Exception as exc:
            metadata["semanticContentJudgmentError"] = str(exc)
            metadata["semanticContentJudgmentRetryable"] = False

    if use_gemini_prioritization or prioritizer is not None:
        context = _gemini_prioritization_context(
            state,
            deterministic_selection=selection,
            weakness_list=weakness_list,
        )
        try:
            judgment = _run_gemini_prioritization(
                context,
                prioritizer=prioritizer,
                llm=llm,
            )
            selection = _apply_gemini_prioritization(
                deterministic_selection,
                judgment,
            )
            metadata["strategySelectionMode"] = "deterministic_plus_gemini"
            metadata["strategySelectionSummary"] = judgment.strategy_summary
            metadata["geminiMissingFactsToConfirm"] = judgment.missing_facts_to_confirm
        except LLMError as exc:
            metadata["strategySelectionGeminiError"] = str(exc)
            metadata["strategySelectionGeminiRetryable"] = exc.retryable
        except Exception as exc:
            metadata["strategySelectionGeminiError"] = str(exc)
            metadata["strategySelectionGeminiRetryable"] = False

    selected = selection.selected_strategies
    return {
        **state,
        "strategy_selection": selection,
        # Convenience copy for later graph nodes.
        "selected_strategies": selected,
        "metadata": metadata,
    }


def _state_weaknesses(
    state: OptimizationGraphState,
    deterministic_selection: StrategySelectionResult,
) -> list[OptimizationWeakness]:
    weaknesses = state.get("weakness_list")
    if weaknesses:
        return weaknesses
    return [
        OptimizationWeakness(
            layer=layer,
            score=_layer_score(state, layer),
            missingSignals=[],
            reason=f"{layer} katmani strateji secimi icin zayiflik sinyali olarak kullanildi.",
        )
        for layer in deterministic_selection.weakest_layers
    ]


def _run_gemini_prioritization(
    context: dict[str, Any],
    *,
    prioritizer: StrategyPrioritizer | None,
    llm: Any | None,
) -> GeminiStrategyPrioritization:
    if prioritizer is not None:
        raw_output = prioritizer(context)
        if isinstance(raw_output, GeminiStrategyPrioritization):
            return raw_output
        return GeminiStrategyPrioritization.model_validate(raw_output)

    resolved_llm = llm or get_gemini_llm(json_mode=True)
    prompt = build_skill_prompt(
        STRATEGY_SELECTION_SKILL_PATH,
        extra_context=context,
    )
    response = invoke_with_safety(
        resolved_llm,
        prompt,
        operation="optimization_strategy_prioritization",
    )
    return parse_structured_output(response, GeminiStrategyPrioritization)


def _run_semantic_content_judgment(
    context: dict[str, Any],
    *,
    evaluator: SemanticContentEvaluator | None,
    llm: Any | None,
) -> SemanticContentJudgment:
    if evaluator is not None:
        raw_output = evaluator(context)
        if isinstance(raw_output, SemanticContentJudgment):
            return raw_output
        return SemanticContentJudgment.model_validate(raw_output)

    resolved_llm = llm or get_gemini_llm(json_mode=True)
    prompt = build_skill_prompt(
        STRATEGY_SELECTION_SKILL_PATH,
        extra_context={
            "task": "semantic_content_thinness_judgment",
            **context,
        },
    )
    response = invoke_with_safety(
        resolved_llm,
        prompt,
        operation="semantic_content_thinness_judgment",
    )
    return parse_structured_output(response, SemanticContentJudgment)


def _apply_semantic_content_judgment(
    selection: StrategySelectionResult,
    judgment: SemanticContentJudgment,
) -> StrategySelectionResult:
    if not judgment.is_thin:
        return selection
    selected = list(selection.selected_strategies)
    if any(strategy.strategy_id == STRATEGY_BUYER_INTENT_REWRITE for strategy in selected):
        return selection

    reason = _semantic_buyer_intent_reason(judgment)
    selected.append(
        ImprovementStrategySelection(
            strategyId=STRATEGY_BUYER_INTENT_REWRITE,
            name=STRATEGY_DISPLAY_NAMES[STRATEGY_BUYER_INTENT_REWRITE],
            skillPath=STRATEGY_SKILL_PATHS[STRATEGY_BUYER_INTENT_REWRITE],
            targetLayers=list(STRATEGY_TARGET_LAYERS[STRATEGY_BUYER_INTENT_REWRITE]),
            reason=reason,
            priority=STRATEGY_PRIORITY[STRATEGY_BUYER_INTENT_REWRITE],
        )
    )
    ordered = sorted(selected, key=lambda strategy: (strategy.priority, strategy.name))
    return StrategySelectionResult(
        selectedStrategies=ordered,
        weakestLayers=selection.weakest_layers,
        strategyReasons={strategy.strategy_id: strategy.reason for strategy in ordered},
    )


def _semantic_buyer_intent_reason(judgment: SemanticContentJudgment) -> str:
    reason = judgment.reasons[0] if judgment.reasons else ""
    if reason:
        return (
            "Turkish Buyer Intent Rewrite secildi cunku Gemini urun icerigini "
            f"semantik olarak zayif buldu: {reason}"
        )
    return (
        "Turkish Buyer Intent Rewrite secildi cunku Gemini urun iceriginin "
        "Turkce alici sorularini guvenli ve anlamli sekilde cevaplamak icin "
        "yeterli olmadigini belirledi."
    )


def _apply_gemini_prioritization(
    deterministic_selection: StrategySelectionResult,
    judgment: GeminiStrategyPrioritization,
) -> StrategySelectionResult:
    deterministic_by_id = {
        strategy.strategy_id: strategy
        for strategy in deterministic_selection.selected_strategies
    }
    ordered_ids = [
        choice.strategy_key
        for choice in sorted(judgment.selected_strategies, key=lambda item: item.priority)
        if choice.strategy_key in deterministic_by_id
    ]
    if not ordered_ids:
        return deterministic_selection

    reason_by_id = {
        choice.strategy_key: choice.reason
        for choice in judgment.selected_strategies
        if choice.strategy_key in deterministic_by_id
    }
    ordered_ids.extend(
        strategy.strategy_id
        for strategy in deterministic_selection.selected_strategies
        if strategy.strategy_id not in ordered_ids
    )
    prioritized = [
        _strategy_with_reason(
            deterministic_by_id[strategy_id],
            reason_by_id.get(strategy_id),
            priority=index + 1,
        )
        for index, strategy_id in enumerate(ordered_ids)
    ]
    return StrategySelectionResult(
        selectedStrategies=prioritized,
        weakestLayers=deterministic_selection.weakest_layers,
        strategyReasons={
            strategy.strategy_id: strategy.reason
            for strategy in prioritized
        },
    )


def _strategy_with_reason(
    strategy: ImprovementStrategySelection,
    reason: str | None,
    *,
    priority: int,
) -> ImprovementStrategySelection:
    return strategy.model_copy(
        update={
            "reason": reason or strategy.reason,
            "priority": priority,
        }
    )


def _gemini_prioritization_context(
    state: OptimizationGraphState,
    *,
    deterministic_selection: StrategySelectionResult,
    weakness_list: list[OptimizationWeakness],
) -> dict[str, Any]:
    analysis = state["analysis_output"]
    return {
        "decisionRules": {
            "productAgnostic": True,
            "doNotUseProductCategory": True,
            "chooseOnlyFromDeterministicCandidates": True,
            "doNotInventProductFacts": True,
            "implementedStrategyKeys": sorted(IMPLEMENTED_STRATEGY_IDS),
        },
        "weaknessPatterns": [
            weakness.model_dump(mode="json", by_alias=True)
            for weakness in weakness_list
        ],
        "scoreSummary": {
            "retrieval": analysis.scores.retrieval.score,
            "machineUnderstanding": analysis.scores.machine_understanding.score,
            "rerankingStrength": analysis.scores.reranking_strength.score,
            "aiAnswerReadiness": analysis.scores.ai_answer_readiness.score,
        },
        "knownFactKeys": sorted(_flatten_fact_keys(state.get("known_facts", {}))),
        "missingFacts": list(state.get("missing_facts", analysis.missing_facts)),
        "deterministicCandidates": [
            _strategy_context(strategy)
            for strategy in deterministic_selection.selected_strategies
        ],
        "excludedSignals": [
            "product category labels",
            "fixed supported categories",
            "unsupported product claims",
        ],
    }


def _semantic_content_context(state: OptimizationGraphState) -> dict[str, Any]:
    analysis = state["analysis_output"]
    product = state.get("product_input")
    raw_extracted = product.raw_extracted if product is not None else None
    return {
        "decisionRules": {
            "judgeMeaningNotLength": True,
            "doNotInventProductFacts": True,
            "returnThinOnlyWhenRewriteWouldImproveAnswerability": True,
            "recommendedStrategyWhenThin": STRATEGY_BUYER_INTENT_REWRITE,
        },
        "visibleProductContent": {
            "title": product.title if product is not None else analysis.known_facts.get("title"),
            "shortDescription": (
                product.short_description
                if product is not None
                else analysis.known_facts.get("shortDescription")
            ),
            "description": (
                product.description
                if product is not None
                else analysis.known_facts.get("description")
            ),
            "pageTitle": raw_extracted.page_title if raw_extracted is not None else None,
            "metaDescription": (
                raw_extracted.meta_description if raw_extracted is not None else None
            ),
            "bodyText": raw_extracted.body_text if raw_extracted is not None else None,
        },
        "knownFacts": analysis.known_facts,
        "missingFacts": list(state.get("missing_facts", analysis.missing_facts)),
        "buyerIntentVariants": analysis.buyer_intent_variants,
        "mainProblems": analysis.main_problems,
        "scoreSummary": {
            "retrieval": analysis.scores.retrieval.score,
            "rerankingStrength": analysis.scores.reranking_strength.score,
            "aiAnswerReadiness": analysis.scores.ai_answer_readiness.score,
        },
        "answerReadinessSignals": {
            "reasons": analysis.scores.ai_answer_readiness.reasons,
            "missingSignals": analysis.scores.ai_answer_readiness.missing_signals,
            "recommendedNextAction": (
                analysis.scores.ai_answer_readiness.recommended_next_action
            ),
        },
    }


def _strategy_context(strategy: ImprovementStrategySelection) -> dict[str, Any]:
    return {
        "strategyKey": strategy.strategy_id,
        "name": strategy.name,
        "priority": strategy.priority,
        "targetLayers": strategy.target_layers,
        "reason": strategy.reason,
    }


def _flatten_fact_keys(source: Mapping[str, Any], prefix: str = "") -> list[str]:
    keys: list[str] = []
    for key, value in source.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        keys.append(path)
        if isinstance(value, Mapping):
            keys.extend(_flatten_fact_keys(value, path))
    return _dedupe_text(keys)


def _layer_score(state: OptimizationGraphState, layer: GeoScoreLayer) -> float:
    scores = state["analysis_output"].scores
    if layer == "retrieval":
        return scores.retrieval.score
    if layer == "machine_understanding":
        return scores.machine_understanding.score
    if layer == "reranking_strength":
        return scores.reranking_strength.score
    return scores.ai_answer_readiness.score


def _dedupe_text(values: Any) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        iterable: Iterable[Any] = (values,)
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
    "GeminiStrategyChoice",
    "GeminiStrategyPrioritization",
    "select_optimization_strategies",
    "select_strategies",
]
