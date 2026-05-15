# ai/geo_engine/improvement/collect_missing_facts.py
"""Builds targeted user questions for high-impact missing product facts."""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.geo_improvement_output import SelectedStrategy
from ai.api_contracts.user_fact_questions import QuestionTarget, UserFactQuestion
from ai.geo_engine.strategies.base import (
    ImprovementStrategySelection,
    STRATEGY_ATTRIBUTE_COMPLETION,
    STRATEGY_BUYER_INTENT_REWRITE,
    STRATEGY_FAQ_ENRICHMENT,
    STRATEGY_SCHEMA_REPAIR,
    StrategyId,
    StrategySelectionResult,
)
from ai.schema_engine.schema_mapping import is_known_value, normalize_text


DEFAULT_MAX_USER_FACT_QUESTIONS = 3


@dataclass(frozen=True)
class MissingFactRule:
    """Rule describing one askable missing fact."""

    field: str
    aliases: tuple[str, ...]
    signal_keywords: tuple[str, ...]
    strategies: tuple[StrategyId, ...]
    required_for: tuple[QuestionTarget, ...]
    question: str
    reason: str
    priority: int


MISSING_FACT_RULES: tuple[MissingFactRule, ...] = (
    MissingFactRule(
        field="availability",
        aliases=("availability", "offerAvailability", "offers.availability"),
        signal_keywords=("availability", "stok", "stoktaki", "in stock", "offer"),
        strategies=(STRATEGY_SCHEMA_REPAIR,),
        required_for=("schema",),
        question="Urunun stok durumunu dogrular misiniz?",
        reason="Offer schema ve guvenli urun onerileri icin stok durumu gercek bir kaynakla dogrulanmali.",
        priority=10,
    ),
    MissingFactRule(
        field="price",
        aliases=("price", "offerPrice", "offers.price"),
        signal_keywords=("price", "fiyat", "offer", "teklif"),
        strategies=(STRATEGY_SCHEMA_REPAIR,),
        required_for=("schema",),
        question="Urunun guncel satis fiyatini dogrular misiniz?",
        reason="Product JSON-LD icindeki Offer.price degeri tahmin edilemez; fiyat kullanicidan veya platformdan gelmeli.",
        priority=20,
    ),
    MissingFactRule(
        field="currency",
        aliases=("currency", "priceCurrency", "offers.priceCurrency"),
        signal_keywords=("currency", "pricecurrency", "para birimi", "try", "tl"),
        strategies=(STRATEGY_SCHEMA_REPAIR,),
        required_for=("schema",),
        question="Fiyat para birimi nedir?",
        reason="Offer.priceCurrency alani eksikse schema tamamlanirken para birimi uydurulamaz.",
        priority=30,
    ),
    MissingFactRule(
        field="brand",
        aliases=("brand", "manufacturer", "marka"),
        signal_keywords=("brand", "marka", "manufacturer", "uretici"),
        strategies=(STRATEGY_SCHEMA_REPAIR, STRATEGY_ATTRIBUTE_COMPLETION),
        required_for=("schema", "attributes", "comparison_readiness"),
        question="Urunun marka veya uretici bilgisini dogrular misiniz?",
        reason="Marka bilgisi schema, karsilastirma ve guvenli AI ozeti icin onemli bir kimlik sinyalidir.",
        priority=40,
    ),
    MissingFactRule(
        field="attributes",
        aliases=("attributes", "categoryAttributes", "productAttributes"),
        signal_keywords=(
            "attribute",
            "attributes",
            "ozellik",
            "nitelik",
            "kategori ozelligi",
            "malzeme",
            "olcu",
            "boyut",
            "kapasite",
        ),
        strategies=(STRATEGY_ATTRIBUTE_COMPLETION,),
        required_for=("attributes", "comparison_readiness", "faq"),
        question="Bu urun icin en onemli teknik veya kategori ozellikleri nelerdir?",
        reason="Kategori ozellikleri eksikken aciklama, FAQ veya karsilastirma iceriginde somut iddia uretilmemeli.",
        priority=50,
    ),
    MissingFactRule(
        field="useCases",
        aliases=("useCases", "usage", "targetUse", "usageAreas"),
        signal_keywords=("kullanim", "kullanim alani", "kimler icin", "alici niyeti", "buyer intent"),
        strategies=(STRATEGY_ATTRIBUTE_COMPLETION, STRATEGY_FAQ_ENRICHMENT),
        required_for=("attributes", "faq", "comparison_readiness"),
        question="Urun hangi kullanim alanlari veya hangi alici ihtiyaclari icin uygundur?",
        reason="Kullanim alani bilinmeden alici niyeti, FAQ ve karsilastirma metinleri guvenli sekilde zenginlestirilemez.",
        priority=60,
    ),
    MissingFactRule(
        field="trustSignals",
        aliases=("trustSignals", "warranty", "shipping", "returnPolicy", "certifications"),
        signal_keywords=("trust", "guven", "warranty", "garanti", "shipping", "kargo", "sertifika"),
        strategies=(STRATEGY_FAQ_ENRICHMENT,),
        required_for=("trust_signals", "faq"),
        question="Urun icin dogrulanmis garanti, iade, kargo veya sertifika bilgisi var mi?",
        reason="Guven sinyalleri eksikken garanti, kargo veya sertifika iddialari uretilmemeli.",
        priority=70,
    ),
    MissingFactRule(
        field="description",
        aliases=("description", "shortDescription", "longDescription"),
        signal_keywords=("description", "aciklama", "generic", "thin content", "zayif icerik", "genel"),
        strategies=(STRATEGY_BUYER_INTENT_REWRITE,),
        required_for=("description", "short_description"),
        question="Urunu mevcut sayfadakinden daha net anlatan dogrulanmis kisa bir aciklama var mi?",
        reason="Mevcut aciklama zayifsa alici niyetine uygun yeniden yazim gercek urun bilgileriyle sinirlanmali.",
        priority=80,
    ),
)


