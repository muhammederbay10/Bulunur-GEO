# ai/geo_engine/improvement/validate_improvement.py
"""Validates generated improvement content against trusted product facts."""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ai.api_contracts.geo_improvement_output import (
    GeneratedFaqItem,
    GeneratedProductContent,
    ImprovementValidation,
)
from ai.api_contracts.product_input import ProductInput
from ai.llm.gemini_client import get_gemini_llm
from ai.llm.safety import LLMError, invoke_with_safety
from ai.llm.skill_loader import build_skill_prompt
from ai.llm.structured_outputs import StructuredOutputError, parse_structured_output
from ai.schema_engine.schema_mapping import is_known_value, normalize_price
from ai.schema_engine.validate_schema import validate_schema
from ai.turkish_nlp.normalize import normalize_for_matching


TrustedFactSource = Literal["product", "trusted", "user_confirmed"]
ValidationSeverity = Literal["warning", "error"]
SemanticValidationStatus = Literal["pass", "needs_revision"]
SemanticValidator = Callable[[dict[str, Any]], Any]

SEMANTIC_VALIDATION_SKILL_PATH = "optimization/anti_hallucination_validation"

MONEY_RE = re.compile(
    r"(?:₺\s*)?\d+(?:[.,]\d+)?\s*(?:tl|try|türk lirası|turk lirasi|₺)",
    re.IGNORECASE,
)
MEASUREMENT_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:litre|lt|ml|cm|mm|metre|m|kg|gr|g|w|watt|mah|derece|adet|parça|parca)\b",
    re.IGNORECASE,
)
COUNT_RE = re.compile(r"\b(\d+(?:[.,]\d+)?)\s*adet\b", re.IGNORECASE)
DURATION_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:yıl|yil|ay|gün|gun)\b",
    re.IGNORECASE,
)
GROUNDING_TOKEN_RE = re.compile(r"[\wçğıöşüÇĞİÖŞÜ]+", re.UNICODE)

PROTECTED_CLAIM_PHRASES: tuple[tuple[str, str], ...] = (
    ("free_shipping", "ücretsiz kargo"),
    ("free_shipping", "ucretsiz kargo"),
    ("free_shipping", "bedava kargo"),
    ("same_day_shipping", "aynı gün kargo"),
    ("same_day_shipping", "ayni gun kargo"),
    ("same_day_shipping", "aynı gün teslimat"),
    ("same_day_shipping", "ayni gun teslimat"),
    ("warranty", "garanti"),
    ("certification", "sertifika"),
    ("certification", "sertifikalı"),
    ("certification", "sertifikali"),
    ("organic", "organik"),
    ("dishwasher_safe", "bulaşık makinesi"),
    ("dishwasher_safe", "bulasik makinesi"),
    ("dishwasher_safe", "dishwasher"),
    ("original", "orijinal"),
)
NEGATED_FACT_MARKERS: tuple[str, ...] = (
    "belirtilmedi",
    "belirtilmemis",
    "verilmedi",
    "verilmemis",
    "yok",
    "degil",
    "bulunmuyor",
    "mevcut degil",
)
GROUNDING_HELPER_WORDS: frozenset[str] = frozenset(
    {
        "amac",
        "amaci",
        "amaciyla",
        "bilgi",
        "bilgisi",
        "icerik",
        "icerigi",
        "karisim",
        "karisimi",
        "koleksiyon",
        "koleksiyonu",
        "kullanim",
        "kullanimi",
        "ozellik",
        "ozelligi",
        "urun",
        "urunu",
        "urunun",
    }
)


class TrustedFact(BaseModel):
    """One trusted fact leaf available to improvement validation."""

    model_config = ConfigDict(populate_by_name=True)

    path: str = Field(min_length=1)
    value: Any
    normalized_value: str = Field(alias="normalizedValue", min_length=1)
    source: TrustedFactSource


