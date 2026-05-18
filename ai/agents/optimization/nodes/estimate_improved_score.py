# ai/agents/optimization/nodes/estimate_improved_score.py
"""Estimates before/after GEO score by rerunning the scoring engine."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ai.agents.analysis.nodes.scoring_common import (
    build_json_repair_prompt,
    build_layer_prompt,
    coerce_semantic_judgment,
    invoke_semantic_judgment_generator,
)
from ai.agents.optimization.state import OptimizationGraphState
from ai.api_contracts.geo_improvement_output import GeneratedProductContent
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import EXPECTED_LAYER_ORDER
from ai.geo_engine.improvement.estimate_improved_score import (
    estimate_improved_score as run_score_estimation,
)
from ai.geo_engine.scoring.score_product import SemanticJudgmentMap
from ai.geo_engine.types import GeoScoreLayer
from ai.llm.structured_outputs import MalformedJSONError, parse_json_object


SEMANTIC_JUDGMENTS_METADATA_KEYS = (
    "semanticJudgments",
    "semantic_judgments",
    "afterSemanticJudgments",
    "after_semantic_judgments",
)
BEFORE_SEMANTIC_JUDGMENTS_METADATA_KEYS = (
    "beforeSemanticJudgments",
    "before_semantic_judgments",
)


def estimate_improved_score(state: OptimizationGraphState) -> OptimizationGraphState:
    """Estimate score movement for validated generated improvements."""
    metadata = dict(state.get("metadata", {}))
    validation = state.get("validation_results")
    if validation is not None and not validation.passed:
        metadata["scoreEstimation"] = {
            "skipped": True,
            "reason": "validation_failed",
        }
        return {**state, "metadata": metadata}

    generated_state = state.get("generated_improvements")
    if generated_state is None:
        return _with_score_error(
            state,
            "score_estimation_missing_generated_content",
            "Skor tahmini icin graph state icinde generated_improvements bulunmali.",
        )

    semantic_judgments = _semantic_judgments_from_metadata(
        metadata,
        keys=SEMANTIC_JUDGMENTS_METADATA_KEYS,
    )
    if semantic_judgments is None:
        try:
            semantic_judgments = _generate_semantic_judgments(state, generated_state.content)
            metadata["semanticJudgments"] = semantic_judgments
            metadata["scoreEstimationSemanticJudgmentsGenerated"] = True
        except Exception as exc:
            return _with_score_error(
                state,
                "score_estimation_semantic_judgments_failed",
                f"Skor tahmini icin Gemini semantik yargilari uretilemedi: {exc}",
            )

    before_semantic_judgments = _semantic_judgments_from_metadata(
        metadata,
        keys=BEFORE_SEMANTIC_JUDGMENTS_METADATA_KEYS,
        required=False,
    )
    fact_state = state.get("fact_state")

    try:
        estimate = run_score_estimation(
            state["product_input"],
            generated_state.content,
            semantic_judgments=semantic_judgments,
            before_semantic_judgments=before_semantic_judgments,
            known_facts=state.get("known_facts", state["analysis_output"].known_facts),
            user_confirmed_facts=fact_state.user_confirmed_facts if fact_state else None,
            missing_facts=state.get("missing_facts", state["analysis_output"].missing_facts),
        )
    except Exception as exc:
        return _with_score_error(
            state,
            "score_estimation_failed",
            f"Skor tahmini basarisiz oldu: {exc}",
        )

    metadata["scoreEstimation"] = {
        "skipped": False,
        "scoringEngineReused": estimate.metadata.get("scoringEngineReused", True),
        "before": estimate.before,
        "after": estimate.after,
        "gain": estimate.gain,
        "expectedGainReasons": estimate.expected_gain_reasons,
    }
    return {
        **state,
        "estimated_score": estimate,
        "metadata": metadata,
    }


def _semantic_judgments_from_metadata(
    metadata: Mapping[str, Any],
    *,
    keys: tuple[str, ...],
    required: bool = True,
) -> SemanticJudgmentMap | None:
    for key in keys:
        value = metadata.get(key)
        if isinstance(value, Mapping):
            if required:
                _validate_semantic_layers(value)
            return value
    return None


def _validate_semantic_layers(semantic_judgments: Mapping[str, Any]) -> None:
    missing = [layer for layer in EXPECTED_LAYER_ORDER if layer not in semantic_judgments]
    if missing:
        joined = ", ".join(missing)
        raise ValueError(f"semantic judgments missing layers: {joined}")


def _generate_semantic_judgments(
    state: OptimizationGraphState,
    generated_content: GeneratedProductContent,
) -> SemanticJudgmentMap:
    semantic_context = _semantic_context_for_estimation(state, generated_content)
    judgments: dict[GeoScoreLayer, Any] = {}

    for layer in EXPECTED_LAYER_ORDER:
        prompt = build_layer_prompt(
            layer=layer,
            semantic_context={**semantic_context, "layer": layer},
        )
        raw_output = invoke_semantic_judgment_generator(state, layer, prompt)
        if raw_output is None:
            raise ValueError(f"{layer} semantic judgment returned empty output")

        try:
            parsed = parse_json_object(raw_output)
        except MalformedJSONError:
            repair_prompt = build_json_repair_prompt(layer=layer, raw_output=raw_output)
            repaired_output = invoke_semantic_judgment_generator(state, layer, repair_prompt)
            if repaired_output is None:
                raise
            parsed = parse_json_object(repaired_output)

        judgments[layer] = coerce_semantic_judgment(layer, parsed)

    return judgments


def _semantic_context_for_estimation(
    state: OptimizationGraphState,
    generated_content: GeneratedProductContent,
) -> dict[str, Any]:
    product = state["product_input"]
    analysis = state["analysis_output"]
    return {
        "purpose": "estimate_improved_geo_score_after_optimization",
        "product": _product_payload(product),
        "analysis": analysis.model_dump(mode="json", by_alias=True),
        "generatedImprovement": generated_content.model_dump(mode="json", by_alias=True),
        "knownFacts": dict(state.get("known_facts", analysis.known_facts)),
        "missingFacts": list(state.get("missing_facts", analysis.missing_facts)),
        "validation": _validation_payload(state),
        "instruction": (
            "Bu semantik yargi iyilestirme sonrasi tahmini skor icindir. "
            "Yalnizca urun girdisi, analiz sonucu, dogrulanmis gercekler ve "
            "uretilen iyilestirme ciktisini dikkate al."
        ),
    }


def _product_payload(product: ProductInput) -> dict[str, Any]:
    return product.model_dump(mode="json", by_alias=True)


def _validation_payload(state: OptimizationGraphState) -> dict[str, Any]:
    validation = state.get("validation_results")
    if validation is None:
        return {}
    return {
        "passed": validation.passed,
        "warnings": validation.warnings,
        "errors": validation.errors,
    }


def _with_score_error(
    state: OptimizationGraphState,
    code: str,
    message: str,
) -> OptimizationGraphState:
    metadata = dict(state.get("metadata", {}))
    metadata["scoreEstimation"] = {
        "skipped": True,
        "reason": code,
        "error": message,
    }
    errors = [*state.get("errors", []), message]
    return {
        **state,
        "metadata": metadata,
        "errors": errors,
    }


__all__ = ["estimate_improved_score"]
