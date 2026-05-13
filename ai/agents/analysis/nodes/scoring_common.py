# ai/agents/analysis/nodes/scoring_common.py
"""Shared helpers for analysis score nodes."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from ai.agents.analysis.state import AnalysisGraphState
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import LAYER_SKILL_MAX_SCORES, LAYER_SKILL_PATHS
from ai.geo_engine.types import GeminiLayerJudgment, GeoScoreLayer, LayerScoreResult
from ai.llm.skill_loader import build_skill_prompt, load_skill
from ai.llm.structured_outputs import parse_json_object


SemanticJudgmentGenerator = Callable[[GeoScoreLayer, str], Any]


def get_or_create_semantic_judgment(
    state: AnalysisGraphState,
    *,
    layer: GeoScoreLayer,
    semantic_context: Mapping[str, Any],
) -> tuple[GeminiLayerJudgment, dict[str, Any]]:
    """Return a validated semantic judgment for one scoring layer."""
    if _allows_prefilled_semantic_judgments(state):
        existing = state.get("semantic_judgments", {}).get(layer)
        if isinstance(existing, GeminiLayerJudgment):
            return existing, {
                "layer": layer,
                "source": "state.semantic_judgments",
                "geminiUsed": False,
                "prefilledJudgmentAllowed": True,
            }
        if isinstance(existing, Mapping):
            judgment = coerce_semantic_judgment(layer, existing)
            return judgment, {
                "layer": layer,
                "source": "state.semantic_judgments",
                "geminiUsed": False,
                "prefilledJudgmentAllowed": True,
            }

    prompt = build_layer_prompt(layer=layer, semantic_context=semantic_context)
    raw_output = invoke_semantic_judgment_generator(state, layer, prompt)
    if raw_output is None:
        raise ValueError(f"semantic_judgment is required for {layer} scoring")

    parsed = parse_json_object(raw_output)
    judgment = coerce_semantic_judgment(layer, parsed)
    return judgment, {
        "layer": layer,
        "source": "gemini",
        "geminiUsed": True,
        "skillPath": LAYER_SKILL_PATHS[layer],
    }


def coerce_semantic_judgment(
    layer: GeoScoreLayer,
    data: Mapping[str, Any],
) -> GeminiLayerJudgment:
    """Normalize layer skill score scales into a 0-100 semantic percentage."""
    normalized = dict(data)
    normalized["layer"] = normalized.get("layer") or layer

    if "semanticScore" not in normalized and "semantic_score" not in normalized:
        raw_score = normalized.get("score")
        if raw_score is None:
            raise ValueError(f"{layer} semantic judgment must include score")
        max_score = normalized.get("maxScore", normalized.get("max_score"))
        if max_score is None:
            max_score = _default_skill_max_score(layer)
        normalized["semanticScore"] = float(raw_score) / float(max_score) * 100.0

    return GeminiLayerJudgment.model_validate(normalized)


def build_layer_prompt(
    *,
    layer: GeoScoreLayer,
    semantic_context: Mapping[str, Any],
) -> str:
    """Build a skill prompt for one scoring layer."""
    skill = load_skill(LAYER_SKILL_PATHS[layer])
    return build_skill_prompt(
        skill,
        extra_context={
            "semanticEvaluationContext": dict(semantic_context),
            "outputReminder": "Sadece geçerli JSON döndür.",
        },
    )


def invoke_semantic_judgment_generator(
    state: AnalysisGraphState,
    layer: GeoScoreLayer,
    prompt: str,
) -> Any | None:
    """Invoke an injected generator or Gemini for a semantic layer judgment."""
    injected = _get_injected_generator(state)
    if injected is not None:
        return injected(layer, prompt)

    from ai.llm.gemini_client import get_gemini_llm

    llm = get_gemini_llm(temperature=0.1, max_tokens=1024, json_mode=True)
    return llm.invoke(prompt)


def store_layer_score(
    state: AnalysisGraphState,
    *,
    layer: GeoScoreLayer,
    semantic_judgment: GeminiLayerJudgment,
    layer_score: LayerScoreResult,
    metadata: Mapping[str, Any],
) -> AnalysisGraphState:
    """Store one semantic judgment and score result back into graph state."""
    semantic_judgments = dict(state.get("semantic_judgments", {}))
    semantic_judgments[layer] = semantic_judgment

    layer_scores = dict(state.get("layer_scores", {}))
    layer_scores[layer] = layer_score

    state_metadata = dict(state.get("metadata", {}))
    score_metadata = dict(state_metadata.get("scoreNodes", {}))
    score_metadata[layer] = {
        **dict(metadata),
        "score": layer_score.score,
        "weightedPoints": layer_score.weighted_points,
    }
    state_metadata["scoreNodes"] = score_metadata

    return {
        **state,
        "semantic_judgments": semantic_judgments,
        "layer_scores": layer_scores,
        "metadata": state_metadata,
    }


def product_for_scoring(state: AnalysisGraphState) -> ProductInput:
    """Return product input with graph-detected category applied when present."""
    product = state.get("product_input")
    if not isinstance(product, ProductInput):
        raise ValueError("score node requires product_input in analysis state")

    detected_category = state.get("detected_category")
    if detected_category and detected_category != product.category:
        return product.model_copy(update={"category": detected_category})
    return product


def _get_injected_generator(state: AnalysisGraphState) -> SemanticJudgmentGenerator | None:
    metadata = state.get("metadata", {})
    generator = None
    if isinstance(metadata, Mapping):
        generator = metadata.get("semanticJudgmentGenerator") or metadata.get(
            "semantic_judgment_generator"
        )
    return generator if callable(generator) else None


def _allows_prefilled_semantic_judgments(state: AnalysisGraphState) -> bool:
    metadata = state.get("metadata", {})
    if not isinstance(metadata, Mapping):
        return False
    return bool(
        metadata.get("allowPrefilledSemanticJudgments")
        or metadata.get("allow_prefilled_semantic_judgments")
    )


def _default_skill_max_score(layer: GeoScoreLayer) -> float:
    return LAYER_SKILL_MAX_SCORES[layer]


__all__ = [
    "SemanticJudgmentGenerator",
    "build_layer_prompt",
    "coerce_semantic_judgment",
    "get_or_create_semantic_judgment",
    "invoke_semantic_judgment_generator",
    "product_for_scoring",
    "store_layer_score",
]
