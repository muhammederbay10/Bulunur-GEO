# ai/geo_engine/scoring/retrieval_score.py
"""Scores product retrieval readiness from crawl metadata and Turkish signals."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import (
    DEFAULT_LAYER_RECOMMENDED_ACTIONS,
    LAYER_COMPONENT_MAX_POINTS,
    MAX_MISSING_SIGNALS_PER_LAYER,
    MAX_REASONS_PER_LAYER,
    MAX_USEFUL_META_DESCRIPTION_CHARS,
    MIN_BODY_TEXT_CHARS,
    MIN_TITLE_TOKENS,
    MIN_USEFUL_DESCRIPTION_CHARS,
    MIN_USEFUL_META_DESCRIPTION_CHARS,
    MIN_USEFUL_TITLE_CHARS,
    SCORE_DECIMAL_PLACES,
    SEMANTIC_COMPONENT_NAME,
)
from ai.geo_engine.types import (
    GeminiLayerJudgment,
    LayerScoreResult,
    ScoreComponentResult,
    TurkishNlpScoringSignals,
)
from ai.turkish_nlp.borrowed_terms import find_borrowed_term_matches
from ai.turkish_nlp.buyer_patterns import detect_buyer_patterns
from ai.turkish_nlp.intent_expansion import expand_buyer_intents
from ai.turkish_nlp.normalize import (
    normalize_text,
    tokenize,
    unique_normalized_terms,
)
from ai.turkish_nlp.synonyms import normalize_query_terms


RETRIEVAL_LAYER = "retrieval"
RETRIEVAL_COMPONENTS = LAYER_COMPONENT_MAX_POINTS[RETRIEVAL_LAYER]

GENERIC_QUERY_TOKENS = {
    "alirken",
    "alinir",
    "daha",
    "dikkat",
    "edilmeli",
    "en",
    "fiyat",
    "fiyati",
    "guvenilir",
    "icin",
    "iyi",
    "kargo",
    "karsilastirma",
    "mi",
    "modelleri",
    "nelere",
    "onerisi",
    "urun",
    "yorumlari",
}


def score_retrieval(
    product: ProductInput,
    *,
    nlp_signals: TurkishNlpScoringSignals | Mapping[str, Any] | None = None,
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any],
) -> LayerScoreResult:
    """Score the retrieval layer without re-crawling the product page."""
    signals = build_retrieval_nlp_signals(product, nlp_signals=nlp_signals)
    semantic_component, semantic_action = _score_semantic_judgment(
        signals,
        semantic_judgment,
    )

    components = [
        _score_crawl_accessibility(product),
        _score_content_extraction(product, signals),
        _score_page_metadata(product, signals),
        _score_product_field_presence(product),
        semantic_component,
    ]

    return LayerScoreResult(
        layer=RETRIEVAL_LAYER,
        components=components,
        recommendedNextAction=_choose_recommended_action(components, semantic_action),
        metadata={
            "crawlStatus": product.crawl_metadata.crawl_status,
            "httpStatusCode": product.crawl_metadata.http_status_code,
            "usedCrawlerMetadata": True,
            "semanticJudgmentRequired": True,
        },
    )


def build_retrieval_nlp_signals(
    product: ProductInput,
    *,
    nlp_signals: TurkishNlpScoringSignals | Mapping[str, Any] | None = None,
) -> TurkishNlpScoringSignals:
    """Build product-agnostic Turkish NLP signals for retrieval scoring."""
    if isinstance(nlp_signals, TurkishNlpScoringSignals):
        return nlp_signals
    if isinstance(nlp_signals, Mapping):
        return TurkishNlpScoringSignals.model_validate(dict(nlp_signals))

    raw = product.raw_extracted
    crawl = product.crawl_metadata
    intent_result = expand_buyer_intents(
        title=product.title,
        category=product.category,
        brand=product.brand,
        attributes=product.attributes,
    )

    retrieval_text = _join_text(
        product.title,
        product.description,
        product.short_description,
        raw.page_title,
        crawl.page_title,
        raw.meta_description,
        crawl.meta_description,
        raw.body_text,
        _flatten_headings(raw.headings),
        _flatten_headings(crawl.headings),
    )

    return TurkishNlpScoringSignals(
        normalizedTitle=normalize_text(product.title),
        normalizedDescription=normalize_text(product.description),
        normalizedShortDescription=normalize_text(product.short_description),
        normalizedPageTitle=normalize_text(raw.page_title or crawl.page_title),
        normalizedMetaDescription=normalize_text(
            raw.meta_description or crawl.meta_description
        ),
        normalizedBodyText=normalize_text(raw.body_text),
        buyerIntentVariants=intent_result.buyer_intent_variants,
        localBuyerIntentVariants=intent_result.local_variants,
        llmBuyerIntentVariants=intent_result.llm_variants,
        intentGroups=intent_result.intent_groups,
        synonymTerms=normalize_query_terms(retrieval_text),
        borrowedTerms=[
            match.canonical for match in find_borrowed_term_matches(retrieval_text)
        ],
        buyerPatterns=detect_buyer_patterns(retrieval_text),
        missingSignals=intent_result.missing_signals,
    )


def build_retrieval_semantic_context(
    product: ProductInput,
    *,
    nlp_signals: TurkishNlpScoringSignals | Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Return compact context that can be sent to the retrieval SKILL.md prompt."""
    signals = build_retrieval_nlp_signals(product, nlp_signals=nlp_signals)
    crawl = product.crawl_metadata
    raw = product.raw_extracted

    return {
        "product": {
            "title": product.title,
            "description": product.description,
            "shortDescription": product.short_description,
            "brand": product.brand,
            "category": product.category,
            "attributes": product.attributes,
        },
        "page": {
            "pageTitle": raw.page_title or crawl.page_title,
            "metaDescription": raw.meta_description or crawl.meta_description,
            "headings": _merge_headings(raw.headings, crawl.headings),
            "bodyText": raw.body_text,
        },
        "crawlMetadata": {
            "crawlStatus": crawl.crawl_status,
            "accessible": crawl.accessible,
            "blocked": crawl.blocked,
            "contentExtracted": crawl.content_extracted,
            "httpStatusCode": crawl.http_status_code,
            "robotsAllowed": crawl.robots_allowed,
            "indexable": crawl.indexable,
        },
        "turkishNlpSignals": signals.model_dump(mode="json", by_alias=True),
    }


