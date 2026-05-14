# ai/agents/analysis/nodes/score_reranking.py
"""Scores the reranking-strength layer through the GEO scoring engine."""

from __future__ import annotations

from ai.agents.analysis.nodes.scoring_common import (
    get_or_create_semantic_judgment,
    product_for_scoring,
    store_layer_score,
)
from ai.agents.analysis.state import AnalysisGraphState
from ai.geo_engine.scoring.reranking_score import (
    build_reranking_semantic_context,
    score_reranking_strength,
)


RERANKING_LAYER = "reranking_strength"


def score_reranking(state: AnalysisGraphState) -> AnalysisGraphState:
    """Call the reranking scoring engine with a semantic judgment."""
    product = product_for_scoring(state)
    semantic_context = build_reranking_semantic_context(product)
    semantic_context["buyerIntentVariants"] = state.get("buyer_intent_variants", [])
    judgment, metadata = get_or_create_semantic_judgment(
        state,
        layer=RERANKING_LAYER,
        semantic_context=semantic_context,
    )
    layer_score = score_reranking_strength(
        product,
        semantic_judgment=judgment,
    )
    return store_layer_score(
        state,
        layer=RERANKING_LAYER,
        semantic_judgment=judgment,
        layer_score=layer_score,
        metadata=metadata,
    )


__all__ = ["score_reranking"]
