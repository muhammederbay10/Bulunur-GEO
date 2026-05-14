# ai/schema_engine/build_product_schema.py
"""Builds deterministic Schema.org Product JSON-LD from trusted product facts."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.api_contracts.product_input import ProductInput
from ai.schema_engine.schema_mapping import (
    is_known_value,
    map_availability,
    normalize_availability,
    normalize_currency,
    normalize_price,
    normalize_text,
)
from ai.schema_engine.types import JsonObject, ProductSchemaBuildResult


ProductSchemaInput = ProductInput | Mapping[str, Any]

SCHEMA_CONTEXT = "https://schema.org"
PRODUCT_TYPE = "Product"
OFFER_TYPE = "Offer"
BRAND_TYPE = "Brand"
PROPERTY_VALUE_TYPE = "PropertyValue"

NAME_ALIASES = ("name", "title", "productName", "product_name")
DESCRIPTION_ALIASES = ("description", "longDescription", "long_description")
SHORT_DESCRIPTION_ALIASES = ("shortDescription", "short_description")
URL_ALIASES = ("url", "productUrl", "product_url", "canonicalUrl", "canonical_url")
IMAGE_ALIASES = ("image", "images", "imageUrls", "image_urls")
BRAND_ALIASES = ("brand", "brandName", "brand_name")
CATEGORY_ALIASES = ("category", "categoryName", "category_name")
PRODUCT_ID_ALIASES = ("productID", "productId", "product_id", "id")
SKU_ALIASES = ("sku", "SKU")
MPN_ALIASES = ("mpn", "MPN")
GTIN_ALIASES = ("gtin", "gtin8", "gtin12", "gtin13", "gtin14")
ATTRIBUTES_ALIASES = ("attributes", "productAttributes", "product_attributes")
OFFERS_ALIASES = ("offers", "offer")
PRICE_ALIASES = ("price", "salePrice", "sale_price", "regularPrice", "regular_price")
CURRENCY_ALIASES_KEYS = ("currency", "priceCurrency", "price_currency")
AVAILABILITY_ALIASES_KEYS = ("availability", "stockStatus", "stock_status")

RESERVED_ATTRIBUTE_KEYS = {
    "availability",
    "brand",
    "category",
    "currency",
    "description",
    "gtin",
    "image",
    "images",
    "mpn",
    "name",
    "price",
    "productid",
    "sku",
    "title",
    "url",
}


def build_product_schema(
    product: ProductSchemaInput,
    *,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
) -> ProductSchemaBuildResult:
    """Build Product JSON-LD using only extracted, trusted, or user-confirmed facts."""
    warnings: list[str] = []
    omitted_fields: list[str] = []

    product_facts = _product_to_facts(product)
    sources = [
        dict(user_confirmed_facts or {}),
        dict(trusted_facts or {}),
        product_facts,
    ]

    schema: JsonObject = {
        "@context": SCHEMA_CONTEXT,
        "@type": PRODUCT_TYPE,
    }

    _set_text_field(schema, "name", sources, NAME_ALIASES, warnings, "Product name")
    _set_description(schema, sources, warnings)
    _set_text_field(schema, "url", sources, URL_ALIASES, warnings, "Product URL")
    _set_brand(schema, sources, omitted_fields)
    _set_text_field(schema, "category", sources, CATEGORY_ALIASES, None, None)
    _set_images(schema, sources, omitted_fields)
    _set_identifier_fields(schema, sources, public_identifier_sources=sources[:2])
    _set_attributes(schema, sources, omitted_fields)

    offer = _build_offer(schema.get("url"), sources, warnings, omitted_fields)
    if offer:
        schema["offers"] = offer

    return ProductSchemaBuildResult(
        schemaJsonLd=schema,
        warnings=_dedupe_strings(warnings),
        omittedFields=_dedupe_strings(omitted_fields),
    )


def build_product_schema_json_ld(
    product: ProductSchemaInput,
    *,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
) -> JsonObject:
    """Return only the generated Product JSON-LD dictionary."""
    return build_product_schema(
        product,
        trusted_facts=trusted_facts,
        user_confirmed_facts=user_confirmed_facts,
    ).schema_json_ld


def _product_to_facts(product: ProductSchemaInput) -> JsonObject:
    if isinstance(product, ProductInput):
        return {
            "url": str(product.url),
            "title": product.title,
            "description": product.description,
            "short_description": product.short_description,
            "price": product.price,
            "currency": product.currency,
            "availability": product.availability,
            "brand": product.brand,
            "category": product.category,
            "image_urls": [str(url) for url in product.image_urls],
            "attributes": dict(product.attributes),
        }

    return dict(product)


def _set_text_field(
    schema: JsonObject,
    field_name: str,
    sources: list[Mapping[str, Any]],
    aliases: Sequence[str],
    warnings: list[str] | None,
    warning_label: str | None,
) -> None:
    value = _first_known_value(sources, aliases)
    if value is None:
        if warnings is not None and warning_label is not None:
            warnings.append(f"{warning_label} is missing from trusted facts.")
        return

    schema[field_name] = str(value).strip()


def _set_description(
    schema: JsonObject,
    sources: list[Mapping[str, Any]],
    warnings: list[str],
) -> None:
    description = None
    for source in sources:
        description = _first_known_value(
            [source],
            (*DESCRIPTION_ALIASES, *SHORT_DESCRIPTION_ALIASES),
        )
        if description is not None:
            break

    if description is None:
        warnings.append("Product description is missing from trusted facts.")
        return

    schema["description"] = str(description).strip()


def _set_brand(
    schema: JsonObject,
    sources: list[Mapping[str, Any]],
    omitted_fields: list[str],
) -> None:
    value = _first_known_value(sources, BRAND_ALIASES)
    brand_name = _extract_named_value(value)
    if brand_name is None:
        if value is not None:
            omitted_fields.append("brand")
        return

    schema["brand"] = {
        "@type": BRAND_TYPE,
        "name": brand_name,
    }


def _set_images(
    schema: JsonObject,
    sources: list[Mapping[str, Any]],
    omitted_fields: list[str],
) -> None:
    value = _first_known_value(sources, IMAGE_ALIASES)
    images = _coerce_string_list(value)
    if images:
        schema["image"] = images
    elif value is not None:
        omitted_fields.append("image")


def _set_identifier_fields(
    schema: JsonObject,
    sources: list[Mapping[str, Any]],
    *,
    public_identifier_sources: Sequence[Mapping[str, Any]],
) -> None:
    product_id = _first_known_value(public_identifier_sources, PRODUCT_ID_ALIASES)
    if product_id is not None:
        schema["productID"] = str(product_id).strip()

    sku = _first_known_value(sources, SKU_ALIASES)
    if sku is not None:
        schema["sku"] = str(sku).strip()

    mpn = _first_known_value(sources, MPN_ALIASES)
    if mpn is not None:
        schema["mpn"] = str(mpn).strip()

    for alias in GTIN_ALIASES:
        value = _first_known_value(sources, (alias,))
        if value is not None:
            schema[alias] = str(value).strip()
            return


def _set_attributes(
    schema: JsonObject,
    sources: list[Mapping[str, Any]],
    omitted_fields: list[str],
) -> None:
    attributes = _merge_attributes(sources)
    additional_properties: list[JsonObject] = []

    for name, value in attributes.items():
        normalized_name = _normalize_key(name)
        if normalized_name in RESERVED_ATTRIBUTE_KEYS:
            continue

        if not is_known_value(value):
            omitted_fields.append(f"attributes.{name}")
            continue

        additional_properties.append(
            {
                "@type": PROPERTY_VALUE_TYPE,
                "name": str(name),
                "value": _stringify_attribute_value(value),
            }
        )

    if additional_properties:
        schema["additionalProperty"] = additional_properties


def _build_offer(
    product_url: Any,
    sources: list[Mapping[str, Any]],
    warnings: list[str],
    omitted_fields: list[str],
) -> JsonObject | None:
    raw_availability = _first_known_offer_value(sources, AVAILABILITY_ALIASES_KEYS)
    availability_mapping = map_availability(raw_availability)
    if raw_availability is not None and not availability_mapping.valid:
        warnings.append(f"Unsupported availability value was omitted: {raw_availability}.")

    price = normalize_price(_first_known_offer_value(sources, PRICE_ALIASES))
    currency = normalize_currency(_first_known_offer_value(sources, CURRENCY_ALIASES_KEYS))
    availability = normalize_availability(raw_availability)

    missing_fields: list[str] = []
    if price is None:
        missing_fields.append("offers.price")
    if currency is None:
        missing_fields.append("offers.priceCurrency")
    if availability is None:
        missing_fields.append("offers.availability")

    if missing_fields:
        omitted_fields.extend(missing_fields)
        warnings.append(
            "Offer schema was omitted because a complete trusted Offer requires "
            "price, priceCurrency, and availability."
        )
        return None

    offer: JsonObject = {"@type": OFFER_TYPE}
    if is_known_value(product_url):
        offer["url"] = str(product_url).strip()

    offer["price"] = price
    offer["priceCurrency"] = currency
    offer["availability"] = availability

    return offer


def _first_known_value(
    sources: Sequence[Mapping[str, Any]],
    aliases: Sequence[str],
) -> Any | None:
    for source in sources:
        value = _get_value(source, aliases)
        if is_known_value(value):
            return value
    return None


def _first_known_offer_value(
    sources: Sequence[Mapping[str, Any]],
    aliases: Sequence[str],
) -> Any | None:
    for source in sources:
        offer_value = _get_value(source, OFFERS_ALIASES)
        if isinstance(offer_value, Mapping):
            nested_value = _get_value(offer_value, aliases)
            if is_known_value(nested_value):
                return nested_value

        value = _get_value(source, aliases)
        if is_known_value(value):
            return value

    return None


def _get_value(source: Mapping[str, Any], aliases: Sequence[str]) -> Any | None:
    for alias in aliases:
        if alias in source:
            return source[alias]

    normalized_aliases = {_normalize_key(alias) for alias in aliases}
    for key, value in source.items():
        if _normalize_key(key) in normalized_aliases:
            return value

    return None


def _merge_attributes(sources: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for source in reversed(sources):
        attributes = _get_value(source, ATTRIBUTES_ALIASES)
        if isinstance(attributes, Mapping):
            merged.update(dict(attributes))
    return merged


def _extract_named_value(value: Any) -> str | None:
    if isinstance(value, Mapping):
        nested = _get_value(value, ("name", "title"))
        if is_known_value(nested):
            return str(nested).strip()
        return None

    if is_known_value(value):
        return str(value).strip()

    return None


def _coerce_string_list(value: Any) -> list[str]:
    if not is_known_value(value):
        return []

    if isinstance(value, str):
        return [value.strip()]

    if _is_sequence(value):
        return [str(item).strip() for item in value if is_known_value(item)]

    return []


def _stringify_attribute_value(value: Any) -> str:
    if isinstance(value, Mapping):
        parts = [
            f"{key}: {nested_value}"
            for key, nested_value in value.items()
            if is_known_value(nested_value)
        ]
        return ", ".join(parts)

    if _is_sequence(value):
        return ", ".join(str(item).strip() for item in value if is_known_value(item))

    return str(value).strip()


def _normalize_key(value: Any) -> str:
    return "".join(
        char
        for char in normalize_text(value)
        if char.isalnum()
    )


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
    "ProductSchemaBuildResult",
    "build_product_schema",
    "build_product_schema_json_ld",
]
