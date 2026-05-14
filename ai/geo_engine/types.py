# ai/geo_engine/types.py
"""Defines shared result types for Bulunur's four-layer GEO scoring engine."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput, LayerScore, ScoreBreakdown
from ai.geo_engine.constants import (
    DEFAULT_LAYER_MAX_SCORE,
    EXPECTED_LAYER_ORDER,
    LAYER_COMPONENT_MAX_POINTS,
    LAYER_DETERMINISTIC_MAX_POINTS,
    LAYER_DISPLAY_NAMES,
    LAYER_MAX_WEIGHTED_POINTS,
    LAYER_SEMANTIC_MAX_POINTS,
    OVERALL_MAX_WEIGHTED_POINTS,
    POINT_TOLERANCE,
    SCORE_DECIMAL_PLACES,
    SEMANTIC_COMPONENT_NAME,
)


GeoScoreLayer = Literal[
    "retrieval",
    "machine_understanding",
    "reranking_strength",
    "ai_answer_readiness",
]
ScoreComponentKind = Literal["deterministic", "semantic"]
ScoreSignalSource = Literal[
    "crawl_metadata",
    "product_fields",
    "schema_validation",
    "turkish_nlp",
    "gemini",
    "score_math",
]

class LayerScoringConfig(BaseModel):
    """Point-budget split for deterministic and Gemini scoring inside one layer."""

    model_config = ConfigDict(populate_by_name=True)

    layer: GeoScoreLayer
    max_weighted_points: float = Field(gt=0, alias="maxWeightedPoints")
    deterministic_max_points: float = Field(gt=0, alias="deterministicMaxPoints")
    semantic_max_points: float = Field(gt=0, alias="semanticMaxPoints")

    @model_validator(mode="after")
    def validate_budget(self) -> "LayerScoringConfig":
        """Keep component budgets aligned with the agreed layer weight."""
        expected = get_layer_max_weighted_points(self.layer)
        if not _points_close(self.max_weighted_points, expected):
            raise ValueError(f"{self.layer} maxWeightedPoints must be {expected}")

        expected_deterministic = LAYER_DETERMINISTIC_MAX_POINTS[self.layer]
        if not _points_close(self.deterministic_max_points, expected_deterministic):
            raise ValueError(
                f"{self.layer} deterministicMaxPoints must be {expected_deterministic}"
            )

        expected_semantic = LAYER_SEMANTIC_MAX_POINTS[self.layer]
        if not _points_close(self.semantic_max_points, expected_semantic):
            raise ValueError(f"{self.layer} semanticMaxPoints must be {expected_semantic}")

        component_total = self.deterministic_max_points + self.semantic_max_points
        if not _points_close(component_total, self.max_weighted_points):
            raise ValueError(
                "deterministicMaxPoints and semanticMaxPoints must sum to maxWeightedPoints"
            )
        return self


class ScoreComponentResult(BaseModel):
    """One deterministic or Gemini-backed point contribution inside a GEO layer."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1)
    kind: ScoreComponentKind
    source: ScoreSignalSource
    points: float = Field(ge=0)
    max_points: float = Field(gt=0, alias="maxPoints")
    reasons: list[str] = Field(default_factory=list)
    missing_signals: list[str] = Field(default_factory=list, alias="missingSignals")
    metadata: dict[str, Any] = Field(default_factory=dict)

    @computed_field
    @property
    def score(self) -> float:
        """Return this component score as a 0-100 percentage."""
        return score_percent_from_points(self.points, self.max_points)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Reject blank component names after trimming."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("name cannot be blank")
        return normalized

    @field_validator("reasons", "missing_signals", mode="before")
    @classmethod
    def normalize_text_list(cls, values: Any) -> list[str]:
        """Normalize explanation lists while preserving first-seen order."""
        return _dedupe_text(_coerce_text_iterable(values))

    @model_validator(mode="after")
    def validate_points(self) -> "ScoreComponentResult":
        """Prevent component points from exceeding their component budget."""
        if self.points > self.max_points:
            raise ValueError("points cannot exceed maxPoints")
        return self


