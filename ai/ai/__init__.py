# ai/ai/__init__.py
"""Allows ai.* imports when Python is launched from inside the ai folder."""

from __future__ import annotations

from pathlib import Path


_AI_ROOT = Path(__file__).resolve().parents[1]

__path__ = [str(_AI_ROOT)]
