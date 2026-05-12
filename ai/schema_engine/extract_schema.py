# ai/schema_engine/extract_schema.py
"""Extracts detected Schema.org Product JSON-LD from product input payloads."""

from __future__ import annotations

import copy
import json
from collections.abc import Mapping, Sequence
from typing import Any

from ai.api_contracts.product_input import ProductInput, RawExtractedData
from ai.schema_engine.types import ExtractedSchemaEntry, JsonObject, SchemaExtractionResult


SchemaSource = ProductInput | RawExtractedData | Mapping[str, Any] | Sequence[Any]

TYPE_KEYS = ("@type", "type")
CONTEXT_KEY = "@context"
GRAPH_KEY = "@graph"
PRODUCT_TYPE = "product"


def extract_schema(source: SchemaSource) -> SchemaExtractionResult:
    """Extract detected schema nodes and Product JSON-LD from a product payload."""
    detected_schema, root_path, warnings = _read_detected_schema(source)

    all_schemas: list[ExtractedSchemaEntry] = []
    for source_index, entry in enumerate(detected_schema):
        entry_path = f"{root_path}[{source_index}]"
        payload = _coerce_schema_payload(entry, path=entry_path, warnings=warnings)
        if payload is None:
            continue

        for path, schema_data in _iter_schema_nodes(payload, path=entry_path):
            schema_types = get_schema_types(schema_data)
            all_schemas.append(
                ExtractedSchemaEntry(
                    sourceIndex=source_index,
                    path=path,
                    schemaTypes=schema_types,
                    schema=schema_data,
                )
            )

    product_schemas = [
        entry for entry in all_schemas if schema_has_type(entry.schema_data, PRODUCT_TYPE)
    ]

    if not detected_schema:
        warnings.append("No detected schema entries found in rawExtracted.detectedSchema.")
    elif not product_schemas:
        warnings.append("No Product schema found in rawExtracted.detectedSchema.")

    return SchemaExtractionResult(
        allSchemas=all_schemas,
        productSchemas=product_schemas,
        warnings=_dedupe_strings(warnings),
    )


def extract_product_schemas(source: SchemaSource) -> list[JsonObject]:
    """Return only extracted Product schema dictionaries."""
    result = extract_schema(source)
    return [copy.deepcopy(entry.schema_data) for entry in result.product_schemas]


def get_primary_product_schema(source: SchemaSource) -> JsonObject | None:
    """Return the strongest Product schema candidate from detected schema."""
    product_schemas = extract_product_schemas(source)
    if not product_schemas:
        return None

    with_offer = [schema for schema in product_schemas if _has_non_empty_value(schema, "offers")]
    if with_offer:
        return with_offer[0]

    return product_schemas[0]


def schema_has_type(schema_data: Mapping[str, Any], expected_type: str) -> bool:
    """Return whether schema data declares the expected Schema.org type."""
    normalized_expected = _normalize_schema_type(expected_type)
    return any(
        _normalize_schema_type(schema_type) == normalized_expected
        for schema_type in get_schema_types(schema_data)
    )


def get_schema_types(schema_data: Mapping[str, Any]) -> list[str]:
    """Return declared schema types from @type or type fields."""
    for key in TYPE_KEYS:
        if key in schema_data:
            schema_types = _coerce_type_values(schema_data[key])
            if schema_types:
                return schema_types
    return []


def _read_detected_schema(source: SchemaSource) -> tuple[list[Any], str, list[str]]:
    warnings: list[str] = []

    if isinstance(source, ProductInput):
        if source.raw_extracted.detected_schema:
            return list(source.raw_extracted.detected_schema), "rawExtracted.detectedSchema", warnings
        if source.crawl_metadata.detected_structured_data:
            warnings.append(
                "rawExtracted.detectedSchema is empty; using crawlMetadata.detectedStructuredData."
            )
            return (
                list(source.crawl_metadata.detected_structured_data),
                "crawlMetadata.detectedStructuredData",
                warnings,
            )
        return [], "rawExtracted.detectedSchema", warnings

    if isinstance(source, RawExtractedData):
        return list(source.detected_schema), "detectedSchema", warnings

    if isinstance(source, Mapping):
        detected_schema, root_path = _read_mapping_detected_schema(source)
        if detected_schema is None:
            if _looks_like_schema_object(source):
                return [copy.deepcopy(dict(source))], "detectedSchema", warnings

            warnings.append("Input does not contain rawExtracted.detectedSchema.")
            return [], "rawExtracted.detectedSchema", warnings

        return _normalize_detected_schema_list(
            detected_schema,
            root_path=root_path,
            warnings=warnings,
        )

    if _is_sequence(source):
        return list(source), "detectedSchema", warnings

    warnings.append("Unsupported input type for schema extraction.")
    return [], "rawExtracted.detectedSchema", warnings