class ValidationIssue(BaseModel):
    """Structured validation issue for generated improvement content."""

    model_config = ConfigDict(populate_by_name=True)

    severity: ValidationSeverity
    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    field: str = Field(min_length=1)
    value: str | None = None
    trusted_paths: list[str] = Field(default_factory=list, alias="trustedPaths")
    suggestion: str | None = None
    deterministic: bool = True

    @field_validator("code", "message", "field", "value", "suggestion")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize issue text fields."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("trusted_paths", mode="before")
    @classmethod
    def normalize_trusted_paths(cls, values: Any) -> list[str]:
        """Normalize trusted fact path lists."""
        return _dedupe_text(_coerce_text_values(values))


class ImprovementValidationResult(BaseModel):
    """Deterministic validation result with structured issue details."""

    model_config = ConfigDict(populate_by_name=True)

    passed: bool = True
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    issues: list[ValidationIssue] = Field(default_factory=list)
    trusted_facts: list[TrustedFact] = Field(default_factory=list, alias="trustedFacts")

    @model_validator(mode="after")
    def sync_passed_state(self) -> "ImprovementValidationResult":
        """Keep summary fields aligned with structured issues."""
        self.errors = _dedupe_text(
            [*self.errors, *(issue.message for issue in self.issues if issue.severity == "error")]
        )
        self.warnings = _dedupe_text(
            [*self.warnings, *(issue.message for issue in self.issues if issue.severity == "warning")]
        )
        self.passed = not self.errors
        return self

    def to_api_validation(self) -> ImprovementValidation:
        """Return the public improvement validation contract."""
        return ImprovementValidation(
            passed=self.passed,
            warnings=self.warnings,
            errors=self.errors,
        )


