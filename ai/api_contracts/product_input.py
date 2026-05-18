# ai/api_contracts/product_input.py
"""Defines product input contracts sent from the backend to the AI/GEO engine."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from ai.api_contracts.crawl_metadata import CrawlMetadata


ProductSource = Literal["shopify", "native", "woocommerce"]
AvailabilityStatus = Literal[
    "in_stock",
    "out_of_stock",
    "preorder",
    "backorder",
    "unknown",
]


class RawExtractedData(BaseModel):
    """Raw page signals extracted by the backend crawler."""

    model_config = ConfigDict(populate_by_name=True)

    page_title: str | None = Field(default=None, alias="pageTitle")
    meta_description: str | None = Field(default=None, alias="metaDescription")
    headings: dict[str, list[str]] = Field(default_factory=dict)
    body_text: str | None = Field(default=None, alias="bodyText")
    detected_schema: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="detectedSchema",
    )


class ProductInput(BaseModel):
    """Normalized product payload used by analysis and improvement flows."""

    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(alias="productId", min_length=1)
    store_id: str | None = Field(default=None, alias="storeId")
    source: ProductSource
    url: HttpUrl
    language: str = Field(default="tr", min_length=2, max_length=5)
    market: str = Field(default="TR", min_length=2, max_length=2)
    title: str = Field(min_length=1)
    description: str | None = None
    short_description: str | None = Field(default=None, alias="shortDescription")
    price: str | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    availability: AvailabilityStatus = "unknown"
    brand: str | None = None
    category: str | None = None
    image_urls: list[HttpUrl] = Field(default_factory=list, alias="imageUrls")
    attributes: dict[str, Any] = Field(default_factory=dict)
    raw_extracted: RawExtractedData = Field(
        default_factory=RawExtractedData,
        alias="rawExtracted",
    )
    crawl_metadata: CrawlMetadata = Field(alias="crawlMetadata")

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        """Normalize and restrict the MVP language contract."""
        normalized = value.strip().lower()
        if normalized != "tr":
            raise ValueError("language must be 'tr' for the Turkish MVP")
        return normalized

    @field_validator("market")
    @classmethod
    def validate_market(cls, value: str) -> str:
        """Normalize and restrict the MVP market contract."""
        normalized = value.strip().upper()
        if normalized != "TR":
            raise ValueError("market must be 'TR' for the Turkish MVP")
        return normalized

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        """Normalize ISO currency codes when present."""
        if value is None:
            return None
        return value.strip().upper()
