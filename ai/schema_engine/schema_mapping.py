# ai/schema_engine/schema_mapping.py
"""Maps generic product facts to deterministic Schema.org-compatible values."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from decimal import Decimal, InvalidOperation
from typing import Any

from ai.schema_engine.types import SchemaIssue, SchemaMappingResult


SCHEMA_ORG_BASE_URL = "https://schema.org/"
SCHEMA_ORG_HTTP_BASE_URL = "http://schema.org/"

AVAILABILITY_URLS = {
    "backorder": f"{SCHEMA_ORG_BASE_URL}BackOrder",
    "discontinued": f"{SCHEMA_ORG_BASE_URL}Discontinued",
    "in_stock": f"{SCHEMA_ORG_BASE_URL}InStock",
    "limited_availability": f"{SCHEMA_ORG_BASE_URL}LimitedAvailability",
    "out_of_stock": f"{SCHEMA_ORG_BASE_URL}OutOfStock",
    "preorder": f"{SCHEMA_ORG_BASE_URL}PreOrder",
    "presale": f"{SCHEMA_ORG_BASE_URL}PreSale",
    "sold_out": f"{SCHEMA_ORG_BASE_URL}SoldOut",
}

SCHEMA_AVAILABILITY_SUFFIXES = {
    url.rsplit("/", maxsplit=1)[-1].casefold(): url
    for url in AVAILABILITY_URLS.values()
}

AVAILABILITY_ALIASES = {
    "available": "in_stock",
    "back order": "backorder",
    "backorder": "backorder",
    "backordered": "backorder",
    "discontinued": "discontinued",
    "in stock": "in_stock",
    "in_stock": "in_stock",
    "instock": "in_stock",
    "limited": "limited_availability",
    "limited availability": "limited_availability",
    "on stock": "in_stock",
    "out of stock": "out_of_stock",
    "out_of_stock": "out_of_stock",
    "outofstock": "out_of_stock",
    "pre order": "preorder",
    "pre sale": "presale",
    "pre-order": "preorder",
    "pre-sale": "presale",
    "preorder": "preorder",
    "presale": "presale",
    "sold out": "sold_out",
    "soldout": "sold_out",
    "mevcut": "in_stock",
    "on siparis": "preorder",
    "on sipariste": "preorder",
    "sinirli stok": "limited_availability",
    "siparis uzerine": "backorder",
    "stok var": "in_stock",
    "stok yok": "out_of_stock",
    "stokta": "in_stock",
    "stokta var": "in_stock",
    "stokta yok": "out_of_stock",
    "tukendi": "out_of_stock",
}

CURRENCY_ALIASES = {
    "$": "USD",
    "dolar": "USD",
    "euro": "EUR",
    "eur": "EUR",
    "tl": "TRY",
    "tr lira": "TRY",
    "trl": "TRY",
    "try": "TRY",
    "turk lirasi": "TRY",
    "turkish lira": "TRY",
    "usd": "USD",
    "\u20ba": "TRY",
    "\u20ac": "EUR",
}

PRICE_SYMBOLS = ("\u20ba", "$", "\u20ac")
PRICE_WORDS = ("TRY", "TL", "TRL", "USD", "EUR")

TURKISH_FOLD_MAP = str.maketrans(
    {
        "\u00c7": "C",
        "\u00d6": "O",
        "\u00dc": "U",
        "\u011e": "G",
        "\u0130": "I",
        "\u015e": "S",
        "\u00e7": "c",
        "\u00f6": "o",
        "\u00fc": "u",
        "\u011f": "g",
        "\u0131": "i",
        "\u015f": "s",
    }
)

UNKNOWN_TEXT_MARKERS = {
    "-",
    "belirtilmedi",
    "belirtilmemis",
    "bos",
    "mevcut degil",
    "n/a",
    "none",
    "not available",
    "not specified",
    "null",
    "tanimsiz",
    "undefined",
    "unknown",
    "yok",
}


def map_availability(value: Any) -> SchemaMappingResult:
    """Map a platform or Turkish availability value to a Schema.org URL."""
    normalized = normalize_availability(value)
    if normalized is not None:
        return SchemaMappingResult(
            kind="availability",
            inputValue=value,
            normalizedValue=normalized,
            valid=True,
        )

    return SchemaMappingResult(
        kind="availability",
        inputValue=value,
        normalizedValue=None,
        valid=False,
        issue=_mapping_issue(
            code="invalid_availability",
            message="Availability could not be mapped to a supported Schema.org URL.",
            field="availability",
            value=value,
            suggestion="Use in_stock, out_of_stock, preorder, backorder, or a Schema.org availability URL.",
        ),
    )


def normalize_availability(value: Any) -> str | None:
    """Return a Schema.org availability URL, or None if the value is unknown."""
    if not is_known_value(value):
        return None

    text = str(value).strip()
    schema_url = _normalize_schema_org_url(text)
    if schema_url is not None:
        return schema_url

    normalized = normalize_text(value)
    normalized_with_spaces = normalized.replace("-", " ").replace("_", " ")
    normalized_with_spaces = " ".join(normalized_with_spaces.split())
    compact = normalized_with_spaces.replace(" ", "")

    availability_key = AVAILABILITY_ALIASES.get(normalized)
    if availability_key is None:
        availability_key = AVAILABILITY_ALIASES.get(normalized_with_spaces)
    if availability_key is None:
        availability_key = AVAILABILITY_ALIASES.get(compact)
    if availability_key is None and normalized in AVAILABILITY_URLS:
        availability_key = normalized
    if availability_key is None and compact in AVAILABILITY_URLS:
        availability_key = compact

    if availability_key is None:
        return None

    return AVAILABILITY_URLS[availability_key]


def is_valid_availability(value: Any) -> bool:
    """Return whether a value can be mapped to Schema.org ItemAvailability."""
    return normalize_availability(value) is not None


def map_currency(value: Any) -> SchemaMappingResult:
    """Normalize a currency value to an ISO 4217-style uppercase code."""
    normalized = normalize_currency(value)
    if normalized is not None:
        return SchemaMappingResult(
            kind="currency",
            inputValue=value,
            normalizedValue=normalized,
            valid=True,
        )

    return SchemaMappingResult(
        kind="currency",
        inputValue=value,
        normalizedValue=None,
        valid=False,
        issue=_mapping_issue(
            code="invalid_currency",
            message="Currency could not be normalized to a three-letter code.",
            field="priceCurrency",
            value=value,
            suggestion="Use an ISO 4217 currency code such as TRY, USD, or EUR.",
        ),
    )


def normalize_currency(value: Any) -> str | None:
    """Normalize known currency aliases to three-letter uppercase codes."""
    if not is_known_value(value):
        return None

    text = str(value).strip()
    alias_key = normalize_text(text)
    aliased = CURRENCY_ALIASES.get(alias_key)
    if aliased is not None:
        return aliased

    upper = text.upper()
    if len(upper) == 3 and upper.isalpha():
        return upper

    return None


def is_valid_currency(value: Any) -> bool:
    """Return whether a currency value normalizes to a three-letter code."""
    return normalize_currency(value) is not None


def map_price(value: Any) -> SchemaMappingResult:
    """Normalize a price value to Schema.org's string-compatible decimal format."""
    normalized = normalize_price(value)
    if normalized is not None:
        return SchemaMappingResult(
            kind="price",
            inputValue=value,
            normalizedValue=normalized,
            valid=True,
        )

    return SchemaMappingResult(
        kind="price",
        inputValue=value,
        normalizedValue=None,
        valid=False,
        issue=_mapping_issue(
            code="invalid_price",
            message="Price could not be normalized to a non-negative decimal value.",
            field="price",
            value=value,
            suggestion="Use a numeric price such as 149.00 or 2499.90.",
        ),
    )


