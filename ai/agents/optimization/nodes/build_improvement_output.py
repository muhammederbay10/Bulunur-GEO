# ai/agents/optimization/nodes/build_improvement_output.py
"""Builds the public GeoImprovementOutput from optimization graph state."""

from __future__ import annotations

from typing import Any

from ai.agents.optimization.state import OptimizationGraphState
from ai.api_contracts.geo_improvement_output import (
    BeforeAfterChange,
    GeneratedProductContent,
    GeoImprovementOutput,
    ImprovementValidation,
    SelectedStrategy,
)


def build_improvement_output(state: OptimizationGraphState) -> OptimizationGraphState:
    """Store the final public improvement output in graph state."""
    generated = _generated_content(state)
    validation = _api_validation(state)
    validation = _validation_with_score_estimate_errors(state, validation)
    needs_user_input = list(state.get("user_fact_questions", []))
    before_after = state.get("before_after") or _build_before_after(state, generated)

    output = GeoImprovementOutput(
        selectedStrategies=_selected_api_strategies(state),
        needsUserInput=needs_user_input,
        userConfirmedFacts=_user_confirmed_facts(state),
        generated=generated,
        validation=validation,
        scoreEstimate=_score_estimate(state),
        beforeAfter=before_after,
    )

    return {
        **state,
        "before_after": before_after,
        "final_output": output,
    }


def _generated_content(state: OptimizationGraphState) -> GeneratedProductContent:
    generated_state = state.get("generated_improvements")
    if generated_state is None:
        return GeneratedProductContent()
    return generated_state.content


def _api_validation(state: OptimizationGraphState) -> ImprovementValidation:
    validation = state.get("validation_results")
    if validation is not None:
        api_validation = validation.to_api_validation()
    elif state.get("user_fact_questions"):
        api_validation = ImprovementValidation(
            passed=False,
            warnings=[],
            errors=[
                "Final iyilestirmelerin dogrulamadan gecmesi icin once kullanici girdisi gerekli.",
            ],
        )
    else:
        api_validation = ImprovementValidation(
            passed=False,
            warnings=[],
            errors=["Optimizasyon dogrulamasi henuz calismadi."],
        )

    if state.get("user_fact_questions") and api_validation.passed:
        return ImprovementValidation(
            passed=False,
            warnings=api_validation.warnings,
            errors=[
                *api_validation.errors,
                "Final iyilestirmelerin dogrulamadan gecmesi icin once kullanici girdisi gerekli.",
            ],
        )
    return api_validation


def _validation_with_score_estimate_errors(
    state: OptimizationGraphState,
    validation: ImprovementValidation,
) -> ImprovementValidation:
    estimate = state.get("estimated_score")
    if estimate is None:
        return validation
    try:
        estimate.to_api_score_estimate()
    except ValueError as exc:
        return ImprovementValidation(
            passed=False,
            warnings=validation.warnings,
            errors=[
                *validation.errors,
                f"Iyilestirme skor tahminini dusuruyor veya yayinlanabilir degil: {exc}",
            ],
        )
    return validation


def _score_estimate(state: OptimizationGraphState) -> Any | None:
    estimate = state.get("estimated_score")
    if estimate is None:
        return None
    try:
        return estimate.to_api_score_estimate()
    except ValueError:
        return None


def _selected_api_strategies(state: OptimizationGraphState) -> list[SelectedStrategy]:
    selected = state.get("selected_strategies", [])
    if not selected:
        strategy_selection = state.get("strategy_selection")
        if strategy_selection is not None:
            selected = strategy_selection.selected_strategies
    return [strategy.to_api_strategy() for strategy in selected]


def _build_before_after(
    state: OptimizationGraphState,
    generated: GeneratedProductContent,
) -> dict[str, BeforeAfterChange]:
    product = state.get("product_input")
    changes: dict[str, BeforeAfterChange] = {}
    if product is None:
        return changes

    _add_change(changes, "title", product.title, generated.title)
    _add_change(
        changes,
        "shortDescription",
        product.short_description,
        generated.short_description,
    )
    _add_change(
        changes,
        "longDescription",
        product.description,
        generated.long_description,
    )
    if generated.schema_json_ld:
        changes["schemaJsonLd"] = BeforeAfterChange(
            before=None,
            after="Generated Product JSON-LD",
        )
    if generated.faq:
        changes["faq"] = BeforeAfterChange(
            before=None,
            after=f"{len(generated.faq)} generated FAQ item(s)",
        )
    return changes


def _add_change(
    changes: dict[str, BeforeAfterChange],
    field: str,
    before: str | None,
    after: str | None,
) -> None:
    if not after:
        return
    if (before or "").strip() == after.strip():
        return
    changes[field] = BeforeAfterChange(before=before, after=after)


def _user_confirmed_facts(state: OptimizationGraphState) -> dict[str, Any]:
    fact_state = state.get("fact_state")
    if fact_state is None:
        return {}
    return dict(fact_state.user_confirmed_facts)


__all__ = ["build_improvement_output"]
