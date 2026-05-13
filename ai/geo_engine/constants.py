# ai/geo_engine/constants.py
"""Defines reusable constants for Bulunur's four-layer GEO scoring engine."""

from __future__ import annotations

from typing import Final


DEFAULT_LAYER_MAX_SCORE: Final[float] = 100.0
OVERALL_MAX_WEIGHTED_POINTS: Final[float] = 100.0
SCORE_DECIMAL_PLACES: Final[int] = 2
POINT_TOLERANCE: Final[float] = 0.01

EXPECTED_LAYER_ORDER: Final[tuple[str, ...]] = (
    "retrieval",
    "machine_understanding",
    "reranking_strength",
    "ai_answer_readiness",
)

LAYER_MAX_WEIGHTED_POINTS: Final[dict[str, float]] = {
    "retrieval": 25.0,
    "machine_understanding": 30.0,
    "reranking_strength": 25.0,
    "ai_answer_readiness": 20.0,
}

LAYER_DETERMINISTIC_MAX_POINTS: Final[dict[str, float]] = {
    "retrieval": 15.0,
    "machine_understanding": 20.0,
    "reranking_strength": 15.0,
    "ai_answer_readiness": 12.0,
}

LAYER_SEMANTIC_MAX_POINTS: Final[dict[str, float]] = {
    "retrieval": 10.0,
    "machine_understanding": 10.0,
    "reranking_strength": 10.0,
    "ai_answer_readiness": 8.0,
}

LAYER_DISPLAY_NAMES: Final[dict[str, str]] = {
    "retrieval": "Retrieval",
    "machine_understanding": "Machine Understanding",
    "reranking_strength": "Reranking Strength",
    "ai_answer_readiness": "AI Answer Readiness",
}

SEMANTIC_COMPONENT_NAME: Final[str] = "semantic_judgment"

LAYER_COMPONENT_MAX_POINTS: Final[dict[str, dict[str, float]]] = {
    "retrieval": {
        "crawl_accessibility": 6.0,
        "content_extraction": 4.0,
        "page_metadata": 3.0,
        "product_field_presence": 2.0,
        SEMANTIC_COMPONENT_NAME: 10.0,
    },
    "machine_understanding": {
        "schema_validation": 10.0,
        "offer_fact_completeness": 5.0,
        "product_fact_coverage": 3.0,
        "attribute_normalization": 2.0,
        SEMANTIC_COMPONENT_NAME: 10.0,
    },
    "reranking_strength": {
        "attribute_completeness": 6.0,
        "trust_signal_presence": 4.0,
        "buyer_pattern_coverage": 3.0,
        "comparison_readiness_signals": 2.0,
        SEMANTIC_COMPONENT_NAME: 10.0,
    },
    "ai_answer_readiness": {
        "answer_content_presence": 4.0,
        "faq_readiness": 3.0,
        "known_fact_grounding": 3.0,
        "missing_fact_control": 2.0,
        SEMANTIC_COMPONENT_NAME: 8.0,
    },
}

LAYER_SKILL_PATHS: Final[dict[str, str]] = {
    "retrieval": "analysis/retrieval_evaluation",
    "machine_understanding": "analysis/machine_understanding",
    "reranking_strength": "analysis/reranking_evaluation",
    "ai_answer_readiness": "analysis/answer_readiness",
}

TURKISH_INTENT_SKILL_PATH: Final[str] = "analysis/turkish_intent_expansion"

CORE_PRODUCT_FACT_FIELDS: Final[tuple[str, ...]] = (
    "title",
    "description",
    "short_description",
    "price",
    "currency",
    "availability",
    "brand",
    "category",
    "image_urls",
    "attributes",
)

REQUIRED_SCHEMA_FIELD_NAMES: Final[tuple[str, ...]] = ("@type", "name")
RECOMMENDED_SCHEMA_FIELD_NAMES: Final[tuple[str, ...]] = (
    "description",
    "image",
    "brand",
    "offers",
)
REQUIRED_OFFER_FIELD_NAMES: Final[tuple[str, ...]] = (
    "price",
    "priceCurrency",
    "availability",
)

