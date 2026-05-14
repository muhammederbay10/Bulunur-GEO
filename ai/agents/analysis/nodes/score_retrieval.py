# ai/agents/analysis/nodes/score_retrieval.py
"""Scores the retrieval layer through the GEO scoring engine."""

from __future__ import annotations

from ai.agents.analysis.nodes.scoring_common import (
    get_or_create_semantic_judgment,
    product_for_scoring,
    store_layer_score,
)
from ai.agents.analysis.state import AnalysisGraphState
from ai.geo_engine.scoring.retrieval_score import (
    build_retrieval_semantic_context,
    score_retrieval as score_retrieval_layer,
)


RETRIEVAL_LAYER = "retrieval"


def score_retrieval(state: AnalysisGraphState) -> AnalysisGraphState:
    """Call the retrieval scoring engine with a semantic judgment."""
    product = product_for_scoring(state)
    nlp_signals = state.get("turkish_nlp_signals")
    semantic_context = build_retrieval_semantic_context(
        product,
        nlp_signals=nlp_signals,
    )
    judgment, metadata = get_or_create_semantic_judgment(
        state,
        layer=RETRIEVAL_LAYER,
        semantic_context=semantic_context,
    )
    layer_score = score_retrieval_layer(
        product,
        nlp_signals=nlp_signals,
        semantic_judgment=judgment,
    )
    return store_layer_score(
        state,
        layer=RETRIEVAL_LAYER,
        semantic_judgment=judgment,
        layer_score=layer_score,
        metadata=metadata,
    )


__all__ = ["score_retrieval"]