def _read_mapping_detected_schema(source: Mapping[str, Any]) -> tuple[Any | None, str]:
    raw_extracted = source.get("rawExtracted")
    raw_extracted_path = "rawExtracted.detectedSchema"
    if raw_extracted is None:
        raw_extracted = source.get("raw_extracted")
        raw_extracted_path = "raw_extracted.detected_schema"

    if isinstance(raw_extracted, Mapping):
        if "detectedSchema" in raw_extracted:
            return raw_extracted["detectedSchema"], "rawExtracted.detectedSchema"
        if "detected_schema" in raw_extracted:
            return raw_extracted["detected_schema"], raw_extracted_path

    if "detectedSchema" in source:
        return source["detectedSchema"], "detectedSchema"
    if "detected_schema" in source:
        return source["detected_schema"], "detected_schema"

    crawl_metadata = source.get("crawlMetadata")
    crawl_metadata_path = "crawlMetadata.detectedStructuredData"
    if crawl_metadata is None:
        crawl_metadata = source.get("crawl_metadata")
        crawl_metadata_path = "crawl_metadata.detected_structured_data"

    if isinstance(crawl_metadata, Mapping):
        if "detectedStructuredData" in crawl_metadata:
            return crawl_metadata["detectedStructuredData"], "crawlMetadata.detectedStructuredData"
        if "detected_structured_data" in crawl_metadata:
            return crawl_metadata["detected_structured_data"], crawl_metadata_path

    if "detectedStructuredData" in source:
        return source["detectedStructuredData"], "detectedStructuredData"
    if "detected_structured_data" in source:
        return source["detected_structured_data"], "detected_structured_data"

    return None, "rawExtracted.detectedSchema"


def _looks_like_schema_object(value: Mapping[str, Any]) -> bool:
    if any(key in value for key in (CONTEXT_KEY, GRAPH_KEY, "@type")):
        return True

    schema_type = value.get("type")
    return isinstance(schema_type, str) and _normalize_schema_type(schema_type) in {
        "product",
        "offer",
        "brand",
        "organization",
        "aggregaterating",
        "review",
        "breadcrumblist",
        "listitem",
    }


def _normalize_detected_schema_list(
    detected_schema: Any,
    *,
    root_path: str,
    warnings: list[str],
) -> tuple[list[Any], str, list[str]]:
    if isinstance(detected_schema, Mapping) or isinstance(detected_schema, str):
        warnings.append(f"{root_path} should be a list; treating the value as one entry.")
        return [detected_schema], root_path, warnings

    if _is_sequence(detected_schema):
        return list(detected_schema), root_path, warnings

    warnings.append(f"{root_path} must be a list of schema objects.")
    return [], root_path, warnings


def _coerce_schema_payload(
    value: Any,
    *,
    path: str,
    warnings: list[str],
) -> JsonObject | list[Any] | None:
    if isinstance(value, Mapping):
        return copy.deepcopy(dict(value))

    if isinstance(value, str):
        return _parse_schema_string(value, path=path, warnings=warnings)

    if _is_sequence(value):
        return [copy.deepcopy(item) for item in value]

    warnings.append(f"Ignored non-object schema entry at {path}.")
    return None


def _parse_schema_string(
    value: str,
    *,
    path: str,
    warnings: list[str],
) -> JsonObject | list[Any] | None:
    text = value.strip()
    if not text:
        warnings.append(f"Ignored empty schema string at {path}.")
        return None

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        warnings.append(f"Ignored malformed JSON schema string at {path}: {exc.msg}.")
        return None

    if isinstance(parsed, Mapping):
        return copy.deepcopy(dict(parsed))
    if _is_sequence(parsed):
        return [copy.deepcopy(item) for item in parsed]

    warnings.append(f"Ignored JSON schema string at {path} because it did not parse to an object.")
    return None


def _iter_schema_nodes(
    value: Any,
    *,
    path: str,
    inherited_context: Any | None = None,
) -> list[tuple[str, JsonObject]]:
    nodes: list[tuple[str, JsonObject]] = []

    if isinstance(value, Mapping):
        current_context = value.get(CONTEXT_KEY, inherited_context)
        schema_data = copy.deepcopy(dict(value))
        if CONTEXT_KEY not in schema_data and current_context is not None:
            schema_data[CONTEXT_KEY] = copy.deepcopy(current_context)

        if get_schema_types(schema_data):
            nodes.append((path, schema_data))

        for key, child in value.items():
            if key in {CONTEXT_KEY, *TYPE_KEYS}:
                continue

            child_path = f"{path}.{key}"
            nodes.extend(
                _iter_schema_nodes(
                    child,
                    path=child_path,
                    inherited_context=current_context,
                )
            )

        return nodes

    if _is_sequence(value):
        for index, item in enumerate(value):
            nodes.extend(
                _iter_schema_nodes(
                    item,
                    path=f"{path}[{index}]",
                    inherited_context=inherited_context,
                )
            )

    return nodes


def _coerce_type_values(value: Any) -> list[str]:
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []

    if _is_sequence(value):
        return [item for item in value if isinstance(item, str) and item.strip()]

    return []


def _normalize_schema_type(value: str) -> str:
    normalized = value.strip().rstrip("/#")
    if "/" in normalized:
        normalized = normalized.rsplit("/", maxsplit=1)[-1]
    if "#" in normalized:
        normalized = normalized.rsplit("#", maxsplit=1)[-1]
    if ":" in normalized:
        normalized = normalized.rsplit(":", maxsplit=1)[-1]
    return normalized.casefold()


def _has_non_empty_value(schema_data: Mapping[str, Any], key: str) -> bool:
    value = schema_data.get(key)
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (Mapping, Sequence)):
        return bool(value)
    return True


def _is_sequence(value: Any) -> bool:
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))


def _dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            deduped.append(value)
    return deduped


__all__ = [
    "ExtractedSchemaEntry",
    "SchemaExtractionResult",
    "extract_product_schemas",
    "extract_schema",
    "get_primary_product_schema",
    "get_schema_types",
    "schema_has_type",
]
