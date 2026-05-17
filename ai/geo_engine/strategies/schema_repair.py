# ai/geo_engine/strategies/schema_repair.py
"""Repairs Product JSON-LD using the deterministic schema engine."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ai.api_contracts.geo_improvement_output import GeneratedProductContent
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.strategies.base import (
    STRATEGY_DISPLAY_NAMES,
    STRATEGY_SCHEMA_REPAIR,
    StrategyExecutionResult,
)
from ai.schema_engine.build_product_schema import build_product_schema
from ai.schema_engine.types import ProductSchemaBuildResult, SchemaValidationResult
from ai.schema_engine.validate_schema import validate_schema


SchemaRepairInput = ProductInput | Mapping[str, Any]


def run_schema_repair_strategy(
    product: SchemaRepairInput,
    *,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
) -> StrategyExecutionResult:
    """Build and validate Product JSON-LD from trusted facts only."""
    build_result = build_product_schema(
        product,
        trusted_facts=trusted_facts,
        user_confirmed_facts=user_confirmed_facts,
    )
    validation_result = validate_schema(build_result.schema_json_ld)

    return StrategyExecutionResult(
        strategyId=STRATEGY_SCHEMA_REPAIR,
        name=STRATEGY_DISPLAY_NAMES[STRATEGY_SCHEMA_REPAIR],
        generated=GeneratedProductContent(schemaJsonLd=build_result.schema_json_ld),
        warnings=_build_warnings(build_result, validation_result),
        errors=_build_errors(build_result, validation_result),
        missingFacts=_missing_facts_from_omissions(build_result.omitted_fields),
        metadata={
            "deterministicSchemaEngine": True,
            "build": build_result.model_dump(by_alias=True),
            "validation": validation_result.model_dump(by_alias=True),
        },
    )


def _build_warnings(
    build_result: ProductSchemaBuildResult,
    validation_result: SchemaValidationResult,
) -> list[str]:
    warnings = list(build_result.warnings)
    warnings.extend(issue.message for issue in build_result.issues if issue.severity == "warning")
    warnings.extend(validation_result.warnings)
    return _dedupe_text(warnings)


def _build_errors(
    build_result: ProductSchemaBuildResult,
    validation_result: SchemaValidationResult,
) -> list[str]:
    errors = [issue.message for issue in build_result.issues if issue.severity == "error"]
    errors.extend(validation_result.errors)
    return _dedupe_text(errors)


def _missing_facts_from_omissions(omitted_fields: list[str]) -> list[str]:
    return _dedupe_text(
        _missing_fact_label(field)
        for field in omitted_fields
        if _missing_fact_label(field) is not None
    )


def _missing_fact_label(field: str) -> str | None:
    labels = {
        "offers.price": "price",
        "offers.priceCurrency": "currency",
        "offers.availability": "availability",
        "brand": "brand",
        "image": "imageUrls",
    }
    if field in labels:
        return labels[field]
    if field.startswith("attributes."):
        return "attributes"
    return None


def _dedupe_text(values: Any) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []

    for value in values:
        if value is None:
            continue
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)

    return deduped


__all__ = [
    "SchemaRepairInput",
    "run_schema_repair_strategy",
]