class GeminiLayerJudgment(BaseModel):
    """Structured semantic judgment returned by a layer-specific Gemini skill."""

    model_config = ConfigDict(populate_by_name=True)

    layer: GeoScoreLayer | None = None
    semantic_score: float = Field(ge=0, le=100, alias="semanticScore")
    reasons: list[str] = Field(default_factory=list)
    missing_signals: list[str] = Field(default_factory=list, alias="missingSignals")
    recommended_next_action: str | None = Field(
        default=None,
        alias="recommendedNextAction",
    )
    confidence: float | None = Field(default=None, ge=0, le=1)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_score_aliases(cls, data: Any) -> Any:
        """Accept common score keys from structured LLM JSON responses."""
        if not isinstance(data, Mapping):
            return data

        normalized = dict(data)
        has_semantic_score = "semanticScore" in normalized or "semantic_score" in normalized
        if not has_semantic_score:
            for key in ("score", "geminiScore", "gemini_score"):
                if key in normalized:
                    normalized["semanticScore"] = normalized[key]
                    break

        if "missingSignals" not in normalized and "missing_signals" not in normalized:
            for key in ("missing", "missingSignalsDetected"):
                if key in normalized:
                    normalized["missingSignals"] = normalized[key]
                    break

        if (
            "recommendedNextAction" not in normalized
            and "recommended_next_action" not in normalized
            and "nextAction" in normalized
        ):
            normalized["recommendedNextAction"] = normalized["nextAction"]

        return normalized

    @field_validator("reasons", "missing_signals", mode="before")
    @classmethod
    def normalize_text_list(cls, values: Any) -> list[str]:
        """Normalize explanation lists while preserving first-seen order."""
        return _dedupe_text(_coerce_text_iterable(values))

    @field_validator("recommended_next_action")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional user-facing guidance text."""
        return _clean_optional_text(value)

    def to_component(
        self,
        *,
        max_points: float,
        name: str = SEMANTIC_COMPONENT_NAME,
    ) -> ScoreComponentResult:
        """Convert the semantic percentage judgment into weighted layer points."""
        metadata = dict(self.metadata)
        if self.confidence is not None:
            metadata["confidence"] = self.confidence
        if self.layer is not None:
            metadata["layer"] = self.layer

        return ScoreComponentResult(
            name=name,
            kind="semantic",
            source="gemini",
            points=weighted_points_from_percent(self.semantic_score, max_points),
            maxPoints=max_points,
            reasons=self.reasons,
            missingSignals=self.missing_signals,
            metadata=metadata,
        )


class TurkishNlpScoringSignals(BaseModel):
    """Normalized Turkish NLP context used as scoring signals, not hard rules."""

    model_config = ConfigDict(populate_by_name=True)

    normalized_title: str = Field(default="", alias="normalizedTitle")
    normalized_description: str = Field(default="", alias="normalizedDescription")
    normalized_short_description: str = Field(default="", alias="normalizedShortDescription")
    normalized_page_title: str = Field(default="", alias="normalizedPageTitle")
    normalized_meta_description: str = Field(default="", alias="normalizedMetaDescription")
    normalized_body_text: str = Field(default="", alias="normalizedBodyText")
    buyer_intent_variants: list[str] = Field(default_factory=list, alias="buyerIntentVariants")
    local_buyer_intent_variants: list[str] = Field(
        default_factory=list,
        alias="localBuyerIntentVariants",
    )
    llm_buyer_intent_variants: list[str] = Field(
        default_factory=list,
        alias="llmBuyerIntentVariants",
    )
    intent_groups: dict[str, list[str]] = Field(default_factory=dict, alias="intentGroups")
    synonym_terms: list[str] = Field(default_factory=list, alias="synonymTerms")
    borrowed_terms: list[str] = Field(default_factory=list, alias="borrowedTerms")
    buyer_patterns: list[str] = Field(default_factory=list, alias="buyerPatterns")
    trust_signals: list[str] = Field(default_factory=list, alias="trustSignals")
    known_attributes: dict[str, Any] = Field(default_factory=dict, alias="knownAttributes")
    unknown_attributes: dict[str, Any] = Field(default_factory=dict, alias="unknownAttributes")
    missing_attribute_hints: list[str] = Field(
        default_factory=list,
        alias="missingAttributeHints",
    )
    missing_signals: list[str] = Field(default_factory=list, alias="missingSignals")

    @field_validator(
        "normalized_title",
        "normalized_description",
        "normalized_short_description",
        "normalized_page_title",
        "normalized_meta_description",
        "normalized_body_text",
        mode="before",
    )
    @classmethod
    def normalize_text_field(cls, value: Any) -> str:
        """Convert optional text into a stripped string."""
        if value is None:
            return ""
        return str(value).strip()

    @field_validator(
        "buyer_intent_variants",
        "local_buyer_intent_variants",
        "llm_buyer_intent_variants",
        "synonym_terms",
        "borrowed_terms",
        "buyer_patterns",
        "trust_signals",
        "missing_attribute_hints",
        "missing_signals",
        mode="before",
    )
    @classmethod
    def normalize_signal_list(cls, values: Any) -> list[str]:
        """Normalize signal lists while preserving first-seen order."""
        return _dedupe_text(_coerce_text_iterable(values))

    @field_validator("intent_groups", mode="before")
    @classmethod
    def normalize_intent_groups(cls, values: Any) -> dict[str, list[str]]:
        """Normalize intent group keys and values for stable prompt context."""
        if not isinstance(values, Mapping):
            return {}

        normalized_groups: dict[str, list[str]] = {}
        for raw_key, raw_values in values.items():
            key = str(raw_key).strip()
            if not key:
                continue

            normalized_values = _dedupe_text(_coerce_text_iterable(raw_values))
            if normalized_values:
                normalized_groups[key] = normalized_values

        return normalized_groups


class LayerScoreResult(BaseModel):
    """Aggregated score for one GEO layer with transparent component math."""

    model_config = ConfigDict(populate_by_name=True)

    layer: GeoScoreLayer
    components: list[ScoreComponentResult] = Field(min_length=1)
    recommended_next_action: str | None = Field(
        default=None,
        alias="recommendedNextAction",
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    @computed_field
    @property
    def score(self) -> float:
        """Return layer score as a 0-100 percentage."""
        return score_percent_from_points(self.weighted_points, self.max_weighted_points)

    @computed_field(alias="maxScore")
    @property
    def max_score(self) -> float:
        """Return the fixed percentage denominator used by public contracts."""
        return DEFAULT_LAYER_MAX_SCORE

    @computed_field(alias="weightedPoints")
    @property
    def weighted_points(self) -> float:
        """Return earned points from this layer's weighted budget."""
        return _round_points(sum(component.points for component in self.components))

    @computed_field(alias="maxWeightedPoints")
    @property
    def max_weighted_points(self) -> float:
        """Return this layer's agreed contribution to the 100-point score."""
        return get_layer_max_weighted_points(self.layer)

    @computed_field
    @property
    def reasons(self) -> list[str]:
        """Return deduplicated reasons from all layer components."""
        return _dedupe_text(
            reason
            for component in self.components
            for reason in component.reasons
        )

    @computed_field(alias="missingSignals")
    @property
    def missing_signals(self) -> list[str]:
        """Return deduplicated missing signals from all layer components."""
        return _dedupe_text(
            signal
            for component in self.components
            for signal in component.missing_signals
        )

    @computed_field(alias="deterministicPoints")
    @property
    def deterministic_points(self) -> float:
        """Return points earned by deterministic checks."""
        return self._sum_component_points("deterministic")

    @computed_field(alias="deterministicMaxPoints")
    @property
    def deterministic_max_points(self) -> float:
        """Return deterministic component budget."""
        return self._sum_component_max_points("deterministic")

    @computed_field(alias="semanticPoints")
    @property
    def semantic_points(self) -> float:
        """Return points earned by Gemini semantic judgment."""
        return self._sum_component_points("semantic")

    @computed_field(alias="semanticMaxPoints")
    @property
    def semantic_max_points(self) -> float:
        """Return semantic component budget."""
        return self._sum_component_max_points("semantic")

    @field_validator("recommended_next_action")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional user-facing guidance text."""
        return _clean_optional_text(value)

    @model_validator(mode="after")
    def validate_layer_components(self) -> "LayerScoreResult":
        """Ensure every layer follows the agreed component rubric."""
        expected_components = LAYER_COMPONENT_MAX_POINTS[self.layer]
        expected_names = set(expected_components)
        provided_names = [component.name for component in self.components]
        provided_name_set = set(provided_names)

        duplicate_names = _find_duplicates(provided_names)
        if duplicate_names:
            raise ValueError(
                f"{self.layer} has duplicate components: {', '.join(duplicate_names)}"
            )

        unknown_names = sorted(provided_name_set - expected_names)
        if unknown_names:
            raise ValueError(
                f"{self.layer} has unknown components: {', '.join(unknown_names)}"
            )

        missing_names = sorted(expected_names - provided_name_set)
        if missing_names:
            raise ValueError(
                f"{self.layer} is missing components: {', '.join(missing_names)}"
            )

        for component in self.components:
            expected_max_points = expected_components[component.name]
            if not _points_close(component.max_points, expected_max_points):
                raise ValueError(
                    f"{self.layer}.{component.name} maxPoints must be {expected_max_points}"
                )

            expected_kind: ScoreComponentKind = (
                "semantic" if component.name == SEMANTIC_COMPONENT_NAME else "deterministic"
            )
            if component.kind != expected_kind:
                raise ValueError(
                    f"{self.layer}.{component.name} kind must be {expected_kind}"
                )

        component_budget = _round_points(
            sum(component.max_points for component in self.components)
        )
        expected_budget = self.max_weighted_points
        if not _points_close(component_budget, expected_budget):
            raise ValueError(
                f"{self.layer} component maxPoints must sum to {expected_budget}"
            )

        component_kinds = {component.kind for component in self.components}
        if "deterministic" not in component_kinds:
            raise ValueError("layer score must include at least one deterministic component")
        if "semantic" not in component_kinds:
            raise ValueError("layer score must include at least one semantic component")

        return self

    def to_api_layer_score(self) -> LayerScore:
        """Convert this engine score into the public API LayerScore contract."""
        return LayerScore(
            score=self.score,
            maxScore=self.max_score,
            weightedPoints=self.weighted_points,
            maxWeightedPoints=self.max_weighted_points,
            reasons=self.reasons,
            missingSignals=self.missing_signals,
            recommendedNextAction=self.recommended_next_action,
        )

    def _sum_component_points(self, kind: ScoreComponentKind) -> float:
        return _round_points(
            sum(component.points for component in self.components if component.kind == kind)
        )

    def _sum_component_max_points(self, kind: ScoreComponentKind) -> float:
        return _round_points(
            sum(component.max_points for component in self.components if component.kind == kind)
        )


class FourLayerGeoScore(BaseModel):
    """Complete four-layer GEO score before conversion to the API contract."""

    model_config = ConfigDict(populate_by_name=True)

    retrieval: LayerScoreResult
    machine_understanding: LayerScoreResult = Field(alias="machineUnderstanding")
    reranking_strength: LayerScoreResult = Field(alias="rerankingStrength")
    ai_answer_readiness: LayerScoreResult = Field(alias="aiAnswerReadiness")
    detected_category: str | None = Field(default=None, alias="detectedCategory")
    buyer_intent_variants: list[str] = Field(default_factory=list, alias="buyerIntentVariants")
    known_facts: dict[str, Any] = Field(default_factory=dict, alias="knownFacts")
    missing_facts: list[str] = Field(default_factory=list, alias="missingFacts")
    main_problems: list[str] = Field(default_factory=list, alias="mainProblems")
    recommended_action: str = Field(
        default="Improve the weakest GEO layer first.",
        alias="recommendedAction",
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    @computed_field(alias="overallScore")
    @property
    def overall_score(self) -> float:
        """Return the summed weighted score across all four layers."""
        return _round_points(sum(layer.weighted_points for layer in self.ordered_layers()))

    @field_validator("detected_category")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional category text."""
        return _clean_optional_text(value)

    @field_validator("recommended_action")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Reject blank top-level guidance text."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("recommendedAction cannot be blank")
        return normalized

    @field_validator("buyer_intent_variants", "missing_facts", "main_problems", mode="before")
    @classmethod
    def normalize_text_list(cls, values: Any) -> list[str]:
        """Normalize top-level explanation lists."""
        return _dedupe_text(_coerce_text_iterable(values))

    @model_validator(mode="after")
    def validate_layer_identity(self) -> "FourLayerGeoScore":
        """Keep each layer result in its matching aggregate slot."""
        expected_layers: dict[str, GeoScoreLayer] = {
            "retrieval": "retrieval",
            "machine_understanding": "machine_understanding",
            "reranking_strength": "reranking_strength",
            "ai_answer_readiness": "ai_answer_readiness",
        }
        for field_name, expected_layer in expected_layers.items():
            layer_result = getattr(self, field_name)
            if layer_result.layer != expected_layer:
                raise ValueError(f"{field_name} must contain a {expected_layer} result")

        total_budget = _round_points(
            sum(layer.max_weighted_points for layer in self.ordered_layers())
        )
        if not _points_close(total_budget, OVERALL_MAX_WEIGHTED_POINTS):
            raise ValueError("layer maxWeightedPoints must sum to 100")

        return self

    def ordered_layers(self) -> list[LayerScoreResult]:
        """Return layer results in the public rubric order."""
        return [
            self.retrieval,
            self.machine_understanding,
            self.reranking_strength,
            self.ai_answer_readiness,
        ]

    def to_score_breakdown(self) -> ScoreBreakdown:
        """Convert layer results into the public API ScoreBreakdown contract."""
        return ScoreBreakdown(
            retrieval=self.retrieval.to_api_layer_score(),
            machineUnderstanding=self.machine_understanding.to_api_layer_score(),
            rerankingStrength=self.reranking_strength.to_api_layer_score(),
            aiAnswerReadiness=self.ai_answer_readiness.to_api_layer_score(),
        )

    def to_analysis_output(self) -> GeoAnalysisOutput:
        """Convert the full scoring result into the public GeoAnalysisOutput contract."""
        return GeoAnalysisOutput(
            overallScore=self.overall_score,
            scores=self.to_score_breakdown(),
            detectedCategory=self.detected_category,
            buyerIntentVariants=self.buyer_intent_variants,
            knownFacts=self.known_facts,
            missingFacts=self.missing_facts,
            mainProblems=self.main_problems,
            recommendedAction=self.recommended_action,
        )


