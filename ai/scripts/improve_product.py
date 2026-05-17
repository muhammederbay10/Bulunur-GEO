# ai/scripts/improve_product.py
"""Runs local GEO optimization from product and analysis JSON files."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Mapping, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

# Ensure `ai.*` imports work regardless of where the script is launched from.
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ai.agents.optimization import improve_product
from ai.api_contracts.geo_analysis_output import GeoAnalysisOutput
from ai.api_contracts.product_input import ProductInput
from ai.geo_engine.constants import EXPECTED_LAYER_ORDER
from ai.schema_engine.schema_mapping import normalize_availability


EXAMPLES_DIR = REPO_ROOT / "ai" / "examples"
OUTPUT_DIR = REPO_ROOT / "ai" / "tests" / "output"
MAX_INTERACTIVE_FACT_ROUNDS = 3


def main(argv: Sequence[str] | None = None) -> int:
    """Run local improvement generation and save output JSON."""
    args = _parse_args(argv)
    product_path = _resolve_product_path(args.product)
    if product_path is None:
        print("Selection cancelled.")
        return 1

    analysis_path = _resolve_analysis_path(args.analysis, product_path)
    if analysis_path is None:
        print("No analysis output was selected.")
        return 1

    try:
        product_input = _load_product_input(product_path)
        analysis_output = _load_analysis_output(analysis_path)
        user_facts = _parse_user_facts(args.user_fact)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Input could not be loaded: {exc}")
        return 1

    metadata = _workflow_metadata(
        analysis_output,
        live_gemini=not args.offline_demo,
        force_generation=args.force_generation,
    )

    try:
        output = _run_improvement_with_interactive_questions(
            product_input,
            analysis_output,
            user_facts=user_facts,
            metadata=metadata,
        )
    except Exception as exc:
        print(f"Improvement failed: {exc}")
        return 1

    output_path = _build_output_path(args.output_dir, product_path.stem)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output.model_dump(mode="json", by_alias=True), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Product input: {product_path.name}")
    print(f"Analysis input: {analysis_path.name}")
    print(f"Saved output: {output_path}")
    print(f"Selected strategies: {', '.join(strategy.name for strategy in output.selected_strategies) or 'none'}")
    if output.needs_user_input:
        print("Needs user input:")
        for question in output.needs_user_input:
            print(f"- {question.field}: {question.question}")
    elif output.score_estimate is not None:
        print(f"Estimated score: {output.score_estimate.before} -> {output.score_estimate.after}")
    print(f"Validation passed: {output.validation.passed}")
    return 0


def _run_improvement_with_interactive_questions(
    product_input: ProductInput,
    analysis_output: GeoAnalysisOutput,
    *,
    user_facts: dict[str, Any],
    metadata: dict[str, Any],
) -> Any:
    """Run improvement and ask terminal questions when user facts are needed."""
    confirmed_facts = dict(user_facts)
    output = improve_product(
        product_input,
        analysis_output,
        user_facts=confirmed_facts,
        metadata=metadata,
    )

    for round_index in range(1, MAX_INTERACTIVE_FACT_ROUNDS + 1):
        if not output.needs_user_input:
            return output

        print()
        print(f"Missing facts required before safe generation (round {round_index}):")
        added_facts = _ask_user_fact_questions(output.needs_user_input, confirmed_facts)
        if not added_facts:
            print("No new facts were provided, so the question-first output will be saved.")
            return output

        confirmed_facts = _deep_merge_facts(confirmed_facts, added_facts)
        output = improve_product(
            product_input,
            analysis_output,
            user_facts=confirmed_facts,
            metadata=metadata,
        )

    if output.needs_user_input:
        print()
        print("Some facts are still missing after the interactive rounds; saving current output.")
    return output


def _ask_user_fact_questions(
    questions: Sequence[Any],
    existing_facts: Mapping[str, Any],
) -> dict[str, Any]:
    """Ask missing-fact questions in the terminal and return confirmed answers."""
    answers: dict[str, Any] = {}
    for question in questions:
        if _has_fact(existing_facts, question.field):
            continue

        print(f"- {question.field}: {question.question}")
        print(f"  Why: {question.reason}")
        raw_answer = input("  Answer (leave blank if unknown): ").strip()
        if not raw_answer:
            continue
        _set_answer_fact(answers, question.field, raw_answer)
    return answers


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Bulunur GEO improvement flow for a local product example.",
    )
    parser.add_argument(
        "--product",
        type=Path,
        help="Path to a ProductInput JSON file. If omitted, choose interactively.",
    )
    parser.add_argument(
        "--analysis",
        type=Path,
        help="Path to a GeoAnalysisOutput JSON file. If omitted, latest matching output is used or selected interactively.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help=f"Directory for saved improvement output JSON. Default: {OUTPUT_DIR}",
    )
    parser.add_argument(
        "--user-fact",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="User-confirmed fact. Dot paths create nested facts, e.g. attributes.usageArea=Mutfak.",
    )
    parser.add_argument(
        "--offline-demo",
        action="store_true",
        help="Use quick local demo generators instead of real Gemini calls.",
    )
    parser.add_argument(
        "--force-generation",
        action="store_true",
        help="Generate even when high-impact user fact questions are pending.",
    )
    return parser.parse_args(argv)


def _resolve_product_path(path: Path | None) -> Path | None:
    if path is not None:
        return _resolve_existing_path(path)

    example_files = _list_json_files(EXAMPLES_DIR)
    if not example_files:
        raise ValueError(f"No product examples found in {EXAMPLES_DIR}")

    print("Select a product example to improve:")
    for index, example in enumerate(example_files, start=1):
        print(f"{index}. {example.name}")
    return _select_file(example_files)


def _resolve_analysis_path(path: Path | None, product_path: Path) -> Path | None:
    if path is not None:
        return _resolve_existing_path(path)

    latest_match = _latest_matching_analysis(product_path.stem)
    if latest_match is not None:
        return latest_match

    analysis_files = _list_json_files(OUTPUT_DIR, pattern="*_analysis_*.json")
    if not analysis_files:
        raise ValueError(
            f"No saved analysis outputs found in {OUTPUT_DIR}. Run ai.scripts.analyze_product first."
        )

    print("Select an analysis output to use:")
    for index, analysis in enumerate(analysis_files, start=1):
        print(f"{index}. {analysis.name}")
    return _select_file(analysis_files)


def _latest_matching_analysis(product_stem: str) -> Path | None:
    candidates = _list_json_files(OUTPUT_DIR, pattern=f"{product_stem}_analysis_*.json")
    return candidates[-1] if candidates else None


def _resolve_existing_path(path: Path) -> Path:
    resolved = path if path.is_absolute() else REPO_ROOT / path
    if not resolved.exists():
        raise ValueError(f"File does not exist: {resolved}")
    if not resolved.is_file():
        raise ValueError(f"Path is not a file: {resolved}")
    return resolved


def _list_json_files(directory: Path, *, pattern: str = "*.json") -> list[Path]:
    return sorted(path for path in directory.glob(pattern) if path.is_file())


def _select_file(files: list[Path]) -> Path | None:
    while True:
        raw = input("Enter number (or 'q' to quit): ").strip().lower()
        if raw in {"q", "quit", "exit"}:
            return None
        if not raw.isdigit():
            print("Please enter a valid number.")
            continue
        selected_index = int(raw)
        if selected_index < 1 or selected_index > len(files):
            print(f"Choose a number between 1 and {len(files)}.")
            continue
        return files[selected_index - 1]


def _load_product_input(path: Path) -> ProductInput:
    return ProductInput.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _load_analysis_output(path: Path) -> GeoAnalysisOutput:
    return GeoAnalysisOutput.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _parse_user_facts(values: Sequence[str]) -> dict[str, Any]:
    facts: dict[str, Any] = {}
    for value in values:
        if "=" not in value:
            raise ValueError(f"User fact must use KEY=VALUE format: {value}")
        key, raw_fact_value = value.split("=", maxsplit=1)
        key = key.strip()
        fact_value = raw_fact_value.strip()
        if not key or not fact_value:
            raise ValueError(f"User fact key and value cannot be blank: {value}")
        _set_nested_fact(facts, key.split("."), fact_value)
    return facts


def _set_nested_fact(target: dict[str, Any], path: Sequence[str], value: str) -> None:
    current = target
    for raw_part in path[:-1]:
        part = raw_part.strip()
        if not part:
            raise ValueError("User fact path cannot include blank segments.")
        nested = current.setdefault(part, {})
        if not isinstance(nested, dict):
            raise ValueError(f"Cannot nest user fact under scalar key: {part}")
        current = nested

    leaf = path[-1].strip()
    if not leaf:
        raise ValueError("User fact path cannot include blank segments.")
    current[leaf] = value


def _set_answer_fact(target: dict[str, Any], field: str, value: str) -> None:
    """Store a terminal answer with field-specific normalization when useful."""
    if field == "availability":
        normalized = normalize_availability(value)
        if normalized is not None:
            _set_nested_fact(target, ("availability",), normalized)
            _set_nested_fact(target, ("availabilityText",), value)
            return
    _set_nested_fact(target, field.split("."), value)


def _has_fact(source: Mapping[str, Any], dotted_path: str) -> bool:
    """Return whether a nested fact already has a non-empty value."""
    current: Any = source
    for raw_part in dotted_path.split("."):
        part = raw_part.strip()
        if not part or not isinstance(current, Mapping) or part not in current:
            return False
        current = current[part]
    return current is not None and str(current).strip() != ""


def _deep_merge_facts(
    left: Mapping[str, Any],
    right: Mapping[str, Any],
) -> dict[str, Any]:
    """Merge nested user facts without dropping sibling values."""
    merged = dict(left)
    for key, value in right.items():
        if isinstance(value, Mapping) and isinstance(merged.get(key), Mapping):
            merged[key] = _deep_merge_facts(merged[key], value)
        else:
            merged[key] = value
    return merged


def _workflow_metadata(
    analysis: GeoAnalysisOutput,
    *,
    live_gemini: bool,
    force_generation: bool,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "semanticJudgments": _semantic_judgments_from_analysis(analysis, boost=12.0),
        "beforeSemanticJudgments": _semantic_judgments_from_analysis(analysis, boost=0.0),
        "useSemanticValidation": live_gemini,
        "forceGenerationWithMissingFacts": force_generation,
    }
    if not live_gemini:
        metadata["rewriteGenerator"] = _offline_rewrite_generator
        metadata["faqGenerator"] = _offline_faq_generator
    return metadata


def _semantic_judgments_from_analysis(
    analysis: GeoAnalysisOutput,
    *,
    boost: float,
) -> dict[str, dict[str, Any]]:
    scores = {
        "retrieval": analysis.scores.retrieval.score,
        "machine_understanding": analysis.scores.machine_understanding.score,
        "reranking_strength": analysis.scores.reranking_strength.score,
        "ai_answer_readiness": analysis.scores.ai_answer_readiness.score,
    }
    return {
        layer: {
            "layer": layer,
            "semanticScore": min(max(score + boost, 0.0), 90.0),
            "reasons": [f"CLI semantic estimate for {layer}."],
            "missingSignals": [],
            "recommendedNextAction": "Yerel CLI demo tahmini; canli Gemini yargisi degildir.",
            "confidence": 0.5,
            "metadata": {"cliEstimate": True},
        }
        for layer, score in scores.items()
        if layer in EXPECTED_LAYER_ORDER
    }


def _offline_rewrite_generator(context: dict[str, Any]) -> dict[str, Any]:
    known_facts = context.get("knownFacts", {})
    title = _fact_text(known_facts, "title") or _fact_text(context.get("product", {}), "title")
    description = _fact_text(known_facts, "description") or _fact_text(known_facts, "shortDescription")
    intent = _first_text(context.get("buyerIntentVariants")) or "Turkce alici niyeti"
    improved_title = f"{title} - {intent.title()}" if title else None
    short_description = description or (f"{title} icin dogrulanmis urun bilgilerine dayali aciklama." if title else None)
    long_description = (
        f"{title}, yalnizca dogrulanmis urun bilgileri kullanilarak daha net anlatilir. "
        f"Desteklenmeyen ticari veya teknik iddia eklenmemistir."
        if title
        else None
    )
    return {
        "improvedTitle": improved_title,
        "improvedShortDescription": short_description,
        "improvedLongDescription": long_description,
        "preservedFacts": _known_fact_strings(known_facts)[:6],
        "blockedByMissingFacts": list(context.get("missingFacts", []))[:6],
        "recommendedNextAction": "Eksik gercekler dogrulanirsa metni canli Gemini ile tekrar zenginlestirin.",
    }


def _offline_faq_generator(context: dict[str, Any]) -> dict[str, Any]:
    known_facts = context.get("knownFacts", {})
    title = _fact_text(known_facts, "title") or _fact_text(context.get("product", {}), "title")
    source_fact = _first_attribute_value(known_facts) or _fact_text(known_facts, "description")
    if not title or not source_fact:
        return {
            "faqItems": [],
            "blockedQuestions": ["FAQ icin yeterli dogrulanmis urun gercegi yok."],
            "missingFactsToAnswerBetter": list(context.get("missingFacts", []))[:6],
        }
    return {
        "faqItems": [
            {
                "question": "Bu urun ne icin kullanilir?",
                "answer": f"{title}, {source_fact} bilgisiyle aciklanan bir urundur.",
                "sourceFacts": [title, source_fact],
            }
        ],
        "blockedQuestions": [],
        "missingFactsToAnswerBetter": list(context.get("missingFacts", []))[:6],
        "recommendedNextAction": "Daha fazla urun gercegi dogrulanirsa FAQ genisletilebilir.",
    }


def _fact_text(source: Mapping[str, Any], key: str) -> str | None:
    value = source.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _first_attribute_value(source: Mapping[str, Any]) -> str | None:
    attributes = source.get("attributes")
    if not isinstance(attributes, Mapping):
        return None
    for value in attributes.values():
        text = str(value).strip()
        if text:
            return text
    return None


def _first_text(values: Any) -> str | None:
    if isinstance(values, Sequence) and not isinstance(values, (str, bytes, bytearray)):
        for value in values:
            text = str(value).strip()
            if text:
                return text
    if isinstance(values, str) and values.strip():
        return values.strip()
    return None


def _known_fact_strings(source: Mapping[str, Any]) -> list[str]:
    facts: list[str] = []
    for value in source.values():
        if isinstance(value, Mapping):
            facts.extend(_known_fact_strings(value))
        elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            facts.extend(str(item).strip() for item in value if str(item).strip())
        else:
            text = str(value).strip()
            if text:
                facts.append(text)
    return _dedupe_text(facts)


def _dedupe_text(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


def _build_output_path(output_dir: Path, stem: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return output_dir / f"{stem}_improvement_{timestamp}.json"


if __name__ == "__main__":
    raise SystemExit(main())