class SemanticClaimIssue(BaseModel):
    """One semantic validation claim issue returned by Gemini."""

    model_config = ConfigDict(populate_by_name=True)

    claim: str = Field(min_length=1)
    location: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    fix_suggestion: str | None = Field(default=None, alias="fixSuggestion")

    @field_validator("claim", "location", "reason", "fix_suggestion")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        """Normalize semantic issue text."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SemanticImprovementValidationJudgment(BaseModel):
    """Structured semantic validation returned by the anti-hallucination skill."""

    model_config = ConfigDict(populate_by_name=True)

    validation_status: SemanticValidationStatus = Field(alias="validationStatus")
    supported_claims: list[str] = Field(default_factory=list, alias="supportedClaims")
    unsupported_claims: list[SemanticClaimIssue] = Field(default_factory=list, alias="unsupportedClaims")
    uncertain_claims: list[SemanticClaimIssue] = Field(default_factory=list, alias="uncertainClaims")
    naturalness_warnings: list[str] = Field(default_factory=list, alias="naturalnessWarnings")
    keyword_stuffing_warnings: list[str] = Field(default_factory=list, alias="keywordStuffingWarnings")
    recommended_safe_next_action: str | None = Field(default=None, alias="recommendedSafeNextAction")

    @field_validator(
        "supported_claims",
        "naturalness_warnings",
        "keyword_stuffing_warnings",
        mode="before",
    )
    @classmethod
    def normalize_text_list(cls, values: Any) -> list[str]:
        """Normalize semantic validation string lists."""
        return _dedupe_text(_coerce_text_values(values))

    @field_validator("recommended_safe_next_action")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional semantic next action."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


def validate_improvement(
    generated: GeneratedProductContent | Mapping[str, Any],
    *,
    product: ProductInput | Mapping[str, Any] | None = None,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
    use_semantic_validation: bool = False,
    semantic_validator: SemanticValidator | None = None,
    llm: Any | None = None,
) -> ImprovementValidationResult:
    """Validate generated content against trusted and user-confirmed facts."""
    generated_content = _coerce_generated_content(generated)
    fact_index = _build_fact_index(
        product=product,
        trusted_facts=trusted_facts,
        user_confirmed_facts=user_confirmed_facts,
    )

    issues: list[ValidationIssue] = []
    issues.extend(_validate_declared_fact_grounding(generated_content, fact_index))
    issues.extend(_validate_protected_claims(generated_content, fact_index))
    issues.extend(_validate_generated_schema(generated_content))
    if use_semantic_validation or semantic_validator is not None:
        issues.extend(
            _validate_semantically(
                generated_content,
                product=product,
                fact_index=fact_index,
                semantic_validator=semantic_validator,
                llm=llm,
            )
        )

    return ImprovementValidationResult(
        issues=_dedupe_issues(issues),
        trustedFacts=list(fact_index.values()),
    )


def validate_trusted_fact_usage(
    generated: GeneratedProductContent | Mapping[str, Any],
    *,
    product: ProductInput | Mapping[str, Any] | None = None,
    trusted_facts: Mapping[str, Any] | None = None,
    user_confirmed_facts: Mapping[str, Any] | None = None,
    use_semantic_validation: bool = False,
    semantic_validator: SemanticValidator | None = None,
    llm: Any | None = None,
) -> ImprovementValidationResult:
    """Validate that generated improvement facts are supported by trusted facts."""
    return validate_improvement(
        generated,
        product=product,
        trusted_facts=trusted_facts,
        user_confirmed_facts=user_confirmed_facts,
        use_semantic_validation=use_semantic_validation,
        semantic_validator=semantic_validator,
        llm=llm,
    )


def _validate_declared_fact_grounding(
    generated: GeneratedProductContent,
    fact_index: Mapping[str, TrustedFact],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    for index, faq_item in enumerate(generated.faq):
        field = f"faq[{index}].groundedIn"
        if not faq_item.grounded_in:
            issues.append(
                _issue(
                    code="faq_missing_grounding",
                    message=f"FAQ cevabı doğrulanmış ürün gerçeğine bağlanmamış: {faq_item.question}",
                    field=field,
                    value=faq_item.question,
                    suggestion="FAQ cevabını çıkarılan veya kullanıcı tarafından doğrulanan ürün bilgilerine bağlayın.",
                )
            )
            continue

        for source_fact in faq_item.grounded_in:
            if _is_supported_by_trusted_facts(source_fact, fact_index):
                continue
            issues.append(
                _issue(
                    code="untrusted_grounding_reference",
                    message=f"FAQ dayanağı doğrulanmış ürün bilgilerinde yok: {source_fact}",
                    field=field,
                    value=source_fact,
                    trusted_paths=_supporting_paths(source_fact, fact_index),
                    suggestion="FAQ maddesini kaldırın veya bu bilgiyi kullanıcıya doğrulatın.",
                )
            )

    return issues


def _validate_protected_claims(
    generated: GeneratedProductContent,
    fact_index: Mapping[str, TrustedFact],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    known_prices = _known_prices(fact_index)

    for field, text in _generated_text_fields(generated):
        for claim in _protected_claims(text):
            if claim.kind == "money" and _money_claim_supported(claim.value, known_prices):
                continue
            if _is_supported_by_trusted_facts(claim.value, fact_index):
                continue

            issues.append(
                _issue(
                    code="unsupported_trusted_fact_claim",
                    message=f"Üretilen içerikte doğrulanmamış bir iddia var: {claim.value}",
                    field=field,
                    value=claim.value,
                    trusted_paths=_supporting_paths(claim.value, fact_index),
                    suggestion="Bu iddiayı kaldırın veya üretimden önce kullanıcı tarafından doğrulanmış bilgi olarak ekleyin.",
                )
            )

    return issues


def _validate_generated_schema(generated: GeneratedProductContent) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not generated.schema_json_ld:
        return issues

    schema_result = validate_schema(generated.schema_json_ld)
    for schema_issue in schema_result.issues:
        severity: ValidationSeverity = "error" if schema_issue.severity == "error" else "warning"
        issues.append(
            ValidationIssue(
                severity=severity,
                code=f"schema_{schema_issue.code}",
                message=f"Üretilen schema çıktısında sorun var: {schema_issue.message}",
                field=f"schemaJsonLd.{schema_issue.field or schema_issue.path or '$'}",
                value=str(schema_issue.value) if schema_issue.value is not None else None,
                suggestion=schema_issue.suggestion,
                deterministic=True,
            )
        )

    return issues


def _validate_semantically(
    generated: GeneratedProductContent,
    *,
    product: ProductInput | Mapping[str, Any] | None,
    fact_index: Mapping[str, TrustedFact],
    semantic_validator: SemanticValidator | None,
    llm: Any | None,
) -> list[ValidationIssue]:
    context = _semantic_validation_context(generated, product=product, fact_index=fact_index)
    try:
        judgment = _run_semantic_validation(
            context,
            semantic_validator=semantic_validator,
            llm=llm,
        )
    except LLMError as exc:
        return [
            ValidationIssue(
                severity="error",
                code="semantic_validation_unavailable",
                message=f"Semantik doğrulama çalıştırılamadı: {exc}",
                field="semanticValidation",
                suggestion="Yayınlamadan önce Gemini ile semantik doğrulamayı tekrar çalıştırın.",
            )
        ]
    except Exception as exc:
        return [
            ValidationIssue(
                severity="error",
                code="semantic_validation_unavailable",
                message=f"Semantik doğrulama çıktısı okunamadı: {exc}",
                field="semanticValidation",
                suggestion="Yayınlamadan önce Gemini ile semantik doğrulamayı tekrar çalıştırın.",
            )
        ]

    return _semantic_judgment_issues(judgment, fact_index)


def _run_semantic_validation(
    context: dict[str, Any],
    *,
    semantic_validator: SemanticValidator | None,
    llm: Any | None,
) -> SemanticImprovementValidationJudgment:
    if semantic_validator is not None:
        raw_output = semantic_validator(context)
        if isinstance(raw_output, SemanticImprovementValidationJudgment):
            return raw_output
        return SemanticImprovementValidationJudgment.model_validate(raw_output)

    resolved_llm = llm or get_gemini_llm(json_mode=True)
    prompt = build_skill_prompt(
        SEMANTIC_VALIDATION_SKILL_PATH,
        product_data=context.get("product"),
        extra_context=context,
    )
    response = invoke_with_safety(
        resolved_llm,
        prompt,
        operation="improvement_semantic_validation",
    )
    try:
        return parse_structured_output(response, SemanticImprovementValidationJudgment)
    except StructuredOutputError:
        retry_response = invoke_with_safety(
            resolved_llm,
            _strict_json_retry_prompt(prompt),
            operation="improvement_semantic_validation_retry",
        )
        return parse_structured_output(retry_response, SemanticImprovementValidationJudgment)


def _semantic_judgment_issues(
    judgment: SemanticImprovementValidationJudgment,
    fact_index: Mapping[str, TrustedFact],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for claim in judgment.unsupported_claims:
        severity = _semantic_unsupported_claim_severity(claim, fact_index)
        issues.append(
            ValidationIssue(
                severity=severity,
                code="semantic_unsupported_claim",
                message=_semantic_unsupported_claim_message(claim.claim, severity),
                field=claim.location,
                value=claim.claim,
                suggestion=claim.fix_suggestion or judgment.recommended_safe_next_action,
            )
        )

    for claim in judgment.uncertain_claims:
        issues.append(
            ValidationIssue(
                severity="warning",
                code="semantic_uncertain_claim",
                message=f"Semantik doğrulama bu iddiayı kesin doğrulayamadı: {claim.claim}",
                field=claim.location,
                value=claim.claim,
                suggestion=claim.fix_suggestion or judgment.recommended_safe_next_action,
            )
        )

    for warning in judgment.naturalness_warnings:
        issues.append(
            ValidationIssue(
                severity="warning",
                code="semantic_naturalness_warning",
                message=f"Semantik doğrulama doğal Türkçe uyarısı verdi: {warning}",
                field="generatedContent",
                value=warning,
                suggestion=judgment.recommended_safe_next_action,
            )
        )

    for warning in judgment.keyword_stuffing_warnings:
        issues.append(
            ValidationIssue(
                severity="warning",
                code="semantic_keyword_stuffing_warning",
                message=f"Semantik doğrulama anahtar kelime tekrarı uyarısı verdi: {warning}",
                field="generatedContent",
                value=warning,
                suggestion=judgment.recommended_safe_next_action,
            )
        )

    return issues


def _semantic_unsupported_claim_severity(
    claim: SemanticClaimIssue,
    fact_index: Mapping[str, TrustedFact],
) -> ValidationSeverity:
    """Downgrade source/user-confirmed conflicts to warnings."""
    if _is_supported_by_trusted_facts(claim.claim, fact_index):
        return "warning"
    return "error"


def _semantic_unsupported_claim_message(claim: str, severity: ValidationSeverity) -> str:
    """Return a user-facing semantic validation message."""
    if severity == "warning":
        return f"Semantik doğrulama kaynak veya kullanıcı bilgisiyle çelişebilecek bir uyarı buldu: {claim}"
    return f"Semantik doğrulama desteklenmeyen bir iddia buldu: {claim}"


def _semantic_validation_context(
    generated: GeneratedProductContent,
    *,
    product: ProductInput | Mapping[str, Any] | None,
    fact_index: Mapping[str, TrustedFact],
) -> dict[str, Any]:
    return {
        "product": _semantic_product_context(product),
        "knownFacts": [
            fact.model_dump(mode="json", by_alias=True)
            for fact in fact_index.values()
        ],
        "generated": generated.model_dump(mode="json", by_alias=True),
        "semanticValidationFocus": {
            "detectUnsupportedClaims": True,
            "validateFaqAnswerGrounding": True,
            "detectKeywordStuffing": True,
            "detectUnnaturalTurkish": True,
            "returnJsonOnly": True,
            "extraExpectedJsonFields": [
                "naturalnessWarnings",
                "keywordStuffingWarnings",
            ],
        },
    }


def _semantic_product_context(product: ProductInput | Mapping[str, Any] | None) -> dict[str, Any]:
    if product is None:
        return {}
    if isinstance(product, ProductInput):
        return product.model_dump(mode="json", by_alias=True)
    return dict(product)


class _Claim(BaseModel):
    kind: str
    value: str


def _protected_claims(text: str | None) -> list[_Claim]:
    if not text:
        return []

    claims: list[_Claim] = []
    for match in MONEY_RE.finditer(text):
        claims.append(_Claim(kind="money", value=match.group(0)))
    for match in MEASUREMENT_RE.finditer(text):
        claims.append(_Claim(kind="measurement", value=match.group(0)))

    normalized = normalize_for_matching(text)
    for code, phrase in PROTECTED_CLAIM_PHRASES:
        normalized_phrase = normalize_for_matching(phrase)
        if f" {normalized_phrase} " in f" {normalized} ":
            claims.append(_Claim(kind=code, value=phrase))

    if "garanti" in normalized:
        for match in DURATION_RE.finditer(text):
            claims.append(_Claim(kind="warranty_duration", value=match.group(0)))

    return _dedupe_claims(claims)


def _money_claim_supported(claim: str, known_prices: set[str]) -> bool:
    normalized_claim = normalize_price(claim)
    return normalized_claim is not None and normalized_claim in known_prices


def _known_prices(fact_index: Mapping[str, TrustedFact]) -> set[str]:
    prices: set[str] = set()
    for fact in fact_index.values():
        path = normalize_for_matching(fact.path)
        if "price" not in path and "fiyat" not in path:
            continue
        normalized_price = normalize_price(fact.value)
        if normalized_price is not None:
            prices.add(normalized_price)
    return prices


def _generated_text_fields(generated: GeneratedProductContent) -> Iterable[tuple[str, str | None]]:
    yield "title", generated.title
    yield "shortDescription", generated.short_description
    yield "longDescription", generated.long_description
    yield "seoTitle", generated.seo_title
    yield "metaDescription", generated.meta_description
    yield "aiAnswerPreview", generated.ai_answer_preview
    for index, faq_item in enumerate(generated.faq):
        yield f"faq[{index}].question", faq_item.question
        yield f"faq[{index}].answer", faq_item.answer


def _build_fact_index(
    *,
    product: ProductInput | Mapping[str, Any] | None,
    trusted_facts: Mapping[str, Any] | None,
    user_confirmed_facts: Mapping[str, Any] | None,
) -> dict[str, TrustedFact]:
    facts: dict[str, TrustedFact] = {}
    for source_name, source_value in (
        ("product", _product_to_facts(product)),
        ("trusted", trusted_facts or {}),
        ("user_confirmed", user_confirmed_facts or {}),
    ):
        _add_facts(
            facts,
            source=source_name,  # type: ignore[arg-type]
            path_prefix="",
            value=source_value,
        )
    return facts


def _add_facts(
    facts: dict[str, TrustedFact],
    *,
    source: TrustedFactSource,
    path_prefix: str,
    value: Any,
) -> None:
    if not _is_trusted_value(value):
        return

    if isinstance(value, Mapping):
        for key, item in value.items():
            child_path = f"{path_prefix}.{key}" if path_prefix else str(key)
            _add_facts(facts, source=source, path_prefix=child_path, value=item)
        return

    if _is_sequence(value):
        for index, item in enumerate(value):
            child_path = f"{path_prefix}[{index}]"
            _add_facts(facts, source=source, path_prefix=child_path, value=item)
        return

    normalized_value = normalize_for_matching(str(value))
    if not path_prefix or not normalized_value:
        return

    facts[path_prefix] = TrustedFact(
        path=path_prefix,
        value=value,
        normalizedValue=normalized_value,
        source=source,
    )


def _product_to_facts(product: ProductInput | Mapping[str, Any] | None) -> Mapping[str, Any]:
    if product is None:
        return {}
    if isinstance(product, ProductInput):
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
            "attributes": dict(product.attributes),
            "rawExtracted": product.raw_extracted.model_dump(by_alias=True),
        }
    return product


def _is_supported_by_trusted_facts(value: str, fact_index: Mapping[str, TrustedFact]) -> bool:
    normalized = normalize_for_matching(value)
    if not normalized:
        return False

    for fact in fact_index.values():
        fact_text = _fact_support_text(fact)
        if f" {normalized} " in f" {fact_text} ":
            if _fact_negates_claim(fact.value, normalized):
                continue
            return True

    if _count_claim_supported(normalized, fact_index):
        return True

    return _is_supported_by_trusted_fact_terms(normalized, fact_index)


def _count_claim_supported(
    normalized: str,
    fact_index: Mapping[str, TrustedFact],
) -> bool:
    """Allow count wording like '24 adet' when a count fact states the same number."""
    match = COUNT_RE.search(normalized)
    if match is None:
        return False

    number = match.group(1).replace(",", ".")
    for fact in fact_index.values():
        fact_text = _fact_support_text(fact)
        if f" {number} " not in f" {fact_text} ":
            continue
        if any(keyword in fact_text for keyword in ("adet", "sayisi", "miktar", "parca", "quantity", "count")):
            return True
    return False


def _is_supported_by_trusted_fact_terms(
    normalized: str,
    fact_index: Mapping[str, TrustedFact],
) -> bool:
    if _requires_exact_grounding(normalized):
        return False

    tokens = _meaningful_grounding_tokens(normalized)
    if not tokens:
        return False

    support_text = normalize_for_matching(
        " ".join(_fact_support_text(fact) for fact in fact_index.values())
    )
    if not support_text:
        return False

    return all(f" {token} " in f" {support_text} " for token in tokens)


def _requires_exact_grounding(normalized: str) -> bool:
    """Return whether a claim is too sensitive for flexible token grounding."""
    if MONEY_RE.search(normalized) or MEASUREMENT_RE.search(normalized) or DURATION_RE.search(normalized):
        return True

    return any(
        f" {normalize_for_matching(phrase)} " in f" {normalized} "
        for _, phrase in PROTECTED_CLAIM_PHRASES
    )


def _meaningful_grounding_tokens(value: str) -> list[str]:
    tokens = [
        token
        for token in GROUNDING_TOKEN_RE.findall(normalize_for_matching(value))
        if (len(token) > 2 or token.isdigit()) and token not in GROUNDING_HELPER_WORDS
    ]
    return _dedupe_text(tokens)


def _fact_support_text(fact: TrustedFact) -> str:
    path_text = normalize_for_matching(fact.path.replace(".", " "))
    path_alias_text = " ".join(_fact_path_aliases(path_text))
    if isinstance(fact.value, bool):
        return f"{path_text} {path_alias_text}".strip() if fact.value else ""
    return f"{path_text} {path_alias_text} {fact.normalized_value}"


def _fact_path_aliases(path_text: str) -> list[str]:
    aliases: list[str] = []
    if "warranty" in path_text or "garanti" in path_text:
        aliases.append("garanti")
    if "shipping" in path_text or "kargo" in path_text:
        aliases.append("kargo")
    if "certification" in path_text or "certificate" in path_text:
        aliases.append("sertifika")
    if "organic" in path_text:
        aliases.append("organik")
    if "dishwasher" in path_text:
        aliases.append("bulasik makinesi")
    return aliases


def _fact_negates_claim(value: Any, normalized_claim: str) -> bool:
    normalized_value = normalize_for_matching(str(value))
    if normalized_claim not in normalized_value:
        return False
    return any(
        f"{normalized_claim} {marker}" in normalized_value
        for marker in NEGATED_FACT_MARKERS
    )


def _strict_json_retry_prompt(original_prompt: str) -> str:
    """Ask Gemini to retry with only the required JSON object."""
    return (
        f"{original_prompt}\n\n"
        "Önceki cevap geçerli JSON olarak okunamadı. "
        "Şimdi yalnızca tek bir geçerli JSON objesi döndür. "
        "Markdown, açıklama, code fence veya JSON dışında metin yazma. "
        "Zorunlu alanlar: validationStatus, supportedClaims, unsupportedClaims, "
        "uncertainClaims, naturalnessWarnings, keywordStuffingWarnings, "
        "recommendedSafeNextAction."
    )


def _supporting_paths(value: str, fact_index: Mapping[str, TrustedFact]) -> list[str]:
    normalized = normalize_for_matching(value)
    if not normalized:
        return []

    paths: list[str] = []
    for fact in fact_index.values():
        fact_text = _fact_support_text(fact)
        if normalized in fact_text or fact.normalized_value in normalized:
            paths.append(fact.path)
            continue
        tokens = _meaningful_grounding_tokens(normalized)
        if tokens and all(f" {token} " in f" {fact_text} " for token in tokens):
            paths.append(fact.path)
    return _dedupe_text(paths)


def _issue(
    *,
    code: str,
    message: str,
    field: str,
    value: str | None = None,
    trusted_paths: Sequence[str] | None = None,
    suggestion: str | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        severity="error",
        code=code,
        message=message,
        field=field,
        value=value,
        trustedPaths=list(trusted_paths or ()),
        suggestion=suggestion,
    )


def _coerce_generated_content(
    generated: GeneratedProductContent | Mapping[str, Any],
) -> GeneratedProductContent:
    if isinstance(generated, GeneratedProductContent):
        return generated
    return GeneratedProductContent.model_validate(generated)


def _is_trusted_value(value: Any) -> bool:
    if value is False:
        return False
    return is_known_value(value)


def _is_sequence(value: Any) -> bool:
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))


def _coerce_text_values(values: Any) -> tuple[str, ...]:
    if values is None:
        return ()
    if isinstance(values, str):
        return (values,)
    if isinstance(values, Sequence):
        return tuple(str(value) for value in values if value is not None)
    return (str(values),)


def _dedupe_text(values: Iterable[Any]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for raw_value in values:
        value = str(raw_value).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


def _dedupe_claims(claims: Sequence[_Claim]) -> list[_Claim]:
    seen: set[tuple[str, str]] = set()
    deduped: list[_Claim] = []
    for claim in claims:
        key = (claim.kind, normalize_for_matching(claim.value))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(claim)
    return deduped


def _dedupe_issues(issues: Sequence[ValidationIssue]) -> list[ValidationIssue]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[ValidationIssue] = []
    for issue in issues:
        key = (issue.code, issue.field, issue.value or issue.message)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(issue)
    return deduped


__all__ = [
    "ImprovementValidationResult",
    "SemanticClaimIssue",
    "SemanticImprovementValidationJudgment",
    "SemanticValidator",
    "TrustedFact",
    "ValidationIssue",
    "validate_improvement",
    "validate_trusted_fact_usage",
]
