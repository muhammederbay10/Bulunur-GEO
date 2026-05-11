# ai/llm/skill_loader.py
"""Loads markdown skill playbooks for Gemini-powered agent nodes."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SKILL_FILE_NAME = "SKILL.md"
DEFAULT_SKILLS_ROOT = Path(__file__).resolve().parents[1] / "skills"


class SkillLoaderError(Exception):
    """Base error for skill loading failures."""


class SkillNotFoundError(SkillLoaderError, FileNotFoundError):
    """Raised when a requested skill cannot be found."""


class AmbiguousSkillError(SkillLoaderError, ValueError):
    """Raised when a skill name matches more than one markdown skill."""


@dataclass(frozen=True)
class SkillDocument:
    """A loaded markdown skill and its filesystem metadata."""

    name: str
    path: Path
    content: str
    title: str | None = None

    @property
    def relative_name(self) -> str:
        """Return the skill path relative to the default skills folder when possible."""
        try:
            return self.path.parent.relative_to(DEFAULT_SKILLS_ROOT).as_posix()
        except ValueError:
            return self.path.parent.name


def load_skill(skill: str | Path, skills_root: str | Path | None = None) -> SkillDocument:
    """Load a SKILL.md file by explicit path, relative path, folder path, or skill name."""
    root = _resolve_skills_root(skills_root)
    skill_path = _resolve_skill_path(skill, root)
    content = _read_skill_file(skill_path)

    return SkillDocument(
        name=skill_path.parent.name,
        path=skill_path,
        content=content,
        title=_extract_title(content),
    )


def load_skill_content(skill: str | Path, skills_root: str | Path | None = None) -> str:
    """Load only the markdown content for a skill."""
    return load_skill(skill, skills_root=skills_root).content


def list_skill_paths(skills_root: str | Path | None = None) -> list[Path]:
    """Return every SKILL.md path under the skills root."""
    root = _resolve_skills_root(skills_root)
    if not root.exists():
        return []

    return sorted(path for path in root.rglob(SKILL_FILE_NAME) if path.is_file())


def list_skills(skills_root: str | Path | None = None) -> list[SkillDocument]:
    """Load and return every available markdown skill."""
    return [load_skill(path, skills_root=skills_root) for path in list_skill_paths(skills_root)]


def build_skill_prompt(
    skill: SkillDocument | str | Path,
    product_data: Any | None = None,
    extra_context: dict[str, Any] | None = None,
    skills_root: str | Path | None = None,
) -> str:
    """Combine a markdown skill with structured JSON context for an LLM call."""
    skill_document = skill if isinstance(skill, SkillDocument) else load_skill(skill, skills_root)
    sections = [skill_document.content.strip()]

    if product_data is not None:
        sections.append("## Structured Product Data\n\n```json\n" + _to_json(product_data) + "\n```")

    if extra_context:
        sections.append("## Extra Context\n\n```json\n" + _to_json(extra_context) + "\n```")

    return "\n\n".join(sections).strip()


def _resolve_skills_root(skills_root: str | Path | None) -> Path:
    return Path(skills_root).resolve() if skills_root is not None else DEFAULT_SKILLS_ROOT


def _resolve_skill_path(skill: str | Path, skills_root: Path) -> Path:
    raw_path = Path(skill)

    if raw_path.is_absolute():
        return _normalize_explicit_skill_path(raw_path)

    candidate = skills_root / raw_path
    if candidate.exists():
        return _normalize_explicit_skill_path(candidate)

    if raw_path.suffix.lower() == ".md":
        raise SkillNotFoundError(f"Skill file does not exist: {candidate}")

    return _find_skill_by_name(str(skill), skills_root)


def _normalize_explicit_skill_path(path: Path) -> Path:
    resolved = path.resolve()
    if resolved.is_dir():
        resolved = resolved / SKILL_FILE_NAME

    if resolved.name != SKILL_FILE_NAME:
        raise SkillNotFoundError(f"Expected a {SKILL_FILE_NAME} file or containing folder: {path}")

    if not resolved.exists():
        raise SkillNotFoundError(f"Skill file does not exist: {resolved}")

    return resolved


def _find_skill_by_name(skill_name: str, skills_root: Path) -> Path:
    normalized_query = _normalize_name(skill_name)
    matches: list[Path] = []

    for path in list_skill_paths(skills_root):
        content = _read_skill_file(path)
        aliases = {
            _normalize_name(path.parent.name),
            _normalize_name(path.parent.relative_to(skills_root).as_posix()),
        }

        title = _extract_title(content)
        if title:
            aliases.add(_normalize_name(title))
            aliases.add(_normalize_name(re.sub(r"\bskill\b", "", title, flags=re.IGNORECASE)))

        if normalized_query in aliases:
            matches.append(path)

    if not matches:
        raise SkillNotFoundError(f"No skill named '{skill_name}' was found under {skills_root}.")

    if len(matches) > 1:
        joined = ", ".join(str(path) for path in matches)
        raise AmbiguousSkillError(f"Skill name '{skill_name}' matched multiple files: {joined}")

    return matches[0]


def _read_skill_file(path: Path) -> str:
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise SkillLoaderError(f"Skill file must be UTF-8 encoded: {path}") from exc

    if not content.strip():
        raise SkillLoaderError(f"Skill file is empty: {path}")

    return content


def _extract_title(content: str) -> str | None:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip() or None
    return None


def _normalize_name(value: str) -> str:
    normalized = value.casefold().replace("\\", "/")
    normalized = re.sub(r"[_\s]+", "-", normalized)
    normalized = re.sub(r"[^a-z0-9ğüşöçıİ/-]+", "", normalized)
    normalized = re.sub(r"-+", "-", normalized)
    return normalized.strip("-/")


def _to_json(value: Any) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")

    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
