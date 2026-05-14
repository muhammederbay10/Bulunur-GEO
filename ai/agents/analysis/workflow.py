# ai/agents/analysis/workflow.py
"""Builds the LangGraph workflow for GEO product analysis."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from importlib import import_module
from typing import Any

from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.product_input import ProductInput
from ai.agents.analysis.state import AnalysisGraphState, create_initial_analysis_state


AnalysisNode = Callable[[AnalysisGraphState], Mapping[str, Any] | AnalysisGraphState]

NODE_ORDER: tuple[str, ...] = (
    "prepare_input",
    "detect_category",
    "expand_turkish_intents",
    "score_retrieval",
    "score_machine_understanding",
    "score_reranking",
    "score_answer_readiness",
    "build_analysis_output",
)

NODE_IMPORTS: dict[str, tuple[str, str]] = {
    "prepare_input": (
        "ai.agents.analysis.nodes.prepare_input",
        "prepare_input",
    ),
    "detect_category": (
        "ai.agents.analysis.nodes.detect_category",
        "detect_category",
    ),
    "expand_turkish_intents": (
        "ai.agents.analysis.nodes.expand_turkish_intents",
        "expand_turkish_intents",
    ),
    "score_retrieval": (
        "ai.agents.analysis.nodes.score_retrieval",
        "score_retrieval",
    ),
    "score_machine_understanding": (
        "ai.agents.analysis.nodes.score_machine_understanding",
        "score_machine_understanding",
    ),
    "score_reranking": (
        "ai.agents.analysis.nodes.score_reranking",
        "score_reranking",
    ),
    "score_answer_readiness": (
        "ai.agents.analysis.nodes.score_answer_readiness",
        "score_answer_readiness",
    ),
    "build_analysis_output": (
        "ai.agents.analysis.nodes.build_analysis_output",
        "build_analysis_output",
    ),
}


def build_analysis_workflow() -> Any:
    """Build and compile the GEO analysis LangGraph workflow."""
    try:
        from langgraph.graph import END, START, StateGraph
    except ImportError as exc:
        raise ImportError(
            "LangGraph is required for the GEO analysis workflow. "
            "Install the ai project dependencies from ai/pyproject.toml."
        ) from exc

    graph = StateGraph(AnalysisGraphState)
    for node_name in NODE_ORDER:
        graph.add_node(node_name, _load_node(node_name))

    graph.add_edge(START, NODE_ORDER[0])
    for current_node, next_node in zip(NODE_ORDER, NODE_ORDER[1:]):
        graph.add_edge(current_node, next_node)
    graph.add_edge(NODE_ORDER[-1], END)

    return graph.compile()


def analyze_product(product_input: ProductInput | Mapping[str, Any]) -> GeoAnalysisOutput:
    """Run the compiled analysis graph and return the public analysis output."""
    product = (
        product_input
        if isinstance(product_input, ProductInput)
        else ProductInput.model_validate(product_input)
    )
    final_state = build_analysis_workflow().invoke(create_initial_analysis_state(product))
    output = final_state.get("final_output")
    if not isinstance(output, GeoAnalysisOutput):
        raise ValueError("analysis workflow completed without final_output")
    return output


def _load_node(node_name: str) -> AnalysisNode:
    module_path, function_name = NODE_IMPORTS[node_name]
    module = import_module(module_path)
    node = getattr(module, function_name, None)
    if node is None or not callable(node):
        raise AttributeError(
            f"{module_path} must define callable {function_name}()"
        )
    return node


__all__ = [
    "NODE_IMPORTS",
    "NODE_ORDER",
    "analyze_product",
    "build_analysis_workflow",
]