def _score_crawl_accessibility(product: ProductInput) -> ScoreComponentResult:
    crawl = product.crawl_metadata
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    http_status = crawl.http_status_code
    if crawl.accessible and _is_success_http_status(http_status):
        points += 2.0
        reasons.append("Crawler verisi ürün sayfasının erişilebilir olduğunu gösteriyor.")
    elif crawl.accessible:
        points += 1.25
        reasons.append("Crawler verisi sayfanın erişilebilir olduğunu gösteriyor.")
        missing.append("Başarılı HTTP durum kodu")
    else:
        missing.append("Erişilebilir ürün sayfası")

    if crawl.crawl_status == "success":
        points += 1.5
        reasons.append("Crawler işlemi başarı durumuyla tamamlandı.")
    elif crawl.crawl_status == "partial":
        points += 0.75
        reasons.append("Crawler kısmi sonuç döndürdü.")
        missing.append("Tam crawl sonucu")
    else:
        missing.append(f"Başarılı crawl durumu; mevcut durum {crawl.crawl_status}.")

    if not crawl.blocked:
        points += 1.0
        reasons.append("Crawler verisinde sayfa engelli görünmüyor.")
    else:
        missing.append("Engellenmemiş crawler erişimi")

    points += _score_optional_boolean(
        crawl.robots_allowed,
        full_points=0.5,
        positive_reason="Robots verisi taramaya izin veriyor.",
        negative_missing="Robots tarama izni",
        unknown_missing="Robots izin verisi",
        reasons=reasons,
        missing=missing,
    )
    points += _score_optional_boolean(
        crawl.indexable,
        full_points=0.5,
        positive_reason="Sayfa indexlenebilir olarak işaretlenmiş.",
        negative_missing="Indexlenebilir ürün sayfası",
        unknown_missing="Indexlenebilirlik verisi",
        reasons=reasons,
        missing=missing,
    )

    if crawl.canonical_url is not None:
        points += 0.5
        reasons.append("Canonical URL crawl verisinde mevcut.")
    elif crawl.product_url is not None:
        points += 0.25
        missing.append("Canonical URL")
    else:
        missing.append("Canonical veya crawl edilen ürün URL'si")

    return _component(
        "crawl_accessibility",
        "crawl_metadata",
        points,
        reasons,
        missing,
        metadata={
            "crawlStatus": crawl.crawl_status,
            "httpStatusCode": http_status,
            "accessible": crawl.accessible,
            "blocked": crawl.blocked,
        },
    )