def collect_missing_facts(
    analysis: GeoAnalysisOutput | Mapping[str, Any],
    selected_strategies: StrategySelectionResult
    | Sequence[ImprovementStrategySelection]
    | Sequence[SelectedStrategy]
    | Sequence[Mapping[str, Any]]
    | None = None,
    *,
    max_questions: int = DEFAULT_MAX_USER_FACT_QUESTIONS,
) -> list[UserFactQuestion]:
    """Return targeted user questions for missing facts that block safe generation."""
    normalized_analysis = _coerce_analysis(analysis)
    if max_questions < 1:
        raise ValueError("max_questions must be at least 1")

    strategy_ids = _selected_strategy_ids(selected_strategies)
    signal_blob = _analysis_signal_blob(normalized_analysis)

    questions: list[UserFactQuestion] = []
    for rule in sorted(MISSING_FACT_RULES, key=lambda item: item.priority):
        if not _rule_applies(rule, normalized_analysis, strategy_ids, signal_blob):
            continue

        questions.append(
            UserFactQuestion(
                field=rule.field,
                question=rule.question,
                reason=rule.reason,
                requiredFor=list(rule.required_for),
            )
        )
        if len(questions) >= max_questions:
            break

    return questions


def needs_user_input(
    analysis: GeoAnalysisOutput | Mapping[str, Any],
    selected_strategies: StrategySelectionResult
    | Sequence[ImprovementStrategySelection]
    | Sequence[SelectedStrategy]
    | Sequence[Mapping[str, Any]]
    | None = None,
) -> bool:
    """Return whether optimization should pause for user-confirmed facts."""
    return bool(collect_missing_facts(analysis, selected_strategies))


