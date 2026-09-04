"""Server-side AI provider abstraction backed by Groq (OpenAI-compatible).

The chat path talks ONLY to this module. The GROQ_API_KEY lives here and is
never exposed to the browser; the frontend never calls Groq directly.

Groq exposes an OpenAI-compatible endpoint so we call it with httpx (already a
project dependency) and support clean token streaming.
"""
import os
import json
import httpx

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Default to a strong, currently-supported production model on the account.
# Overridable with GROQ_MODEL in the server environment.
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"


class GroqError(Exception):
    """Base error carrying a safe message plus an optional HTTP status."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _headers() -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise GroqError(
            "AI service is not configured. Please contact the administrator.",
            500,
        )
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _model() -> str:
    return os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)


def _build_payload(messages, temperature=0.2, max_tokens=None, stream=False):
    payload = {
        "model": _model(),
        "messages": messages,
        "temperature": temperature,
        "stream": stream,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens
    return payload


def _map_provider_error(status_code: int, body_text: str) -> GroqError:
    """Translate an upstream HTTP error into a safe, actionable message."""
    lower = (body_text or "").lower()
    friendly = "The AI service is temporarily unavailable. Please try again."
    mapped = status_code
    if status_code == 404 or "model_not_found" in lower or "does not exist" in lower:
        friendly = "The AI model is not available. Please check the server configuration (GROQ_MODEL)."
        mapped = 502
    elif status_code == 429 or "rate limit" in lower or "quota" in lower:
        friendly = "The AI service is rate-limited. Please wait a moment and try again."
        mapped = 429
    elif status_code in (401, 403) or "api key" in lower or "invalid" in lower:
        friendly = "The AI service rejected the request. Please check the server configuration."
        mapped = 502
    elif status_code in (400, 422):
        friendly = "The AI service could not process the request. Please rephrase your question."
        mapped = 400
    return GroqError(friendly, mapped)


def generate_codebase_answer(messages, temperature=0.2, max_tokens=None) -> str:
    """Non-streaming completion. Returns the full assistant text.

    Raises GroqError with a safe message on failure.
    """
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                GROQ_API_URL,
                headers=_headers(),
                json=_build_payload(messages, temperature=temperature, max_tokens=max_tokens, stream=False),
            )
    except GroqError:
        raise
    except Exception as e:
        raise GroqError("The AI service could not be reached. Please try again.", 502) from e

    if resp.status_code != 200:
        raise _map_provider_error(resp.status_code, resp.text)

    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return (content or "").strip()
    except (KeyError, IndexError, ValueError) as e:
        raise GroqError("The AI service returned an unexpected response.", 502) from e


def generate_codebase_answer_stream(messages, temperature=0.2, max_tokens=None):
    """Streaming completion. Yields incremental text deltas.

    Raises GroqError with a safe message if the request itself fails (before or
    during streaming). After this generator raises once, no further yields occur.
    """
    try:
        client = httpx.Client(timeout=120.0)
        req = client.build_request(
            "POST",
            GROQ_API_URL,
            headers=_headers(),
            json=_build_payload(messages, temperature=temperature, max_tokens=max_tokens, stream=True),
        )
        resp = client.send(req, stream=True)
    except GroqError:
        raise
    except Exception as e:
        raise GroqError("The AI service could not be reached. Please try again.", 502) from e

    if resp.status_code != 200:
        body = resp.read().decode("utf-8", "replace")
        resp.close()
        client.close()
        raise _map_provider_error(resp.status_code, body)

    try:
        started = False
        for line in resp.iter_lines():
            if not line:
                continue
            if line.startswith("data:"):
                data = line[5:].strip()
            else:
                data = line.strip()
            if data == "[DONE]":
                break
            if not data:
                continue
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue
            started = True
            choices = chunk.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}
            text = delta.get("content")
            if text:
                yield text
        if not started:
            raise GroqError("The AI service returned an empty response.", 502)
    finally:
        resp.close()
        client.close()
