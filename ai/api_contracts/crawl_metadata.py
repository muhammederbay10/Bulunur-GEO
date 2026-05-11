# ai/api_contracts/crawl_metadata.py
"""Defines crawler retrieval metadata shared with the AI/GEO engine."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


CrawlStatus = Literal["success", "partial", "failed", "blocked", "timeout"]


class CrawlMetadata(BaseModel):
    """Metadata from the backend crawler used by retrieval scoring."""

    model_config = ConfigDict(populate_by_name=True)

    crawl_status: CrawlStatus = Field(alias="crawlStatus")
    crawled_at: datetime = Field(alias="crawledAt")
    accessible: bool
    blocked: bool
    content_extracted: bool = Field(alias="contentExtracted")
    product_url: HttpUrl | None = Field(default=None, alias="productUrl")
    http_status_code: int | None = Field(
        default=None,
        ge=100,
        le=599,
        alias="httpStatusCode",
    )
    canonical_url: HttpUrl | None = Field(default=None, alias="canonicalUrl")
    robots_allowed: bool | None = Field(default=None, alias="robotsAllowed")
    indexable: bool | None = None
    page_title: str | None = Field(default=None, alias="pageTitle")
    meta_description: str | None = Field(default=None, alias="metaDescription")
    headings: dict[str, list[str]] = Field(default_factory=dict)
    detected_structured_data: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="detectedStructuredData",
    )
    image_urls: list[HttpUrl] = Field(default_factory=list, alias="imageUrls")
    images_accessible: bool | None = Field(default=None, alias="imagesAccessible")

    @model_validator(mode="after")
    def validate_retrieval_state(self) -> "CrawlMetadata":
        """Reject contradictory crawl states before scoring starts."""
        if self.crawl_status == "success" and not self.accessible:
            raise ValueError("successful crawls must be accessible")
        if self.crawl_status == "success" and not self.content_extracted:
            raise ValueError("successful crawls must have extracted content")
        if self.blocked and self.crawl_status not in {"blocked", "failed", "partial"}:
            raise ValueError("blocked crawls must use blocked, failed, or partial status")
        if self.content_extracted and not self.accessible:
            raise ValueError("content cannot be extracted from an inaccessible page")
        return self
