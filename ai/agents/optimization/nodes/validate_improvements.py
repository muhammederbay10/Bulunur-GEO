# ai/agents/optimization/nodes/validate_improvements.py
"""Validates generated optimization output before score estimation."""

from __future__ import annotations

from typing import Any

from ai.agents.optimization.state import OptimizationGraphState
from ai.geo_engine.improvement.validate_improvement import (
    ImprovementValidationResult,
    ValidationIssue,
    validate_trusted_fact_usage,
)


USE_SEMANTIC_VALIDATION_METADATA_KEY = "useSemanticValidation"
SEMANTIC_VALIDATOR_METADATA_KEY = "semanticValidator"


def validate_improvements(state: OptimizationGraphState) -> OptimizationGraphState:
    """Validate generated content for grounding, schema, claims, and Turkish quality."""
    metadata = dict(state.get("metadata", {}))
    generated_state = state.get("generated_improvements")
    generated_content = generated_state.content if generated_state is not None else None
    if generated_content is None:
        validation = ImprovementValidationResult(
            issues=[
                ValidationIssue(
                    severity="error",
                    code="missing_generated_content",
                    message="Dogrulanacak uretilmis optimizasyon ciktisi yok.",
                    field="generated",
                    suggestion="Dogrulama oncesinde generate_improvements node'unu calistirin.",
                )
            ]
        )
        return {
            **state,
            "validation_results": validation,
            "metadata": _metadata_with_validation(metadata, validation, semantic_used=False),
        }

    semantic_validator = _metadata_callable(state, SEMANTIC_VALIDATOR_METADATA_KEY)
    semantic_requested = bool(
        metadata.get(USE_SEMANTIC_VALIDATION_METADATA_KEY, True)
        or semantic_validator is not None
    )
    fact_state = state.get("fact_state")
    validation = validate_trusted_fact_usage(
        generated_content,
        product=state.get("product_input"),
        trusted_facts=state.get("known_facts", state["analysis_output"].known_facts),
        user_confirmed_facts=fact_state.user_confirmed_facts if fact_state else None,
        use_semantic_validation=semantic_requested,
        semantic_validator=semantic_validator,
        llm=metadata.get("llm"),
    )
    validation = _with_generation_errors(validation, generated_state.errors if generated_state else [])

    return {
        **state,
        "validation_results": validation,
        "metadata": _metadata_with_validation(
            metadata,
            validation,
            semantic_used=semantic_requested,
        ),
    }


def _with_generation_errors(
    validation: ImprovementValidationResult,
    generation_errors: list[str],
) -> ImprovementValidationResult:
    issues = list(validation.issues)
    for error in generation_errors:
        issues.append(
            ValidationIssue(
                severity="error",
                code="strategy_generation_error",
                message=error,
                field="generated.strategyResults",
                suggestion="Strateji ciktisini yayinlamadan once hatayi giderin.",
            )
        )
    return ImprovementValidationResult(
        issues=_dedupe_issues(issues),
        trustedFacts=validation.trusted_facts,
    )


def _metadata_with_validation(
    metadata: dict[str, Any],
    validation: ImprovementValidationResult,
    *,
    semantic_used: bool,
) -> dict[str, Any]:
    updated = dict(metadata)
    updated["validation"] = {
        "passed": validation.passed,
        "errorCount": len(validation.errors),
        "warningCount": len(validation.warnings),
        "issueCodes": [issue.code for issue in validation.issues],
        "checks": {
            "unsupportedClaims": True,
            "knownFactGrounding": True,
            "schemaConsistency": True,
            "turkishNaturalness": semantic_used,
            "keywordStuffing": semantic_used,
        },
    }
    return updated


def _metadata_callable(state: OptimizationGraphState, key: str) -> Any | None:
    value = state.get("metadata", {}).get(key)
    return value if callable(value) else None


def _dedupe_issues(issues: list[ValidationIssue]) -> list[ValidationIssue]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[ValidationIssue] = []
    for issue in issues:
        key = (issue.code, issue.field, issue.value or issue.message)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(issue)
    return deduped


__all__ = ["validate_improvements"]
