# ai/llm/structured_outputs.py
"""Parses and validates structured JSON returned by LLM calls."""

from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

JsonValue = dict[str, Any] | list[Any] | str | int | float | bool | None
ModelT = TypeVar("ModelT", bound=BaseModel)

CODE_FENCE_PATTERN = re.compile(
    r"```(?:json|JSON)?\s*(?P<json>.*?)\s*```",
    re.DOTALL,
)


class StructuredOutputError(Exception):
    """Base error for structured LLM output parsing failures."""


class MalformedJSONError(StructuredOutputError, ValueError):
    """Raised when LLM output does not contain valid JSON."""


class StructuredOutputValidationError(StructuredOutputError, ValueError):
    """Raised when valid JSON does not match the expected Pydantic model."""

    def __init__(self, message: str, validation_error: ValidationError) -> None:
        super().__init__(message)
        self.validation_error = validation_error


def parse_json_response(raw_output: Any) -> JsonValue:
    """Parse a JSON value from a raw LLM response."""
    if isinstance(raw_output, (dict, list)):
        return raw_output

    text = extract_text(raw_output).strip()
    if not text:
        raise MalformedJSONError("LLM response was empty; expected JSON output.")

    for candidate in _json_candidates(text):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    raise MalformedJSONError("LLM response did not contain valid JSON.")


def parse_json_object(raw_output: Any) -> dict[str, Any]:
    """Parse a JSON object from a raw LLM response."""
    parsed = parse_json_response(raw_output)
    if not isinstance(parsed, dict):
        raise MalformedJSONError("LLM response must be a JSON object.")
    return parsed


def parse_structured_output(raw_output: Any, model: type[ModelT]) -> ModelT:
    """Parse LLM JSON output and validate it against a Pydantic model."""
    parsed = parse_json_response(raw_output)

    try:
        return model.model_validate(parsed)
    except ValidationError as exc:
        raise StructuredOutputValidationError(
            f"LLM JSON did not match {model.__name__}.",
            exc,
        ) from exc


def parse_structured_list(raw_output: Any, model: type[ModelT]) -> list[ModelT]:
    """Parse a JSON array and validate each item against a Pydantic model."""
    parsed = parse_json_response(raw_output)
    if not isinstance(parsed, list):
        raise MalformedJSONError("LLM response must be a JSON array.")

    items: list[ModelT] = []
    errors: list[ValidationError] = []
    for item in parsed:
        try:
            items.append(model.model_validate(item))
        except ValidationError as exc:
            errors.append(exc)

    if errors:
        raise StructuredOutputValidationError(
            f"LLM JSON list contained items that did not match {model.__name__}.",
            errors[0],
        )

    return items


def extract_text(raw_output: Any) -> str:
    """Extract text from common LangChain response shapes."""
    if isinstance(raw_output, str):
        return raw_output

    if hasattr(raw_output, "content"):
        return _content_to_text(raw_output.content)

    if isinstance(raw_output, dict):
        for key in ("content", "text", "output", "response"):
            if key in raw_output:
                return _content_to_text(raw_output[key])

    return str(raw_output)


def json_schema_for_model(model: type[BaseModel]) -> dict[str, Any]:
    """Return a JSON schema dictionary for prompt or LangChain configuration."""
    return model.model_json_schema(by_alias=True)


def json_schema_text(model: type[BaseModel]) -> str:
    """Return a pretty JSON schema string for the expected output model."""
    return json.dumps(json_schema_for_model(model), ensure_ascii=False, indent=2)


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                value = part.get("text") or part.get("content")
                if value is not None:
                    parts.append(str(value))
        return "\n".join(parts)

    return str(content)


def _json_candidates(text: str) -> list[str]:
    candidates: list[str] = []

    stripped = text.strip()
    if stripped:
        candidates.append(stripped)

    candidates.extend(match.group("json").strip() for match in CODE_FENCE_PATTERN.finditer(text))

    balanced = _extract_balanced_json(text)
    if balanced:
        candidates.append(balanced)

    return _dedupe(candidates)


def _extract_balanced_json(text: str) -> str | None:
    start = _find_json_start(text)
    if start is None:
        return None

    opening = text[start]
    closing = "}" if opening == "{" else "]"
    depth = 0
    in_string = False
    escaped = False

    for index in range(start, len(text)):
        char = text[index]

        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return text[start : index + 1].strip()

    return None


def _find_json_start(text: str) -> int | None:
    object_start = text.find("{")
    array_start = text.find("[")

    if object_start == -1 and array_start == -1:
        return None
    if object_start == -1:
        return array_start
    if array_start == -1:
        return object_start
    return min(object_start, array_start)


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []

    for value in values:
        if value and value not in seen:
            seen.add(value)
            deduped.append(value)

    return deduped
