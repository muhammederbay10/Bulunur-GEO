# ai/api_contracts/user_fact_questions.py
"""Defines targeted user questions for missing product facts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


QuestionTarget = Literal[
    "title",
    "description",
    "short_description",
    "faq",
    "schema",
    "attributes",
    "trust_signals",
    "comparison_readiness",
]
QuestionInputType = Literal["text", "select"]


class UserFactOption(BaseModel):
    """Selectable option for user-confirmed facts."""

    value: str = Field(min_length=1)
    label: str = Field(min_length=1)


class UserFactQuestion(BaseModel):
    """Question the backend should ask before final improvement generation."""

    model_config = ConfigDict(populate_by_name=True)

    field: str = Field(min_length=1)
    question: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    required_for: list[QuestionTarget] = Field(alias="requiredFor", min_length=1)
    input_type: QuestionInputType = Field(default="text", alias="inputType")
    options: list[UserFactOption] = Field(default_factory=list)

    @field_validator("field")
    @classmethod
    def normalize_field(cls, value: str) -> str:
        """Normalize fact keys so user_facts can be matched reliably."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("field cannot be blank")
        return normalized

    @field_validator("question", "reason")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Reject blank user-facing text."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("text fields cannot be blank")
        return normalized