def _score_content_extraction(
    product: ProductInput,
    signals: TurkishNlpScoringSignals,
) -> ScoreComponentResult:
    crawl = product.crawl_metadata
    raw = product.raw_extracted
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if crawl.content_extracted:
        points += 1.5
        reasons.append("Crawler urun iceriginin cikarildigini bildiriyor.")
    else:
        missing.append("Cikarilmis sayfa icerigi")

    body_length = len(signals.normalized_body_text)
    if body_length >= MIN_BODY_TEXT_CHARS:
        points += 1.0
        reasons.append("Gorunur govde metni retrieval sinyalleri icin yeterli uzunlukta.")
    elif body_length > 0:
        points += 0.45
        missing.append("Daha zengin gorunur urun govde metni")
    else:
        missing.append("Gorunur urun govde metni")

    detected_schema_count = len(raw.detected_schema) + len(crawl.detected_structured_data)
    if detected_schema_count:
        points += 0.75
        reasons.append("Tespit edilen yapilandirilmis veri skorlama motoruna ulasabiliyor.")
    else:
        missing.append("Tespit edilen yapilandirilmis veri")

    image_count = len(product.image_urls) or len(crawl.image_urls)
    if image_count and crawl.images_accessible is True:
        points += 0.75
        reasons.append("Urun gorselleri mevcut ve erisilebilir olarak isaretlenmis.")
    elif image_count:
        points += 0.45
        reasons.append("Urun gorsel URL'leri mevcut.")
        if crawl.images_accessible is False:
            missing.append("Erisilebilir urun gorselleri")
        else:
            missing.append("Gorsel erisilebilirlik metadata verisi")
    else:
        missing.append("Urun gorsel URL'leri")

    return _component(
        "content_extraction",
        "crawl_metadata",
        points,
        reasons,
        missing,
        metadata={
            "bodyTextLength": body_length,
            "detectedSchemaCount": detected_schema_count,
            "imageCount": image_count,
        },
    )


def _score_page_metadata(
    product: ProductInput,
    signals: TurkishNlpScoringSignals,
) -> ScoreComponentResult:
    raw = product.raw_extracted
    crawl = product.crawl_metadata
    page_title = raw.page_title or crawl.page_title
    meta_description = raw.meta_description or crawl.meta_description
    headings = _merge_headings(raw.headings, crawl.headings)
    heading_text = _flatten_headings(headings)
    anchors = _product_anchor_tokens(product)

    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if _has_text(page_title):
        if len(normalize_text(page_title)) >= MIN_USEFUL_TITLE_CHARS and _shares_anchor(
            page_title,
            anchors,
        ):
            points += 1.2
            reasons.append("Sayfa basligi mevcut ve urunle uyumlu.")
        else:
            points += 0.6
            missing.append("Urune ozel sayfa basligi")
    else:
        missing.append("Sayfa basligi")

    meta_length = len(normalize_text(meta_description))
    if meta_length >= MIN_USEFUL_META_DESCRIPTION_CHARS:
        points += 1.0 if meta_length <= MAX_USEFUL_META_DESCRIPTION_CHARS else 0.85
        reasons.append("Meta aciklama kullanilabilir retrieval baglami sagliyor.")
    elif meta_length > 0:
        points += 0.45
        missing.append("Daha aciklayici meta aciklama")
    else:
        missing.append("Meta aciklama")

    if _has_text(heading_text) and _shares_anchor(heading_text, anchors):
        points += 0.8
        reasons.append("Basliklar urun kimligini destekliyor.")
    elif _has_text(heading_text):
        points += 0.4
        missing.append("Urune ozel H1/H2 basliklari")
    else:
        missing.append("Urun sayfasi basliklari")

    return _component(
        "page_metadata",
        "crawl_metadata",
        points,
        reasons,
        missing,
        metadata={
            "hasPageTitle": _has_text(page_title),
            "metaDescriptionLength": meta_length,
            "headingCount": sum(len(values) for values in headings.values()),
        },
    )


