# ai/schema_engine/types.py
"""Defines shared serializable result types for the schema engine."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


JsonObject = dict[str, Any]

SchemaIssueSeverity = Literal["error", "warning", "info"]
SchemaIssueStage = Literal["extraction", "mapping", "build", "validation"]
SchemaFieldState = Literal["present", "missing", "invalid", "omitted", "unknown"]
SchemaMappingKind = Literal["availability", "currency", "price", "schema_type"]


class SchemaIssue(BaseModel):
    """Structured schema issue that agents and scoring can consume."""

    model_config = ConfigDict(populate_by_name=True)

    severity: SchemaIssueSeverity
    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    stage: SchemaIssueStage
    path: str | None = None
    field: str | None = None
    source: str | None = None
    value: Any | None = None
    suggestion: str | None = None

    @computed_field(alias="isBlocking")
    @property
    def is_blocking(self) -> bool:
        """Return whether this issue should block a valid final schema."""
        return self.severity == "error"

    @classmethod
    def error(
        cls,
        *,
        code: str,
        message: str,
        stage: SchemaIssueStage,
        path: str | None = None,
        field: str | None = None,
        source: str | None = None,
        value: Any | None = None,
        suggestion: str | None = None,
    ) -> "SchemaIssue":
        """Create a blocking schema issue."""
        return cls(
            severity="error",
            code=code,
            message=message,
            stage=stage,
            path=path,
            field=field,
            source=source,
            value=value,
            suggestion=suggestion,
        )

    @classmethod
    def warning(
        cls,
        *,
        code: str,
        message: str,
        stage: SchemaIssueStage,
        path: str | None = None,
        field: str | None = None,
        source: str | None = None,
        value: Any | None = None,
        suggestion: str | None = None,
    ) -> "SchemaIssue":
        """Create a non-blocking schema issue."""
        return cls(
            severity="warning",
            code=code,
            message=message,
            stage=stage,
            path=path,
            field=field,
            source=source,
            value=value,
            suggestion=suggestion,
        )

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        """Normalize issue codes for stable downstream matching."""
        normalized = value.strip().casefold().replace("-", "_").replace(" ", "_")
        if not normalized:
            raise ValueError("code cannot be blank")
        return normalized

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        """Reject blank issue messages."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("message cannot be blank")
        return normalized

    @field_validator("path", "field", "source", "suggestion")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional text fields."""
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class SchemaFieldStatus(BaseModel):
    """Validation status for one Product or Offer schema field."""

    model_config = ConfigDict(populate_by_name=True)

    field: str = Field(min_length=1)
    status: SchemaFieldState
    required: bool = False
    path: str | None = None
    message: str | None = None
    issue_codes: list[str] = Field(default_factory=list, alias="issueCodes")
    value: Any | None = None

    @computed_field(alias="isPresent")
    @property
    def is_present(self) -> bool:
        """Return whether the field exists and has a usable value."""
        return self.status == "present"

    @computed_field(alias="isValid")
    @property
    def is_valid(self) -> bool:
        """Return whether the field should count as valid for scoring."""
        return self.status == "present"

    @field_validator("field")
    @classmethod
    def strip_field(cls, value: str) -> str:
        """Reject blank field names."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("field cannot be blank")
        return normalized

    @field_validator("issue_codes")
    @classmethod
    def normalize_issue_codes(cls, values: list[str]) -> list[str]:
        """Normalize issue code references."""
        normalized_codes: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = value.strip().casefold().replace("-", "_").replace(" ", "_")
            if normalized and normalized not in seen:
                seen.add(normalized)
                normalized_codes.append(normalized)
        return normalized_codes


class ExtractedSchemaEntry(BaseModel):
    """One typed schema node extracted from crawler or direct input data."""

    model_config = ConfigDict(populate_by_name=True)

    schema_data: JsonObject = Field(alias="schema")
    path: str = Field(min_length=1)
    schema_types: list[str] = Field(default_factory=list, alias="schemaTypes")
    source: str = Field(default="unknown", min_length=1)
    source_index: int | None = Field(default=None, ge=0, alias="sourceIndex")

    @computed_field(alias="isProductSchema")
    @property
    def is_product_schema(self) -> bool:
        """Return whether this node declares a Product type."""
        return any(_normalize_schema_type(value) == "product" for value in self.schema_types)

    @field_validator("schema_types")
    @classmethod
    def normalize_schema_types(cls, values: list[str]) -> list[str]:
        """Remove blank schema type values while preserving original labels."""
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            stripped = value.strip()
            key = _normalize_schema_type(stripped)
            if stripped and key not in seen:
                seen.add(key)
                normalized.append(stripped)
        return normalized