def get_layer_max_weighted_points(layer: GeoScoreLayer) -> float:
    """Return the agreed weighted-point budget for a GEO score layer."""
    return LAYER_MAX_WEIGHTED_POINTS[layer]


def score_percent_from_points(points: float, max_points: float) -> float:
    """Convert point math into a bounded 0-100 score percentage."""
    if max_points <= 0:
        raise ValueError("max_points must be greater than zero")
    return _round_points(min(max((points / max_points) * 100.0, 0.0), 100.0))


def weighted_points_from_percent(score: float, max_points: float) -> float:
    """Convert a 0-100 score percentage into weighted layer points."""
    if max_points <= 0:
        raise ValueError("max_points must be greater than zero")
    bounded_score = min(max(float(score), 0.0), 100.0)
    return _round_points((bounded_score / 100.0) * max_points)


def _points_close(left: float, right: float) -> bool:
    return abs(_round_points(left) - _round_points(right)) <= POINT_TOLERANCE


def _round_points(value: float) -> float:
    return round(float(value), SCORE_DECIMAL_PLACES)


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _coerce_text_iterable(values: Any) -> Iterable[str | None]:
    if values is None:
        return ()
    if isinstance(values, str):
        return (values,)
    if isinstance(values, Iterable):
        return (str(value) for value in values if value is not None)
    return (str(values),)


def _dedupe_text(values: Iterable[str | None]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []

    for value in values:
        if value is None:
            continue

        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        deduped.append(normalized)

    return deduped


def _find_duplicates(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    duplicates: list[str] = []

    for value in values:
        if value in seen and value not in duplicates:
            duplicates.append(value)
        seen.add(value)

    return duplicates


__all__ = [
    "DEFAULT_LAYER_MAX_SCORE",
    "EXPECTED_LAYER_ORDER",
    "FourLayerGeoScore",
    "GeminiLayerJudgment",
    "GeoScoreLayer",
    "LAYER_DISPLAY_NAMES",
    "LAYER_MAX_WEIGHTED_POINTS",
    "LayerScoreResult",
    "LayerScoringConfig",
    "OVERALL_MAX_WEIGHTED_POINTS",
    "POINT_TOLERANCE",
    "SCORE_DECIMAL_PLACES",
    "ScoreComponentKind",
    "ScoreComponentResult",
    "ScoreSignalSource",
    "TurkishNlpScoringSignals",
    "get_layer_max_weighted_points",
    "score_percent_from_points",
    "weighted_points_from_percent",
]