def _rule_applies(
    rule: MissingFactRule,
    analysis: GeoAnalysisOutput,
    strategy_ids: set[StrategyId],
    signal_blob: str,
) -> bool:
    strategy_matches = not strategy_ids or any(strategy in strategy_ids for strategy in rule.strategies)
    if not strategy_matches:
        return False

    fact_missing = not _has_known_fact(analysis.known_facts, rule.aliases)
    signal_mentions_fact = _has_any_keyword(signal_blob, rule.signal_keywords)
    description_is_weak = rule.field == "description" and _description_is_weak(analysis)
    explicit_missing = _has_missing_fact_hint(analysis.missing_facts, rule)
    reranking_is_weak = analysis.scores.reranking_strength.score <= 55
    answer_is_weak = analysis.scores.ai_answer_readiness.score <= 55

    if description_is_weak:
        return STRATEGY_BUYER_INTENT_REWRITE in strategy_ids

    if rule.field in {"price", "currency", "availability"}:
        return fact_missing and STRATEGY_SCHEMA_REPAIR in strategy_ids

    if rule.field == "attributes":
        return STRATEGY_ATTRIBUTE_COMPLETION in strategy_ids and (
            _attributes_are_missing(analysis)
            or (explicit_missing and reranking_is_weak)
        )

    if rule.field == "useCases":
        return any(
            strategy in strategy_ids
            for strategy in (STRATEGY_ATTRIBUTE_COMPLETION, STRATEGY_FAQ_ENRICHMENT)
        ) and (
            (_use_cases_are_missing(analysis) and signal_mentions_fact)
            or (explicit_missing and answer_is_weak)
        )

    if rule.field == "trustSignals":
        return STRATEGY_FAQ_ENRICHMENT in strategy_ids and (
            (explicit_missing and reranking_is_weak)
            or (_trust_signals_are_missing(analysis) and signal_mentions_fact and reranking_is_weak)
        )

    if rule.field == "brand":
        return fact_missing and (explicit_missing or signal_mentions_fact)

    return fact_missing and (explicit_missing or signal_mentions_fact)


def _selected_strategy_ids(
    selected_strategies: StrategySelectionResult
    | Sequence[ImprovementStrategySelection]
    | Sequence[SelectedStrategy]
    | Sequence[Mapping[str, Any]]
    | None,
) -> set[StrategyId]:
    if selected_strategies is None:
        return set()

    if isinstance(selected_strategies, StrategySelectionResult):
        strategies = selected_strategies.selected_strategies
    else:
        strategies = selected_strategies

    strategy_ids: set[StrategyId] = set()
    for strategy in strategies:
        if isinstance(strategy, ImprovementStrategySelection):
            strategy_ids.add(strategy.strategy_id)
            continue
        if isinstance(strategy, SelectedStrategy):
            strategy_id = _strategy_id_from_name(strategy.name)
            if strategy_id is not None:
                strategy_ids.add(strategy_id)
            continue
        if isinstance(strategy, Mapping):
            raw_value = strategy.get("strategyId") or strategy.get("strategy_id")
            if raw_value in _all_strategy_ids():
                strategy_ids.add(raw_value)  # type: ignore[arg-type]
                continue
            raw_name = strategy.get("name")
            if raw_name is not None:
                strategy_id = _strategy_id_from_name(str(raw_name))
                if strategy_id is not None:
                    strategy_ids.add(strategy_id)

    return strategy_ids


def _strategy_id_from_name(name: str) -> StrategyId | None:
    normalized_name = normalize_text(name)
    for strategy_id, display_name in STRATEGY_DISPLAY_NAMES.items():
        if normalize_text(display_name) == normalized_name:
            return strategy_id
    return None


def _all_strategy_ids() -> set[str]:
    return {
        STRATEGY_SCHEMA_REPAIR,
        STRATEGY_ATTRIBUTE_COMPLETION,
        STRATEGY_BUYER_INTENT_REWRITE,
        STRATEGY_FAQ_ENRICHMENT,
    }


def _has_known_fact(known_facts: Mapping[str, Any], aliases: Sequence[str]) -> bool:
    for alias in aliases:
        value = _lookup_fact(known_facts, alias)
        if is_known_value(value):
            return True
    return False