def _score_product_field_presence(product: ProductInput) -> ScoreComponentResult:
    points = 0.0
    reasons: list[str] = []
    missing: list[str] = []

    if _is_useful_title(product.title):
        points += 0.5
        reasons.append("Ürün başlığı mevcut ve retrieval için yeterince spesifik.")
    elif _has_text(product.title):
        points += 0.25
        missing.append("Daha spesifik ürün başlığı")
    else:
        missing.append("Ürün başlığı")

    description_text = _join_text(product.description, product.short_description)
    if len(normalize_text(description_text)) >= MIN_USEFUL_DESCRIPTION_CHARS:
        points += 0.5
        reasons.append("Ürün açıklaması retrieval bağlamı sağlıyor.")
    elif _has_text(description_text):
        points += 0.25
        missing.append("Daha zengin ürün açıklaması")
    else:
        missing.append("Ürün açıklaması")

    commerce_points = 0.0
    if _has_text(product.price):
        commerce_points += 0.2
    else:
        missing.append("Ürün fiyatı")
    if _has_text(product.currency):
        commerce_points += 0.15
    else:
        missing.append("Ürün para birimi")
    if product.availability != "unknown":
        commerce_points += 0.15
    else:
        missing.append("Ürün stok durumu")

    if commerce_points > 0:
        reasons.append("Ticari bilgiler retrieval sinyali olarak kullanılabiliyor.")
    points += commerce_points

    qualifier_points = 0.0
    if _has_text(product.brand):
        qualifier_points += 0.15
    else:
        missing.append("Ürün markası")
    if _has_text(product.category):
        qualifier_points += 0.15
    else:
        missing.append("Ürün kategorisi")
    if product.image_urls:
        qualifier_points += 0.1
    else:
        missing.append("Ürün görseli")
    if product.attributes:
        qualifier_points += 0.1
    else:
        missing.append("Ürün özellikleri")

    if qualifier_points > 0:
        reasons.append("Marka, kategori, görsel veya özellik gibi ürün sinyalleri mevcut.")
    points += qualifier_points

    return _component(
        "product_field_presence",
        "product_fields",
        points,
        reasons,
        missing,
        metadata={
            "attributeCount": len(product.attributes),
            "imageCount": len(product.image_urls),
        },
    )


def _score_semantic_judgment(
    signals: TurkishNlpScoringSignals,
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any],
) -> tuple[ScoreComponentResult, str | None]:
    max_points = RETRIEVAL_COMPONENTS[SEMANTIC_COMPONENT_NAME]

    if semantic_judgment is None:
        raise ValueError("semantic_judgment is required for retrieval scoring")

    judgment = _coerce_semantic_judgment(semantic_judgment)
    if judgment.layer is not None and judgment.layer != RETRIEVAL_LAYER:
        raise ValueError("semantic_judgment layer must be retrieval")

    component = judgment.to_component(max_points=max_points)
    component.metadata["buyerIntentVariantCount"] = len(signals.buyer_intent_variants)
    return component, judgment.recommended_next_action


def _coerce_semantic_judgment(
    semantic_judgment: GeminiLayerJudgment | Mapping[str, Any],
) -> GeminiLayerJudgment:
    if isinstance(semantic_judgment, GeminiLayerJudgment):
        return semantic_judgment

    data = dict(semantic_judgment)
    if "semanticScore" not in data and "semantic_score" not in data and "score" in data:
        raw_score = float(data["score"])
        max_score = data.get("maxScore", data.get("max_score"))
        if max_score is not None:
            data["semanticScore"] = raw_score / float(max_score) * 100.0
        elif raw_score <= 10.0:
            data["semanticScore"] = raw_score * 10.0
        else:
            data["semanticScore"] = raw_score

    data.setdefault("layer", RETRIEVAL_LAYER)
    return GeminiLayerJudgment.model_validate(data)


def _component(
    name: str,
    source: str,
    points: float,
    reasons: Sequence[str],
    missing: Sequence[str],
    *,
    metadata: Mapping[str, Any] | None = None,
) -> ScoreComponentResult:
    max_points = RETRIEVAL_COMPONENTS[name]
    return ScoreComponentResult(
        name=name,
        kind="semantic" if name == SEMANTIC_COMPONENT_NAME else "deterministic",
        source=source,
        points=_bounded_points(points, max_points),
        maxPoints=max_points,
        reasons=_limit(reasons, MAX_REASONS_PER_LAYER),
        missingSignals=_limit(missing, MAX_MISSING_SIGNALS_PER_LAYER),
        metadata=dict(metadata or {}),
    )


