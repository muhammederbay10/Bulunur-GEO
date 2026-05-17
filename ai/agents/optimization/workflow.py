# ai/agents/optimization/workflow.py
"""Builds the LangGraph workflow for GEO product optimization."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from importlib import import_module
from typing import Any

from ai.agents.optimization.nodes.generate_improvements import (
    FORCE_GENERATION_METADATA_KEY,
)
from ai.agents.optimization.state import (
    OptimizationGraphState,
    create_initial_optimization_state,
)
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.geo_improvement_output import GeoImprovementOutput
from ai.api_contracts.product_input import ProductInput


OptimizationNode = Callable[
    [OptimizationGraphState],
    Mapping[str, Any] | OptimizationGraphState,
]

NODE_ORDER: tuple[str, ...] = (
    "identify_weaknesses",
    "select_strategies",
    "collect_missing_facts",
    "generate_improvements",
    "build_schema",
    "validate_improvements",
    "estimate_improved_score",
    "build_improvement_output",
)

NODE_IMPORTS: dict[str, tuple[str, str]] = {
    "identify_weaknesses": (
        "ai.agents.optimization.nodes.identify_weaknesses",
        "identify_weaknesses",
    ),
    "select_strategies": (
        "ai.agents.optimization.nodes.select_strategies",
        "select_strategies",
    ),
    "collect_missing_facts": (
        "ai.agents.optimization.nodes.collect_missing_facts",
        "collect_missing_facts",
    ),
    "generate_improvements": (
        "ai.agents.optimization.nodes.generate_improvements",
        "generate_improvements",
    ),
    "build_schema": (
        "ai.agents.optimization.nodes.build_schema",
        "build_schema",
    ),
    "validate_improvements": (
        "ai.agents.optimization.nodes.validate_improvements",
        "validate_improvements",
    ),
    "estimate_improved_score": (
        "ai.agents.optimization.nodes.estimate_improved_score",
        "estimate_improved_score",
    ),
    "build_improvement_output": (
        "ai.agents.optimization.nodes.build_improvement_output",
        "build_improvement_output",
    ),
}


def build_optimization_workflow() -> Any:
    """Build and compile the GEO optimization LangGraph workflow."""
    try:
        from langgraph.graph import END, START, StateGraph
    except ImportError as exc:
        raise ImportError(
            "LangGraph is required for the GEO optimization workflow. "
            "Install the ai project dependencies from ai/pyproject.toml."
        ) from exc

    graph = StateGraph(OptimizationGraphState)
    for node_name in NODE_ORDER:
        graph.add_node(node_name, _load_node(node_name))

    graph.add_edge(START, "identify_weaknesses")
    graph.add_edge("identify_weaknesses", "select_strategies")
    graph.add_edge("select_strategies", "collect_missing_facts")
    graph.add_conditional_edges(
        "collect_missing_facts",
        _route_after_missing_facts,
        {
            "needs_user_input": "build_improvement_output",
            "generate": "generate_improvements",
        },
    )
    graph.add_edge("generate_improvements", "build_schema")
    graph.add_edge("build_schema", "validate_improvements")
    graph.add_conditional_edges(
        "validate_improvements",
        _route_after_validation,
        {
            "estimate_score": "estimate_improved_score",
            "build_output": "build_improvement_output",
        },
    )
    graph.add_edge("estimate_improved_score", "build_improvement_output")
    graph.add_edge("build_improvement_output", END)

    return graph.compile()


def improve_product(
    product_input: ProductInput | Mapping[str, Any],
    analysis_output: GeoAnalysisOutput | Mapping[str, Any],
    user_facts: Mapping[str, Any] | None = None,
    *,
    metadata: Mapping[str, Any] | None = None,
) -> GeoImprovementOutput:
    """Run the compiled optimization graph and return public improvement output."""
    final_state = run_optimization_workflow(
        product_input,
        analysis_output,
        user_facts=user_facts,
        metadata=metadata,
    )
    output = final_state.get("final_output")
    if not isinstance(output, GeoImprovementOutput):
        raise ValueError("optimization workflow completed without final_output")
    return output


def run_optimization_workflow(
    product_input: ProductInput | Mapping[str, Any],
    analysis_output: GeoAnalysisOutput | Mapping[str, Any],
    *,
    user_facts: Mapping[str, Any] | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> OptimizationGraphState:
    """Run the optimization graph and return the final graph state."""
    product = (
        product_input
        if isinstance(product_input, ProductInput)
        else ProductInput.model_validate(product_input)
    )
    analysis = (
        analysis_output
        if isinstance(analysis_output, GeoAnalysisOutput)
        else GeoAnalysisOutput.model_validate(analysis_output)
    )
    initial_state = create_initial_optimization_state(
        product,
        analysis,
        user_confirmed_facts=user_facts,
    )
    if metadata:
        initial_state["metadata"] = {
            **initial_state.get("metadata", {}),
            **dict(metadata),
        }
    return build_optimization_workflow().invoke(initial_state)


def _route_after_missing_facts(state: OptimizationGraphState) -> str:
    metadata = state.get("metadata", {})
    if state.get("user_fact_questions") and not metadata.get(
        FORCE_GENERATION_METADATA_KEY,
        False,
    ):
        return "needs_user_input"
    return "generate"


def _route_after_validation(state: OptimizationGraphState) -> str:
    validation = state.get("validation_results")
    if validation is not None and validation.passed:
        return "estimate_score"
    return "build_output"


def _load_node(node_name: str) -> OptimizationNode:
    module_path, function_name = NODE_IMPORTS[node_name]
    module = import_module(module_path)
    node = getattr(module, function_name, None)
    if node is None or not callable(node):
        raise AttributeError(f"{module_path} must define callable {function_name}()")
    return node


__all__ = [
    "NODE_IMPORTS",
    "NODE_ORDER",
    "build_optimization_workflow",
    "improve_product",
    "run_optimization_workflow",
]