def _lookup_fact(known_facts: Mapping[str, Any], alias: str) -> Any:
    if alias in known_facts:
        return known_facts[alias]

    normalized_alias = normalize_text(alias)
    for key, value in known_facts.items():
        if normalize_text(key) == normalized_alias:
            return value

    if "." not in alias:
        return None

    current: Any = known_facts
    for part in alias.split("."):
        if not isinstance(current, Mapping):
            return None

        matched_key = next(
            (key for key in current if normalize_text(key) == normalize_text(part)),
            None,
        )
        if matched_key is None:
            return None
        current = current[matched_key]

    return current


def _description_is_weak(analysis: GeoAnalysisOutput) -> bool:
    description = _lookup_fact(
        analysis.known_facts,
        "description",
    ) or _lookup_fact(analysis.known_facts, "shortDescription")
    if not is_known_value(description):
        return True

    normalized = normalize_text(description)
    return len(normalized) < 80


def _attributes_are_missing(analysis: GeoAnalysisOutput) -> bool:
    attributes = _lookup_fact(analysis.known_facts, "attributes")
    return not (isinstance(attributes, Mapping) and attributes)


def _use_cases_are_missing(analysis: GeoAnalysisOutput) -> bool:
    use_case_aliases = (
        "useCases",
        "usage",
        "usageArea",
        "usageAreas",
        "suitableFor",
        "targetUse",
        "attributes.usageArea",
        "attributes.suitableFor",
    )
    return not _has_known_fact(analysis.known_facts, use_case_aliases)


def _trust_signals_are_missing(analysis: GeoAnalysisOutput) -> bool:
    trust_aliases = (
        "warranty",
        "shipping",
        "returnPolicy",
        "certifications",
        "attributes.warranty",
        "attributes.shipping",
        "attributes.returnPolicy",
        "attributes.certifications",
    )
    return not _has_known_fact(analysis.known_facts, trust_aliases)


def _has_missing_fact_hint(
    missing_facts: Sequence[str],
    rule: MissingFactRule,
) -> bool:
    normalized_facts = [normalize_text(value) for value in missing_facts]
    normalized_aliases = {normalize_text(alias) for alias in rule.aliases}
    normalized_field = normalize_text(rule.field)

    for value in normalized_facts:
        if value == normalized_field:
            return True
        if value.startswith(f"{normalized_field}."):
            return True
        if value in normalized_aliases:
            return True
        for alias in normalized_aliases:
            if alias and alias in value:
                return True

    return False


def _coerce_analysis(analysis: GeoAnalysisOutput | Mapping[str, Any]) -> GeoAnalysisOutput:
    if isinstance(analysis, GeoAnalysisOutput):
        return analysis
    return GeoAnalysisOutput.model_validate(analysis)


def _analysis_signal_blob(analysis: GeoAnalysisOutput) -> str:
    values: list[Any] = [
        analysis.missing_facts,
        analysis.main_problems,
        analysis.recommended_action,
        analysis.scores.retrieval.missing_signals,
        analysis.scores.retrieval.recommended_next_action,
        analysis.scores.machine_understanding.missing_signals,
        analysis.scores.machine_understanding.recommended_next_action,
        analysis.scores.reranking_strength.missing_signals,
        analysis.scores.reranking_strength.recommended_next_action,
        analysis.scores.ai_answer_readiness.missing_signals,
        analysis.scores.ai_answer_readiness.recommended_next_action,
    ]
    return " | ".join(normalize_text(value) for value in _flatten_values(values))


def _flatten_values(values: Iterable[Any]) -> Iterable[Any]:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            yield value
            continue
        if isinstance(value, Mapping):
            yield from _flatten_values(value.keys())
            yield from _flatten_values(value.values())
            continue
        if isinstance(value, Iterable):
            yield from _flatten_values(value)
            continue
        yield value


def _has_any_keyword(text: str, keywords: Iterable[str]) -> bool:
    normalized_text = normalize_text(text)
    return any(normalize_text(keyword) in normalized_text for keyword in keywords)


__all__ = [
    "DEFAULT_MAX_USER_FACT_QUESTIONS",
    "MISSING_FACT_RULES",
    "MissingFactRule",
    "collect_missing_facts",
    "needs_user_input",
]
