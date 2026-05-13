# ai/scripts/analyze_product.py
"""Runs local GEO analysis from example payloads and saves output JSON."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

# Ensure `ai.*` imports work regardless of where the script is launched from.
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ai.agents.analysis import analyze_product
from ai.api_contracts.product_input import ProductInput

EXAMPLES_DIR = REPO_ROOT / "ai" / "examples"
OUTPUT_DIR = REPO_ROOT / "ai" / "tests" / "output"


def main() -> int:
    """Run interactive example selection, analysis, and output save."""
    example_files = _list_example_files(EXAMPLES_DIR)
    if not example_files:
        print(f"No example JSON files found in: {EXAMPLES_DIR}")
        return 1

    print("Select an example file to analyze:")
    for index, path in enumerate(example_files, start=1):
        print(f"{index}. {path.name}")

    selected = _select_example_file(example_files)
    if selected is None:
        print("Selection cancelled.")
        return 1

    try:
        product_input = _load_product_input(selected)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Failed to load product input: {exc}")
        return 1

    try:
        output = analyze_product(product_input)
    except Exception as exc:
        print(f"Analysis failed: {exc}")
        return 1

    output_path = _build_output_path(OUTPUT_DIR, selected.stem)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output.model_dump(mode="json", by_alias=True), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Analyzed input: {selected.name}")
    print(f"Saved output: {output_path}")
    print(f"Overall score: {output.overall_score}")
    return 0


def _list_example_files(directory: Path) -> list[Path]:
    return sorted(
        [
            path
            for path in directory.glob("*.json")
            if path.is_file()
        ]
    )


def _select_example_file(files: list[Path]) -> Path | None:
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
    payload = json.loads(path.read_text(encoding="utf-8"))
    return ProductInput.model_validate(payload)


def _build_output_path(output_dir: Path, stem: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return output_dir / f"{stem}_analysis_{timestamp}.json"


if __name__ == "__main__":
    raise SystemExit(main())
