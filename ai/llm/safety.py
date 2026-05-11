# ai/llm/safety.py
"""Wraps LLM calls with clear errors for local development and demos."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from ai.llm.structured_outputs import StructuredOutputError

T = TypeVar("T")

DEFAULT_OPERATION = "llm_call"

CONFIG_ERROR_MARKERS = (
    "api key",
    "apikey",
    "credential",
    "credentials",
    "environment variable",
    "google_api_key",
    "google api key",
    "model=",
    "no default model",
)

RETRYABLE_ERROR_MARKERS = (
    "429",
    "500",
    "502",
    "503",
    "504",
    "deadline",
    "temporarily unavailable",
    "timeout",
    "timed out",
    "rate limit",
    "resource exhausted",
    "service unavailable",
)


class LLMError(RuntimeError):
    """Base error for safe LLM call failures."""

    def __init__(
        self,
        message: str,
        *,
        operation: str = DEFAULT_OPERATION,
        retryable: bool = False,
        original_error: BaseException | None = None,
    ) -> None:
        super().__init__(message)
        self.operation = operation
        self.retryable = retryable
        self.original_error = original_error


class LLMConfigurationError(LLMError):
    """Raised when local Gemini configuration is missing or invalid."""


class LLMProviderError(LLMError):
    """Raised when Gemini or LangChain fails during a provider call."""


class LLMOutputError(LLMError):
    """Raised when Gemini returns malformed or schema-invalid output."""


@dataclass(frozen=True)
class SafeLLMResult(Generic[T]):
    """Non-throwing result for agent nodes that prefer explicit error state."""

    ok: bool
    operation: str
    value: T | None = None
    error: str | None = None
    error_type: str | None = None
    retryable: bool = False

    def unwrap(self) -> T:
        """Return the value or raise an LLMError built from the captured failure."""
        if self.ok:
            return self.value  # type: ignore[return-value]

        raise LLMError(
            self.error or "LLM call failed.",
            operation=self.operation,
            retryable=self.retryable,
        )


def invoke_with_safety(
    llm: Any,
    prompt: Any,
    *,
    operation: str = DEFAULT_OPERATION,
    **invoke_kwargs: Any,
) -> Any:
    """Call a LangChain LLM and raise normalized LLMError failures."""
    try:
        return llm.invoke(prompt, **invoke_kwargs)
    except Exception as exc:
        raise normalize_llm_error(exc, operation=operation) from exc


async def ainvoke_with_safety(
    llm: Any,
    prompt: Any,
    *,
    operation: str = DEFAULT_OPERATION,
    **invoke_kwargs: Any,
) -> Any:
    """Call an async LangChain LLM and raise normalized LLMError failures."""
    try:
        return await llm.ainvoke(prompt, **invoke_kwargs)
    except Exception as exc:
        raise normalize_llm_error(exc, operation=operation) from exc


def run_with_safety(
    func: Callable[..., T],
    *args: Any,
    operation: str = DEFAULT_OPERATION,
    **kwargs: Any,
) -> T:
    """Run any sync LLM helper and normalize provider or parsing failures."""
    try:
        return func(*args, **kwargs)
    except Exception as exc:
        raise normalize_llm_error(exc, operation=operation) from exc


async def arun_with_safety(
    func: Callable[..., Awaitable[T]],
    *args: Any,
    operation: str = DEFAULT_OPERATION,
    **kwargs: Any,
) -> T:
    """Run any async LLM helper and normalize provider or parsing failures."""
    try:
        return await func(*args, **kwargs)
    except Exception as exc:
        raise normalize_llm_error(exc, operation=operation) from exc


def safe_result(
    func: Callable[..., T],
    *args: Any,
    operation: str = DEFAULT_OPERATION,
    **kwargs: Any,
) -> SafeLLMResult[T]:
    """Run a sync LLM helper and return an explicit success or failure object."""
    try:
        return SafeLLMResult(ok=True, operation=operation, value=func(*args, **kwargs))
    except Exception as exc:
        normalized = normalize_llm_error(exc, operation=operation)
        return _error_result(normalized)


async def asafe_result(
    func: Callable[..., Awaitable[T]],
    *args: Any,
    operation: str = DEFAULT_OPERATION,
    **kwargs: Any,
) -> SafeLLMResult[T]:
    """Run an async LLM helper and return an explicit success or failure object."""
    try:
        return SafeLLMResult(ok=True, operation=operation, value=await func(*args, **kwargs))
    except Exception as exc:
        normalized = normalize_llm_error(exc, operation=operation)
        return _error_result(normalized)


def normalize_llm_error(
    error: BaseException,
    *,
    operation: str = DEFAULT_OPERATION,
) -> LLMError:
    """Convert arbitrary LangChain/Gemini/parser errors into local error types."""
    if isinstance(error, LLMError):
        return error

    message = str(error).strip() or error.__class__.__name__

    if isinstance(error, StructuredOutputError):
        return LLMOutputError(
            f"{operation} returned unusable structured output: {message}",
            operation=operation,
            retryable=False,
            original_error=error,
        )

    if _looks_like_config_error(message):
        return LLMConfigurationError(
            f"{operation} is not configured correctly: {message}",
            operation=operation,
            retryable=False,
            original_error=error,
        )

    return LLMProviderError(
        f"{operation} failed while calling Gemini: {message}",
        operation=operation,
        retryable=_looks_retryable(message),
        original_error=error,
    )


def _error_result(error: LLMError) -> SafeLLMResult[Any]:
    return SafeLLMResult(
        ok=False,
        operation=error.operation,
        error=str(error),
        error_type=error.__class__.__name__,
        retryable=error.retryable,
    )


def _looks_like_config_error(message: str) -> bool:
    normalized = message.casefold()
    return any(marker in normalized for marker in CONFIG_ERROR_MARKERS)


def _looks_retryable(message: str) -> bool:
    normalized = message.casefold()
    return any(marker in normalized for marker in RETRYABLE_ERROR_MARKERS)