def normalize_price(value: Any) -> str | None:
    """Normalize price strings with Turkish or international separators."""
    if not is_known_value(value):
        return None

    if isinstance(value, Decimal):
        return _decimal_to_price(value)

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return _decimal_to_price(Decimal(str(value)))
        except InvalidOperation:
            return None

    text = str(value).strip()
    for symbol in PRICE_SYMBOLS:
        text = text.replace(symbol, "")
    for word in PRICE_WORDS:
        text = text.replace(word, "").replace(word.casefold(), "")

    text = text.strip().replace("\u00a0", " ").replace(" ", "")
    if not text:
        return None

    normalized = _normalize_decimal_separators(text)
    try:
        decimal_value = Decimal(normalized)
    except InvalidOperation:
        return None

    return _decimal_to_price(decimal_value)


def is_valid_price(value: Any) -> bool:
    """Return whether a price can be normalized to a non-negative decimal."""
    return normalize_price(value) is not None


def map_schema_type(value: Any) -> SchemaMappingResult:
    """Normalize a Schema.org type label for comparisons."""
    normalized = normalize_schema_type(value)
    if normalized is not None:
        return SchemaMappingResult(
            kind="schema_type",
            inputValue=value,
            normalizedValue=normalized,
            valid=True,
        )

    return SchemaMappingResult(
        kind="schema_type",
        inputValue=value,
        normalizedValue=None,
        valid=False,
        issue=_mapping_issue(
            code="invalid_schema_type",
            message="Schema type could not be normalized.",
            field="@type",
            value=value,
            suggestion="Use a Schema.org type string such as Product or Offer.",
        ),
    )


