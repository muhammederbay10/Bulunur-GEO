# ai/agents/analysis/nodes/score_answer_readiness.py
"""Scores the AI-answer-readiness layer through the GEO scoring engine."""

from __future__ import annotations

from ai.agents.analysis.nodes.scoring_common import (
    get_or_create_semantic_judgment,
    product_for_scoring,
    store_layer_score,
)
from ai.agents.analysis.state import AnalysisGraphState
from ai.geo_engine.scoring.answer_readiness_score import (
    build_answer_readiness_semantic_context,
    score_answer_readiness as score_answer_readiness_layer,
)


ANSWER_READINESS_LAYER = "ai_answer_readiness"


def score_answer_readiness(state: AnalysisGraphState) -> AnalysisGraphState:
    """Call the answer-readiness scoring engine with a semantic judgment."""
    product = product_for_scoring(state)
    product_facts = state.get("product_facts")
    known_facts = product_facts.known_facts if hasattr(product_facts, "known_facts") else {}
    missing_facts = state.get("missing_facts", [])
    semantic_context = build_answer_readiness_semantic_context(
        product,
        known_facts=known_facts,
        missing_facts=missing_facts,
    )
    semantic_context["buyerIntentVariants"] = state.get("buyer_intent_variants", [])
    judgment, metadata = get_or_create_semantic_judgment(
        state,
        layer=ANSWER_READINESS_LAYER,
        semantic_context=semantic_context,
    )
    layer_score = score_answer_readiness_layer(
        product,
        semantic_judgment=judgment,
        known_facts=known_facts,
        missing_facts=missing_facts,
    )
    return store_layer_score(
        state,
        layer=ANSWER_READINESS_LAYER,
        semantic_judgment=judgment,
        layer_score=layer_score,
        metadata=metadata,
    )


__all__ = ["score_answer_readiness"]
