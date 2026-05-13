# ai/agents/analysis/nodes/prepare_input.py
"""Prepares normalized product context for the GEO analysis graph."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.agents.analysis.state import (
    AnalysisGraphState,
    AnalysisNormalizedText,
    AnalysisProductFacts,
    AnalysisSchemaSummary,
)
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.scoring.retrieval_score import build_retrieval_nlp_signals
from ai.schema_engine.extract_schema import extract_schema
from ai.schema_engine.schema_mapping import is_known_value
from ai.schema_engine.validate_schema import validate_schema
from ai.turkish_nlp.borrowed_terms import normalize_borrowed_terms_in_text
from ai.turkish_nlp.buyer_patterns import detect_buyer_patterns
from ai.turkish_nlp.category_attributes import summarize_attribute_coverage
from ai.turkish_nlp.normalize import normalize_text
from ai.turkish_nlp.synonyms import canonicalize_attribute_keys, normalize_query_terms
from ai.turkish_nlp.trust_signals import detect_trust_signals


def prepare_input(state: AnalysisGraphState) -> AnalysisGraphState:
    """Normalize product input and attach deterministic Turkish NLP context."""
    product = _get_product_input(state)
    normalized_text = _build_normalized_text(product)
    schema_extraction = extract_schema(product)
    schema_validation = validate_schema(schema_extraction)
    schema_summary = AnalysisSchemaSummary.from_validation(
        schema_validation,
        has_structured_data=schema_extraction.has_structured_data,
    )
    product_facts = _build_product_facts(product, schema_summary)
    turkish_nlp_signals = build_retrieval_nlp_signals(product)

    retrieval_text = _build_retrieval_text(product)
    trust_signals = detect_trust_signals(retrieval_text)
    buyer_patterns = detect_buyer_patterns(retrieval_text)
    synonym_terms = normalize_query_terms(retrieval_text)

    turkish_nlp_signals = turkish_nlp_signals.model_copy(
        update={
            "trust_signals": trust_signals,
            "buyer_patterns": buyer_patterns,
            "synonym_terms": synonym_terms,
            "known_attributes": product_facts.known_attributes,
            "unknown_attributes": product_facts.unknown_attributes,
            "missing_attribute_hints": product_facts.missing_attribute_hints,
            "missing_signals": _dedupe_text(
                [
                    *turkish_nlp_signals.missing_signals,
                    *product_facts.missing_facts,
                ]
            ),
        }
    )

    metadata = dict(state.get("metadata", {}))
    metadata["prepareInput"] = {
        "usedTurkishNlpHelpers": [
            "normalize",
            "borrowed_terms",
            "synonyms",
            "buyer_patterns",
            "trust_signals",
            "category_attributes",
        ],
        "schemaEntriesFound": len(schema_extraction.all_schemas),
        "productSchemaEntriesFound": len(schema_extraction.product_schemas),
        "knownFactCount": len(product_facts.known_facts),
        "missingFactCount": len(product_facts.missing_facts),
    }

    return {
        **state,
        "normalized_text": normalized_text,
        "product_facts": product_facts,
        "missing_facts": product_facts.missing_facts,
        "schema_validation": schema_validation,
        "schema_summary": schema_summary,
        "turkish_nlp_signals": turkish_nlp_signals,
        "metadata": metadata,
    }


def _get_product_input(state: AnalysisGraphState) -> ProductInput:
    product = state.get("product_input")
    if not isinstance(product, ProductInput):
        raise ValueError("prepare_input requires product_input in analysis state")
    return product


def _build_normalized_text(product: ProductInput) -> AnalysisNormalizedText:
    raw = product.raw_extracted
    crawl = product.crawl_metadata
    retrieval_text = _build_retrieval_text(product)

    return AnalysisNormalizedText(
        title=normalize_text(product.title),
        description=normalize_text(product.description),
        shortDescription=normalize_text(product.short_description),
        pageTitle=normalize_text(raw.page_title or crawl.page_title),
        metaDescription=normalize_text(raw.meta_description or crawl.meta_description),
        bodyText=normalize_text(raw.body_text),
        borrowedTermsNormalizedText=normalize_borrowed_terms_in_text(retrieval_text),
    )


def _build_product_facts(
    product: ProductInput,
    schema_summary: AnalysisSchemaSummary,
) -> AnalysisProductFacts:
    attribute_coverage = summarize_attribute_coverage(
        category=product.category,
        attributes=product.attributes,
        product_facts=_raw_fact_map(product),
    )
    known_attributes = {
        **canonicalize_attribute_keys(product.attributes),
        **attribute_coverage.known_attributes,
    }
    missing_attribute_hints = [
        hint.name for hint in attribute_coverage.suggested_missing_attributes
    ]

    known_facts = _known_fact_map(product, known_attributes)
    missing_facts = _missing_fact_names(product, schema_summary, missing_attribute_hints)

    return AnalysisProductFacts(
        knownFacts=known_facts,
        missingFacts=missing_facts,
        knownAttributes=known_attributes,
        unknownAttributes=attribute_coverage.unknown_attributes,
        missingAttributeHints=missing_attribute_hints,
    )


def _raw_fact_map(product: ProductInput) -> dict[str, Any]:
    return {
        "title": product.title,
        "description": product.description,
        "shortDescription": product.short_description,
        "price": product.price,
        "currency": product.currency,
        "availability": product.availability,
        "brand": product.brand,
        "category": product.category,
        "imageUrls": [str(url) for url in product.image_urls],
        "attributes": product.attributes,
    }


def _known_fact_map(
    product: ProductInput,
    known_attributes: Mapping[str, Any],
) -> dict[str, Any]:
    facts = _raw_fact_map(product)
    if known_attributes:
        facts["knownAttributes"] = dict(known_attributes)

    return {
        key: value
        for key, value in facts.items()
        if is_known_value(value) and value != "unknown"
    }


def _missing_fact_names(
    product: ProductInput,
    schema_summary: AnalysisSchemaSummary,
    missing_attribute_hints: Sequence[str],
) -> list[str]:
    missing: list[str] = []

    for field_name, value in _raw_fact_map(product).items():
        if not is_known_value(value) or value == "unknown":
            missing.append(field_name)

    if not product.image_urls:
        missing.append("imageUrls")
    if not product.attributes:
        missing.append("attributes")
    if not schema_summary.product_schema_present:
        missing.append("schema.product")
    if not schema_summary.offer_schema_present:
        missing.append("schema.offers")

    missing.extend(f"attribute.{name}" for name in missing_attribute_hints)
    missing.extend(f"schema.{field}" for field in schema_summary.missing_fields)
    return _dedupe_text(missing)


def _build_retrieval_text(product: ProductInput) -> str:
    raw = product.raw_extracted
    crawl = product.crawl_metadata
    return _join_text(
        product.title,
        product.description,
        product.short_description,
        product.brand,
        product.category,
        product.attributes,
        raw.page_title,
        crawl.page_title,
        raw.meta_description,
        crawl.meta_description,
        _flatten_headings(raw.headings),
        _flatten_headings(crawl.headings),
        raw.body_text,
    )


def _flatten_headings(headings: Mapping[str, Sequence[str]]) -> str:
    return _join_text(*[
        value
        for key, values in headings.items()
        if str(key).lower() in {"h1", "h2", "h3"}
        for value in values
    ])


def _join_text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                parts.append(value.strip())
            continue
        if isinstance(value, Mapping):
            parts.extend(
                f"{key} {item}"
                for key, item in value.items()
                if is_known_value(item)
            )
            continue
        if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
            parts.extend(str(item).strip() for item in value if is_known_value(item))
            continue
        if is_known_value(value):
            parts.append(str(value).strip())

    return " ".join(parts)


def _dedupe_text(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


__all__ = ["prepare_input"]