def normalize_schema_type(value: Any) -> str | None:
    """Normalize Schema.org type values to lowercase comparison labels."""
    if not is_known_value(value):
        return None

    text = str(value).strip().rstrip("/#")
    if "/" in text:
        text = text.rsplit("/", maxsplit=1)[-1]
    if "#" in text:
        text = text.rsplit("#", maxsplit=1)[-1]
    if ":" in text:
        text = text.rsplit(":", maxsplit=1)[-1]

    normalized = text.casefold()
    return normalized or None


def schema_type_matches(value: Any, expected_type: str) -> bool:
    """Return whether a Schema.org type matches the expected type label."""
    normalized_value = normalize_schema_type(value)
    normalized_expected = normalize_schema_type(expected_type)
    return normalized_value is not None and normalized_value == normalized_expected


def get_schema_types(schema_data: Mapping[str, Any]) -> list[str]:
    """Read normalized schema type labels from @type or type fields."""
    for key in ("@type", "type"):
        if key in schema_data:
            return normalize_schema_type_list(schema_data[key])
    return []


def normalize_schema_type_list(value: Any) -> list[str]:
    """Normalize scalar or list Schema.org type declarations."""
    if isinstance(value, str):
        normalized = normalize_schema_type(value)
        return [normalized] if normalized is not None else []

    if _is_sequence(value):
        normalized_values: list[str] = []
        seen: set[str] = set()
        for item in value:
            normalized = normalize_schema_type(item)
            if normalized is not None and normalized not in seen:
                seen.add(normalized)
                normalized_values.append(normalized)
        return normalized_values

    return []


def is_known_value(value: Any) -> bool:
    """Return whether a value is safe to use as a known product fact."""
    if value is None:
        return False

    if isinstance(value, str):
        normalized = normalize_text(value)
        return bool(normalized) and normalized not in UNKNOWN_TEXT_MARKERS

    if isinstance(value, Mapping):
        return any(is_known_value(item) for item in value.values())

    if _is_sequence(value):
        return any(is_known_value(item) for item in value)

    return True


def normalize_text(value: Any) -> str:
    """Fold Turkish characters and normalize whitespace for deterministic matching."""
    return " ".join(str(value).translate(TURKISH_FOLD_MAP).casefold().strip().split())


def _normalize_schema_org_url(value: str) -> str | None:
    stripped = value.strip().rstrip("/#")
    lower = stripped.casefold()
    for prefix in (SCHEMA_ORG_BASE_URL, SCHEMA_ORG_HTTP_BASE_URL):
        if lower.startswith(prefix.casefold()):
            suffix = stripped.rsplit("/", maxsplit=1)[-1].strip()
            return SCHEMA_AVAILABILITY_SUFFIXES.get(suffix.casefold())
    return None


def _normalize_decimal_separators(value: str) -> str:
    if "," in value and "." in value:
        if value.rfind(",") > value.rfind("."):
            return value.replace(".", "").replace(",", ".")
        return value.replace(",", "")

    if "," in value:
        parts = value.split(",")
        if len(parts[-1]) in {1, 2}:
            return value.replace(".", "").replace(",", ".")
        return value.replace(",", "")

    if "." in value:
        parts = value.split(".")
        if len(parts) > 1 and all(part.isdigit() for part in parts):
            if all(len(part) == 3 for part in parts[1:]):
                return value.replace(".", "")

    return value


def _decimal_to_price(value: Decimal) -> str | None:
    if value.is_nan() or value.is_infinite() or value < 0:
        return None

    normalized = format(value, "f")
    if normalized == "-0":
        return "0"
    return normalized


def _mapping_issue(
    *,
    code: str,
    message: str,
    field: str,
    value: Any,
    suggestion: str,
) -> SchemaIssue:
    return SchemaIssue.warning(
        code=code,
        message=message,
        stage="mapping",
        field=field,
        value=value,
        suggestion=suggestion,
    )


def _is_sequence(value: Any) -> bool:
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))


__all__ = [
    "AVAILABILITY_URLS",
    "map_availability",
    "map_currency",
    "map_price",
    "map_schema_type",
    "get_schema_types",
    "is_known_value",
    "is_valid_availability",
    "is_valid_currency",
    "is_valid_price",
    "normalize_availability",
    "normalize_currency",
    "normalize_price",
    "normalize_schema_type",
    "normalize_schema_type_list",
    "normalize_text",
    "schema_type_matches",
]