MIN_TITLE_TOKENS: Final[int] = 2
MIN_USEFUL_TITLE_CHARS: Final[int] = 12
MIN_USEFUL_DESCRIPTION_CHARS: Final[int] = 80
MIN_STRONG_DESCRIPTION_CHARS: Final[int] = 180
MIN_USEFUL_META_DESCRIPTION_CHARS: Final[int] = 50
MAX_USEFUL_META_DESCRIPTION_CHARS: Final[int] = 180
MIN_BODY_TEXT_CHARS: Final[int] = 120
MIN_IMAGE_COUNT_FOR_FULL_CREDIT: Final[int] = 1
MIN_ATTRIBUTE_COUNT_FOR_FULL_CREDIT: Final[int] = 4
MIN_TRUST_SIGNAL_COUNT_FOR_FULL_CREDIT: Final[int] = 2
MIN_BUYER_PATTERN_COUNT_FOR_FULL_CREDIT: Final[int] = 4
MIN_BUYER_INTENT_VARIANTS_FOR_CONTEXT: Final[int] = 4
MIN_FAQ_ITEM_COUNT_FOR_FULL_CREDIT: Final[int] = 2
MIN_KNOWN_FACT_COUNT_FOR_GROUNDING: Final[int] = 5
MAX_REASONS_PER_LAYER: Final[int] = 6
MAX_MISSING_SIGNALS_PER_LAYER: Final[int] = 6
MAX_MAIN_PROBLEMS: Final[int] = 6

GOOD_LAYER_SCORE_THRESHOLD: Final[float] = 80.0
WEAK_LAYER_SCORE_THRESHOLD: Final[float] = 55.0

DEFAULT_LAYER_RECOMMENDED_ACTIONS: Final[dict[str, str]] = {
    "retrieval": "Improve crawlability, metadata, and Turkish query relevance first.",
    "machine_understanding": "Repair Product JSON-LD and complete trusted offer facts.",
    "reranking_strength": "Add specific attributes, trust signals, and comparison-ready detail.",
    "ai_answer_readiness": "Add grounded FAQ and answer-ready Turkish summary content.",
}

__all__ = [
    "CORE_PRODUCT_FACT_FIELDS",
    "DEFAULT_LAYER_MAX_SCORE",
    "DEFAULT_LAYER_RECOMMENDED_ACTIONS",
    "EXPECTED_LAYER_ORDER",
    "GOOD_LAYER_SCORE_THRESHOLD",
    "LAYER_COMPONENT_MAX_POINTS",
    "LAYER_DETERMINISTIC_MAX_POINTS",
    "LAYER_DISPLAY_NAMES",
    "LAYER_MAX_WEIGHTED_POINTS",
    "LAYER_SEMANTIC_MAX_POINTS",
    "LAYER_SKILL_PATHS",
    "MAX_MAIN_PROBLEMS",
    "MAX_MISSING_SIGNALS_PER_LAYER",
    "MAX_REASONS_PER_LAYER",
    "MAX_USEFUL_META_DESCRIPTION_CHARS",
    "MIN_ATTRIBUTE_COUNT_FOR_FULL_CREDIT",
    "MIN_BODY_TEXT_CHARS",
    "MIN_BUYER_INTENT_VARIANTS_FOR_CONTEXT",
    "MIN_BUYER_PATTERN_COUNT_FOR_FULL_CREDIT",
    "MIN_FAQ_ITEM_COUNT_FOR_FULL_CREDIT",
    "MIN_IMAGE_COUNT_FOR_FULL_CREDIT",
    "MIN_KNOWN_FACT_COUNT_FOR_GROUNDING",
    "MIN_STRONG_DESCRIPTION_CHARS",
    "MIN_TITLE_TOKENS",
    "MIN_TRUST_SIGNAL_COUNT_FOR_FULL_CREDIT",
    "MIN_USEFUL_DESCRIPTION_CHARS",
    "MIN_USEFUL_META_DESCRIPTION_CHARS",
    "MIN_USEFUL_TITLE_CHARS",
    "OVERALL_MAX_WEIGHTED_POINTS",
    "POINT_TOLERANCE",
    "RECOMMENDED_SCHEMA_FIELD_NAMES",
    "REQUIRED_OFFER_FIELD_NAMES",
    "REQUIRED_SCHEMA_FIELD_NAMES",
    "SCORE_DECIMAL_PLACES",
    "SEMANTIC_COMPONENT_NAME",
    "TURKISH_INTENT_SKILL_PATH",
    "WEAK_LAYER_SCORE_THRESHOLD",
]
