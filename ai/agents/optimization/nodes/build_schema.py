# ai/agents/optimization/nodes/build_schema.py
"""Builds final Product JSON-LD through the deterministic schema engine."""

from __future__ import annotations

from typing import Any

from ai.agents.optimization.state import (
    OptimizationGeneratedState,
    OptimizationGraphState,
)
from ai.api_contracts.geo_improvement_output import GeneratedProductContent
from ai.schema_engine.build_product_schema import build_product_schema
from ai.schema_engine.types import ProductSchemaBuildResult, SchemaValidationResult
from ai.schema_engine.validate_schema import validate_schema


def build_schema(state: OptimizationGraphState) -> OptimizationGraphState:
    """Attach deterministic Product JSON-LD to generated improvements."""
    build_result = _build_schema_from_state(state)
    validation_result = validate_schema(build_result.schema_json_ld)
    generated_state = _generated_state_with_schema(
        state.get("generated_improvements"),
        build_result=build_result,
        validation_result=validation_result,
    )
    metadata = dict(state.get("metadata", {}))
    metadata["schemaBuild"] = {
        "deterministicSchemaEngine": True,
        "usedGemini": False,
        "hasSchema": build_result.has_schema,
        "omittedFields": build_result.omitted_fields,
        "warnings": build_result.warnings,
        "valid": validation_result.valid,
        "offerSchemaPresent": validation_result.offer_schema_present,
    }

    return {
        **state,
        "generated_improvements": generated_state,
        "schema_validation": validation_result,
        "metadata": metadata,
    }


def _build_schema_from_state(state: OptimizationGraphState) -> ProductSchemaBuildResult:
    fact_state = state.get("fact_state")
    return build_product_schema(
        state["product_input"],
        trusted_facts=state.get("known_facts", state["analysis_output"].known_facts),
        user_confirmed_facts=fact_state.user_confirmed_facts if fact_state else None,
    )


def _generated_state_with_schema(
    generated_state: OptimizationGeneratedState | None,
    *,
    build_result: ProductSchemaBuildResult,
    validation_result: SchemaValidationResult,
) -> OptimizationGeneratedState:
    current_state = generated_state or OptimizationGeneratedState()
    generated_content = _content_with_schema(
        current_state.content,
        build_result.schema_json_ld,
    )
    return current_state.model_copy(
        update={
            "content": generated_content,
            "warnings": _dedupe_text(
                [
                    *current_state.warnings,
                    *build_result.warnings,
                    *validation_result.warnings,
                ]
            ),
            "errors": _dedupe_text(
                [
                    *current_state.errors,
                    *(
                        issue.message
                        for issue in build_result.issues
                        if issue.severity == "error"
                    ),
                    *validation_result.errors,
                ]
            ),
        }
    )


def _content_with_schema(
    generated: GeneratedProductContent,
    schema_json_ld: dict[str, Any],
) -> GeneratedProductContent:
    return generated.model_copy(update={"schema_json_ld": schema_json_ld}, deep=True)


def _dedupe_text(values: Any) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        iterable = (values,)
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


__all__ = ["build_schema"]