class SchemaExtractionResult(BaseModel):
    """Structured output from schema extraction."""

    model_config = ConfigDict(populate_by_name=True)

    all_schemas: list[ExtractedSchemaEntry] = Field(
        default_factory=list,
        alias="allSchemas",
    )
    product_schemas: list[ExtractedSchemaEntry] = Field(
        default_factory=list,
        alias="productSchemas",
    )
    issues: list[SchemaIssue] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @computed_field(alias="hasStructuredData")
    @property
    def has_structured_data(self) -> bool:
        """Return whether any schema nodes were extracted."""
        return bool(self.all_schemas)

    @computed_field(alias="hasProductSchema")
    @property
    def has_product_schema(self) -> bool:
        """Return whether any Product schema nodes were extracted."""
        return bool(self.product_schemas)


class SchemaMappingResult(BaseModel):
    """Result of deterministic value normalization for Schema.org fields."""

    model_config = ConfigDict(populate_by_name=True)

    kind: SchemaMappingKind
    input_value: Any | None = Field(default=None, alias="inputValue")
    normalized_value: Any | None = Field(default=None, alias="normalizedValue")
    valid: bool
    issue: SchemaIssue | None = None


class ProductSchemaBuildResult(BaseModel):
    """Generated Product JSON-LD plus build-time omissions and issues."""

    model_config = ConfigDict(populate_by_name=True)

    schema_json_ld: JsonObject = Field(default_factory=dict, alias="schemaJsonLd")
    issues: list[SchemaIssue] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    omitted_fields: list[str] = Field(default_factory=list, alias="omittedFields")

    @computed_field(alias="hasSchema")
    @property
    def has_schema(self) -> bool:
        """Return whether a schema object was produced."""
        return bool(self.schema_json_ld)

    @computed_field(alias="hasBlockingIssues")
    @property
    def has_blocking_issues(self) -> bool:
        """Return whether build output includes blocking issues."""
        return any(issue.is_blocking for issue in self.issues)


SchemaBuildResult = ProductSchemaBuildResult


class SchemaValidationResult(BaseModel):
    """Validation result for existing or generated Product JSON-LD."""

    model_config = ConfigDict(populate_by_name=True)

    valid: bool
    product_schema_present: bool = Field(default=False, alias="productSchemaPresent")
    offer_schema_present: bool = Field(default=False, alias="offerSchemaPresent")
    field_statuses: list[SchemaFieldStatus] = Field(
        default_factory=list,
        alias="fieldStatuses",
    )
    issues: list[SchemaIssue] = Field(default_factory=list)

    @computed_field(alias="hasErrors")
    @property
    def has_errors(self) -> bool:
        """Return whether validation found blocking issues."""
        return any(issue.severity == "error" for issue in self.issues)

    @computed_field(alias="errors")
    @property
    def errors(self) -> list[str]:
        """Return blocking issue messages for simple UI display."""
        return [issue.message for issue in self.issues if issue.severity == "error"]

    @computed_field(alias="warnings")
    @property
    def warnings(self) -> list[str]:
        """Return warning issue messages for simple UI display."""
        return [issue.message for issue in self.issues if issue.severity == "warning"]


def _normalize_schema_type(value: str) -> str:
    normalized = value.strip().rstrip("/#")
    if "/" in normalized:
        normalized = normalized.rsplit("/", maxsplit=1)[-1]
    if "#" in normalized:
        normalized = normalized.rsplit("#", maxsplit=1)[-1]
    if ":" in normalized:
        normalized = normalized.rsplit(":", maxsplit=1)[-1]
    return normalized.casefold()


__all__ = [
    "ExtractedSchemaEntry",
    "JsonObject",
    "ProductSchemaBuildResult",
    "SchemaBuildResult",
    "SchemaExtractionResult",
    "SchemaFieldState",
    "SchemaFieldStatus",
    "SchemaIssue",
    "SchemaIssueSeverity",
    "SchemaIssueStage",
    "SchemaMappingKind",
    "SchemaMappingResult",
    "SchemaValidationResult",
]
