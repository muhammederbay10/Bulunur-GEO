# ai/schema_engine/validate_schema.py
"""Validates Schema.org Product JSON-LD with deterministic rules."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.schema_engine.extract_schema import extract_schema
from ai.schema_engine.schema_mapping import (
    get_schema_types,
    is_known_value,
    normalize_availability,
    normalize_currency,
    normalize_price,
)
from ai.schema_engine.types import (
    ExtractedSchemaEntry,
    JsonObject,
    SchemaExtractionResult,
    SchemaFieldState,
    SchemaFieldStatus,
    SchemaIssue,
    SchemaValidationResult,
)


SchemaValidationInput = (
    JsonObject
    | Sequence[Any]
    | ExtractedSchemaEntry
    | SchemaExtractionResult
)

PRODUCT_REQUIRED_FIELDS = ("@type", "name")
PRODUCT_RECOMMENDED_FIELDS = ("description", "image", "brand", "offers")
OFFER_REQUIRED_FIELDS = ("price", "priceCurrency", "availability")
PRODUCT_TYPE = "product"
OFFER_TYPE = "offer"
GRAPH_KEY = "@graph"


def validate_schema(source: Any) -> SchemaValidationResult:
    """Validate direct schema, extracted schema, ProductInput, or raw payload data."""
    product_schema, source_path, pre_issues = _resolve_product_schema(source)
    if product_schema is None:
        issues = [
            *pre_issues,
            SchemaIssue.error(
                code="missing_product_schema",
                message="No Schema.org Product schema was found.",
                stage="validation",
                path="$",
                field="@type",
                suggestion="Provide a Product JSON-LD object with @type set to Product.",
            ),
        ]
        return SchemaValidationResult(
            valid=False,
            productSchemaPresent=False,
            offerSchemaPresent=False,
            fieldStatuses=[
                _field_status(
                    field="@type",
                    status="missing",
                    required=True,
                    path="$",
                    message="Product schema type is missing.",
                    issue_codes=["missing_product_schema"],
                )
            ],
            issues=_dedupe_issues(issues),
        )

    return validate_product_schema(product_schema, path=source_path, issues=pre_issues)


def validate_product_schema(
    schema_data: Mapping[str, Any],
    *,
    path: str = "$",
    issues: Sequence[SchemaIssue] | None = None,
) -> SchemaValidationResult:
    """Validate one Product JSON-LD object."""
    if not isinstance(schema_data, Mapping):
        validation_issues = [
            *(issues or []),
            SchemaIssue.error(
                code="invalid_schema_object",
                message="Product schema must be a JSON object.",
                stage="validation",
                path=path,
                suggestion="Pass a JSON object that declares @type Product.",
            ),
        ]
        return SchemaValidationResult(
            valid=False,
            productSchemaPresent=False,
            offerSchemaPresent=False,
            fieldStatuses=[],
            issues=_dedupe_issues(validation_issues),
        )

    field_statuses: list[SchemaFieldStatus] = []
    validation_issues = list(issues or [])

    product_type_present = _validate_product_type(schema_data, path, field_statuses, validation_issues)
    if not product_type_present and get_schema_types(schema_data):
        validation_issues = _dedupe_issues(validation_issues)
        return SchemaValidationResult(
            valid=False,
            productSchemaPresent=False,
            offerSchemaPresent=False,
            fieldStatuses=field_statuses,
            issues=validation_issues,
        )

    _validate_known_field(
        schema_data,
        field="name",
        path=f"{path}.name",
        required=True,
        field_statuses=field_statuses,
        issues=validation_issues,
    )

    for field in ("description", "image"):
        _validate_known_field(
            schema_data,
            field=field,
            path=f"{path}.{field}",
            required=False,
            field_statuses=field_statuses,
            issues=validation_issues,
        )

    _validate_brand(schema_data, path, field_statuses, validation_issues)
    offer_schema_present = _validate_offers(schema_data, path, field_statuses, validation_issues)

    validation_issues = _dedupe_issues(validation_issues)
    has_errors = any(issue.severity == "error" for issue in validation_issues)

    return SchemaValidationResult(
        valid=product_type_present and not has_errors,
        productSchemaPresent=product_type_present,
        offerSchemaPresent=offer_schema_present,
        fieldStatuses=field_statuses,
        issues=validation_issues,
    )


def validate_offer_schema(
    offer_data: Any,
    *,
    path: str = "$.offers",
) -> SchemaValidationResult:
    """Validate one Offer JSON-LD object without requiring a parent Product."""
    if not isinstance(offer_data, Mapping):
        issues = [
            SchemaIssue.error(
                code="invalid_offer_schema_object",
                message="Offer schema must be a JSON object.",
                stage="validation",
                path=path,
                field="offers",
                value=offer_data,
                suggestion="Pass an Offer object with price, priceCurrency, and availability.",
            )
        ]
        return SchemaValidationResult(
            valid=False,
            productSchemaPresent=False,
            offerSchemaPresent=False,
            fieldStatuses=[
                _field_status(
                    field="offers",
                    status="invalid",
                    required=True,
                    path=path,
                    value=offer_data,
                    message="Offer schema must be an object.",
                    issue_codes=["invalid_offer_schema_object"],
                )
            ],
            issues=issues,
        )

    field_statuses: list[SchemaFieldStatus] = []
    issues: list[SchemaIssue] = []

    _validate_offer_type(offer_data, path, field_statuses, issues)
    for field in OFFER_REQUIRED_FIELDS:
        _validate_offer_field(
            offer_data,
            field=field,
            path=f"{path}.{field}",
            field_statuses=field_statuses,
            issues=issues,
        )

    issues = _dedupe_issues(issues)
    return SchemaValidationResult(
        valid=not any(issue.severity == "error" for issue in issues),
        productSchemaPresent=False,
        offerSchemaPresent=True,
        fieldStatuses=field_statuses,
        issues=issues,
    )


def _resolve_product_schema(source: Any) -> tuple[JsonObject | None, str, list[SchemaIssue]]:
    if isinstance(source, ExtractedSchemaEntry):
        if source.is_product_schema:
            return source.schema_data, source.path, []
        return None, source.path, []

    if isinstance(source, SchemaExtractionResult):
        issues = _extraction_warnings_to_issues(source.warnings)
        issues.extend(source.issues)
        if source.product_schemas:
            entry = source.product_schemas[0]
            return entry.schema_data, entry.path, issues
        return None, "$", issues

    if isinstance(source, Mapping) and GRAPH_KEY not in source and _looks_like_direct_schema(source):
        return dict(source), "$", []

    extraction = extract_schema(source)
    issues = _extraction_warnings_to_issues(extraction.warnings)
    issues.extend(extraction.issues)
    if extraction.product_schemas:
        entry = extraction.product_schemas[0]
        return entry.schema_data, entry.path, issues

    return None, "$", issues


def _validate_product_type(
    schema_data: Mapping[str, Any],
    path: str,
    field_statuses: list[SchemaFieldStatus],
    issues: list[SchemaIssue],
) -> bool:
    schema_types = get_schema_types(schema_data)
    if not schema_types:
        code = "missing_product_type"
        issues.append(
            SchemaIssue.error(
                code=code,
                message="Product schema is missing @type.",
                stage="validation",
                path=f"{path}.@type",
                field="@type",
                suggestion="Set @type to Product.",
            )
        )
        field_statuses.append(
            _field_status(
                field="@type",
                status="missing",
                required=True,
                path=f"{path}.@type",
                message="Product @type is missing.",
                issue_codes=[code],
            )
        )
        return False

    if PRODUCT_TYPE not in schema_types:
        code = "invalid_product_type"
        issues.append(
            SchemaIssue.error(
                code=code,
                message="Schema object is not a Product schema.",
                stage="validation",
                path=f"{path}.@type",
                field="@type",
                value=schema_data.get("@type", schema_data.get("type")),
                suggestion="Use @type Product for product JSON-LD.",
            )
        )
        field_statuses.append(
            _field_status(
                field="@type",
                status="invalid",
                required=True,
                path=f"{path}.@type",
                value=schema_data.get("@type", schema_data.get("type")),
                message="Schema @type must include Product.",
                issue_codes=[code],
            )
        )
        return False

    field_statuses.append(
        _field_status(
            field="@type",
            status="present",
            required=True,
            path=f"{path}.@type",
            value=schema_data.get("@type", schema_data.get("type")),
        )
    )
    return True


def _validate_known_field(
    schema_data: Mapping[str, Any],
    *,
    field: str,
    path: str,
    required: bool,
    field_statuses: list[SchemaFieldStatus],
    issues: list[SchemaIssue],
) -> None:
    value = schema_data.get(field)
    if is_known_value(value):
        field_statuses.append(
            _field_status(
                field=field,
                status="present",
                required=required,
                path=path,
                value=value,
            )
        )
        return

    severity = SchemaIssue.error if required else SchemaIssue.warning
    code = f"missing_product_{field}"
    issues.append(
        severity(
            code=code,
            message=f"Product schema is missing {field}.",
            stage="validation",
            path=path,
            field=field,
            suggestion=f"Add a trusted {field} value to Product JSON-LD.",
        )
    )
    field_statuses.append(
        _field_status(
            field=field,
            status="missing",
            required=required,
            path=path,
            message=f"Product {field} is missing.",
            issue_codes=[code],
        )
    )


def _validate_brand(
    schema_data: Mapping[str, Any],
    path: str,
    field_statuses: list[SchemaFieldStatus],
    issues: list[SchemaIssue],
) -> None:
    brand = schema_data.get("brand")
    if isinstance(brand, Mapping):
        brand_name = brand.get("name")
        if is_known_value(brand_name):
            field_statuses.append(
                _field_status(
                    field="brand",
                    status="present",
                    path=f"{path}.brand.name",
                    value=brand_name,
                )
            )
            return

        code = "invalid_product_brand"
        issues.append(
            SchemaIssue.warning(
                code=code,
                message="Product brand object is missing a trusted name.",
                stage="validation",
                path=f"{path}.brand",
                field="brand",
                value=brand,
                suggestion="Use a brand string or a Brand object with name.",
            )
        )
        field_statuses.append(
            _field_status(
                field="brand",
                status="invalid",
                path=f"{path}.brand",
                value=brand,
                message="Brand object is missing name.",
                issue_codes=[code],
            )
        )
        return

    if is_known_value(brand):
        field_statuses.append(
            _field_status(
                field="brand",
                status="present",
                path=f"{path}.brand",
                value=brand,
            )
        )
        return

    code = "missing_product_brand"
    issues.append(
        SchemaIssue.warning(
            code=code,
            message="Product schema is missing brand.",
            stage="validation",
            path=f"{path}.brand",
            field="brand",
            suggestion="Add a trusted brand when available.",
        )
    )
    field_statuses.append(
        _field_status(
            field="brand",
            status="missing",
            path=f"{path}.brand",
            message="Product brand is missing.",
            issue_codes=[code],
        )
    )


def _validate_offers(
    schema_data: Mapping[str, Any],
    path: str,
    field_statuses: list[SchemaFieldStatus],
    issues: list[SchemaIssue],
) -> bool:
    offers = schema_data.get("offers")
    if not is_known_value(offers):
        code = "missing_product_offers"
        issues.append(
            SchemaIssue.warning(
                code=code,
                message="Product schema is missing Offer data.",
                stage="validation",
                path=f"{path}.offers",
                field="offers",
                suggestion="Add complete Offer data when price, currency, and availability are trusted.",
            )
        )
        field_statuses.append(
            _field_status(
                field="offers",
                status="missing",
                path=f"{path}.offers",
                message="Product offers are missing.",
                issue_codes=[code],
            )
        )
        return False

    offer_items = _coerce_offer_items(
        offers,
        path=f"{path}.offers",
        field_statuses=field_statuses,
        issues=issues,
    )
    if not offer_items:
        code = "invalid_product_offers"
        issues.append(
            SchemaIssue.error(
                code=code,
                message="Product offers must be an Offer object or a list of Offer objects.",
                stage="validation",
                path=f"{path}.offers",
                field="offers",
                value=offers,
                suggestion="Use an Offer object with price, priceCurrency, and availability.",
            )
        )
        field_statuses.append(
            _field_status(
                field="offers",
                status="invalid",
                required=False,
                path=f"{path}.offers",
                value=offers,
                message="Product offers value is invalid.",
                issue_codes=[code],
            )
        )
        return False

    field_statuses.append(
        _field_status(
            field="offers",
            status="present",
            path=f"{path}.offers",
            value=offers,
        )
    )

    for offer_path, offer in offer_items:
        _validate_offer_type(offer, offer_path, field_statuses, issues)
        for field in OFFER_REQUIRED_FIELDS:
            _validate_offer_field(
                offer,
                field=field,
                path=f"{offer_path}.{field}",
                field_statuses=field_statuses,
                issues=issues,
            )

    return True


def _validate_offer_type(
    offer_data: Mapping[str, Any],
    path: str,
    field_statuses: list[SchemaFieldStatus],
    issues: list[SchemaIssue],
) -> None:
    schema_types = get_schema_types(offer_data)
    if not schema_types:
        code = "missing_offer_type"
        issues.append(
            SchemaIssue.warning(
                code=code,
                message="Offer schema is missing @type.",
                stage="validation",
                path=f"{path}.@type",
                field="@type",
                suggestion="Set offer @type to Offer.",
            )
        )
        field_statuses.append(
            _field_status(
                field="offers.@type",
                status="missing",
                path=f"{path}.@type",
                message="Offer @type is missing.",
                issue_codes=[code],
            )
        )
        return

    if OFFER_TYPE not in schema_types:
        code = "invalid_offer_type"
        issues.append(
            SchemaIssue.error(
                code=code,
                message="Offer schema @type must be Offer.",
                stage="validation",
                path=f"{path}.@type",
                field="@type",
                value=offer_data.get("@type", offer_data.get("type")),
                suggestion="Use @type Offer for Product offers.",
            )
        )
        field_statuses.append(
            _field_status(
                field="offers.@type",
                status="invalid",
                path=f"{path}.@type",
                value=offer_data.get("@type", offer_data.get("type")),
                message="Offer @type is invalid.",
                issue_codes=[code],
            )
        )
        return

    field_statuses.append(
        _field_status(
            field="offers.@type",
            status="present",
            path=f"{path}.@type",
            value=offer_data.get("@type", offer_data.get("type")),
        )
    )


def _validate_offer_field(
    offer_data: Mapping[str, Any],
    *,
    field: str,
    path: str,
    field_statuses: list[SchemaFieldStatus],
    issues: list[SchemaIssue],
) -> None:
    value = offer_data.get(field)
    if not is_known_value(value):
        code = f"missing_offer_{field.casefold()}"
        issues.append(
            SchemaIssue.error(
                code=code,
                message=f"Offer schema is missing {field}.",
                stage="validation",
                path=path,
                field=field,
                suggestion=f"Add trusted Offer {field} or omit the incomplete Offer.",
            )
        )
        field_statuses.append(
            _field_status(
                field=f"offers.{field}",
                status="missing",
                required=True,
                path=path,
                message=f"Offer {field} is missing.",
                issue_codes=[code],
            )
        )
        return

    normalized = _normalize_offer_value(field, value)
    if normalized is None:
        code = f"invalid_offer_{field.casefold()}"
        issues.append(
            SchemaIssue.error(
                code=code,
                message=f"Offer {field} is invalid.",
                stage="validation",
                path=path,
                field=field,
                value=value,
                suggestion=_offer_field_suggestion(field),
            )
        )
        field_statuses.append(
            _field_status(
                field=f"offers.{field}",
                status="invalid",
                required=True,
                path=path,
                value=value,
                message=f"Offer {field} is invalid.",
                issue_codes=[code],
            )
        )
        return

    field_statuses.append(
        _field_status(
            field=f"offers.{field}",
            status="present",
            required=True,
            path=path,
            value=normalized,
        )
    )


def _normalize_offer_value(field: str, value: Any) -> Any | None:
    if field == "price":
        return normalize_price(value)
    if field == "priceCurrency":
        return normalize_currency(value)
    if field == "availability":
        return normalize_availability(value)
    return value if is_known_value(value) else None


def _offer_field_suggestion(field: str) -> str:
    suggestions = {
        "price": "Use a non-negative numeric price such as 149.00.",
        "priceCurrency": "Use a three-letter currency code such as TRY.",
        "availability": "Use a supported Schema.org availability URL such as https://schema.org/InStock.",
    }
    return suggestions.get(field, f"Use a trusted Offer {field} value.")


def _schema_is_product(schema_data: Mapping[str, Any]) -> bool:
    return PRODUCT_TYPE in get_schema_types(schema_data)


def _looks_like_direct_schema(schema_data: Mapping[str, Any]) -> bool:
    if any(key in schema_data for key in ("@context", "@type", "type")):
        return True

    return "name" in schema_data and any(
        field in schema_data for field in PRODUCT_RECOMMENDED_FIELDS
    )


def _coerce_offer_items(
    value: Any,
    *,
    path: str,
    field_statuses: list[SchemaFieldStatus],
    issues: list[SchemaIssue],
) -> list[tuple[str, Mapping[str, Any]]]:
    if isinstance(value, Mapping):
        return [(path, value)]

    if _is_sequence(value):
        items: list[tuple[str, Mapping[str, Any]]] = []
        for index, item in enumerate(value):
            item_path = f"{path}[{index}]"
            if isinstance(item, Mapping):
                items.append((item_path, item))
                continue

            code = "invalid_product_offer_item"
            issues.append(
                SchemaIssue.error(
                    code=code,
                    message="Each Product offers list item must be an Offer object.",
                    stage="validation",
                    path=item_path,
                    field="offers",
                    value=item,
                    suggestion="Remove non-object offer items or replace them with valid Offer objects.",
                )
            )
            field_statuses.append(
                _field_status(
                    field="offers",
                    status="invalid",
                    path=item_path,
                    value=item,
                    message="Offer list item is not an object.",
                    issue_codes=[code],
                )
            )
        return items

    return []


def _field_status(
    *,
    field: str,
    status: SchemaFieldState,
    required: bool = False,
    path: str | None = None,
    value: Any | None = None,
    message: str | None = None,
    issue_codes: list[str] | None = None,
) -> SchemaFieldStatus:
    return SchemaFieldStatus(
        field=field,
        status=status,
        required=required,
        path=path,
        value=value,
        message=message,
        issueCodes=issue_codes or [],
    )


def _extraction_warnings_to_issues(warnings: Sequence[str]) -> list[SchemaIssue]:
    return [
        SchemaIssue.warning(
            code="schema_extraction_warning",
            message=warning,
            stage="extraction",
        )
        for warning in warnings
    ]


def _dedupe_issues(issues: Sequence[SchemaIssue]) -> list[SchemaIssue]:
    deduped: list[SchemaIssue] = []
    seen: set[tuple[str, str | None, str | None, str]] = set()
    for issue in issues:
        key = (issue.code, issue.path, issue.field, issue.message)
        if key not in seen:
            seen.add(key)
            deduped.append(issue)
    return deduped


def _is_sequence(value: Any) -> bool:
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))


__all__ = [
    "validate_offer_schema",
    "validate_product_schema",
    "validate_schema",
]