def _choose_recommended_action(
    components: Sequence[ScoreComponentResult],
    semantic_action: str | None,
) -> str:
    if semantic_action:
        return semantic_action

    by_name = {component.name: component for component in components}
    semantic_component = by_name[SEMANTIC_COMPONENT_NAME]
    if all(_component_ratio(component) >= 0.95 for component in components):
        return "Mevcut crawl erişimini, metadata yapısını ve Türkçe retrieval sinyallerini koruyun."
    if _component_ratio(by_name["crawl_accessibility"]) < 0.8:
        return "Önce crawl erişimini, robots/indexlenebilirlik durumunu ve canonical URL sinyallerini düzeltin."
    if _component_ratio(by_name["content_extraction"]) < 0.75:
        return "Daha zengin görünür ürün metni, yapılandırılmış veri ve görsel sinyalleri ekleyin."
    if _component_ratio(by_name["page_metadata"]) < 0.75:
        return "Sayfa başlığını, meta açıklamayı ve H1/H2 ürün uyumunu iyileştirin."
    if _component_ratio(by_name[SEMANTIC_COMPONENT_NAME]) < 0.75:
        return "Başlıkta, metadata alanlarında ve gövde metninde Türkçe alıcı niyeti uyumunu güçlendirin."
    return DEFAULT_LAYER_RECOMMENDED_ACTIONS[RETRIEVAL_LAYER]


def _score_optional_boolean(
    value: bool | None,
    *,
    full_points: float,
    positive_reason: str,
    negative_missing: str,
    unknown_missing: str,
    reasons: list[str],
    missing: list[str],
) -> float:
    if value is True:
        reasons.append(positive_reason)
        return full_points
    if value is False:
        missing.append(negative_missing)
        return 0.0
    missing.append(unknown_missing)
    return 0.0


def _component_ratio(component: ScoreComponentResult) -> float:
    return component.points / component.max_points


def _bounded_points(points: float, max_points: float) -> float:
    return round(min(max(points, 0.0), max_points), SCORE_DECIMAL_PLACES)


def _is_success_http_status(status_code: int | None) -> bool:
    return status_code is not None and 200 <= status_code < 400


def _is_useful_title(value: str | None) -> bool:
    normalized = normalize_text(value)
    return (
        len(normalized) >= MIN_USEFUL_TITLE_CHARS
        and len(_meaningful_tokens(normalized)) >= MIN_TITLE_TOKENS
    )


def _shares_anchor(text: str | None, anchors: Sequence[str]) -> bool:
    text_tokens = set(_meaningful_tokens(text))
    return bool(text_tokens.intersection(anchors))


def _product_anchor_tokens(product: ProductInput) -> list[str]:
    anchor_text = _join_text(product.title, product.category, product.brand)
    return _meaningful_tokens(anchor_text)


def _meaningful_tokens(text: str | None) -> list[str]:
    return [
        token
        for token in tokenize(text)
        if len(token) > 2 and token not in GENERIC_QUERY_TOKENS
    ]


def _merge_headings(
    primary: Mapping[str, list[str]],
    fallback: Mapping[str, list[str]],
) -> dict[str, list[str]]:
    merged: dict[str, list[str]] = {}
    for source in (fallback, primary):
        for key, values in source.items():
            normalized_key = str(key).strip().lower()
            if not normalized_key:
                continue
            merged.setdefault(normalized_key, [])
            merged[normalized_key].extend(str(value) for value in values if _has_text(value))

    return {
        key: unique_normalized_terms(values, fold_diacritics=False)
        for key, values in merged.items()
        if values
    }


def _flatten_headings(headings: Mapping[str, Sequence[str]]) -> str:
    values = [
        value
        for key, values in headings.items()
        if str(key).lower() in {"h1", "h2", "h3"}
        for value in values
    ]
    return _join_text(*values)


def _join_text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                parts.append(value.strip())
            continue
        if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
            parts.extend(str(item).strip() for item in value if _has_text(item))
            continue
        if _has_text(value):
            parts.append(str(value).strip())
    return " ".join(parts)


def _has_text(value: Any) -> bool:
    return bool(normalize_text(str(value)) if value is not None else "")


def _limit(values: Sequence[str], limit: int) -> list[str]:
    seen: set[str] = set()
    limited: list[str] = []

    for value in values:
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        limited.append(normalized)
        if len(limited) >= limit:
            break

    return limited


__all__ = [
    "build_retrieval_nlp_signals",
    "build_retrieval_semantic_context",
    "score_retrieval",
]
