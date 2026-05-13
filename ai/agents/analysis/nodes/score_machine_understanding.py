# ai/agents/analysis/nodes/score_machine_understanding.py
"""Scores the machine-understanding layer through the GEO scoring engine."""

from __future__ import annotations

from ai.agents.analysis.nodes.scoring_common import (
    get_or_create_semantic_judgment,
    product_for_scoring,
    store_layer_score,
)
from ai.agents.analysis.state import AnalysisGraphState
from ai.geo_engine.scoring.machine_understanding_score import (
    build_machine_understanding_semantic_context,
    score_machine_understanding as score_machine_understanding_layer,
)


MACHINE_UNDERSTANDING_LAYER = "machine_understanding"


def score_machine_understanding(state: AnalysisGraphState) -> AnalysisGraphState:
    """Call the machine-understanding scoring engine with semantic context."""
    product = product_for_scoring(state)
    schema_validation = state.get("schema_validation")
    semantic_context = build_machine_understanding_semantic_context(
        product,
        schema_validation=schema_validation,
    )
    judgment, metadata = get_or_create_semantic_judgment(
        state,
        layer=MACHINE_UNDERSTANDING_LAYER,
        semantic_context=semantic_context,
    )
    layer_score = score_machine_understanding_layer(
        product,
        schema_validation=schema_validation,
        semantic_judgment=judgment,
    )
    return store_layer_score(
        state,
        layer=MACHINE_UNDERSTANDING_LAYER,
        semantic_judgment=judgment,
        layer_score=layer_score,
        metadata=metadata,
    )


__all__ = ["score_machine_understanding"]
